from datetime import datetime
from typing import Literal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterInput(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_]+$")
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    workspace_name: str | None = Field(default=None, min_length=1, max_length=160)


class LoginInput(BaseModel):
    identifier: str = Field(min_length=1, max_length=320)
    password: str = Field(min_length=1, max_length=128)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    username: str
    email: EmailStr | None
    created_at: datetime


class FirebaseTokenRead(BaseModel):
    id_token: str
    refresh_token: str
    expires_in: int
    token_type: str = "bearer"


class FirebaseRefreshInput(BaseModel):
    refresh_token: str = Field(min_length=1, max_length=4096)


class ProfileSyncInput(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_]+$")
    workspace_name: str | None = Field(default=None, min_length=1, max_length=160)


class OrganizationRead(BaseModel):
    id: UUID
    name: str
    role: str
    created_at: datetime


class ProjectCreate(BaseModel):
    organization_id: UUID
    name: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=5000)


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    organization_id: UUID
    created_by_id: UUID
    name: str
    description: str
    created_at: datetime
    updated_at: datetime


class ExperimentCreate(BaseModel):
    project_id: UUID
    environment_id: UUID | None = None
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=10000)
    objective: str = Field(default="", max_length=10000)
    domain: str = Field(default="general", min_length=1, max_length=80)
    specification: dict[str, Any] = Field(default_factory=dict)


class ExperimentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10000)
    objective: str | None = Field(default=None, max_length=10000)
    domain: str | None = Field(default=None, min_length=1, max_length=80)
    specification: dict[str, Any] | None = None
    environment_id: UUID | None = None


class ExperimentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    environment_id: UUID | None
    created_by_id: UUID
    title: str
    description: str
    objective: str
    domain: str
    specification: dict[str, Any]
    version: int
    created_at: datetime
    updated_at: datetime


class ExperimentVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    revision: int
    snapshot: dict[str, Any]
    created_by_id: UUID
    created_at: datetime


class ScenarioCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    overrides: dict[str, Any] = Field(default_factory=dict)


class ScenarioBranchInput(ScenarioCreate):
    pass


class ScenarioUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=160)
    overrides: dict[str, Any] | None = None


class ScenarioRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    experiment_id: UUID
    parent_id: UUID | None
    created_by_id: UUID
    name: str
    overrides: dict[str, Any]
    is_baseline: bool
    version: int
    created_at: datetime
    updated_at: datetime


class ScenarioVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    revision: int
    snapshot: dict[str, Any]
    created_by_id: UUID
    created_at: datetime


class SimulationRunCreate(BaseModel):
    seed: int | None = Field(default=None, ge=0, le=2_147_483_647)
    config_overrides: dict[str, Any] = Field(default_factory=dict)


class SimulationRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    scenario_id: UUID
    experiment_version: int
    scenario_version: int
    engine: str
    engine_version: str
    seed: int
    config: dict[str, Any]
    status: str
    progress: int
    metrics: dict[str, Any] | None
    error: str | None
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime


class SimulationEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    sequence: int
    event_type: str
    message: str
    details: dict[str, Any]
    created_at: datetime


class CompareRunsInput(BaseModel):
    run_ids: list[UUID] = Field(min_length=2, max_length=10)


class EnvironmentCreate(BaseModel):
    organization_id: UUID
    name: str = Field(min_length=1, max_length=160)
    environment_type: str = Field(pattern="^(real_world|digital_twin|synthetic)$")
    configuration: dict[str, Any] = Field(default_factory=dict)
    provenance: dict[str, Any] = Field(default_factory=dict)


class EnvironmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    organization_id: UUID
    created_by_id: UUID
    name: str
    environment_type: str
    configuration: dict[str, Any]
    provenance: dict[str, Any]
    version: int
    created_at: datetime
    updated_at: datetime


class DatasetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    source_url: str | None = Field(default=None, max_length=2000)
    license: str | None = Field(default=None, max_length=240)
    observed_at: datetime | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class DatasetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    environment_id: UUID
    created_by_id: UUID
    name: str
    source_url: str | None
    license: str | None
    observed_at: datetime | None
    metadata_json: dict[str, Any]
    created_at: datetime


class ReportCreate(BaseModel):
    format: Literal["json", "csv", "pdf"] = "json"


class ReportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    run_id: UUID
    created_by_id: UUID
    title: str
    format: str
    created_at: datetime


class IdeaInterpretInput(BaseModel):
    idea: str = Field(min_length=20, max_length=12000)


class VariableSuggestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    description: str
    value: str | float | int | bool | None
    unit: str | None
    rationale: str


class QueueingDraftConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    arrival_rate_per_hour: float | None
    service_rate_per_hour_per_server: float | None
    servers: int | None
    duration_hours: float | None


class ExperimentInterpretation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    objective: str
    domain: str
    assumptions: list[str]
    variables: list[VariableSuggestion]
    missing_information: list[str]
    suggested_engine: str
    simulation_config: QueueingDraftConfig
    configuration_valid: bool
    configuration_errors: list[str]
    interpretation_notice: str


class RunInterpretation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str
    findings: list[str]
    limitations: list[str]
    follow_up_questions: list[str]
    interpretation_notice: str
