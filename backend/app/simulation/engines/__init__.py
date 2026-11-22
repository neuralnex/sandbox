from backend.app.simulation.contracts import SimulationEngine
from backend.app.simulation.engines.inventory import InventoryEngine
from backend.app.simulation.engines.monte_carlo import MonteCarloEngine
from backend.app.simulation.engines.queueing import QueueingEngine

ENGINE_REGISTRY: dict[str, SimulationEngine] = {
    "queueing": QueueingEngine(),
    "inventory": InventoryEngine(),
    "monte_carlo": MonteCarloEngine(),
}
