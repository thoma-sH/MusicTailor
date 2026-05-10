"""Tests for `app.providers.musicbrainz`."""

from __future__ import annotations

import httpx
import pytest

from app.providers.musicbrainz import MusicBrainzClient
from tests.conftest import ScriptedTransport, make_response


def _make_client(transport: ScriptedTransport) -> MusicBrainzClient:
    client = MusicBrainzClient()
    client._client._client = httpx.AsyncClient(base_url="http://test", transport=transport)
    return client


@pytest.mark.usefixtures("disable_sleeps")
class TestMusicBrainzClient:
    async def test_returns_first_mbid(self) -> None:
        transport = ScriptedTransport(
            [
                make_response(
                    200,
                    {
                        "recordings": [
                            {"id": "first-uuid", "title": "Track A"},
                            {"id": "second-uuid", "title": "Track A (Remaster)"},
                        ]
                    },
                )
            ]
        )
        client = _make_client(transport)
        try:
            mbid = await client.lookup_by_isrc("USRC17607839")
            assert mbid == "first-uuid"
        finally:
            await client.aclose()

    async def test_returns_none_on_empty_recordings(self) -> None:
        transport = ScriptedTransport([make_response(200, {"recordings": []})])
        client = _make_client(transport)
        try:
            mbid = await client.lookup_by_isrc("USRC17607839")
            assert mbid is None
        finally:
            await client.aclose()

    async def test_returns_none_on_404(self) -> None:
        transport = ScriptedTransport([make_response(404, {})])
        client = _make_client(transport)
        try:
            mbid = await client.lookup_by_isrc("DOESNTEXIST")
            assert mbid is None
        finally:
            await client.aclose()

    async def test_user_agent_header_sent(self) -> None:
        transport = ScriptedTransport([make_response(200, {"recordings": []})])
        client = _make_client(transport)
        try:
            await client.lookup_by_isrc("USRC17607839")
            assert transport.calls[0].headers.get("user-agent", "").startswith("MusicTailor/")
        finally:
            await client.aclose()
