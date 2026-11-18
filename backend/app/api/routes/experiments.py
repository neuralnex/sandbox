from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from backend.app.api.deps import CurrentUser, DbSession
from backend.app.api.schemas import (
    ExperimentCreate,
    ExperimentRead,
    ExperimentUpdate,
    ExperimentVersionRead,
)
from backend.app.db.base import utc_now
from backend.app.db.models import (
    Experiment,
    ExperimentVersion,
    Environment,
    OrganizationMembership,
    Project,
    Scenario,
    ScenarioVersion,
)

router = APIRouter(prefix="/experiments", tags=["experiments"])


def _snapshot(experiment: Experiment) -> dict:
    return {
        "title": experiment.title,
        "description": experiment.description,
        "objective": experiment.objective,
        "domain": experiment.domain,
        "environment_id": str(experiment.environment_id) if experiment.environment_id else None,
        "specification": experiment.specification,
    }


def _get_accessible_experiment(db: DbSession, user_id: UUID, experiment_id: UUID) -> Experiment:
    experiment = db.scalar(
        select(Experiment)
        .join(Project, Project.id == Experiment.project_id)
        .join(OrganizationMembership, OrganizationMembership.organization_id == Project.organization_id)
        .where(Experiment.id == experiment_id, OrganizationMembership.user_id == user_id)
    )
    if experiment is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return experiment


@router.post("", response_model=ExperimentRead, status_code=status.HTTP_201_CREATED)
def create_experiment(payload: ExperimentCreate, user: CurrentUser, db: DbSession) -> Experiment:
    project = db.scalar(
        select(Project)
        .join(OrganizationMembership, OrganizationMembership.organization_id == Project.organization_id)
        .where(Project.id == payload.project_id, OrganizationMembership.user_id == user.id)
    )
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    experiment = Experiment(
        project_id=project.id,
        environment_id=payload.environment_id,
        created_by_id=user.id,
        title=payload.title,
        description=payload.description,
        objective=payload.objective,
        domain=payload.domain,
        specification=payload.specification,
        version=1,
    )
    if payload.environment_id is not None:
        environment = db.scalar(
            select(Environment).where(
                Environment.id == payload.environment_id,
                Environment.organization_id == project.organization_id,
            )
        )
        if environment is None:
            raise HTTPException(status_code=404, detail="Environment not found in this workspace")
    db.add(experiment)
    db.flush()
    db.add(
        ExperimentVersion(
            experiment_id=experiment.id,
            revision=1,
            snapshot=_snapshot(experiment),
            created_by_id=user.id,
        )
    )
    baseline = Scenario(
            experiment_id=experiment.id,
            created_by_id=user.id,
            name="Baseline",
            overrides={},
            is_baseline=True,
        )
    db.add(baseline)
    db.flush()
    db.add(
        ScenarioVersion(
            scenario_id=baseline.id,
            revision=1,
            snapshot={"name": baseline.name, "overrides": baseline.overrides},
            created_by_id=user.id,
        )
    )
    db.commit()
    db.refresh(experiment)
    return experiment


@router.get("", response_model=list[ExperimentRead])
def list_experiments(
    user: CurrentUser,
    db: DbSession,
    project_id: UUID | None = None,
) -> list[Experiment]:
    query = (
        select(Experiment)
        .join(Project, Project.id == Experiment.project_id)
        .join(OrganizationMembership, OrganizationMembership.organization_id == Project.organization_id)
        .where(OrganizationMembership.user_id == user.id)
    )
    if project_id is not None:
        query = query.where(Experiment.project_id == project_id)
    return list(db.scalars(query.order_by(Experiment.updated_at.desc())).all())


@router.get("/{experiment_id}", response_model=ExperimentRead)
def get_experiment(experiment_id: UUID, user: CurrentUser, db: DbSession) -> Experiment:
    return _get_accessible_experiment(db, user.id, experiment_id)


@router.patch("/{experiment_id}", response_model=ExperimentRead)
def update_experiment(
    experiment_id: UUID,
    payload: ExperimentUpdate,
    user: CurrentUser,
    db: DbSession,
) -> Experiment:
    experiment = _get_accessible_experiment(db, user.id, experiment_id)
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return experiment
    if any(value is None for value in updates.values()):
        raise HTTPException(status_code=422, detail="Experiment fields cannot be null")
    for field, value in updates.items():
        if field == "environment_id" and value is not None:
            project = db.get(Project, experiment.project_id)
            environment = db.scalar(
                select(Environment).where(
                    Environment.id == value,
                    Environment.organization_id == project.organization_id,
                )
            )
            if environment is None:
                raise HTTPException(status_code=404, detail="Environment not found in this workspace")
        setattr(experiment, field, value)
    experiment.version += 1
    experiment.updated_at = utc_now()
    db.flush()
    db.add(
        ExperimentVersion(
            experiment_id=experiment.id,
            revision=experiment.version,
            snapshot=_snapshot(experiment),
            created_by_id=user.id,
        )
    )
    db.commit()
    db.refresh(experiment)
    return experiment


@router.get("/{experiment_id}/versions", response_model=list[ExperimentVersionRead])
def list_experiment_versions(
    experiment_id: UUID, user: CurrentUser, db: DbSession
) -> list[ExperimentVersion]:
    experiment = _get_accessible_experiment(db, user.id, experiment_id)
    return list(
        db.scalars(
            select(ExperimentVersion)
            .where(ExperimentVersion.experiment_id == experiment.id)
            .order_by(ExperimentVersion.revision.desc())
        ).all()
    )
