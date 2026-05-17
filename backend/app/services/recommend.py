"""Recommendation engine. Normalize seed → track/artist sets, run the right
similarity engine, project to the requested output type.

The 16 input-by-output combinations all collapse into two engines:
- track-similarity (for song / playlist / album outputs)
- artist-similarity (for artist output; also feeds album-output)

The engine is provider-agnostic: it depends on `mock_provider` directly when
`settings.mock_mode` is True; the live-provider path consumes the same
`Candidate` shape (wired post-PR).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.config import settings
from app.services import mock_provider as mp
from app.services.scoring import (
    Candidate,
    Sliders,
    apply_hard_filters,
    apply_soft_scoring,
    dedupe_by_artist,
    mmr_by_artist,
    why_matched,
)

InputType = Literal["song", "album", "artist", "playlist"]
OutputType = Literal["song", "album", "artist", "playlist"]


@dataclass(frozen=True)
class SeedPayload:
    input_type: InputType
    id: str


@dataclass
class RecommendItem:
    type: OutputType
    id: str
    name: str
    artist_name: str
    image: str | None
    popularity: int
    preview_url: str | None
    open_url: str | None
    why: str
    # Playlist output carries an embedded track list.
    tracks: list[RecommendItem] | None = None


@dataclass
class RecommendResult:
    seed: dict[str, str | int | None]
    items: list[RecommendItem]
    debug: dict[str, str | int | float]


# ----- Seed normalization --------------------------------------------------


@dataclass(frozen=True)
class SeedContext:
    """Normalized seed: a set of tracks and artists, with pivot stats."""

    tracks: tuple[str, ...]  # track ids
    artists: tuple[str, ...]  # artist ids
    pivot_popularity: int | None
    pivot_year: int | None
    seed_name: str
    seed_image: str | None


def _normalize_song(track_id: str) -> SeedContext | None:
    t = mp.track(track_id)
    if not t:
        return None
    alb = mp.album(t.album_id)
    return SeedContext(
        tracks=(t.id,),
        artists=(t.artist_id,),
        pivot_popularity=t.popularity,
        pivot_year=t.year,
        seed_name=t.name,
        seed_image=alb.image if alb else None,
    )


def _normalize_artist(artist_id: str) -> SeedContext | None:
    a = mp.artist(artist_id)
    if not a:
        return None
    tops = mp.top_tracks_for_artist(artist_id, limit=5)
    avg_pop = a.popularity
    pivot_year = tops[0].year if tops else None
    return SeedContext(
        tracks=tuple(t.id for t in tops),
        artists=(a.id,),
        pivot_popularity=avg_pop,
        pivot_year=pivot_year,
        seed_name=a.name,
        seed_image=a.image,
    )


def _normalize_album(album_id: str) -> SeedContext | None:
    alb = mp.album(album_id)
    if not alb:
        return None
    tracks = [mp.track(tid) for tid in alb.track_ids[:5]]
    pivot_pop = max((t.popularity for t in tracks if t), default=None)
    return SeedContext(
        tracks=tuple(alb.track_ids[:5]),
        artists=(alb.artist_id,),
        pivot_popularity=pivot_pop,
        pivot_year=alb.year,
        seed_name=alb.name,
        seed_image=alb.image,
    )


def _normalize_playlist(playlist_id: str) -> SeedContext | None:
    tracks = mp.playlist_tracks(playlist_id)
    if not tracks:
        return None
    artist_ids: list[str] = []
    for t in tracks:
        if t.artist_id not in artist_ids:
            artist_ids.append(t.artist_id)
    avg_pop = sum(t.popularity for t in tracks) // len(tracks)
    avg_year = sum(t.year for t in tracks) // len(tracks)
    cover_alb = mp.album(tracks[0].album_id)
    return SeedContext(
        tracks=tuple(t.id for t in tracks),
        artists=tuple(artist_ids),
        pivot_popularity=avg_pop,
        pivot_year=avg_year,
        seed_name=playlist_id.replace("p-", "").replace("-", " ").title(),
        seed_image=cover_alb.image if cover_alb else None,
    )


def normalize_seed(seed: SeedPayload) -> SeedContext | None:
    if seed.input_type == "song":
        return _normalize_song(seed.id)
    if seed.input_type == "artist":
        return _normalize_artist(seed.id)
    if seed.input_type == "album":
        return _normalize_album(seed.id)
    if seed.input_type == "playlist":
        return _normalize_playlist(seed.id)
    return None


# ----- Engines -------------------------------------------------------------


def _track_to_candidate(t: mp.MockTrack, *, similarity: float) -> Candidate:
    a = mp.artist(t.artist_id)
    alb = mp.album(t.album_id)
    return Candidate(
        id=t.id,
        name=t.name,
        artist_id=t.artist_id,
        artist_name=a.name if a else "",
        popularity=t.popularity,
        year=t.year,
        tags=tuple(t.tags),
        similarity=similarity,
        image=alb.image if alb else None,
        preview_url=t.preview_url,
        album_id=alb.id if alb else None,
        album_name=alb.name if alb else None,
    )


def _artist_to_candidate(a: mp.MockArtist, *, similarity: float) -> Candidate:
    return Candidate(
        id=a.id,
        name=a.name,
        artist_id=a.id,
        artist_name=a.name,
        popularity=a.popularity,
        year=None,
        tags=tuple(a.genres),
        similarity=similarity,
        image=a.image,
    )


def _track_engine(ctx: SeedContext, sliders: Sliders) -> list[Candidate]:
    """Aggregate similar-tracks across seed tracks; weighted by position."""
    weights: list[float] = []
    n = len(ctx.tracks)
    if sliders.seed_weight_curve == "exponential":
        weights = [pow(0.6, i) for i in range(n)]
    else:
        weights = [1.0 - (i / max(1, n)) for i in range(n)]

    aggregate: dict[str, tuple[float, mp.MockTrack]] = {}
    for tid, w in zip(ctx.tracks, weights, strict=False):
        for j, t in enumerate(mp.similar_tracks(tid, limit=30)):
            sim = (1.0 - j / 30.0) * w
            prev = aggregate.get(t.id)
            if prev is None or sim > prev[0]:
                aggregate[t.id] = (sim, t)

    seed_set = set(ctx.tracks)
    candidates = [
        _track_to_candidate(t, similarity=sim)
        for tid, (sim, t) in aggregate.items()
        if tid not in seed_set
    ]
    return candidates


def _artist_engine(ctx: SeedContext, sliders: Sliders) -> list[Candidate]:
    """Aggregate similar-artists across seed artists."""
    n = len(ctx.artists)
    weights = (
        [pow(0.6, i) for i in range(n)]
        if sliders.seed_weight_curve == "exponential"
        else [1.0 - (i / max(1, n)) for i in range(n)]
    )

    aggregate: dict[str, tuple[float, mp.MockArtist]] = {}
    for aid, w in zip(ctx.artists, weights, strict=False):
        for j, a in enumerate(mp.similar_artists(aid)):
            sim = (1.0 - j / 10.0) * w
            prev = aggregate.get(a.id)
            if prev is None or sim > prev[0]:
                aggregate[a.id] = (sim, a)

    seed_set = set(ctx.artists)
    return [
        _artist_to_candidate(a, similarity=sim)
        for aid, (sim, a) in aggregate.items()
        if aid not in seed_set
    ]


# ----- Projection (engine output → recommend items) ------------------------


def _open_url(item_type: str, item_id: str) -> str | None:
    """Mock provider has no Spotify URL; return None so the UI hides the link."""
    return None


def _project_song(c: Candidate, sliders: Sliders, seed_pop: int | None) -> RecommendItem:
    return RecommendItem(
        type="song",
        id=c.id,
        name=c.name,
        artist_name=c.artist_name,
        image=c.image,
        popularity=c.popularity,
        preview_url=c.preview_url,
        open_url=_open_url("track", c.id),
        why=why_matched(c, sliders, seed_popularity=seed_pop),
    )


def _project_artist(c: Candidate, sliders: Sliders, seed_pop: int | None) -> RecommendItem:
    return RecommendItem(
        type="artist",
        id=c.id,
        name=c.name,
        artist_name=c.name,
        image=c.image,
        popularity=c.popularity,
        preview_url=None,
        open_url=_open_url("artist", c.id),
        why=why_matched(c, sliders, seed_popularity=seed_pop),
    )


def _project_album(c: Candidate, sliders: Sliders, seed_pop: int | None) -> RecommendItem | None:
    """For artist candidates: pick their top album. For track candidates: the
    candidate's own album."""
    if c.album_id:
        alb = mp.album(c.album_id)
        if alb:
            return RecommendItem(
                type="album",
                id=alb.id,
                name=alb.name,
                artist_name=c.artist_name,
                image=alb.image,
                popularity=c.popularity,
                preview_url=None,
                open_url=_open_url("album", alb.id),
                why=why_matched(c, sliders, seed_popularity=seed_pop),
            )
    tops = mp.top_tracks_for_artist(c.artist_id, limit=1)
    if not tops:
        return None
    alb = mp.album(tops[0].album_id)
    if not alb:
        return None
    return RecommendItem(
        type="album",
        id=alb.id,
        name=alb.name,
        artist_name=c.artist_name,
        image=alb.image,
        popularity=tops[0].popularity,
        preview_url=None,
        open_url=_open_url("album", alb.id),
        why=why_matched(c, sliders, seed_popularity=seed_pop),
    )


