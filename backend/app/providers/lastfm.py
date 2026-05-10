"""Last.fm client. Candidate generation via `track.getSimilar`.

Caches similar-track responses to `lastfm_similar_cache` (TTL 30 days per
PLAN.md §1.3). `track.getTopTags` is uncached at the client layer for now.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import LastFmSimilarCache
from app.providers.base import RateLimitedClient


class LastFmClient:
    BASE_URL = "https://ws.audioscrobbler.com/2.0/"
    SIMILAR_TTL = timedelta(days=30)

    def __init__(self, api_key: str, *, rps: float = 4.0) -> None:
        self.api_key = api_key
        self._client = RateLimitedClient(name="lastfm", base_url=self.BASE_URL, rps=rps)

    @staticmethod
    def _key(artist: str, track: str) -> str:
        return f"{artist.strip().lower()}|{track.strip().lower()}"

    async def track_get_similar(
        self,
        session: AsyncSession,
        artist: str,
        track: str,
        *,
        limit: int = 30,
    ) -> dict[str, Any]:
        """Cached lookup of similar tracks for (artist, track). Returns Last.fm's
        raw JSON payload — caller normalizes."""
        key = self._key(artist, track)
        now = datetime.now(UTC)

        cached = await session.get(LastFmSimilarCache, key)
        if cached is not None and (now - cached.fetched_at) < self.SIMILAR_TTL:
            return cached.response_json

        data: dict[str, Any] = await self._client.get(
            "/",
            params={
                "method": "track.getsimilar",
                "artist": artist,
                "track": track,
                "limit": limit,
                "api_key": self.api_key,
                "format": "json",
                "autocorrect": 1,
            },
        )

        stmt = pg_insert(LastFmSimilarCache).values(
            seed_lastfm_key=key, response_json=data, fetched_at=now
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["seed_lastfm_key"],
            set_={
                "response_json": stmt.excluded.response_json,
                "fetched_at": stmt.excluded.fetched_at,
            },
        )
        await session.execute(stmt)

        return data

    async def track_get_top_tags(self, artist: str, track: str) -> dict[str, Any]:
        """Uncached — call volume is low and tags drift."""
        result: dict[str, Any] = await self._client.get(
            "/",
            params={
                "method": "track.gettoptags",
                "artist": artist,
                "track": track,
                "api_key": self.api_key,
                "format": "json",
                "autocorrect": 1,
            },
        )
        return result

    async def aclose(self) -> None:
        await self._client.aclose()
