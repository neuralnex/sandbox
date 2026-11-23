"""Store public waitlist signups."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0008_waitlist_signups"
down_revision = "0007_workspace_profile"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "waitlist_signups",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("source", sa.String(length=80), nullable=False, server_default="landing_page"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("email", name="uq_waitlist_signups_email"),
    )


def downgrade() -> None:
    op.drop_table("waitlist_signups")
