"""End-to-end recommendation tests covering all 16 input x output combos.

Runs against the mock provider — no DB, no network. Each (input, output)
pair must produce at least one item.
"""

from __future__ import annotations

import pytest

from app.services import mock_provider as mp
from app.services.recommend import SeedPayload, recommend
from app.services.scoring import Sliders

SEED_IDS = {
    "song": "t-rh-1",  # No Surprises — Radiohead
    "album": "al-rh-1",  # the album that contains it
    "artist": "a-radiohead",  # Radiohead
    "playlist": "p-indie-night",
}

OUTPUT_TYPES = ["song", "album", "artist", "playlist"]


@pytest.mark.parametrize("input_type", list(SEED_IDS.keys()))
@pytest.mark.parametrize("output_type", OUTPUT_TYPES)
def test_all_16_combos_return_items(input_type: str, output_type: str) -> None:
    seed = SeedPayload(input_type=input_type, id=SEED_IDS[input_type])  # type: ignore[arg-type]
    result = recommend(seed, output_type, Sliders(), k=10)  # type: ignore[arg-type]
    assert result.items, f"{input_type} -> {output_type} returned no items"
    if output_type == "playlist":
        assert result.items[0].type == "playlist"
        assert result.items[0].tracks is not None
        assert len(result.items[0].tracks) >= 1
    else:
        assert all(it.type == output_type for it in result.items)


def test_underground_bias_returns_less_popular_than_seed() -> None:
    seed = SeedPayload(input_type="song", id="t-rh-1")  # popularity 86
    result = recommend(
        seed,
        "song",
        Sliders(popularity_bias=-1.0, discovery_radius=1.0),
        k=10,
    )
    seed_pop = mp.track("t-rh-1").popularity  # type: ignore[union-attr]
    avg_pop = sum(it.popularity for it in result.items) / len(result.items)
    assert avg_pop < seed_pop


def test_popular_bias_returns_more_popular() -> None:
    seed = SeedPayload(input_type="song", id="t-tycho-2")  # popularity 58
    result_neutral = recommend(seed, "song", Sliders(), k=10)
    result_popular = recommend(
        seed,
        "song",
        Sliders(popularity_bias=1.0, discovery_radius=1.0),
        k=10,
    )
    avg_n = sum(it.popularity for it in result_neutral.items) / len(result_neutral.items)
    avg_p = sum(it.popularity for it in result_popular.items) / len(result_popular.items)
    assert avg_p >= avg_n


def test_artist_exclude_filter_works() -> None:
    seed = SeedPayload(input_type="song", id="t-rh-1")
    result = recommend(
        seed,
        "song",
        Sliders(artists_exclude=("a-portishead",)),
        k=15,
    )
    assert all(it.artist_name != "Portishead" for it in result.items)


def test_artist_include_filter_narrows_to_listed() -> None:
    seed = SeedPayload(input_type="song", id="t-rh-1")
    result = recommend(
        seed,
        "song",
        Sliders(artists_include=("a-portishead", "a-massive")),
        k=15,
    )
    assert result.items
    allowed = {"Portishead", "Massive Attack"}
    assert all(it.artist_name in allowed for it in result.items)


def test_unknown_seed_returns_empty_with_reason() -> None:
    seed = SeedPayload(input_type="song", id="does-not-exist")
    result = recommend(seed, "song", Sliders(), k=10)
    assert result.items == []
    assert result.debug.get("reason") == "seed_not_found"


def test_seed_track_is_never_recommended_back() -> None:
    seed = SeedPayload(input_type="song", id="t-rh-1")
    result = recommend(seed, "song", Sliders(), k=10)
    assert all(it.id != "t-rh-1" for it in result.items)
    # Also: seed artist shouldn't appear, since it's auto-excluded.
    assert all(it.artist_name != "Radiohead" for it in result.items)


def test_playlist_output_bundles_tracks() -> None:
    seed = SeedPayload(input_type="artist", id="a-frank")
    result = recommend(seed, "playlist", Sliders(), k=8)
    assert len(result.items) == 1
    playlist = result.items[0]
    assert playlist.type == "playlist"
    assert playlist.tracks is not None
    assert 1 <= len(playlist.tracks) <= 8
