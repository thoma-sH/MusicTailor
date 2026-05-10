"""MusicBrainz client. Public API, no auth, but a User-Agent header is required.

Used solely for ISRC → MBID lookup so we can join Spotify tracks to
AcousticBrainz features. Strict 1 rps rate limit per MusicBrainz policy.
"""

from __future__ import annotations

import httpx

from app.providers.base import RateLimitedClient


class MusicBrainzClient:
    """Looks up MBIDs by ISRC. One-shot — result is persisted on `tracks.mbid`."""

    BASE_URL = "https://musicbrainz.org/ws/2"

    def __init__(
        self,
        *,
        user_agent: str = "MusicTailor/0.1.0 ( https://github.com/thoma-sH/MusicTailor )",
        rps: float = 1.0,
    ) -> None:
        self.user_agent = user_agent
        self._client = RateLimitedClient(name="musicbrainz", base_url=self.BASE_URL, rps=rps)

    async def lookup_by_isrc(self, isrc: str) -> str | None:
        """Returns the first matching MBID, or None if no recording is registered."""
        try:
            data = await self._client.get(
                f"/isrc/{isrc}",
                params={"fmt": "json"},
                headers={"User-Agent": self.user_agent},
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

        recordings = data.get("recordings") or []
        if not recordings:
            return None
        first = recordings[0]
        mbid = first.get("id")
        return mbid if isinstance(mbid, str) else None

    async def aclose(self) -> None:
        await self._client.aclose()
