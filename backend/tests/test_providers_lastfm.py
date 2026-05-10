"""Tests for `app.providers.lastfm`."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from app.models import LastFmSimilarCache
from app.providers.lastfm import LastFmClient
from tests.conftest import NoNetworkTransport, ScriptedTransport, make_response


def _make_client(
    transport: ScriptedTransport | NoNetworkTransport,
) -> LastFmClient:
    client = LastFmClient(api_key="test-key")
    client._client._client = httpx.AsyncClient(base_url="http://test", transport=transport)
    return client


@pytest.mark.usefixtures("disable_sleeps")
class TestLastFmClient:
    def test_key_normalizes_case_and_whitespace(self) -> None:
        assert LastFmClient._key("  Radiohead ", "Idioteque") == "radiohead|idioteque"
        assert LastFmClient._key("Björk", "Hyperballad") == "björk|hyperballad"

    async def test_fetches_and_caches_on_miss(self) -> None:
        session = AsyncMock()
        session.get = AsyncMock(return_value=None)
        session.execute = AsyncMock()

        transport = ScriptedTransport(
            [
                make_response(
                    200,
                    {"similartracks": {"track": [{"name": "Karma Police"}]}},
                )
            ]
        )
        client = _make_client(transport)
        try:
            data = await client.track_get_similar(session, "Radiohead", "No Surprises")
            assert "similartracks" in data
            session.execute.assert_awaited_once()
        finally:
            await client.aclose()

    async def test_returns_cache_within_ttl(self) -> None:
        cached = MagicMock(spec=LastFmSimilarCache)
        cached.response_json = {"similartracks": {"track": [{"name": "Cached"}]}}
        cached.fetched_at = datetime.now(UTC) - timedelta(days=10)
        session = AsyncMock()
        session.get = AsyncMock(return_value=cached)
        session.execute = AsyncMock()

        client = _make_client(NoNetworkTransport())
        try:
            data = await client.track_get_similar(session, "Radiohead", "No Surprises")
            assert data["similartracks"]["track"][0]["name"] == "Cached"
            session.execute.assert_not_awaited()
        finally:
            await client.aclose()

    async def test_refetches_after_ttl(self) -> None:
        stale = MagicMock(spec=LastFmSimilarCache)
        stale.response_json = {"similartracks": {"track": [{"name": "Stale"}]}}
        stale.fetched_at = datetime.now(UTC) - timedelta(days=45)
        session = AsyncMock()
        session.get = AsyncMock(return_value=stale)
        session.execute = AsyncMock()

        transport = ScriptedTransport(
            [
                make_response(
                    200,
                    {"similartracks": {"track": [{"name": "Fresh"}]}},
                )
            ]
        )
        client = _make_client(transport)
        try:
            data = await client.track_get_similar(session, "Radiohead", "No Surprises")
            assert data["similartracks"]["track"][0]["name"] == "Fresh"
            session.execute.assert_awaited_once()
        finally:
            await client.aclose()

    async def test_top_tags_passes_through_uncached(self) -> None:
        transport = ScriptedTransport(
            [make_response(200, {"toptags": {"tag": [{"name": "alternative"}]}})]
        )
        client = _make_client(transport)
        try:
            data = await client.track_get_top_tags("Radiohead", "No Surprises")
            assert data["toptags"]["tag"][0]["name"] == "alternative"
        finally:
            await client.aclose()
