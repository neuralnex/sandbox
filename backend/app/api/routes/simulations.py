import logging
import secrets
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select, update

from backend.app.api.deps import CurrentUser, DbSession
from backend.app.api.routes.scenarios import _accessible_scenario
from backend.app.api.schemas import (
    SimulationEventRead,
    SimulationRunCreate,
    SimulationRunRead,
)
from backend.app.db.base import utc_now
from backend.app.db.models import Experiment, OrganizationMembership, Project, Scenario, SimulationEvent, SimulationRun
from backend.app.simulation.engines import ENGINE_REGISTRY
from backend.app.workers.simulation_tasks import run_simulation

router = APIRouter(tags=["simulation runs"])
logger = logging.getLogger(__name__)


def _accessible_run(db: DbSession, user_id: UUID, run_id: UUID) -> SimulationRun:
    run = db.get(SimulationRun, run_id)
    if run is not None:
        is_member = db.scalar(
            select(OrganizationMembership.id)
            .join(Project, Project.organization_id == OrganizationMembership.organization_id)
            .join(Experiment, Experiment.project_id == Project.id)
            .join(Scenario, Scenario.experiment_id == Experiment.id)
            .where(
                Scenario.id == run.scenario_id,
                OrganizationMembership.user_id == user_id,
            )
        )
        if is_member is not None:
            return run
    raise HTTPException(status_code=404, detail="Simulation run not found")


@router.get("/experiments/{experiment_id}/runs", response_model=list[SimulationRunRead])
def list_experiment_runs(
    experiment_id: UUID, user: CurrentUser, db: DbSession
) -> list[SimulationRun]:
    experiment = db.scalar(
        select(Experiment)
        .join(Project, Project.id == Experiment.project_id)
        .join(OrganizationMembership, OrganizationMembership.organization_id == Project.organization_id)
        .where(Experiment.id == experiment_id, OrganizationMembership.user_id == user.id)
    )
    if experiment is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return list(
        db.scalars(
            select(SimulationRun)
            .join(Scenario, Scenario.id == SimulationRun.scenario_id)
            .where(Scenario.experiment_id == experiment.id)
            .order_by(SimulationRun.created_at.desc())
        ).all()
    )


def _effective_overrides(db: DbSession, scenario: Scenario) -> dict:
    chain = [scenario]
    parent_id = scenario.parent_id
    while parent_id is not None:
        parent = db.get(Scenario, parent_id)
        if parent is None:
            break
        chain.append(parent)
        parent_id = parent.parent_id
    merged: dict = {}
    for item in reversed(chain):
        merged.update(item.overrides)
    return merged


@router.post(
    "/scenarios/{scenario_id}/runs",
    response_model=SimulationRunRead,
    status_code=status.HTTP_202_ACCEPTED,
)
def start_run(
    scenario_id: UUID,
    payload: SimulationRunCreate,
    user: CurrentUser,
    db: DbSession,
) -> SimulationRun:
    scenario = _accessible_scenario(db, user.id, scenario_id)
    experiment = db.get(Experiment, scenario.experiment_id)
    simulation = (experiment.specification or {}).get("simulation")
    if not isinstance(simulation, dict):
        raise HTTPException(status_code=422, detail="Experiment has no simulation configuration")
    engine_name = simulation.get("engine")
    engine = ENGINE_REGISTRY.get(engine_name)
    if engine is None:
        raise HTTPException(status_code=422, detail=f"Unsupported simulation engine: {engine_name}")
    base_config = simulation.get("config")
    if not isinstance(base_config, dict):
        raise HTTPException(status_code=422, detail="Simulation config must be an object")
    config = {**base_config, **_effective_overrides(db, scenario), **payload.config_overrides}
    try:
        config = engine.validate(config)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    seed = payload.seed if payload.seed is not None else secrets.randbelow(2_147_483_648)
    run = SimulationRun(
        scenario_id=scenario.id,
        experiment_version=experiment.version,
        scenario_version=scenario.version,
        engine=engine.name,
        engine_version=engine.version,
        seed=seed,
        config=config,
        status="queued",
        progress=0,
        created_by_id=user.id,
    )
    db.add(run)
    db.flush()
    db.add(
        SimulationEvent(
            run_id=run.id,
            sequence=1,
            event_type="queued",
            message="Simulation queued",
            details={},
        )
    )
    db.commit()
    db.refresh(run)
    try:
        task = run_simulation.delay(str(run.id))
        run.celery_task_id = task.id
        db.commit()
        db.refresh(run)
    except Exception as exc:
        logger.exception("Could not enqueue simulation run %s", run.id)
        run.status = "failed"
        run.error = "Could not enqueue simulation worker"
        run.finished_at = utc_now()
        db.add(
            SimulationEvent(
                run_id=run.id,
                sequence=2,
                event_type="failed",
                message="Could not enqueue simulation worker",
                details={},
            )
        )
        db.commit()
        raise HTTPException(status_code=503, detail=run.error) from exc
    return run


@router.get("/runs/{run_id}", response_model=SimulationRunRead)
def get_run(run_id: UUID, user: CurrentUser, db: DbSession) -> SimulationRun:
    return _accessible_run(db, user.id, run_id)


@router.get("/runs/{run_id}/results")
def get_run_results(run_id: UUID, user: CurrentUser, db: DbSession) -> dict:
    run = _accessible_run(db, user.id, run_id)
    if run.status != "completed":
        raise HTTPException(status_code=409, detail="Simulation results are not complete")
    return {
        "run_id": run.id,
        "engine": run.engine,
        "engine_version": run.engine_version,
        "seed": run.seed,
        "experiment_version": run.experiment_version,
        "scenario_version": run.scenario_version,
        "config": run.config,
        "metrics": run.metrics,
    }


@router.get("/runs/{run_id}/events", response_model=list[SimulationEventRead])
def get_run_events(
    run_id: UUID, user: CurrentUser, db: DbSession
) -> list[SimulationEvent]:
    run = _accessible_run(db, user.id, run_id)
    return list(
        db.scalars(
            select(SimulationEvent)
            .where(SimulationEvent.run_id == run.id)
            .order_by(SimulationEvent.sequence)
        ).all()
    )


@router.post("/runs/{run_id}/cancel", response_model=SimulationRunRead)
def cancel_run(run_id: UUID, user: CurrentUser, db: DbSession) -> SimulationRun:
    run = _accessible_run(db, user.id, run_id)
    if run.status not in {"queued", "running"}:
        raise HTTPException(status_code=409, detail=f"Cannot cancel a run with status {run.status}")
    updated = db.execute(
        update(SimulationRun)
        .where(
            SimulationRun.id == run.id,
            SimulationRun.status.in_({"queued", "running"}),
        )
        .values(status="cancel_requested")
    )
    if updated.rowcount != 1:
        db.refresh(run)
        raise HTTPException(status_code=409, detail=f"Cannot cancel a run with status {run.status}")
    db.add(
        SimulationEvent(
            run_id=run.id,
            sequence=3,
            event_type="cancel_requested",
            message="Cancellation requested",
            details={},
        )
    )
    db.commit()
    db.refresh(run)
    return run
