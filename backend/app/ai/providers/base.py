from typing import Protocol


class LLMProvider(Protocol):
    async def generate(self, messages: list[dict[str, str]]) -> str: ...

    async def generate_structured(
        self, messages: list[dict[str, str]], schema: dict
    ) -> dict: ...
