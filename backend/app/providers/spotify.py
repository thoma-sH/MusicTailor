"""Spotify client. Server-to-server Client Credentials flow only — no user auth.

Phase 1 needs catalog reads (search / get_track / playlist tracks) for the
seed-input flow. User-account scopes (top tracks, library, playback) come in
Phase 2 with Authorization Code + PKCE.

Token is held in memory and refreshed lazily 60s before expiry. No client-
level response caching: track metadata persists into the `tracks` table via
the ingestion service (Phase 1.4); search results are deliberately uncached
because their popularity-driven ranking drifts.
"""

from __future__ import annotations

import asyncio
import base64
import time
from typing import Any

import httpx

from app.providers.base import RateLimitedClient


class SpotifyClient:
    TOKEN_URL = "https://accounts.spotify.com/api/token"
    BASE_URL = "https://api.spotify.com/v1"

    def __init__(self, client_id: str, client_secret: str, *, rps: float = 2.5) -> None:
        if not client_id or not client_secret:
            raise ValueError("client_id and client_secret are required")
        self.client_id = client_id
        self.client_secret = client_secret
        self._client = RateLimitedClient(name="spotify", base_url=self.BASE_URL, rps=rps)
        # Separate http client for the token endpoint so it doesn't share the
        # rate-limit budget with API calls.
        self._token_client = httpx.AsyncClient(timeout=10.0)
        self._token: str | None = None
        self._token_expires_at: float = 0.0
        self._token_lock = asyncio.Lock()

    async def _get_token(self) -> str:
        async with self._token_lock:
            if self._token and time.monotonic() < self._token_expires_at - 60:
                return self._token

            credentials = f"{self.client_id}:{self.client_secret}".encode()
            auth_header = base64.b64encode(credentials).decode()

            resp = await self._token_client.post(
                self.TOKEN_URL,
                headers={
                    "Authorization": f"Basic {auth_header}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data={"grant_type": "client_credentials"},
            )
            resp.raise_for_status()
            body = resp.json()

            self._token = str(body["access_token"])
            self._token_expires_at = time.monotonic() + float(body["expires_in"])
            return self._token

    async def _bearer(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {await self._get_token()}"}

    async def search(self, query: str, *, limit: int = 20) -> dict[str, Any]:
        result: dict[str, Any] = await self._client.get(
            "/search",
            params={"q": query, "type": "track", "limit": limit},
            headers=await self._bearer(),
        )
        return result

    async def get_track(self, track_id: str) -> dict[str, Any]:
        result: dict[str, Any] = await self._client.get(
            f"/tracks/{track_id}",
            headers=await self._bearer(),
        )
        return result

    async def get_playlist_tracks(
        self,
        playlist_id: str,
        *,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        result: dict[str, Any] = await self._client.get(
            f"/playlists/{playlist_id}/tracks",
            params={"limit": limit, "offset": offset},
            headers=await self._bearer(),
        )
        return result

    async def aclose(self) -> None:
        await self._client.aclose()
        await self._token_client.aclose()
