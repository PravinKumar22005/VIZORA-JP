"""add updated_at column to users

Revision ID: 20241215_add_user_updated_at
Revises: e8b9dab4acc9
Create Date: 2025-12-15 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import func

revision: str = "20241215_add_user_updated_at"
down_revision: Union[str, Sequence[str], None] = "e8b9dab4acc9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=func.now(),
            nullable=True,
        ),
    )
    op.execute("UPDATE users SET updated_at = created_at WHERE updated_at IS NULL")
    op.alter_column("users", "updated_at", nullable=False)


def downgrade() -> None:
    op.drop_column("users", "updated_at")
