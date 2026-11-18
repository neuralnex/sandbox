from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

from backend.app.ai.providers.openrouter import (
    OpenRouterConfigurationError,
    OpenRouterError,
    OpenRouterProvider,
)
from backend.app.api.deps import CurrentUser, DbSession
from backend.app.api.routes.simulations import _accessible_run
from backend.app.api.schemas import ExperimentInterpretation, IdeaInterpretInput, QueueingDraftConfig, RunInterpretation
from backend.app.db.models import Experiment, Scenario
from backend.app.simulation.engines.queueing import ENGINE_REGISTRY

router = APIRouter(prefix="/ai", tags=["AI assistance"])


@router.post("/interpret", response_model=ExperimentInterpretation)
async def interpret_idea(payload: IdeaInterpretInput, _: CurrentUser) -> ExperimentInterpretation:
    output_schema = ExperimentInterpretation.model_json_schema()
    messages = [
        {
            "role": "system",
            "content": (
                "You help users prepare experiments for a real simulation engine. "
                "Return a draft only. Never claim that a simulation was run or predict factual outcomes. "
                "Separate user-provided facts from assumptions. Use null for unknown variable values and "
                "list missing information as questions. The only currently supported simulation engine "
                "is queueing. Its configuration requires arrival_rate_per_hour, "
                "service_rate_per_hour_per_server, servers, and duration_hours. Do not invent values as "
                "facts. If a required value is absent, mark configuration_valid false and explain it."
            ),
        },
        {"role": "user", "content": payload.idea},
    ]
    try:
        raw = await OpenRouterProvider().generate_structured(messages, output_schema)
        interpreted = ExperimentInterpretation.model_validate(raw)
    except OpenRouterConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except OpenRouterError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=502, detail="AI response did not match the experiment schema") from exc

    engine = ENGINE_REGISTRY.get(interpreted.suggested_engine)
    if engine is None:
        interpreted.configuration_valid = False
        interpreted.configuration_errors.append(
            f"Unsupported engine '{interpreted.suggested_engine}'. Available engines: "
            f"{', '.join(sorted(ENGINE_REGISTRY))}."
        )
    else:
        try:
            config = engine.validate(interpreted.simulation_config.model_dump(exclude_none=True))
            interpreted.simulation_config = QueueingDraftConfig.model_validate(config)
        except ValueError as exc:
            interpreted.configuration_valid = False
            interpreted.configuration_errors.append(str(exc))
    interpreted.interpretation_notice = (
        "AI-generated experiment draft. Review its assumptions and configuration before saving or running."
    )
    return interpreted


@router.post("/runs/{run_id}/interpret", response_model=RunInterpretation)
async def interpret_run(run_id: UUID, user: CurrentUser, db: DbSession) -> RunInterpretation:
    run = _accessible_run(db, user.id, run_id)
    if run.status != "completed" or not run.metrics:
        raise HTTPException(status_code=409, detail="Only completed runs can be interpreted")
    scenario = db.get(Scenario, run.scenario_id)
    experiment = db.get(Experiment, scenario.experiment_id)
    schema = RunInterpretation.model_json_schema()
    messages = [
        {
            "role": "system",
            "content": (
                "Explain only the supplied outputs of a simulation. Do not claim the metrics are real-world "
                "observations, causal evidence, or forecasts. Do not add facts or recompute missing metrics. "
                "Describe notable relationships only when directly supported by the provided values. Name "
                "the model assumptions and limitations, and suggest follow-up experiments as questions. "
                "Keep the explanation concise and return only the requested structured object."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Objective: {experiment.objective}\nScenario: {scenario.name}\nEngine: {run.engine} "
                f"version {run.engine_version}\nSeed: {run.seed}\nConfiguration: {run.config}\n"
                f"Simulation outputs: {run.metrics}"
            ),
        },
    ]
    try:
        raw = await OpenRouterProvider().generate_structured(messages, schema)
        interpretation = RunInterpretation.model_validate(raw)
    except OpenRouterConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except OpenRouterError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=502, detail="AI response did not match the interpretation schema") from exc
    interpretation.interpretation_notice = (
        "AI-generated commentary on this run's model outputs. It does not validate the model or predict real-world outcomes."
    )
    return interpretation
