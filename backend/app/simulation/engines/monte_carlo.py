import random
from collections import Counter
from collections.abc import Callable
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from backend.app.simulation.contracts import SimulationCancelled


class MonteCarloConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    trials: int = Field(default=5000, ge=100, le=50_000)
    periods: int = Field(default=12, ge=1, le=120)
    demand_min: float = Field(ge=0, le=1_000_000)
    demand_mode: float = Field(ge=0, le=1_000_000)
    demand_max: float = Field(ge=0, le=1_000_000)
    revenue_per_unit_min: float = Field(ge=0, le=1_000_000)
    revenue_per_unit_mode: float = Field(ge=0, le=1_000_000)
    revenue_per_unit_max: float = Field(ge=0, le=1_000_000)
    variable_cost_per_unit_min: float = Field(ge=0, le=1_000_000)
    variable_cost_per_unit_mode: float = Field(ge=0, le=1_000_000)
    variable_cost_per_unit_max: float = Field(ge=0, le=1_000_000)
    fixed_cost_per_period: float = Field(ge=0, le=1_000_000_000)
    starting_cash: float = Field(default=0, ge=0, le=1_000_000_000_000)

    @model_validator(mode="after")
    def ranges_are_ordered(self) -> "MonteCarloConfig":
        for label in ("demand", "revenue_per_unit", "variable_cost_per_unit"):
            low, mode, high = (getattr(self, f"{label}_{suffix}") for suffix in ("min", "mode", "max"))
            if not low <= mode <= high:
                raise ValueError(f"{label} must satisfy minimum ≤ most likely ≤ maximum")
        if self.trials * self.periods > 2_000_000:
            raise ValueError("Trials × periods cannot exceed 2,000,000")
        return self


class MonteCarloEngine:
    name = "monte_carlo"
    version = "1.0.0"

    def validate(self, config: dict[str, Any]) -> dict[str, Any]:
        try:
            return MonteCarloConfig.model_validate(config).model_dump()
        except ValidationError as exc:
            raise ValueError(f"Invalid Monte Carlo configuration: {exc.errors(include_url=False)}") from exc

    def run(
        self,
        config: dict[str, Any],
        seed: int,
        cancellation_requested: Callable[[], bool],
    ) -> dict[str, Any]:
        values = MonteCarloConfig.model_validate(config)
        rng = random.Random(seed)
        profits: list[float] = []
        for trial in range(values.trials):
            if trial % 128 == 0 and cancellation_requested():
                raise SimulationCancelled
            profit = 0.0
            for _ in range(values.periods):
                demand = rng.triangular(values.demand_min, values.demand_max, values.demand_mode)
                revenue_per_unit = rng.triangular(values.revenue_per_unit_min, values.revenue_per_unit_max, values.revenue_per_unit_mode)
                cost_per_unit = rng.triangular(values.variable_cost_per_unit_min, values.variable_cost_per_unit_max, values.variable_cost_per_unit_mode)
                profit += demand * (revenue_per_unit - cost_per_unit) - values.fixed_cost_per_period
            profits.append(profit)

        ordered = sorted(profits)
        mean_profit = sum(ordered) / len(ordered)
        minimum, maximum = ordered[0], ordered[-1]
        bucket_count = 20
        width = (maximum - minimum) / bucket_count if maximum > minimum else 0.0
        histogram = Counter(min(bucket_count - 1, int((profit - minimum) / width)) for profit in ordered) if width else Counter({0: len(ordered)})
        buckets = [
            {
                "label": f"{minimum + index * width:,.0f}",
                "low": round(minimum + index * width, 2),
                "high": round(minimum + (index + 1) * width, 2),
                "count": histogram[index],
            }
            for index in range(bucket_count)
        ]

        def percentile(percent: float) -> float:
            return ordered[min(len(ordered) - 1, int((len(ordered) - 1) * percent))]

        positive = sum(1 for profit in ordered if profit > 0)
        return {
            "trials": values.trials,
            "periods": values.periods,
            "mean_profit": round(mean_profit, 2),
            "p10_profit": round(percentile(0.10), 2),
            "median_profit": round(percentile(0.50), 2),
            "p90_profit": round(percentile(0.90), 2),
            "probability_positive_profit": round(positive / values.trials, 5),
            "starting_cash": values.starting_cash,
            "mean_ending_cash": round(values.starting_cash + mean_profit, 2),
            "histogram": buckets,
            "assumptions": [
                "Demand, revenue per unit, and variable cost per unit are sampled independently from triangular distributions.",
                "Values are user-provided minimum, most-likely, and maximum estimates; trials are not forecasts or probabilities calibrated to observed data.",
                "Fixed costs are constant in every period, and modelled periods are independent.",
                "The reported positive-profit share is conditional on this configuration and these distributions.",
            ],
        }
