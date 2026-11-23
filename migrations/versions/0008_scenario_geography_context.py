"""Persist scenario geography context and run snapshots."""

from alembic import op
import sqlalchemy as sa

revision = "0008_geography_context"
down_revision = "0007_workspace_profile"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("scenarios", sa.Column("context", sa.JSON(), nullable=True))
    op.add_column("simulation_runs", sa.Column("context", sa.JSON(), nullable=True))
    op.execute("UPDATE scenarios SET context = '{}' WHERE context IS NULL")
    op.execute("UPDATE simulation_runs SET context = '{}' WHERE context IS NULL")
    op.alter_column("scenarios", "context", nullable=False)
    op.alter_column("simulation_runs", "context", nullable=False)


def downgrade() -> None:
    op.drop_column("simulation_runs", "context")
    op.drop_column("scenarios", "context")
