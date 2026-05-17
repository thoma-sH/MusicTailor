"""Last.fm client. Candidate generation via `track.getSimilar`.

Caches similar-track responses to `lastfm_similar_cache` (TTL 30 days per
PLAN.md §1.3). Artist-level lookups (`artist.getSimilar`, `artist.getTopTracks`)
and tag lookups go through the generic `provider_cache` table.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import LastFmSimilarCache, ProviderCache
from app.providers.base import RateLimitedClient


class LastFmClient:
    BASE_URL = "https://ws.audioscrobbler.com/2.0/"
    SIMILAR_TTL = timedelta(days=30)
    ARTIST_TTL = timedelta(days=30)
    TAG_TTL = timedelta(days=7)

    def __init__(self, api_key: str, *, rps: float = 4.0) -> None:
        self.api_key = api_key
        self._client = RateLimitedClient(name="lastfm", base_url=self.BASE_URL, rps=rps)

    @staticmethod
    def _key(artist: str, track: str) -> str:
        return f"{artist.strip().lower()}|{track.strip().lower()}"

    @staticmethod
    def _artist_key(artist: str) -> str:
        return artist.strip().lower()

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

    async def artist_get_similar(
        self,
        session: AsyncSession,
        artist: str,
        *,
        limit: int = 30,
    ) -> dict[str, Any]:
        """Cached lookup of similar artists. Uses generic provider_cache."""
        return await self._cached_call(
            session,
            method="artist.getsimilar",
            cache_key=self._artist_key(artist),
            ttl=self.ARTIST_TTL,
            params={
                "method": "artist.getsimilar",
                "artist": artist,
                "limit": limit,
                "api_key": self.api_key,
                "format": "json",
                "autocorrect": 1,
            },
        )

    async def artist_get_top_tracks(
        self,
        session: AsyncSession,
        artist: str,
        *,
        limit: int = 10,
    ) -> dict[str, Any]:
        """Cached lookup of an artist's top tracks."""
        return await self._cached_call(
            session,
            method="artist.gettoptracks",
            cache_key=self._artist_key(artist),
            ttl=self.ARTIST_TTL,
            params={
                "method": "artist.gettoptracks",
                "artist": artist,
                "limit": limit,
                "api_key": self.api_key,
                "format": "json",
                "autocorrect": 1,
            },
        )

    async def tag_get_top_tracks(
        self,
        session: AsyncSession,
        tag: str,
        *,
        limit: int = 30,
    ) -> dict[str, Any]:
        """Cached lookup of top tracks for a tag/genre."""
        return await self._cached_call(
            session,
            method="tag.gettoptracks",
            cache_key=tag.strip().lower(),
            ttl=self.TAG_TTL,
            params={
                "method": "tag.gettoptracks",
                "tag": tag,
                "limit": limit,
                "api_key": self.api_key,
                "format": "json",
            },
        )

    async def _cached_call(
        self,
        session: AsyncSession,
        *,
        method: str,
        cache_key: str,
        ttl: timedelta,
        params: dict[str, Any],
    ) -> dict[str, Any]:
        now = datetime.now(UTC)
        cached = await session.get(ProviderCache, ("lastfm", method, cache_key))
        if cached is not None and (now - cached.fetched_at) < ttl:
            return cached.response_json

        data: dict[str, Any] = await self._client.get("/", params=params)

        stmt = pg_insert(ProviderCache).values(
            provider="lastfm",
            method=method,
            key=cache_key,
            response_json=data,
            fetched_at=now,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["provider", "method", "key"],
            set_={
                "response_json": stmt.excluded.response_json,
                "fetched_at": stmt.excluded.fetched_at,
            },
        )
        await session.execute(stmt)
        return data

    async def aclose(self) -> None:
        await self._client.aclose()
