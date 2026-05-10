"""AcousticBrainz client. Public API, no auth.

Note: AcousticBrainz was placed in read-only mode by MetaBrainz in 2022;
existing data (~30M recordings) is still served, but no new submissions land.
Tracks recorded after 2022 will frequently 404 — the ingestion service must
handle the missing-features path gracefully (PLAN.md §1.2).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import httpx
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AcousticBrainzCache
from app.providers.base import RateLimitedClient


class AcousticBrainzClient:
    """Fetches AcousticBrainz high-level + low-level features by MBID.

    Cached forever in `acousticbrainz_cache` (the data is immutable).
    Returns None when the MBID has no AcousticBrainz coverage.
    """

    BASE_URL = "https://acousticbrainz.org/api/v1"

    def __init__(self, *, rps: float = 10.0) -> None:
        self._client = RateLimitedClient(name="acousticbrainz", base_url=self.BASE_URL, rps=rps)

    async def get_features(self, session: AsyncSession, mbid: str) -> dict[str, Any] | None:
        """Returns merged {high-level, low-level} payload, or None if not in coverage."""
        mbid_uuid = UUID(mbid)

        cached = await session.get(AcousticBrainzCache, mbid_uuid)
        if cached is not None:
            return cached.response_json

        try:
            highlevel = await self._client.get(f"/{mbid}/high-level")
            lowlevel = await self._client.get(f"/{mbid}/low-level")
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

        merged: dict[str, Any] = {"highlevel": highlevel, "lowlevel": lowlevel}

        stmt = pg_insert(AcousticBrainzCache).values(
            mbid=mbid_uuid,
            response_json=merged,
            fetched_at=datetime.now(UTC),
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["mbid"],
            set_={
                "response_json": stmt.excluded.response_json,
                "fetched_at": stmt.excluded.fetched_at,
            },
        )
        await session.execute(stmt)

        return merged

    async def aclose(self) -> None:
        await self._client.aclose()
