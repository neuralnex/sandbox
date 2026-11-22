"""Add workspace business and location profile fields."""

from alembic import op
import sqlalchemy as sa

revision = "0007_workspace_profile"
down_revision = "0006_firebase_password_hash"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("organizations", sa.Column("business_type", sa.String(80), nullable=False, server_default="general"))
    op.add_column("organizations", sa.Column("country", sa.String(100), nullable=True))
    op.add_column("organizations", sa.Column("region", sa.String(100), nullable=True))
    op.add_column("organizations", sa.Column("city", sa.String(100), nullable=True))
    op.add_column("organizations", sa.Column("timezone", sa.String(80), nullable=True))
    op.add_column("organizations", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("organizations", sa.Column("longitude", sa.Float(), nullable=True))
    op.alter_column("organizations", "business_type", server_default=None)


def downgrade() -> None:
    op.drop_column("organizations", "longitude")
    op.drop_column("organizations", "latitude")
    op.drop_column("organizations", "timezone")
    op.drop_column("organizations", "city")
    op.drop_column("organizations", "region")
    op.drop_column("organizations", "country")
    op.drop_column("organizations", "business_type")
