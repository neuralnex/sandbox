from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    app_name: str = "Sandbox API"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+psycopg://sandbox:sandbox@localhost:5432/sandbox"
    redis_url: str = "redis://localhost:6379/0"
    simulation_max_runtime_seconds: int = Field(default=600, gt=0)
    cors_origins: list[str] = ["http://localhost:3000"]
    waitlist_admin_emails: list[str] = []

    firebase_project_id: str | None = None
    firebase_web_api_key: SecretStr | None = None
    firebase_service_account_json: SecretStr | None = None

    openrouter_api_key: SecretStr | None = None
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str | None = None
    openrouter_site_url: str | None = None
    openrouter_app_name: str = "Sandbox"
    llm_timeout_seconds: float = Field(default=60, gt=0)

@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
