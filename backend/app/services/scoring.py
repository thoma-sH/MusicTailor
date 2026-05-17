"""Slider application + diversification for recommendation results.

The shape of a "candidate" here is a `Candidate` dataclass — provider-agnostic.
The engine builds these from Last.fm + Spotify (or the mock provider) and
passes them through this module's pure functions.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class Sliders:
    """The user-tunable algorithm. Validated upstream — defaults are neutral."""

    popularity_bias: float = 0.0  # [-1, +1]
    diversity: float = 0.5  # [0, 1]
    discovery_radius: float = 0.7  # [0, 1]
    era_bias: float = 0.0  # [-1, +1]
    tags_include: tuple[str, ...] = ()  # hard filter — any-of
    tags_exclude: tuple[str, ...] = ()  # hard filter
    artists_include: tuple[str, ...] = ()  # hard filter — any-of
    artists_exclude: tuple[str, ...] = ()  # hard filter
    seed_weight_curve: Literal["linear", "exponential"] = "linear"


@dataclass
class Candidate:
    """Per-candidate provider-agnostic shape for scoring."""

    id: str  # provider-stable id (e.g., mock or Spotify)
    name: str
    artist_id: str
    artist_name: str
    popularity: int  # 0-100
    year: int | None  # release year if known
    tags: tuple[str, ...] = ()  # genre/style tags
    similarity: float = 0.5  # base similarity from provider [0, 1]
    image: str | None = None
    preview_url: str | None = None
    album_id: str | None = None
    album_name: str | None = None
    extra: dict[str, str | int | None] | None = None
    score: float = 0.0


def _normalize(value: float, low: float, high: float) -> float:
    if high == low:
        return 0.0
    return max(0.0, min(1.0, (value - low) / (high - low)))


def apply_hard_filters(
    candidates: list[Candidate],
    sliders: Sliders,
    *,
    seed_artist_ids: tuple[str, ...] = (),
) -> list[Candidate]:
    """Drop candidates that fail tag/artist include/exclude rules.

    `seed_artist_ids` are always excluded — we never recommend the seed back
    to itself.
    """
    out: list[Candidate] = []
    inc_tags = {t.lower() for t in sliders.tags_include}
    exc_tags = {t.lower() for t in sliders.tags_exclude}
    inc_artists = set(sliders.artists_include)
    exc_artists = set(sliders.artists_exclude) | set(seed_artist_ids)

    for c in candidates:
        ctags = {t.lower() for t in c.tags}
        if inc_tags and not (ctags & inc_tags):
            continue
        if exc_tags and (ctags & exc_tags):
            continue
        if inc_artists and c.artist_id not in inc_artists:
            continue
        if c.artist_id in exc_artists:
            continue
        out.append(c)
    return out


def apply_soft_scoring(
    candidates: list[Candidate],
    sliders: Sliders,
    *,
    seed_popularity: int | None,
    seed_year: int | None,
) -> list[Candidate]:
    """Compute `Candidate.score` from base similarity + slider biases.

    Score formula (each term in [0, 1]):
        base       = similarity                        weight: 1.0
        pop_term   = popularity match                  weight: |popularity_bias|
        era_term   = era match                         weight: |era_bias|

    The popularity match rewards candidates *in the direction* of the bias:
    bias=+1 prefers candidates more popular than seed; bias=-1 prefers less
    popular ("underground"). bias=0 = no contribution. Era likewise.

    `discovery_radius` softly clips low-similarity candidates: similarity is
    raised to a power so radius near 0 sharpens the similarity floor,
    near 1 is wide-open.
    """
    radius_pow = 1.0 + (1.0 - sliders.discovery_radius) * 3.0  # 1.0 .. 4.0
    pb = sliders.popularity_bias
    eb = sliders.era_bias

    scored: list[Candidate] = []
    for c in candidates:
        sim = max(0.0, min(1.0, c.similarity)) ** radius_pow

        pop_term = 0.0
        if seed_popularity is not None and pb != 0.0:
            delta = (c.popularity - seed_popularity) / 100.0  # [-1, +1]
            # If user wants more popular (pb>0), reward positive delta.
            pop_term = max(0.0, min(1.0, 0.5 + 0.5 * (delta * (1.0 if pb > 0 else -1.0))))

        era_term = 0.0
        if seed_year is not None and c.year is not None and eb != 0.0:
            delta = (c.year - seed_year) / 30.0  # 30-year window
            era_term = max(0.0, min(1.0, 0.5 + 0.5 * (delta * (1.0 if eb > 0 else -1.0))))

        score = sim + abs(pb) * pop_term + abs(eb) * era_term
        c.score = score
        scored.append(c)

    scored.sort(key=lambda x: -x.score)
    return scored


def mmr_by_artist(
    candidates: list[Candidate],
    *,
    diversity: float,
    k: int = 10,
) -> list[Candidate]:
    """Maximal Marginal Relevance using artist as the diversity dimension.

    `diversity` ∈ [0, 1] maps directly to (1 - λ): 0 = pure relevance (λ=1),
    1 = pure diversity (λ=0). Default 0.5 → λ=0.5.
    """
    if not candidates:
        return []
    lam = 1.0 - max(0.0, min(1.0, diversity))
    selected: list[Candidate] = []
    pool = list(candidates)
    artist_counts: dict[str, int] = {}

    while pool and len(selected) < k:
        best_idx = 0
        best_marginal = -1e9
        for i, c in enumerate(pool):
            penalty = artist_counts.get(c.artist_id, 0)
            marginal = lam * c.score - (1.0 - lam) * penalty
            if marginal > best_marginal:
                best_marginal = marginal
                best_idx = i
        chosen = pool.pop(best_idx)
        selected.append(chosen)
        artist_counts[chosen.artist_id] = artist_counts.get(chosen.artist_id, 0) + 1

    return selected


def dedupe_by_artist(candidates: list[Candidate]) -> list[Candidate]:
    """Keep only the highest-scoring candidate per artist. Order-preserving."""
    seen: set[str] = set()
    out: list[Candidate] = []
    for c in candidates:
        if c.artist_id in seen:
            continue
        seen.add(c.artist_id)
        out.append(c)
    return out


def why_matched(c: Candidate, sliders: Sliders, *, seed_popularity: int | None) -> str:
    """One-line explanation of the top contributing factors."""
    bits: list[str] = []
    if sliders.popularity_bias != 0 and seed_popularity is not None:
        delta = c.popularity - seed_popularity
        if sliders.popularity_bias > 0 and delta > 0:
            bits.append(f"+{delta} popularity")
        elif sliders.popularity_bias < 0 and delta < 0:
            bits.append(f"{delta} popularity (underground)")
    if c.tags:
        bits.append(c.tags[0])
    if not bits:
        bits.append("similar artist circle")
    return " · ".join(bits[:3])
