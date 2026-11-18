from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from backend.app.api.deps import CurrentUser, DbSession
from backend.app.api.schemas import DatasetCreate, DatasetRead, EnvironmentCreate, EnvironmentRead
from backend.app.db.models import Dataset, Environment, OrganizationMembership

router = APIRouter(prefix="/environments", tags=["environments"])


def _accessible_environment(db: DbSession, user_id: UUID, environment_id: UUID) -> Environment:
    environment = db.scalar(
        select(Environment)
        .join(
            OrganizationMembership,
            OrganizationMembership.organization_id == Environment.organization_id,
        )
        .where(
            Environment.id == environment_id,
            OrganizationMembership.user_id == user_id,
        )
    )
    if environment is None:
        raise HTTPException(status_code=404, detail="Environment not found")
    return environment


@router.post("", response_model=EnvironmentRead, status_code=status.HTTP_201_CREATED)
def create_environment(
    payload: EnvironmentCreate, user: CurrentUser, db: DbSession
) -> Environment:
    membership = db.scalar(
        select(OrganizationMembership.id).where(
            OrganizationMembership.organization_id == payload.organization_id,
            OrganizationMembership.user_id == user.id,
        )
    )
    if membership is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    environment = Environment(
        organization_id=payload.organization_id,
        created_by_id=user.id,
        name=payload.name,
        environment_type=payload.environment_type,
        configuration=payload.configuration,
        provenance=payload.provenance,
    )
    db.add(environment)
    db.commit()
    db.refresh(environment)
    return environment


@router.get("", response_model=list[EnvironmentRead])
def list_environments(
    organization_id: UUID, user: CurrentUser, db: DbSession
) -> list[Environment]:
    membership = db.scalar(
        select(OrganizationMembership.id).where(
            OrganizationMembership.organization_id == organization_id,
            OrganizationMembership.user_id == user.id,
        )
    )
    if membership is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return list(
        db.scalars(
            select(Environment)
            .where(Environment.organization_id == organization_id)
            .order_by(Environment.created_at.desc())
        ).all()
    )


@router.get("/{environment_id}", response_model=EnvironmentRead)
def get_environment(
    environment_id: UUID, user: CurrentUser, db: DbSession
) -> Environment:
    return _accessible_environment(db, user.id, environment_id)


@router.post("/{environment_id}/clone", response_model=EnvironmentRead, status_code=201)
def clone_environment(
    environment_id: UUID, user: CurrentUser, db: DbSession, name: str
) -> Environment:
    original = _accessible_environment(db, user.id, environment_id)
    clone = Environment(
        organization_id=original.organization_id,
        created_by_id=user.id,
        name=name,
        environment_type=original.environment_type,
        configuration=original.configuration.copy(),
        provenance={**original.provenance, "cloned_from": str(original.id)},
    )
    db.add(clone)
    db.flush()
    datasets = db.scalars(select(Dataset).where(Dataset.environment_id == original.id)).all()
    for dataset in datasets:
        db.add(
            Dataset(
                environment_id=clone.id,
                created_by_id=user.id,
                name=dataset.name,
                source_url=dataset.source_url,
                license=dataset.license,
                observed_at=dataset.observed_at,
                metadata_json=dataset.metadata_json.copy(),
            )
        )
    db.commit()
    db.refresh(clone)
    return clone


@router.post(
    "/{environment_id}/datasets",
    response_model=DatasetRead,
    status_code=status.HTTP_201_CREATED,
)
def attach_dataset(
    environment_id: UUID, payload: DatasetCreate, user: CurrentUser, db: DbSession
) -> Dataset:
    environment = _accessible_environment(db, user.id, environment_id)
    dataset = Dataset(
        environment_id=environment.id,
        created_by_id=user.id,
        name=payload.name,
        source_url=payload.source_url,
        license=payload.license,
        observed_at=payload.observed_at,
        metadata_json=payload.metadata,
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    return dataset


@router.get("/{environment_id}/datasets", response_model=list[DatasetRead])
def list_datasets(
    environment_id: UUID, user: CurrentUser, db: DbSession
) -> list[Dataset]:
    environment = _accessible_environment(db, user.id, environment_id)
    return list(
        db.scalars(
            select(Dataset)
            .where(Dataset.environment_id == environment.id)
            .order_by(Dataset.created_at)
        ).all()
    )
