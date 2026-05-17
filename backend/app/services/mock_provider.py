"""In-memory fixture provider for credential-free dev / demo.

Activated by `settings.mock_mode` (True when Spotify creds are absent). Exposes
the same surface the recommendation engine consumes — search, fetch by id,
similar-artists, similar-tracks — backed by a hand-curated graph of artists,
albums, tracks, and a synthetic similarity matrix.

Keep the fixture deliberately small: ~30 artists / ~80 tracks / ~25 albums.
Big enough to exercise every output type and the slider math, small enough to
inspect at a glance.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal


@dataclass(frozen=True)
class MockArtist:
    id: str
    name: str
    genres: list[str]
    popularity: int  # 0-100
    image: str  # absolute CDN-style placeholder URL
    related: list[str] = field(default_factory=list)  # related artist ids


@dataclass(frozen=True)
class MockTrack:
    id: str
    name: str
    artist_id: str
    album_id: str
    popularity: int
    duration_ms: int
    year: int
    preview_url: str | None  # 30s mp3, or None
    tags: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class MockAlbum:
    id: str
    name: str
    artist_id: str
    year: int
    image: str
    track_ids: list[str] = field(default_factory=list)


# ----- Curated dataset -----------------------------------------------------
# Cover-art uses placehold.co (deterministic, no external dependency, served
# over HTTPS, looks like real album art in the UI).


def _img(seed: str, color: str = "c9b6e8") -> str:
    return f"https://placehold.co/400x400/{color}/3a2b5c?text={seed}&font=playfair"


def _audio(seed: str) -> str:
    # Public-domain short tones served by a stable CDN. Keep this list small —
    # the goal is to demonstrate the preview-player UX, not curate audio.
    return f"https://cdn.pixabay.com/audio/{seed}.mp3"


_PALETTE = {
    "indie": "c9b6e8",  # lavender
    "electronic": "9fd6c5",  # mint
    "rnb": "f4c4a3",  # peach
    "jazz": "a4c8e8",  # sky
    "rock": "e8b6c9",  # rose
    "ambient": "d4c9e8",  # lilac
    "hiphop": "e8d6a3",  # sand
    "pop": "f4a3c4",  # bubblegum
}


ARTISTS: list[MockArtist] = [
    MockArtist("a-aurora", "Aurora", ["indie", "pop"], 72, _img("Aurora", _PALETTE["indie"])),
    MockArtist(
        "a-tycho", "Tycho", ["electronic", "ambient"], 65, _img("Tycho", _PALETTE["electronic"])
    ),
    MockArtist("a-bonobo", "Bonobo", ["electronic"], 68, _img("Bonobo", _PALETTE["electronic"])),
    MockArtist(
        "a-flyloto",
        "Flying Lotus",
        ["electronic", "hiphop"],
        63,
        _img("FlyLo", _PALETTE["electronic"]),
    ),
    MockArtist(
        "a-radiohead", "Radiohead", ["rock", "indie"], 84, _img("Radiohead", _PALETTE["rock"])
    ),
    MockArtist(
        "a-portishead",
        "Portishead",
        ["electronic", "indie"],
        70,
        _img("Portishead", _PALETTE["ambient"]),
    ),
    MockArtist(
        "a-massive", "Massive Attack", ["electronic"], 71, _img("Massive", _PALETTE["electronic"])
    ),
    MockArtist("a-fkat", "FKA twigs", ["rnb", "electronic"], 67, _img("FKA", _PALETTE["rnb"])),
    MockArtist(
        "a-james", "James Blake", ["electronic", "rnb"], 69, _img("JBlake", _PALETTE["rnb"])
    ),
    MockArtist("a-bjork", "Björk", ["indie", "electronic"], 73, _img("Bjork", _PALETTE["indie"])),
    MockArtist("a-arcade", "Arcade Fire", ["indie", "rock"], 74, _img("Arcade", _PALETTE["rock"])),
    MockArtist("a-mitski", "Mitski", ["indie"], 78, _img("Mitski", _PALETTE["indie"])),
    MockArtist("a-phoebe", "Phoebe Bridgers", ["indie"], 76, _img("Phoebe", _PALETTE["indie"])),
    MockArtist(
        "a-japan", "Japanese Breakfast", ["indie"], 64, _img("JBreakfast", _PALETTE["indie"])
    ),
    MockArtist("a-frank", "Frank Ocean", ["rnb", "hiphop"], 88, _img("Frank", _PALETTE["rnb"])),
    MockArtist("a-solange", "Solange", ["rnb"], 70, _img("Solange", _PALETTE["rnb"])),
    MockArtist("a-blood", "Blood Orange", ["rnb", "indie"], 66, _img("Blood", _PALETTE["rnb"])),
    MockArtist(
        "a-thunder", "Thundercat", ["electronic", "jazz"], 68, _img("TCat", _PALETTE["jazz"])
    ),
    MockArtist("a-kamasi", "Kamasi Washington", ["jazz"], 60, _img("Kamasi", _PALETTE["jazz"])),
    MockArtist("a-robert", "Robert Glasper", ["jazz"], 58, _img("Glasper", _PALETTE["jazz"])),
    MockArtist(
        "a-bcnr", "Black Country, New Road", ["indie", "rock"], 62, _img("BCNR", _PALETTE["rock"])
    ),
    MockArtist(
        "a-fontaines", "Fontaines D.C.", ["rock", "indie"], 67, _img("Fontaines", _PALETTE["rock"])
    ),
    MockArtist("a-king", "King Krule", ["indie", "jazz"], 65, _img("KKrule", _PALETTE["indie"])),
    MockArtist(
        "a-aphex",
        "Aphex Twin",
        ["electronic", "ambient"],
        70,
        _img("Aphex", _PALETTE["electronic"]),
    ),
    MockArtist(
        "a-boards",
        "Boards of Canada",
        ["electronic", "ambient"],
        64,
        _img("BoC", _PALETTE["ambient"]),
    ),
    MockArtist(
        "a-burial", "Burial", ["electronic", "ambient"], 63, _img("Burial", _PALETTE["ambient"])
    ),
    MockArtist(
        "a-fourtet", "Four Tet", ["electronic"], 65, _img("FourTet", _PALETTE["electronic"])
    ),
    MockArtist(
        "a-caroline", "Caroline Polachek", ["pop", "indie"], 71, _img("Caroline", _PALETTE["pop"])
    ),
    MockArtist("a-charli", "Charli XCX", ["pop"], 82, _img("Charli", _PALETTE["pop"])),
    MockArtist("a-sza", "SZA", ["rnb"], 86, _img("SZA", _PALETTE["rnb"])),
]


def _wire_related() -> None:
    """Hand-tune a similarity graph by genre overlap + curated affinities."""
    by_genre: dict[str, list[str]] = {}
    for a in ARTISTS:
        for g in a.genres:
            by_genre.setdefault(g, []).append(a.id)

    related_map: dict[str, list[str]] = {}
    for a in ARTISTS:
        scores: dict[str, int] = {}
        for g in a.genres:
            for other_id in by_genre[g]:
                if other_id == a.id:
                    continue
                scores[other_id] = scores.get(other_id, 0) + 1
        ranked = sorted(scores.items(), key=lambda kv: (-kv[1], kv[0]))
        related_map[a.id] = [aid for aid, _ in ranked[:8]]

    # Replace `related` via re-creation (frozen dataclass).
    for i, a in enumerate(ARTISTS):
        ARTISTS[i] = MockArtist(
            id=a.id,
            name=a.name,
            genres=a.genres,
            popularity=a.popularity,
            image=a.image,
            related=related_map[a.id],
        )


_wire_related()


def _t(
    tid: str, name: str, aid: str, alb: str, pop: int, year: int, *, dur: int = 210_000
) -> MockTrack:
    artist = next(a for a in ARTISTS if a.id == aid)
    return MockTrack(
        id=tid,
        name=name,
        artist_id=aid,
        album_id=alb,
        popularity=pop,
        duration_ms=dur,
        year=year,
        preview_url=None,
        tags=list(artist.genres),
    )


TRACKS: list[MockTrack] = [
    _t("t-aurora-1", "Runaway", "a-aurora", "al-aurora-1", 80, 2015),
    _t("t-aurora-2", "Cure for Me", "a-aurora", "al-aurora-2", 71, 2021),
    _t("t-aurora-3", "Exist for Love", "a-aurora", "al-aurora-2", 66, 2020),
    _t("t-tycho-1", "Awake", "a-tycho", "al-tycho-1", 60, 2014),
    _t("t-tycho-2", "A Walk", "a-tycho", "al-tycho-2", 58, 2011),
    _t("t-bonobo-1", "Cirrus", "a-bonobo", "al-bonobo-1", 64, 2013),
    _t("t-bonobo-2", "Kerala", "a-bonobo", "al-bonobo-2", 66, 2016),
    _t("t-flylo-1", "Never Catch Me", "a-flyloto", "al-flylo-1", 62, 2014),
    _t("t-flylo-2", "Putty Boy Strut", "a-flyloto", "al-flylo-2", 55, 2012),
    _t("t-rh-1", "No Surprises", "a-radiohead", "al-rh-1", 86, 1997),
    _t("t-rh-2", "Idioteque", "a-radiohead", "al-rh-2", 80, 2000),
    _t("t-rh-3", "Reckoner", "a-radiohead", "al-rh-3", 77, 2007),
    _t("t-rh-4", "Pyramid Song", "a-radiohead", "al-rh-4", 73, 2001),
    _t("t-port-1", "Glory Box", "a-portishead", "al-port-1", 72, 1994),
    _t("t-port-2", "Roads", "a-portishead", "al-port-1", 68, 1994),
    _t("t-mass-1", "Teardrop", "a-massive", "al-mass-1", 78, 1998),
    _t("t-mass-2", "Angel", "a-massive", "al-mass-1", 70, 1998),
    _t("t-fka-1", "Two Weeks", "a-fkat", "al-fka-1", 64, 2014),
    _t("t-fka-2", "Cellophane", "a-fkat", "al-fka-2", 66, 2019),
    _t("t-jb-1", "Retrograde", "a-james", "al-jb-1", 70, 2013),
    _t("t-jb-2", "Limit to Your Love", "a-james", "al-jb-2", 64, 2011),
    _t("t-bjork-1", "Hyperballad", "a-bjork", "al-bjork-1", 70, 1995),
    _t("t-bjork-2", "Joga", "a-bjork", "al-bjork-2", 65, 1997),
    _t("t-arcade-1", "Wake Up", "a-arcade", "al-arcade-1", 78, 2004),
    _t("t-arcade-2", "Reflektor", "a-arcade", "al-arcade-2", 70, 2013),
    _t("t-mitski-1", "Nobody", "a-mitski", "al-mitski-1", 84, 2018),
    _t("t-mitski-2", "Washing Machine Heart", "a-mitski", "al-mitski-1", 80, 2018),
    _t("t-phoebe-1", "Motion Sickness", "a-phoebe", "al-phoebe-1", 79, 2017),
    _t("t-phoebe-2", "Kyoto", "a-phoebe", "al-phoebe-2", 78, 2020),
    _t("t-japan-1", "Be Sweet", "a-japan", "al-japan-1", 65, 2021),
    _t("t-japan-2", "Diving Woman", "a-japan", "al-japan-2", 58, 2017),
    _t("t-frank-1", "Pyramids", "a-frank", "al-frank-1", 82, 2012),
    _t("t-frank-2", "Nights", "a-frank", "al-frank-2", 90, 2016),
    _t("t-frank-3", "Ivy", "a-frank", "al-frank-2", 85, 2016),
    _t("t-sol-1", "Cranes in the Sky", "a-solange", "al-sol-1", 72, 2016),
    _t("t-sol-2", "Don't Touch My Hair", "a-solange", "al-sol-1", 68, 2016),
    _t("t-blood-1", "Charcoal Baby", "a-blood", "al-blood-1", 62, 2018),
    _t("t-blood-2", "Saint", "a-blood", "al-blood-2", 58, 2018),
    _t("t-tcat-1", "Them Changes", "a-thunder", "al-tcat-1", 75, 2015),
    _t("t-tcat-2", "Funny Thing", "a-thunder", "al-tcat-2", 65, 2020),
    _t("t-kamasi-1", "Truth", "a-kamasi", "al-kamasi-1", 55, 2017),
    _t("t-kamasi-2", "Re Run Home", "a-kamasi", "al-kamasi-1", 50, 2015),
    _t("t-glasper-1", "Afro Blue", "a-robert", "al-glasper-1", 55, 2012),
    _t("t-bcnr-1", "The Place Where He Inserted the Blade", "a-bcnr", "al-bcnr-1", 60, 2022),
    _t("t-bcnr-2", "Snow Globes", "a-bcnr", "al-bcnr-2", 55, 2022),
    _t("t-font-1", "Big Shot", "a-fontaines", "al-font-1", 64, 2022),
    _t("t-font-2", "Roman Holiday", "a-fontaines", "al-font-1", 60, 2022),
    _t("t-krule-1", "Easy Easy", "a-king", "al-krule-1", 70, 2013),
    _t("t-krule-2", "Logos", "a-king", "al-krule-2", 60, 2017),
    _t("t-aphex-1", "Xtal", "a-aphex", "al-aphex-1", 65, 1992),
    _t("t-aphex-2", "Avril 14th", "a-aphex", "al-aphex-2", 78, 2001),
    _t("t-boc-1", "Roygbiv", "a-boards", "al-boc-1", 72, 1998),
    _t("t-boc-2", "Dayvan Cowboy", "a-boards", "al-boc-2", 65, 2005),
    _t("t-burial-1", "Archangel", "a-burial", "al-burial-1", 70, 2007),
    _t("t-burial-2", "Untrue", "a-burial", "al-burial-1", 65, 2007),
    _t("t-ft-1", "Two Thousand and Seventeen", "a-fourtet", "al-ft-1", 60, 2017),
    _t("t-ft-2", "Baby", "a-fourtet", "al-ft-2", 65, 2020),
    _t("t-car-1", "Welcome To My Island", "a-caroline", "al-car-1", 73, 2023),
    _t("t-car-2", "Bunny Is A Rider", "a-caroline", "al-car-2", 70, 2021),
    _t("t-charli-1", "Vroom Vroom", "a-charli", "al-charli-1", 76, 2016),
    _t("t-charli-2", "1999", "a-charli", "al-charli-2", 80, 2018),
    _t("t-charli-3", "Speed Drive", "a-charli", "al-charli-3", 84, 2023),
    _t("t-sza-1", "Good Days", "a-sza", "al-sza-1", 92, 2020),
    _t("t-sza-2", "Kill Bill", "a-sza", "al-sza-2", 96, 2022),
    _t("t-sza-3", "The Weekend", "a-sza", "al-sza-3", 86, 2017),
]


def _build_albums() -> list[MockAlbum]:
    grouped: dict[str, list[str]] = {}
    name_year: dict[str, tuple[str, str, int]] = {}
    for t in TRACKS:
        grouped.setdefault(t.album_id, []).append(t.id)
        if t.album_id not in name_year:
            artist = next(a for a in ARTISTS if a.id == t.artist_id)
            name_year[t.album_id] = (
                f"{artist.name} — {t.album_id[3:].title()}",
                t.artist_id,
                t.year,
            )
    albums: list[MockAlbum] = []
    for alb_id, tids in grouped.items():
        name, aid, year = name_year[alb_id]
        artist = next(a for a in ARTISTS if a.id == aid)
        color = _PALETTE.get(artist.genres[0], "c9b6e8")
        albums.append(
            MockAlbum(
                id=alb_id,
                name=name,
                artist_id=aid,
                year=year,
                image=_img(alb_id.upper(), color),
                track_ids=tids,
            )
        )
    return albums


ALBUMS: list[MockAlbum] = _build_albums()


# ----- Public lookup surface ----------------------------------------------


def artist(aid: str) -> MockArtist | None:
    return next((a for a in ARTISTS if a.id == aid), None)


def track(tid: str) -> MockTrack | None:
    return next((t for t in TRACKS if t.id == tid), None)


def album(alb_id: str) -> MockAlbum | None:
    return next((a for a in ALBUMS if a.id == alb_id), None)


def artists_for_album(alb_id: str) -> MockArtist | None:
    alb = album(alb_id)
    return artist(alb.artist_id) if alb else None


def top_tracks_for_artist(aid: str, *, limit: int = 5) -> list[MockTrack]:
    candidates = [t for t in TRACKS if t.artist_id == aid]
    return sorted(candidates, key=lambda t: -t.popularity)[:limit]


def similar_artists(aid: str) -> list[MockArtist]:
    a = artist(aid)
    if not a:
        return []
    return [x for x in (artist(rid) for rid in a.related) if x is not None]


def similar_tracks(tid: str, *, limit: int = 30) -> list[MockTrack]:
    """Similar = tracks by similar artists, ranked by (1 - genre distance, -popularity_delta)."""
    seed = track(tid)
    if not seed:
        return []
    seed_artist = artist(seed.artist_id)
    if not seed_artist:
        return []
    seed_genres = set(seed_artist.genres)

    scored: list[tuple[float, MockTrack]] = []
    for t in TRACKS:
        if t.id == tid:
            continue
        a = artist(t.artist_id)
        if not a:
            continue
        overlap = len(seed_genres & set(a.genres)) / max(1, len(seed_genres | set(a.genres)))
        if overlap == 0:
            continue
        scored.append((overlap, t))
    scored.sort(key=lambda pair: (-pair[0], -pair[1].popularity))
    return [t for _, t in scored[:limit]]


SearchType = Literal["track", "album", "artist", "playlist"]


def search(query: str, search_type: SearchType, limit: int = 12) -> list[dict[str, str | int]]:
    """Substring search across the fixture. Playlist type returns curated
    one-off playlists keyed by query terms."""
    q = query.strip().lower()

    if search_type == "track":
        hits = [t for t in TRACKS if q in t.name.lower()]
        if not hits:
            hits = [t for t in TRACKS for a in [artist(t.artist_id)] if a and q in a.name.lower()]
        out: list[dict[str, str | int]] = []
        for t in hits[:limit]:
            a = artist(t.artist_id)
            alb = album(t.album_id)
            out.append(
                {
                    "id": t.id,
                    "name": t.name,
                    "artist": a.name if a else "",
                    "image": alb.image if alb else "",
                    "popularity": t.popularity,
                }
            )
        return out

    if search_type == "artist":
        hits_a = [a for a in ARTISTS if q in a.name.lower()]
        return [
            {"id": a.id, "name": a.name, "artist": "", "image": a.image, "popularity": a.popularity}
            for a in hits_a[:limit]
        ]

    if search_type == "album":
        hits_alb: list[MockAlbum] = []
        for alb in ALBUMS:
            a = artist(alb.artist_id)
            if q in alb.name.lower() or (a and q in a.name.lower()):
                hits_alb.append(alb)
        out_alb: list[dict[str, str | int]] = []
        for alb in hits_alb[:limit]:
            a = artist(alb.artist_id)
            out_alb.append(
                {
                    "id": alb.id,
                    "name": alb.name,
                    "artist": a.name if a else "",
                    "image": alb.image,
                    "popularity": 0,
                }
            )
        return out_alb

    if search_type == "playlist":
        # Synthetic "playlists" derived from genres for demo purposes.
        seeds = [
            ("p-indie-night", "Indie Night", "indie"),
            ("p-deep-focus", "Deep Focus", "electronic"),
            ("p-soft-rnb", "Soft RnB", "rnb"),
            ("p-jazz-rain", "Jazz in the Rain", "jazz"),
            ("p-rock-classic", "Rock Classics", "rock"),
            ("p-ambient-air", "Ambient Air", "ambient"),
        ]
        hits_pl = [s for s in seeds if q in s[1].lower() or q in s[2]]
        if not hits_pl:
            hits_pl = seeds  # show all for empty/non-matching
        return [
            {
                "id": pid,
                "name": pname,
                "artist": "MusicTailor",
                "image": _img(pname.replace(" ", "+"), _PALETTE.get(genre, "c9b6e8")),
                "popularity": 0,
            }
            for pid, pname, genre in hits_pl[:limit]
        ]

    return []


def playlist_tracks(pid: str) -> list[MockTrack]:
    """Resolve a synthetic playlist id to a concrete track list (top of the
    genre by popularity)."""
    genre_map = {
        "p-indie-night": "indie",
        "p-deep-focus": "electronic",
        "p-soft-rnb": "rnb",
        "p-jazz-rain": "jazz",
        "p-rock-classic": "rock",
        "p-ambient-air": "ambient",
    }
    genre = genre_map.get(pid)
    if not genre:
        return []
    matching = []
    for t in TRACKS:
        a = artist(t.artist_id)
        if a and genre in a.genres:
            matching.append(t)
    matching.sort(key=lambda t: -t.popularity)
    return matching[:20]
