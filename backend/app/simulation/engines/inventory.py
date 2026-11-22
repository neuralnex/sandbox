import random
from collections.abc import Callable
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from backend.app.simulation.contracts import SimulationCancelled


class InventoryConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    average_daily_demand: float = Field(gt=0, le=100_000)
    demand_std_dev: float = Field(ge=0, le=100_000)
    reorder_point: int = Field(ge=0, le=1_000_000)
    order_quantity: int = Field(gt=0, le=1_000_000)
    lead_time_days: int = Field(ge=1, le=90)
    initial_inventory: int = Field(ge=0, le=1_000_000)
    duration_days: int = Field(ge=1, le=3650)
    unit_price: float = Field(default=1, ge=0, le=1_000_000)
    unit_cost: float = Field(default=0, ge=0, le=1_000_000)
    holding_cost_per_unit_day: float = Field(default=0, ge=0, le=1_000_000)
    stockout_cost_per_unit: float = Field(default=0, ge=0, le=1_000_000)


class InventoryEngine:
    name = "inventory"
    version = "1.0.0"

    def validate(self, config: dict[str, Any]) -> dict[str, Any]:
        try:
            return InventoryConfig.model_validate(config).model_dump()
        except ValidationError as exc:
            raise ValueError(f"Invalid inventory configuration: {exc.errors(include_url=False)}") from exc

    def run(
        self,
        config: dict[str, Any],
        seed: int,
        cancellation_requested: Callable[[], bool],
    ) -> dict[str, Any]:
        values = InventoryConfig.model_validate(config)
        rng = random.Random(seed)
        stock = values.initial_inventory
        incoming: dict[int, int] = {}
        total_demand = total_fulfilled = total_stockout = total_orders = 0
        total_revenue = total_purchase = total_holding = total_stockout_cost = 0.0
        series: list[dict[str, int | float]] = []

        for day in range(1, values.duration_days + 1):
            if day % 32 == 0 and cancellation_requested():
                raise SimulationCancelled
            stock += incoming.pop(day, 0)
            demand = max(0, int(round(rng.gauss(values.average_daily_demand, values.demand_std_dev))))
            fulfilled = min(stock, demand)
            stock -= fulfilled
            stockout = demand - fulfilled
            total_demand += demand
            total_fulfilled += fulfilled
            total_stockout += stockout
            revenue = fulfilled * values.unit_price
            holding = stock * values.holding_cost_per_unit_day
            stockout_cost = stockout * values.stockout_cost_per_unit
            total_revenue += revenue
            total_holding += holding
            total_stockout_cost += stockout_cost

            inventory_position = stock + sum(incoming.values())
            if inventory_position <= values.reorder_point:
                incoming[day + values.lead_time_days] = incoming.get(day + values.lead_time_days, 0) + values.order_quantity
                total_orders += 1
                total_purchase += values.order_quantity * values.unit_cost

            series.append({
                "period": day,
                "demand": demand,
                "fulfilled": fulfilled,
                "stockout": stockout,
                "inventory": stock,
            })

        return {
            "total_demand": total_demand,
            "units_fulfilled": total_fulfilled,
            "units_stocked_out": total_stockout,
            "fill_rate": round(total_fulfilled / total_demand, 5) if total_demand else 1.0,
            "replenishment_orders": total_orders,
            "ending_inventory": stock,
            "revenue": round(total_revenue, 2),
            "purchase_cost": round(total_purchase, 2),
            "holding_cost": round(total_holding, 2),
            "stockout_cost": round(total_stockout_cost, 2),
            "net_operating_result": round(total_revenue - total_purchase - total_holding - total_stockout_cost, 2),
            "duration_days": values.duration_days,
            "series": series,
            "assumptions": [
                "Daily demand is sampled from a normal distribution and values below zero are set to zero.",
                "Orders are placed at the end of each day when inventory position is at or below the reorder point.",
                "Orders arrive after a fixed lead time; this model uses a continuous review once per day.",
                "The model does not include perishability, supplier constraints, seasonality, or multiple SKUs.",
            ],
        }
