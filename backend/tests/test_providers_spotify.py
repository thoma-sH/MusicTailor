"""Tests for `app.providers.spotify`."""

from __future__ import annotations

import httpx
import pytest

from app.providers.spotify import SpotifyClient
from tests.conftest import ScriptedTransport, make_response


def _make_client(
    api_transport: ScriptedTransport, token_transport: ScriptedTransport
) -> SpotifyClient:
    client = SpotifyClient(client_id="cid", client_secret="csec")
    client._client._client = httpx.AsyncClient(base_url="http://api.test", transport=api_transport)
    client._token_client = httpx.AsyncClient(transport=token_transport)
    return client


def _token_response(expires_in: int = 3600) -> httpx.Response:
    return make_response(200, {"access_token": "test-bearer-token", "expires_in": expires_in})


@pytest.mark.usefixtures("disable_sleeps")
class TestSpotifyClient:
    def test_rejects_empty_credentials(self) -> None:
        with pytest.raises(ValueError):
            SpotifyClient(client_id="", client_secret="x")
        with pytest.raises(ValueError):
            SpotifyClient(client_id="x", client_secret="")

    async def test_search_uses_bearer_token(self) -> None:
        api = ScriptedTransport([make_response(200, {"tracks": {"items": []}})])
        token = ScriptedTransport([_token_response()])
        client = _make_client(api, token)
        try:
            await client.search("radiohead")
            req = api.calls[0]
            assert req.headers.get("authorization") == "Bearer test-bearer-token"
            assert "/search" in str(req.url)
        finally:
            await client.aclose()

    async def test_token_is_reused_within_expiry(self) -> None:
        api = ScriptedTransport(
            [
                make_response(200, {"name": "track1"}),
                make_response(200, {"name": "track2"}),
            ]
        )
        # Only one token response — second call should hit the cached token.
        token = ScriptedTransport([_token_response()])
        client = _make_client(api, token)
        try:
            await client.get_track("abc")
            await client.get_track("def")
            assert len(token.calls) == 1
            assert len(api.calls) == 2
        finally:
            await client.aclose()

    async def test_get_playlist_tracks_passes_pagination(self) -> None:
        api = ScriptedTransport([make_response(200, {"items": []})])
        token = ScriptedTransport([_token_response()])
        client = _make_client(api, token)
        try:
            await client.get_playlist_tracks("plid", limit=50, offset=100)
            req = api.calls[0]
            assert "limit=50" in str(req.url)
            assert "offset=100" in str(req.url)
            assert "/playlists/plid/tracks" in str(req.url)
        finally:
            await client.aclose()
