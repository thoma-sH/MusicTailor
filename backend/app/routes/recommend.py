"""POST /recommend — full input x output recommendation pipeline.

Request shape kept aligned with the frontend zod schema (see
`frontend/src/lib/schemas.ts`). All sliders are optional and default to
neutral on the backend so an empty `sliders` object still works.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.recommend import (
    RecommendItem,
    SeedPayload,
    recommend,
)
from app.services.scoring import Sliders

router = APIRouter(tags=["recommend"])


class SlidersIn(BaseModel):
    popularity_bias: float = Field(default=0.0, ge=-1.0, le=1.0)
    diversity: float = Field(default=0.5, ge=0.0, le=1.0)
    discovery_radius: float = Field(default=0.7, ge=0.0, le=1.0)
    era_bias: float = Field(default=0.0, ge=-1.0, le=1.0)
    tags_include: list[str] = Field(default_factory=list)
    tags_exclude: list[str] = Field(default_factory=list)
    artists_include: list[str] = Field(default_factory=list)
    artists_exclude: list[str] = Field(default_factory=list)
    seed_weight_curve: Literal["linear", "exponential"] = "linear"


class SeedIn(BaseModel):
    input_type: Literal["song", "album", "artist", "playlist"]
    id: str


class RecommendIn(BaseModel):
    seed: SeedIn
    output_type: Literal["song", "album", "artist", "playlist"]
    sliders: SlidersIn = Field(default_factory=SlidersIn)
    k: int = Field(default=10, ge=1, le=50)


class RecommendItemOut(BaseModel):
    type: Literal["song", "album", "artist", "playlist"]
    id: str
    name: str
    artist_name: str
    image: str | None
    popularity: int
    preview_url: str | None
    open_url: str | None
    why: str
    tracks: list[RecommendItemOut] | None = None


class SeedOut(BaseModel):
    id: str
    type: Literal["song", "album", "artist", "playlist"]
    name: str | None = None
    image: str | None = None
    popularity: int | None = None


class RecommendOut(BaseModel):
    seed: SeedOut
    items: list[RecommendItemOut]
    debug: dict[str, str | int | float]


def _to_item_out(item: RecommendItem) -> RecommendItemOut:
    return RecommendItemOut(
        type=item.type,
        id=item.id,
        name=item.name,
        artist_name=item.artist_name,
        image=item.image,
        popularity=item.popularity,
        preview_url=item.preview_url,
        open_url=item.open_url,
        why=item.why,
        tracks=[_to_item_out(t) for t in item.tracks] if item.tracks else None,
    )


@router.post("/recommend", response_model=RecommendOut)
async def post_recommend(req: RecommendIn) -> RecommendOut:
    sliders = Sliders(
        popularity_bias=req.sliders.popularity_bias,
        diversity=req.sliders.diversity,
        discovery_radius=req.sliders.discovery_radius,
        era_bias=req.sliders.era_bias,
        tags_include=tuple(req.sliders.tags_include),
        tags_exclude=tuple(req.sliders.tags_exclude),
        artists_include=tuple(req.sliders.artists_include),
        artists_exclude=tuple(req.sliders.artists_exclude),
        seed_weight_curve=req.sliders.seed_weight_curve,
    )
    seed = SeedPayload(input_type=req.seed.input_type, id=req.seed.id)

    result = recommend(seed, req.output_type, sliders, k=req.k)

    seed_id = result.seed["id"]
    seed_type = result.seed["type"]
    seed_name = result.seed.get("name")
    seed_image = result.seed.get("image")
    seed_popularity = result.seed.get("popularity")
    return RecommendOut(
        seed=SeedOut(
            id=str(seed_id) if seed_id is not None else "",
            type=str(seed_type) if seed_type is not None else "song",
            name=str(seed_name) if seed_name is not None else None,
            image=str(seed_image) if seed_image is not None else None,
            popularity=int(seed_popularity) if isinstance(seed_popularity, int) else None,
        ),
        items=[_to_item_out(it) for it in result.items],
        debug=result.debug,
    )
