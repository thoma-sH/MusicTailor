"""Tests for `app.providers.acousticbrainz`."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import httpx
import pytest

from app.models import AcousticBrainzCache
from app.providers.acousticbrainz import AcousticBrainzClient
from tests.conftest import NoNetworkTransport, ScriptedTransport, make_response

SAMPLE_MBID = "12345678-1234-5678-1234-567812345678"


def _make_client(
    transport: ScriptedTransport | NoNetworkTransport,
) -> AcousticBrainzClient:
    client = AcousticBrainzClient()
    client._client._client = httpx.AsyncClient(base_url="http://test", transport=transport)
    return client


@pytest.mark.usefixtures("disable_sleeps")
class TestAcousticBrainzClient:
    async def test_returns_cached_on_hit(self) -> None:
        cached = MagicMock(spec=AcousticBrainzCache)
        cached.response_json = {"highlevel": {"x": 1}, "lowlevel": {"y": 2}}
        session = AsyncMock()
        session.get = AsyncMock(return_value=cached)

        client = _make_client(NoNetworkTransport())
        try:
            result = await client.get_features(session, SAMPLE_MBID)
            assert result == {"highlevel": {"x": 1}, "lowlevel": {"y": 2}}
            session.get.assert_awaited_once_with(AcousticBrainzCache, UUID(SAMPLE_MBID))
        finally:
            await client.aclose()

    async def test_fetches_and_caches_on_miss(self) -> None:
        session = AsyncMock()
        session.get = AsyncMock(return_value=None)
        session.execute = AsyncMock()

        transport = ScriptedTransport(
            [
                make_response(200, {"hl": "data"}),
                make_response(200, {"ll": "data"}),
            ]
        )
        client = _make_client(transport)
        try:
            result = await client.get_features(session, SAMPLE_MBID)
            assert result == {"highlevel": {"hl": "data"}, "lowlevel": {"ll": "data"}}
            assert len(transport.calls) == 2
            session.execute.assert_awaited_once()
        finally:
            await client.aclose()

    async def test_returns_none_on_404(self) -> None:
        session = AsyncMock()
        session.get = AsyncMock(return_value=None)
        session.execute = AsyncMock()

        transport = ScriptedTransport([make_response(404, {})])
        client = _make_client(transport)
        try:
            result = await client.get_features(session, SAMPLE_MBID)
            assert result is None
            session.execute.assert_not_awaited()
        finally:
            await client.aclose()
