"""SQLAlchemy 2 ORM models for MusicTailor.

Phase 1 schema (per PLAN.md §3). Phase 2 tables — users, feedback_events,
saved_searches, user_slider_defaults — land in their own migration when
Phase 2 begins.
"""

from datetime import datetime
from typing import Any
from uuid import UUID as PyUUID

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    REAL,
    BigInteger,
    DateTime,
    ForeignKey,
    SmallInteger,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Phase 1 working default. Revise once feature extraction lands (Phase 1.4)
# and the concatenated [tempo | key | mood | low-level] layout is finalized.
FEATURE_VECTOR_DIM = 64


class Base(DeclarativeBase):
    pass


class Track(Base):
    """Canonical track record. External IDs nullable; resolved lazily."""

    __tablename__ = "tracks"

    track_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    spotify_id: Mapped[str | None] = mapped_column(Text, unique=True)
    mbid: Mapped[PyUUID | None] = mapped_column(UUID(as_uuid=True), unique=True)
    lastfm_key: Mapped[str | None] = mapped_column(Text, index=True)
    isrc: Mapped[str | None] = mapped_column(Text, index=True)
    title: Mapped[str] = mapped_column(Text)
    artist_name: Mapped[str] = mapped_column(Text)
    album_name: Mapped[str | None] = mapped_column(Text)
    popularity: Mapped[int | None] = mapped_column(SmallInteger)
    popularity_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    preview_url: Mapped[str | None] = mapped_column(Text)
    feature_vec: Mapped[list[float] | None] = mapped_column(Vector(FEATURE_VECTOR_DIM))
    feature_vec_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LastFmSimilarCache(Base):
    """Cache for Last.fm `track.getSimilar` responses. TTL: 30 days."""

    __tablename__ = "lastfm_similar_cache"

    seed_lastfm_key: Mapped[str] = mapped_column(Text, primary_key=True)
    response_json: Mapped[dict[str, Any]] = mapped_column(JSONB)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class AcousticBrainzCache(Base):
    """Cache for AcousticBrainz feature responses. Immutable: cache forever."""

    __tablename__ = "acousticbrainz_cache"

    mbid: Mapped[PyUUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    response_json: Mapped[dict[str, Any]] = mapped_column(JSONB)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class TrackTag(Base):
    """Last.fm-derived tags per track. Drives filter chips in the UI."""

    __tablename__ = "track_tags"

    track_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("tracks.track_id", ondelete="CASCADE"),
        primary_key=True,
    )
    tag: Mapped[str] = mapped_column(Text, primary_key=True)
    weight: Mapped[float] = mapped_column(REAL)


class ProviderCache(Base):
    """Generic (provider, method, key) → JSON cache.

    Used for Last.fm artist.getSimilar / artist.getTopTracks / tag.getTopTracks
    and any future provider call that needs key-value caching. The dedicated
    `lastfm_similar_cache` table predates this and stays as-is.
    """

    __tablename__ = "provider_cache"

    provider: Mapped[str] = mapped_column(Text, primary_key=True)
    method: Mapped[str] = mapped_column(Text, primary_key=True)
    key: Mapped[str] = mapped_column(Text, primary_key=True)
    response_json: Mapped[dict[str, Any]] = mapped_column(JSONB)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
