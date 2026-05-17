"""provider cache

Generic key-value cache table for provider methods that don't merit their
own dedicated table (artist.getSimilar, artist.getTopTracks, tag.getTopTracks
and future additions). The pre-existing `lastfm_similar_cache` stays
untouched.

Revision ID: 0002_provider_cache
Revises: 0001_phase1_tables
Create Date: 2026-05-16
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_provider_cache"
down_revision: str | None = "0001_phase1_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "provider_cache",
        sa.Column("provider", sa.Text, primary_key=True),
        sa.Column("method", sa.Text, primary_key=True),
        sa.Column("key", sa.Text, primary_key=True),
        sa.Column("response_json", postgresql.JSONB, nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("provider_cache")
