"""Allow Firebase-managed accounts without a local password hash."""

from alembic import op
import sqlalchemy as sa

revision = "0006_firebase_password_hash"
down_revision = "0005_reports"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "password_hash",
        existing_type=sa.String(length=255),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "users",
        "password_hash",
        existing_type=sa.String(length=255),
        nullable=False,
    )
