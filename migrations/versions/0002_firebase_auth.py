"""Add Firebase identity and username while preserving existing user data."""

from alembic import op
import sqlalchemy as sa

revision = "0002_firebase_auth"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("users", "email", existing_type=sa.String(length=320), nullable=True)
    op.add_column("users", sa.Column("firebase_uid", sa.String(128), nullable=True))
    op.add_column("users", sa.Column("username", sa.String(32), nullable=True))
    op.create_unique_constraint("uq_users_firebase_uid", "users", ["firebase_uid"])
    op.create_unique_constraint("uq_users_username", "users", ["username"])


def downgrade() -> None:
    op.drop_constraint("uq_users_username", "users", type_="unique")
    op.drop_constraint("uq_users_firebase_uid", "users", type_="unique")
    op.drop_column("users", "username")
    op.drop_column("users", "firebase_uid")
    op.alter_column("users", "email", existing_type=sa.String(length=320), nullable=False)
