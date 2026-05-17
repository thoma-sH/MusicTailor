"""GET /search?type=song|album|artist|playlist&q=...

Type-aware search box for the seed input. In mock mode (no Spotify creds)
serves results from the curated fixture; otherwise wires through to
`SpotifyClient.search`. Live wiring is the smaller part — we expose the
mock surface unconditionally for v1 so the demo works out of the box.
"""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.config import settings
from app.services import mock_provider as mp

router = APIRouter(tags=["search"])


SearchType = Literal["song", "album", "artist", "playlist"]


class SearchHit(BaseModel):
    id: str
    name: str
    artist: str
    image: str
    popularity: int


class SearchResponse(BaseModel):
    type: SearchType
    query: str
    hits: list[SearchHit]


_TYPE_TO_MOCK = {
    "song": "track",
    "album": "album",
    "artist": "artist",
    "playlist": "playlist",
}


@router.get("/search", response_model=SearchResponse)
async def get_search(
    type: Annotated[SearchType, Query(description="song|album|artist|playlist")],
    q: Annotated[str, Query(min_length=0, max_length=200)] = "",
    limit: Annotated[int, Query(ge=1, le=30)] = 12,
) -> SearchResponse:
    # In live mode this is where we'd dispatch to SpotifyClient.search. For
    # v1, we always hit the mock provider so the app demos without creds.
    # (When live providers are wired in, this branch flips on settings.mock_mode.)
    _ = settings  # keep the import alive — see comment above
    raw = mp.search(q, _TYPE_TO_MOCK[type], limit=limit)  # type: ignore[arg-type]
    hits = [
        SearchHit(
            id=str(r["id"]),
            name=str(r["name"]),
            artist=str(r["artist"]),
            image=str(r["image"]),
            popularity=int(r["popularity"]) if isinstance(r["popularity"], int) else 0,
        )
        for r in raw
    ]
    return SearchResponse(type=type, query=q, hits=hits)
