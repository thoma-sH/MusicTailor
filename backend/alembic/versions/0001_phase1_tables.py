"""phase 1 tables

Initial migration: pgvector extension + the four Phase 1 tables from PLAN.md
§3 (tracks, lastfm_similar_cache, acousticbrainz_cache, track_tags).

Revision ID: 0001_phase1_tables
Revises:
Create Date: 2026-05-09
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

# Alembic identifiers.
revision: str = "0001_phase1_tables"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Must match models.FEATURE_VECTOR_DIM. Hardcoded here because migrations are
# point-in-time snapshots and must not depend on app code that may change.
FEATURE_VECTOR_DIM = 64


def upgrade() -> None:
    # Enable pgvector before any column references the Vector type.
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "tracks",
        sa.Column("track_id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("spotify_id", sa.Text, unique=True),
        sa.Column("mbid", postgresql.UUID(as_uuid=True), unique=True),
        sa.Column("lastfm_key", sa.Text),
        sa.Column("isrc", sa.Text),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("artist_name", sa.Text, nullable=False),
        sa.Column("album_name", sa.Text),
        sa.Column("popularity", sa.SmallInteger),
        sa.Column("popularity_at", sa.DateTime(timezone=True)),
        sa.Column("preview_url", sa.Text),
        sa.Column("feature_vec", Vector(FEATURE_VECTOR_DIM)),
        sa.Column("feature_vec_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_tracks_lastfm_key", "tracks", ["lastfm_key"])
    op.create_index("ix_tracks_isrc", "tracks", ["isrc"])

    op.create_table(
        "lastfm_similar_cache",
        sa.Column("seed_lastfm_key", sa.Text, primary_key=True),
        sa.Column("response_json", postgresql.JSONB, nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "acousticbrainz_cache",
        sa.Column("mbid", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("response_json", postgresql.JSONB, nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "track_tags",
        sa.Column(
            "track_id",
            sa.BigInteger,
            sa.ForeignKey("tracks.track_id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("tag", sa.Text, primary_key=True),
        sa.Column("weight", sa.REAL, nullable=False),
    )


def downgrade() -> None:
    op.drop_table("track_tags")
    op.drop_table("acousticbrainz_cache")
    op.drop_table("lastfm_similar_cache")
    op.drop_index("ix_tracks_isrc", table_name="tracks")
    op.drop_index("ix_tracks_lastfm_key", table_name="tracks")
    op.drop_table("tracks")
    op.execute("DROP EXTENSION IF EXISTS vector")
