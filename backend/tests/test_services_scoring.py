"""Tests for `app.services.scoring` — slider math, hard filters, MMR."""

from __future__ import annotations

import pytest

from app.services.scoring import (
    Candidate,
    Sliders,
    apply_hard_filters,
    apply_soft_scoring,
    dedupe_by_artist,
    mmr_by_artist,
    why_matched,
)


def _c(
    cid: str,
    aid: str,
    pop: int = 50,
    year: int | None = 2020,
    tags: tuple[str, ...] = (),
    sim: float = 0.6,
) -> Candidate:
    return Candidate(
        id=cid,
        name=cid.upper(),
        artist_id=aid,
        artist_name=aid.upper(),
        popularity=pop,
        year=year,
        tags=tags,
        similarity=sim,
    )


class TestHardFilters:
    def test_excludes_seed_artists(self) -> None:
        cands = [_c("t1", "a1"), _c("t2", "a2")]
        out = apply_hard_filters(cands, Sliders(), seed_artist_ids=("a1",))
        assert [c.id for c in out] == ["t2"]

    def test_artists_include_keeps_only_listed(self) -> None:
        cands = [_c("t1", "a1"), _c("t2", "a2"), _c("t3", "a3")]
        sliders = Sliders(artists_include=("a1", "a3"))
        out = apply_hard_filters(cands, sliders)
        assert [c.id for c in out] == ["t1", "t3"]

    def test_artists_exclude_drops_listed(self) -> None:
        cands = [_c("t1", "a1"), _c("t2", "a2")]
        sliders = Sliders(artists_exclude=("a1",))
        out = apply_hard_filters(cands, sliders)
        assert [c.id for c in out] == ["t2"]

    def test_tags_include_requires_overlap(self) -> None:
        cands = [
            _c("t1", "a1", tags=("indie",)),
            _c("t2", "a2", tags=("jazz",)),
        ]
        sliders = Sliders(tags_include=("indie",))
        out = apply_hard_filters(cands, sliders)
        assert [c.id for c in out] == ["t1"]

    def test_tags_exclude_drops_any_overlap(self) -> None:
        cands = [
            _c("t1", "a1", tags=("indie", "rock")),
            _c("t2", "a2", tags=("jazz",)),
        ]
        sliders = Sliders(tags_exclude=("rock",))
        out = apply_hard_filters(cands, sliders)
        assert [c.id for c in out] == ["t2"]

    def test_empty_filters_are_no_op(self) -> None:
        cands = [_c("t1", "a1"), _c("t2", "a2")]
        out = apply_hard_filters(cands, Sliders())
        assert len(out) == 2


class TestSoftScoring:
    def test_popularity_bias_positive_prefers_more_popular(self) -> None:
        cands = [
            _c("low", "a1", pop=20, sim=0.6),
            _c("high", "a2", pop=90, sim=0.6),
        ]
        sliders = Sliders(popularity_bias=1.0)
        out = apply_soft_scoring(cands, sliders, seed_popularity=50, seed_year=2020)
        assert out[0].id == "high"

    def test_popularity_bias_negative_prefers_underground(self) -> None:
        cands = [
            _c("low", "a1", pop=20, sim=0.6),
            _c("high", "a2", pop=90, sim=0.6),
        ]
        sliders = Sliders(popularity_bias=-1.0)
        out = apply_soft_scoring(cands, sliders, seed_popularity=50, seed_year=2020)
        assert out[0].id == "low"

    def test_era_bias_positive_prefers_newer(self) -> None:
        cands = [
            _c("old", "a1", year=1995, sim=0.6),
            _c("new", "a2", year=2024, sim=0.6),
        ]
        sliders = Sliders(era_bias=1.0)
        out = apply_soft_scoring(cands, sliders, seed_popularity=50, seed_year=2010)
        assert out[0].id == "new"

    def test_discovery_radius_low_sharpens_similarity(self) -> None:
        # `apply_soft_scoring` mutates `Candidate.score` in place — use two
        # independent candidate lists so we can compare gaps after both runs.
        cands_n = [_c("a", "a1", sim=0.3), _c("b", "a2", sim=0.9)]
        cands_w = [_c("a", "a1", sim=0.3), _c("b", "a2", sim=0.9)]
        out_n = apply_soft_scoring(
            cands_n, Sliders(discovery_radius=0.0), seed_popularity=50, seed_year=2020
        )
        out_w = apply_soft_scoring(
            cands_w, Sliders(discovery_radius=1.0), seed_popularity=50, seed_year=2020
        )
        # Narrow radius: 0.3**4=0.0081 vs 0.9**4=0.6561 — bigger gap.
        # Wide radius: 0.3**1=0.3 vs 0.9**1=0.9 — smaller relative gap.
        gap_n = out_n[0].score - out_n[1].score
        gap_w = out_w[0].score - out_w[1].score
        assert gap_n > gap_w

    def test_neutral_sliders_preserve_similarity_order(self) -> None:
        cands = [_c("a", "a1", sim=0.4), _c("b", "a2", sim=0.7), _c("c", "a3", sim=0.5)]
        out = apply_soft_scoring(cands, Sliders(), seed_popularity=50, seed_year=2020)
        assert [c.id for c in out] == ["b", "c", "a"]


class TestMMR:
    def test_low_diversity_keeps_pure_relevance(self) -> None:
        cands = [
            _c("t1", "a1", sim=0.9),
            _c("t2", "a1", sim=0.85),
            _c("t3", "a2", sim=0.5),
        ]
        scored = apply_soft_scoring(cands, Sliders(), seed_popularity=None, seed_year=None)
        out = mmr_by_artist(scored, diversity=0.0, k=3)
        assert [c.id for c in out] == ["t1", "t2", "t3"]

    def test_high_diversity_breaks_artist_clusters(self) -> None:
        cands = [
            _c("t1", "a1", sim=0.9),
            _c("t2", "a1", sim=0.85),
            _c("t3", "a2", sim=0.5),
        ]
        scored = apply_soft_scoring(cands, Sliders(), seed_popularity=None, seed_year=None)
        out = mmr_by_artist(scored, diversity=1.0, k=3)
        # First should still be t1 (highest score); second should jump to a2
        # because a1 is now penalized.
        assert out[0].id == "t1"
        assert out[1].artist_id == "a2"


class TestDedupe:
    def test_keeps_first_per_artist(self) -> None:
        cands = [_c("t1", "a1"), _c("t2", "a1"), _c("t3", "a2")]
        out = dedupe_by_artist(cands)
        assert [c.id for c in out] == ["t1", "t3"]


class TestWhyMatched:
    def test_mentions_popularity_when_biased(self) -> None:
        c = _c("t1", "a1", pop=80, tags=("indie",))
        sliders = Sliders(popularity_bias=1.0)
        msg = why_matched(c, sliders, seed_popularity=40)
        assert "popularity" in msg

    def test_fallback_when_no_signals(self) -> None:
        c = _c("t1", "a1", pop=50, tags=())
        msg = why_matched(c, Sliders(), seed_popularity=None)
        assert msg != ""


@pytest.mark.parametrize("curve", ["linear", "exponential"])
def test_sliders_curve_roundtrip(curve: str) -> None:
    s = Sliders(seed_weight_curve=curve)  # type: ignore[arg-type]
    assert s.seed_weight_curve == curve
