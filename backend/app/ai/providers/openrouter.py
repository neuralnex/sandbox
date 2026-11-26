import json
from typing import Any

import httpx

from backend.app.core.config import settings


class OpenRouterConfigurationError(RuntimeError):
    pass


class OpenRouterError(RuntimeError):
    pass


class OpenRouterProvider:
    """OpenRouter chat-completions adapter; callers still validate model output."""

    def __init__(self) -> None:
        if (
            not settings.openrouter_api_key
            or not settings.openrouter_api_key.get_secret_value()
            or not settings.openrouter_model
        ):
            raise OpenRouterConfigurationError(
                "Set OPENROUTER_API_KEY and OPENROUTER_MODEL before using AI features"
            )
        self.api_key = settings.openrouter_api_key.get_secret_value()
        self.model = settings.openrouter_model
        self.base_url = settings.openrouter_base_url.rstrip("/")

    async def generate(self, messages: list[dict[str, str]]) -> str:
        return await self._complete(messages)

    async def generate_structured(self, messages: list[dict[str, str]], schema: dict) -> dict:
        response = await self._complete(
            messages,
            response_format={"type": "json_schema", "json_schema": {"name": "sandbox_output", "strict": True, "schema": schema}},
            provider={"require_parameters": True},
        )
        try:
            parsed: Any = json.loads(response)
        except json.JSONDecodeError as exc:
            raise OpenRouterError("The model returned invalid JSON") from exc
        if not isinstance(parsed, dict):
            raise OpenRouterError("The model response must be a JSON object")
        return parsed

    async def _complete(self, messages: list[dict[str, str]], **options: Any) -> str:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if settings.openrouter_site_url:
            headers["HTTP-Referer"] = settings.openrouter_site_url
        if settings.openrouter_app_name:
            headers["X-Title"] = settings.openrouter_app_name
        payload = {"model": self.model, "messages": messages, **options}
        try:
            async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions", headers=headers, json=payload
                )
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise OpenRouterError(
                f"OpenRouter returned HTTP {exc.response.status_code}"
            ) from exc
        except httpx.HTTPError as exc:
            raise OpenRouterError("Could not reach OpenRouter") from exc

        try:
            content = response.json()["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise OpenRouterError("OpenRouter returned an unexpected response") from exc
        if not isinstance(content, str):
            raise OpenRouterError("OpenRouter returned an empty or non-text response")
        return content
