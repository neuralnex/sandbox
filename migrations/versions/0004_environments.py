"""Add reusable environments, dataset provenance and experiment references."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0004_environments"
down_revision = "0003_scenarios_and_runs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "environments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("environment_type", sa.String(32), nullable=False),
        sa.Column("configuration", sa.JSON(), nullable=False),
        sa.Column("provenance", sa.JSON(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
    )
    op.create_index("ix_environments_organization_id", "environments", ["organization_id"])
    op.create_table(
        "datasets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("environment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("license", sa.String(240), nullable=True),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["environment_id"], ["environments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
    )
    op.create_index("ix_datasets_environment_id", "datasets", ["environment_id"])
    op.add_column("experiments", sa.Column("environment_id", postgresql.UUID(as_uuid=True)))
    op.create_foreign_key(
        "fk_experiments_environment_id_environments",
        "experiments",
        "environments",
        ["environment_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_experiments_environment_id_environments", "experiments", type_="foreignkey")
    op.drop_column("experiments", "environment_id")
    op.drop_index("ix_datasets_environment_id", table_name="datasets")
    op.drop_table("datasets")
    op.drop_index("ix_environments_organization_id", table_name="environments")
    op.drop_table("environments")
