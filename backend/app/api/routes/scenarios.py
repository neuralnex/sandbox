from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from backend.app.api.deps import CurrentUser, DbSession
from backend.app.api.schemas import (
    ScenarioBranchInput,
    ScenarioCreate,
    ScenarioRead,
    ScenarioUpdate,
    ScenarioVersionRead,
    CompareRunsInput,
)
from backend.app.db.base import utc_now
from backend.app.db.models import (
    Experiment,
    OrganizationMembership,
    Project,
    Scenario,
    ScenarioVersion,
    SimulationRun,
)

router = APIRouter(tags=["scenarios"])


def _accessible_experiment(db: DbSession, user_id: UUID, experiment_id: UUID) -> Experiment:
    experiment = db.scalar(
        select(Experiment)
        .join(Project, Project.id == Experiment.project_id)
        .join(OrganizationMembership, OrganizationMembership.organization_id == Project.organization_id)
        .where(Experiment.id == experiment_id, OrganizationMembership.user_id == user_id)
    )
    if experiment is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return experiment


def _accessible_scenario(db: DbSession, user_id: UUID, scenario_id: UUID) -> Scenario:
    scenario = db.scalar(
        select(Scenario)
        .join(Experiment, Experiment.id == Scenario.experiment_id)
        .join(Project, Project.id == Experiment.project_id)
        .join(OrganizationMembership, OrganizationMembership.organization_id == Project.organization_id)
        .where(Scenario.id == scenario_id, OrganizationMembership.user_id == user_id)
    )
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return scenario


@router.post(
    "/experiments/{experiment_id}/scenarios",
    response_model=ScenarioRead,
    status_code=status.HTTP_201_CREATED,
)
def create_scenario(
    experiment_id: UUID, payload: ScenarioCreate, user: CurrentUser, db: DbSession
) -> Scenario:
    experiment = _accessible_experiment(db, user.id, experiment_id)
    scenario = Scenario(
        experiment_id=experiment.id,
        created_by_id=user.id,
        name=payload.name,
        overrides=payload.overrides,
        context=payload.context,
    )
    db.add(scenario)
    db.flush()
    db.add(
        ScenarioVersion(
            scenario_id=scenario.id,
            revision=1,
            snapshot={"name": scenario.name, "overrides": scenario.overrides, "context": scenario.context},
            created_by_id=user.id,
        )
    )
    db.commit()
    db.refresh(scenario)
    return scenario


@router.get("/experiments/{experiment_id}/scenarios", response_model=list[ScenarioRead])
def list_scenarios(
    experiment_id: UUID, user: CurrentUser, db: DbSession
) -> list[Scenario]:
    experiment = _accessible_experiment(db, user.id, experiment_id)
    return list(
        db.scalars(
            select(Scenario)
            .where(Scenario.experiment_id == experiment.id)
            .order_by(Scenario.is_baseline.desc(), Scenario.created_at)
        ).all()
    )


@router.post(
    "/scenarios/{scenario_id}/branch",
    response_model=ScenarioRead,
    status_code=status.HTTP_201_CREATED,
)
def branch_scenario(
    scenario_id: UUID,
    payload: ScenarioBranchInput,
    user: CurrentUser,
    db: DbSession,
) -> Scenario:
    parent = _accessible_scenario(db, user.id, scenario_id)
    branch = Scenario(
        experiment_id=parent.experiment_id,
        parent_id=parent.id,
        created_by_id=user.id,
        name=payload.name,
        overrides=payload.overrides,
        context=payload.context or parent.context,
    )
    db.add(branch)
    db.flush()
    db.add(
        ScenarioVersion(
            scenario_id=branch.id,
            revision=1,
            snapshot={"name": branch.name, "overrides": branch.overrides, "context": branch.context},
            created_by_id=user.id,
        )
    )
    db.commit()
    db.refresh(branch)
    return branch


@router.patch("/scenarios/{scenario_id}", response_model=ScenarioRead)
def update_scenario(
    scenario_id: UUID, payload: ScenarioUpdate, user: CurrentUser, db: DbSession
) -> Scenario:
    scenario = _accessible_scenario(db, user.id, scenario_id)
    if scenario.is_baseline:
        raise HTTPException(status_code=409, detail="The baseline scenario cannot be edited")
    updates = payload.model_dump(exclude_unset=True)
    if any(value is None for value in updates.values()):
        raise HTTPException(status_code=422, detail="Scenario fields cannot be null")
    if not updates:
        return scenario
    for field, value in updates.items():
        setattr(scenario, field, value)
    scenario.version += 1
    scenario.updated_at = utc_now()
    db.add(
        ScenarioVersion(
            scenario_id=scenario.id,
            revision=scenario.version,
            snapshot={"name": scenario.name, "overrides": scenario.overrides, "context": scenario.context},
            created_by_id=user.id,
        )
    )
    db.commit()
    db.refresh(scenario)
    return scenario


@router.get("/scenarios/{scenario_id}/versions", response_model=list[ScenarioVersionRead])
def list_scenario_versions(
    scenario_id: UUID, user: CurrentUser, db: DbSession
) -> list[ScenarioVersion]:
    scenario = _accessible_scenario(db, user.id, scenario_id)
    return list(
        db.scalars(
            select(ScenarioVersion)
            .where(ScenarioVersion.scenario_id == scenario.id)
            .order_by(ScenarioVersion.revision.desc())
        ).all()
    )


@router.post("/experiments/{experiment_id}/scenarios/compare")
def compare_scenario_runs(
    experiment_id: UUID,
    payload: CompareRunsInput,
    user: CurrentUser,
    db: DbSession,
) -> dict:
    experiment = _accessible_experiment(db, user.id, experiment_id)
    if len(set(payload.run_ids)) != len(payload.run_ids):
        raise HTTPException(status_code=422, detail="Run IDs must be unique")
    matching_runs = list(
        db.scalars(
            select(SimulationRun)
            .join(Scenario, Scenario.id == SimulationRun.scenario_id)
            .where(
                Scenario.experiment_id == experiment.id,
                SimulationRun.id.in_(payload.run_ids),
            )
        ).all()
    )
    if len(matching_runs) != len(payload.run_ids):
        raise HTTPException(status_code=404, detail="One or more runs do not belong to this experiment")
    runs_by_id = {run.id: run for run in matching_runs}
    runs = [runs_by_id[run_id] for run_id in payload.run_ids]
    if any(run.status != "completed" for run in runs):
        raise HTTPException(status_code=409, detail="All runs must be completed before comparison")
    metrics = [run.metrics or {} for run in runs]
    metric_names = sorted(set.intersection(*(set(item) for item in metrics)) - {"assumptions"})
    rows = []
    for name in metric_names:
        values = [item[name] for item in metrics]
        numeric_values = all(isinstance(value, int | float) for value in values)
        rows.append(
            {
                "metric": name,
                "values": dict(zip([str(run.id) for run in runs], values, strict=True)),
                "delta_from_first": {
                    str(run.id): round(values[index] - values[0], 6)
                    for index, run in enumerate(runs)
                }
                if numeric_values
                else None,
            }
        )
    return {
        "experiment_id": experiment.id,
        "reference_run_id": runs[0].id,
        "runs": [
            {"id": run.id, "scenario_id": run.scenario_id, "seed": run.seed}
            for run in runs
        ],
        "metrics": rows,
    }