def _project_playlist(
    candidates: list[Candidate],
    sliders: Sliders,
    seed_pop: int | None,
    seed_name: str,
) -> RecommendItem:
    """Bundle the top tracks into a single playlist-shaped result."""
    tracks = [_project_song(c, sliders, seed_pop) for c in candidates]
    cover = next((t.image for t in tracks if t.image), None)
    return RecommendItem(
        type="playlist",
        id=f"generated-{abs(hash(tuple(t.id for t in tracks))) % 10_000_000}",
        name=f"Like {seed_name}",
        artist_name="MusicTailor",
        image=cover,
        popularity=int(sum(t.popularity for t in tracks) / max(1, len(tracks))),
        preview_url=None,
        open_url=None,
        why="Generated from your seed and dials",
        tracks=tracks,
    )


# ----- Top-level entry point ----------------------------------------------


def recommend(
    seed: SeedPayload, output_type: OutputType, sliders: Sliders, *, k: int = 10
) -> RecommendResult:
    ctx = normalize_seed(seed)
    if ctx is None:
        return RecommendResult(
            seed={"id": seed.id, "type": seed.input_type, "name": None},
            items=[],
            debug={"reason": "seed_not_found", "mode": "mock" if settings.mock_mode else "live"},
        )

    # Artist output uses the artist engine; everything else uses the track
    # engine (album output projects via the track's album).
    raw = _artist_engine(ctx, sliders) if output_type == "artist" else _track_engine(ctx, sliders)

    filtered = apply_hard_filters(raw, sliders, seed_artist_ids=ctx.artists)
    scored = apply_soft_scoring(
        filtered,
        sliders,
        seed_popularity=ctx.pivot_popularity,
        seed_year=ctx.pivot_year,
    )

    # Output-type-specific post-processing.
    if output_type in ("artist", "album"):
        scored = dedupe_by_artist(scored)

    diversified = mmr_by_artist(scored, diversity=sliders.diversity, k=max(k, 10))

    items: list[RecommendItem] = []
    if output_type == "song":
        for c in diversified[:k]:
            items.append(_project_song(c, sliders, ctx.pivot_popularity))
    elif output_type == "artist":
        for c in diversified[:k]:
            items.append(_project_artist(c, sliders, ctx.pivot_popularity))
    elif output_type == "album":
        for c in diversified[:k]:
            it = _project_album(c, sliders, ctx.pivot_popularity)
            if it is not None:
                items.append(it)
    elif output_type == "playlist":
        items.append(
            _project_playlist(diversified[:k], sliders, ctx.pivot_popularity, ctx.seed_name)
        )

    return RecommendResult(
        seed={
            "id": seed.id,
            "type": seed.input_type,
            "name": ctx.seed_name,
            "image": ctx.seed_image,
            "popularity": ctx.pivot_popularity,
        },
        items=items,
        debug={
            "mode": "mock" if settings.mock_mode else "live",
            "candidate_count": len(raw),
            "filtered_count": len(filtered),
            "selected_count": len(items),
        },
    )
