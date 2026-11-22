from uuid import UUID

from sqlalchemy import select, update

from backend.app.db.base import utc_now
from backend.app.db.models import SimulationEvent, SimulationRun
from backend.app.db.session import SessionLocal
from backend.app.simulation.contracts import SimulationCancelled
from backend.app.simulation.engines import ENGINE_REGISTRY
from backend.app.workers.celery_app import celery_app


def _write_event(db, run_id: UUID, sequence: int, kind: str, message: str) -> None:
    db.add(
        SimulationEvent(
            run_id=run_id,
            sequence=sequence,
            event_type=kind,
            message=message,
            details={},
        )
    )


def _cancellation_requested(run_id: UUID) -> bool:
    with SessionLocal() as db:
        status = db.scalar(select(SimulationRun.status).where(SimulationRun.id == run_id))
    return status in {"cancel_requested", "cancelled"}


@celery_app.task(name="sandbox.run_simulation")
def run_simulation(run_id_text: str) -> None:
    run_id = UUID(run_id_text)
    with SessionLocal() as db:
        run = db.get(SimulationRun, run_id)
        if run is None:
            return
        claimed = db.execute(
            update(SimulationRun)
            .where(SimulationRun.id == run_id, SimulationRun.status == "queued")
            .values(status="running", progress=5, started_at=utc_now())
        )
        if claimed.rowcount != 1:
            db.refresh(run)
            if run.status == "cancel_requested":
                run.status = "cancelled"
                run.finished_at = utc_now()
                _write_event(db, run.id, 4, "cancelled", "Run cancelled before execution")
                db.commit()
            return
        db.refresh(run)
        engine = ENGINE_REGISTRY.get(run.engine)
        if engine is None:
            run.status = "failed"
            run.error = f"Unsupported simulation engine: {run.engine}"
            run.finished_at = utc_now()
            _write_event(db, run.id, 2, "failed", run.error)
            db.commit()
            return
        _write_event(db, run.id, 2, "running", "Simulation worker started")
        db.commit()
        config = run.config
        seed = run.seed

    try:
        output = engine.run(config, seed, lambda: _cancellation_requested(run_id))
    except SimulationCancelled:
        with SessionLocal() as db:
            run = db.get(SimulationRun, run_id)
            if run is not None:
                run.status = "cancelled"
                run.progress = 0
                run.finished_at = utc_now()
                _write_event(db, run.id, 4, "cancelled", "Run cancelled by user")
                db.commit()
        return
    except Exception as exc:
        with SessionLocal() as db:
            run = db.get(SimulationRun, run_id)
            if run is not None:
                run.status = "failed"
                run.error = str(exc)[:4000]
                run.finished_at = utc_now()
                _write_event(db, run.id, 3, "failed", "Simulation failed")
                db.commit()
        raise

    with SessionLocal() as db:
        run = db.get(SimulationRun, run_id)
        if run is None:
            return
        if run.status == "cancel_requested":
            run.status = "cancelled"
            run.finished_at = utc_now()
            _write_event(db, run.id, 4, "cancelled", "Run cancelled by user")
        else:
            run.status = "completed"
            run.progress = 100
            run.metrics = output
            run.finished_at = utc_now()
            _write_event(db, run.id, 3, "completed", "Simulation finished")
        db.commit()
