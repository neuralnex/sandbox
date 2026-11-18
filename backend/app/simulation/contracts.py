from collections.abc import Callable
from typing import Any, Protocol


class SimulationCancelled(Exception):
    pass


class SimulationEngine(Protocol):
    name: str
    version: str

    def validate(self, config: dict[str, Any]) -> dict[str, Any]: ...

    def run(
        self,
        config: dict[str, Any],
        seed: int,
        cancellation_requested: Callable[[], bool],
    ) -> dict[str, Any]: ...
