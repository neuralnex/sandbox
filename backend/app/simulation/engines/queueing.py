import random
from collections.abc import Callable
from typing import Any

import simpy
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from backend.app.simulation.contracts import SimulationCancelled


class QueueingConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    arrival_rate_per_hour: float = Field(gt=0, le=10000)
    service_rate_per_hour_per_server: float = Field(gt=0, le=10000)
    servers: int = Field(ge=1, le=100)
    duration_hours: float = Field(gt=0, le=720)

    @model_validator(mode="after")
    def bound_total_arrivals(self) -> "QueueingConfig":
        if self.arrival_rate_per_hour * self.duration_hours > 100_000:
            raise ValueError("Expected arrivals exceed the built-in engine limit of 100,000")
        return self


class QueueingEngine:
    name = "queueing"
    version = "1.0.0"

    def validate(self, config: dict[str, Any]) -> dict[str, Any]:
        try:
            return QueueingConfig.model_validate(config).model_dump()
        except ValidationError as exc:
            raise ValueError(f"Invalid queueing configuration: {exc.errors(include_url=False)}") from exc

    def run(
        self,
        config: dict[str, Any],
        seed: int,
        cancellation_requested: Callable[[], bool],
    ) -> dict[str, Any]:
        values = QueueingConfig.model_validate(config)
        rng = random.Random(seed)
        environment = simpy.Environment()
        servers = simpy.Resource(environment, capacity=values.servers)
        arrivals = 0
        completed = 0
        total_busy_hours = 0.0
        waits: list[float] = []
        period_count = max(1, int(values.duration_hours + 0.999999))
        arrivals_by_period = [0] * period_count
        completed_by_period = [0] * period_count

        def serve_customer(arrival_time: float):
            nonlocal completed, total_busy_hours
            with servers.request() as request:
                yield request
                waits.append(environment.now - arrival_time)
                service_time = rng.expovariate(values.service_rate_per_hour_per_server)
                yield environment.timeout(service_time)
                total_busy_hours += service_time
                completed += 1
                if environment.now < values.duration_hours:
                    completed_by_period[min(period_count - 1, int(environment.now))] += 1

        def customer_arrivals():
            nonlocal arrivals
            while True:
                yield environment.timeout(rng.expovariate(values.arrival_rate_per_hour))
                if environment.now >= values.duration_hours:
                    return
                arrivals += 1
                arrivals_by_period[min(period_count - 1, int(environment.now))] += 1
                environment.process(serve_customer(environment.now))

        environment.process(customer_arrivals())
        steps = 0
        while environment.peek() < values.duration_hours:
            if steps % 128 == 0 and cancellation_requested():
                raise SimulationCancelled
            environment.step()
            steps += 1

        ordered_waits = sorted(waits)
        mean_wait = sum(waits) / len(waits) if waits else 0.0
        p95_wait = ordered_waits[min(len(ordered_waits) - 1, int(0.95 * len(ordered_waits)))] if waits else 0.0
        capacity_hours = values.duration_hours * values.servers
        return {
            "customers_arrived": arrivals,
            "customers_started_service": len(waits),
            "customers_served": completed,
            "customers_unfinished_at_horizon": len(waits) - completed,
            "mean_wait_minutes": round(mean_wait * 60, 3),
            "p95_wait_minutes": round(p95_wait * 60, 3),
            "server_utilization": round(total_busy_hours / capacity_hours, 5),
            "duration_hours": values.duration_hours,
            "series": [
                {"period": hour + 1, "arrivals": arrivals_by_period[hour], "completed": completed_by_period[hour]}
                for hour in range(period_count)
            ],
            "assumptions": [
                "Arrivals follow a Poisson process with an exponential inter-arrival time.",
                "Service times are exponentially distributed and servers are identical.",
                "Customers arriving before the horizon are counted; work after the horizon is unfinished.",
            ],
        }
