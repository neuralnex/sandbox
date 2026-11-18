# **SANDBOX — Complete Product & Engineering Blueprint**

Independent product

AI + Simulation

Build from scratch

**Objective:** Build Sandbox yourself using VS Code and Codex, with a properly structured architecture, modular simulation engines, AI orchestration, real-world data, autonomous skills and an extensible experimentation environment.

One important decision: Sandbox will be a completely independent product. There will be **no HelixQA integration, dependency or requirement** in its architecture.

I recommend approaching this as an infrastructure product rather than simply building an AI chatbot with a simulation dashboard.

The platform should have a proper simulation engine underneath it. AI should help users construct experiments, configure environments, operate simulations and interpret results, but the actual calculations and simulation outcomes must come from executable models.

[Digital Twins, 3D GIS e Modelagem Urbana: A Revolução da Simulação Ambiental](https://images.openai.com/static-rsc-4/hUdmJFHi5g_yfqrvB9xxzdKv1XXfTKrRl-COjoWRyp_R9ps5iMHEQMrbLxxWluP7kVdX-CrJfXbsBrl9nqk93_2ZKiaQQi73BSnBPChVmN6h90Ar3OnFlXltmOmvnwYbyhlA_R0-0HNZhJjpJ1q_LAyqblPx_IyjZ7JKQBzhYT8?purpose=inline)

[The Engineering Platform | Precision AI for Design, Simulation & Production — Neodustria](https://images.openai.com/static-rsc-4/bEaafxJcFCpVc5u_ud3Ic4ZDa_Ldmo0IYEPT-5tWxi2xnNihmBxypDUoAFM7sxKAckhujEwLdDQRuGEa9ysEDi2gc6wRmZwsLi3A5Vty0LbP0GgeV0YD5W-psQ_ZC_2pyQbv2Agux0Pzrpz_FEjbqtrXwMP68dWgnUCZBCQ8sfQ?purpose=inline)

[How to Transform Your Airport Operations with AI Digital Twin Technology in 2025](https://images.openai.com/static-rsc-4/LGDsjTiMMrP6I9k0heKzy0F02I_HletcM2kN5DkXmd29T61uaYlhYVBHuN_WvflrJpD1IC3FBO8RnLMS-BhMFPC_sqnVXvgeoi8mdBLSNWMnvK2SJrxxA8bbtHvRu5buzlTbU_r2u5tL4cB9ZbRI4U-7EGygZQ1n0itinaskDk8?purpose=inline)

14

## **1. Product definition**

**Product name:** Sandbox

**Product category:** AI-powered real-world experimentation and simulation infrastructure.

**Core proposition:**

Think of an idea. Construct its environment. Introduce variables. Simulate possible realities. Observe what happens. Take the results with you before making real-world decisions.

Sandbox should serve:

- Entrepreneurs testing business ideas.
- Researchers conducting experiments.
- Engineers testing systems.
- Developers testing autonomous agents.
- Urban planners evaluating development proposals.
- Agricultural researchers testing farming scenarios.
- Organisations evaluating operational decisions.
- Individuals exploring hypothetical situations.

This is the product's broader audience over time, not a commitment to build for every group at once. The initial customer and use case are already defined by the product strategy; use them to choose the first supported experiment, simulation model, data sources and onboarding flow. Expand to other audiences when the core workflow is proven.

### **The fundamental product philosophy**

Every experiment should have five things:

1. An idea or hypothesis.
2. An environment.
3. Variables and assumptions.
4. An executable simulation.
5. Results that can be inspected and reproduced.

A simulation should never be presented as a factual prediction simply because AI generated it. Sandbox must distinguish between observed data, user assumptions, modelled outputs and uncertain estimates.

## **2. Product architecture at a glance**

**SANDBOX USER WORKSPACE**

Ideas · Projects · Environments · Experiments · Reports

**Idea Interpreter**

Natural language to experiment

**Environment Engine**

Real, digital twin, synthetic

**Scenario Engine**

What-if variables and branching

**Autonomous Skills**

Specialised AI capabilities

**SIMULATION ORCHESTRATOR**

Schedules and coordinates execution

Agent-based

Discrete-event

Geospatial

**RESULTS & ANALYTICS ENGINE**

Metrics · Visualisations · Comparisons · Reports

**DATA & STORAGE INFRASTRUCTURE**

PostgreSQL · PostGIS · Redis · Object Storage

The most important architectural principle is that these components must communicate through defined interfaces. You should be able to add another simulation engine without rebuilding the entire application.

## **3. Technology stack**

I recommend a Python-first simulation backend with a TypeScript web application.

This fits the nature of Sandbox: most simulation libraries, scientific computing tools, geospatial processing and AI infrastructure are strongest in Python.

[Making a custom 404 page in Next.js - DEV Community](https://images.openai.com/static-rsc-4/bLlalbNp6jrlR_MDbXrZboKQVewUYbl540tPaxrKHfeYhkUuIbcY24EuZwqdvoz2T6syE51AVhW2nzEAnbXMhFU1S9FS9hfRUHcmE0rqe4-MftFGYbc3hxELPbunRQ4RO1h7brQUYFBkCbuY4CGkHzzUDPnQR728ILI1Y17qp2M?purpose=inline)

**Frontend — Next.js + TypeScript**

Workspace, dashboards, maps and simulation controls

[GitHub - thevkrant/morse_code: Morse code is a method of transmitting text information as a series of on-off tones lights or clicks that can be directly understood by a skilled listener or observer without special equipment. It is named for Samuel F. B. Morse. Every character in the English language is substituted by a series of dots and dashes or something just singular dot or dash. · GitHub](https://images.openai.com/static-rsc-4/urfnHK6zfHhc4B3R1e0oqA7y8Vz4MVLbH4OkbEzp4ebiLf4GTPEzcrMq0g_u9dOKD9WtiCsX1xicbi1zCOCmsU7j0U2CpN8O76md71nd7cu1RcWbDdn6SDRiXMKinT5IfvrkoqB5kmNDq66qlVhyACf4H_8owV3q1znxDE3C7JE?purpose=inline)

**Backend — Python + FastAPI**

API, experiment management, AI orchestration

[Postgresql Logo PNG Transparent With Clear Background ID 473068 |  TOPpng](https://images.openai.com/static-rsc-4/x6sDZ8oKI9URixQ5E82vqCQV1aR38qK7E8n0HKggx6_cD8G7QtlPuHlyO99GalHPJOycjs41bPgfrRTqdHFqayPWJl57hxNttQynREzHXSUSsui_zVAB_ssyc1xdm_msJ5GiDzf23C9Z2RuuoyVCc6J0AbuAqX5Aul_x1J78q2I?purpose=inline)

**Database — PostgreSQL + PostGIS**

Projects, simulation metadata and geographic information

[Redis Logo PNG Vector (SVG) Free Download](https://images.openai.com/static-rsc-4/epIZvTJqrn11fZoyLAql3XQvzvr05WTs4k_hS-9tdnMQyi9Nak_EpGx1d16Qeud3z3mmGKrPzkfB8l4M10kTA8OEXwDm6CtTKKvBDOawlkZbKJwF8Jjm3IiHXcBUIohDPkufesDQyxMCNKXpFH79YSUkxtDVtdaR-HKvPqdpBXw?purpose=inline)

**Queue — Redis + Celery**

Long-running simulations and background jobs

[Learn How to Develop, Deploy, and Run Your Application with Docker | by Neeraj Kushwaha | Medium](https://images.openai.com/static-rsc-4/vpeCahKUt8HLTzNJcfyZuraqvPe4DYkQcZ6H_bYFxktcjGE9IzKNCy_2wzufjFg1CV4gCPUSKqyNqOP1LsjwqsGi_Ptm9bXovNu4KVQgDh00UrSckl0PXpeQz3Fy185kJss3Wgjsqi7965WWyoiWi3LAsk2u_qRKHUOJ4rIUl0s?purpose=inline)

**Infrastructure — Docker**

Reproducible services and isolated simulation workers

[GitHub - maplibre/maplibre-native: MapLibre Native - Interactive vector tile maps for iOS, Android and other platforms. · GitHub](https://images.openai.com/static-rsc-4/l5yGsKjZu4Fmpo8fhsbG-wJa6eHbYmr6FlXWfx_HjhnYX4BQZq8mauxIp2SsouVJZcMr-ANYi_ijQKRlTY_iyex6tLxA4eWFdvV8w40fai3e5enX34mhfYfhy9U4SfHEoeqHQchU-WxJVSBmIbDhmWGlXNyBciLv5FShxhUDLmE?purpose=inline)

**Geospatial — MapLibre + GeoPandas**

Maps, location data and geographic simulation

### **Recommended libraries**

| Area                      | Technology                                        |
| ------------------------- | ------------------------------------------------- |
| API                       | FastAPI                                           |
| Validation                | Pydantic                                          |
| ORM                       | SQLAlchemy                                        |
| Migrations                | Alembic                                           |
| Testing                   | Pytest                                            |
| Numerical computing       | NumPy, SciPy                                      |
| Data analysis             | Pandas                                            |
| Agent-based simulation    | Mesa                                              |
| Discrete-event simulation | SimPy                                             |
| Sensitivity analysis      | SALib                                             |
| Geospatial analysis       | GeoPandas, Shapely                                |
| Geographic networks       | OSMnx, NetworkX                                   |
| Raster data               | Rasterio                                          |
| Maps                      | MapLibre GL JS                                    |
| 3D environments           | Three.js; CesiumJS where globe-scale 3D is needed |
| Frontend                  | Next.js, TypeScript                               |
| UI                        | Tailwind CSS, shadcn/ui                           |
| Frontend state            | Zustand                                           |
| API state                 | TanStack Query                                    |
| Charts                    | ECharts                                           |
| File storage              | S3-compatible object storage                      |
| Job execution             | Celery, Redis                                     |

You do not need all these libraries in Phase 1. Add them when their corresponding simulation capabilities are implemented.

### **AI provider architecture**

Create a provider-independent LLM interface.

For example:

```
class LLMProvider:    async def generate(self, messages, response_schema=None):        raise NotImplementedError    async def generate_structured(self, prompt, schema):        raise NotImplementedError
```

You can implement providers for OpenRouter and other compatible services later.

Never let the LLM directly determine simulation results. It should generate structured configurations, call approved tools and explain outputs from the simulation engine.

## **4. The six core systems**

### **A. Idea Interpreter**

[Introducing Vellum Agent Builder](https://images.openai.com/static-rsc-4/jrAz1MDd6gImEmKRe61XCwjsqz1pGCuUjlrZmYu8aaQohskP3qpYp_F5Onild4UAoY1HtLeNyY4lnZ93XlZ1zBEJnMRHemySJ7P8RTzmytk-dzA1XlVzSDL0FvwYmxfTX6Z93jyOs0OJf7vf7FlZPAOCz8EaUz0UQoo1XP9ng6Y?purpose=inline)

[vellum.ai](https://www.vellum.ai/blog/introducing-vellum-copilot?utm_source=chatgpt.com)

This is where users start.

A user might write:

"Simulate opening a 24-hour supermarket in Owerri with ₦20 million capital. Consider traffic, customer demand, nearby competitors and operating expenses."

The interpreter converts this into a structured experiment specification.

Example:

```
{
  "title": "Owerri Supermarket Experiment",
  "domain": "business",
  "environment": {
    "type": "real_world",
    "location": "Owerri, Nigeria"
  },
  "variables": [
    "capital",
    "customer_demand",
    "competitors",
    "operating_costs",
    "traffic"
  ],
  "scenarios": [
    "baseline",
    "high_demand",
    "low_demand",
    "high_competition"
  ],
  "simulation": {
    "engine": "discrete_event",
    "duration_days": 365
  }
}
```

This is illustrative, not a hardcoded business simulator.

The interpreter should:

- Identify the user's objective.
- Extract variables.
- Identify missing information.
- Suggest relevant datasets.
- Recommend simulation engines.
- Generate an experiment configuration.
- Ask for approval before execution when assumptions are significant.

**Important:** Build schema validation between the AI output and the simulation system. Never execute raw LLM output.

### **B. Environment Engine**

[Main Sequence - Our investment in Terria: Powering the Next Generation of maps and Digital Twins](https://images.openai.com/static-rsc-4/9uOG-jrDPh0bVYkyoTmvKg2RvC6oleivEg1J__WZ7w3aSFBhWfMC3_NHlRX9SpLPfWLqDZB0K6_kBCqHEsg5IzopxahNXjloU-TZKozZQN9UOoCljEmPsl-suJiF95dPbsv1C-88V9UDHpMZHm15_d-JkMGylLvEhfG0yX1w1wg?purpose=inline)

[Frontiers | An empirical evaluation of enhanced teleportation for navigating large urban immersive virtual environments](https://images.openai.com/static-rsc-4/mOndKvuFl2R3u_KnZVV47wByzOm4IlDplnOqUzDLOSHhMUz0MTer0O0YoJAweuZ_E0zgvrUmnWdPONaJIrf5EnolxNp0XGPQLnIoSiyMwYIGxUW_oB3qHuf7_TOUV3OIdDrcJQJnBZ3rOALnPAXOnk68Fg9FNAXNsgTmu_vVV-Y?purpose=inline)

[Digital twin features | Powerful core capabilities | Terria](https://images.openai.com/static-rsc-4/2zrfAZ125rUpTElJaSS6EOhZcjGNa3hVfoDT0OXlG2ZB37jIVoDi0Vb8HnqJU75P2_dtJ9m523r7j6KdfO8Jq2FTfCFY4mfISWS5flMR6EqOJwzuTjvPuoQEMYWUCJjty5IMN_i1ZpO_lweVuHnI6qSmBoWJ40dcByiwJkE-cNU?purpose=inline)

14

Three environment types:

| Environment  | Description                                                       |
| ------------ | ----------------------------------------------------------------- |
| Real-world   | Uses actual datasets and geographic information                   |
| Digital twin | Reconstructs a selected physical environment using available data |
| Synthetic    | Creates a fictional environment with configurable properties      |

Every environment needs:

- Unique ID.
- Environment type.
- Geographic boundaries, if applicable.
- Dataset references.
- Entities and attributes.
- Environmental conditions.
- Version information.
- Data provenance.
- Configuration.

A digital twin does not have to be a photorealistic 3D recreation. A GIS representation with accurate geographic features can be a useful digital twin for many experiments.

**Suggested data sources:**

- OpenStreetMap — roads, buildings and points of interest.
- NASA POWER — meteorological information.
- WorldPop — population estimates.
- Copernicus Data Space — satellite and environmental data.
- Open-Meteo — weather information.

Data licensing, resolution, geographic coverage and update dates must be recorded for every dataset.

### **C. Scenario Engine — What If?**

This should become one of Sandbox's most important features.

Users should be able to change a condition and rerun an experiment without destroying the original.

Example:

**Experiment: Supermarket in Owerri**

Baseline assumptions

Initial capital

# **₦20m**

Operating period

# **365 days**

**What-if changes**

Customer demand change

**+20%**

Operating cost change

**+15%**

Additional competitors

**2**

Illustrative scenario configuration. No simulation has been executed.

Explore this scenario

The actual engine should support:

- Scenario branching.
- Parameter overrides.
- Multiple scenario comparisons.
- Baseline preservation.
- Sensitivity analysis.
- Random seeds.
- Monte Carlo experiments.
- Scenario history.

Each branch should reference the original experiment and contain only its changed parameters and configuration.

### **D. Simulation Engine**

This is the technical heart of Sandbox.

Do not build a single giant simulation engine.

Build a common interface and multiple specialised engines.

| Engine          | Purpose                                               |
| --------------- | ----------------------------------------------------- |
| System dynamics | Relationships, feedback loops and changing quantities |
| Agent-based     | Individuals, businesses and autonomous agents         |
| Discrete-event  | Queues, logistics, operations and processes           |
| Geospatial      | Location, distance, movement and spatial interactions |
| Monte Carlo     | Uncertainty and probabilistic outcomes                |
| Physics         | Physical interactions and environmental processes     |

Each engine should implement a standard interface:

```
class SimulationEngine:    def validate(self, config):        ...    def prepare(self, config, environment):        ...    def run(self, context):        ...    def collect_results(self, context):        ...    def cleanup(self, context):        ...
```

The orchestrator should not need to know the internal implementation of each engine.

### **E. Autonomous Skills Engine**

[Technology | Inside the Barnabus Architecture](https://images.openai.com/static-rsc-4/8MCvzwGDpcsDf0aMt8KfWjyT3LkE8fgqMfqsIlP9ADWzbCr8XcLlCX50dlFBCFiBEiEPOpFRAcuIO0ZZXtDpJiwLupcAZ2rLDapYajHI4GfMVqUUYG9tFKeSg-6JvF8yxlnGF5ntz-wwRFvPdOMmY_KacVbkeQWKSjzpkCYF--U?purpose=inline)

[barnabus.ai](https://barnabus.ai/technology?utm_source=chatgpt.com)

This is different from simply adding an AI assistant.

A skill is a small, specialised capability that can be executed independently or coordinated with other skills.

Initial built-in skills:

| Skill               | Responsibility                        |
| ------------------- | ------------------------------------- |
| Idea Analyzer       | Understands experiment objectives     |
| Environment Builder | Configures environments               |
| Data Researcher     | Finds and evaluates relevant datasets |
| Scenario Generator  | Creates alternative scenarios         |
| Variable Analyzer   | Identifies important parameters       |
| Simulation Operator | Starts and monitors simulations       |
| Risk Analyzer       | Identifies potential risks            |
| Result Interpreter  | Explains outputs                      |
| Report Generator    | Produces final reports                |

All skills should follow a standard contract.

For example:

```
{
  "name": "scenario_generator",
  "version": "1.0.0",
  "description": "Generates alternative simulation scenarios",
  "input_schema": {},
  "output_schema": {},
  "permissions": [
    "read_experiment",
    "create_scenario"
  ],
  "execution": {
    "timeout_seconds": 60,
    "requires_approval": false
  }
}
```

There should be four ways to use skills:

1. Manually activate an individual skill.
2. Let Sandbox select appropriate skills.
3. Build a custom workflow combining skills.
4. Create, upload and share skills.

For user-uploaded executable skills, use isolated worker containers, resource limits, permission checks and strict execution policies. Do not execute arbitrary uploaded Python code inside your API server.

Start with declarative skills that call approved internal tools. Introduce arbitrary executable plugins only after the security infrastructure is ready.

### **F. Results and Reporting Engine**

[Solutions to healthcare challenges: from hospital design to disease spread – AnyLogic Simulation Software](https://images.openai.com/static-rsc-4/87UXaa9JlhhMwrOGAFj9RSjmkkhal7t9mBVrnN6oEKuENhUd6hZmUKXykYQ_E0OI5UeUHSzUcEkkiR6ur3ffJikD5ZTGaDtlHrRQYV8QGnOHjadJXaZPD4gi3sVYq7rtqWyFNrpGSlG8bNXH40W_wE5N45PNQ8eDHqSppiWUI3s?purpose=inline)

[City: dynamic 3d spatial+time analytics](https://images.openai.com/static-rsc-4/vbo5NjMqIj08OC0o8r4Fxsr5zrzouA_26Dwd0xKwSR-RHOWNdBaskupCpzvTZGFi7Lo46dWWuv4Nx1CzUPigZc-K61idO4FruYZghiJYxL-TukvqJW7eJ0iqYCK34U_RXYr9RnFUm1PTZJpkpXYQEGVvl083zQi6DMgNWBY3NjA?purpose=inline)

[Probabilistic Forecasting 101: Everything You Need to Know | Nave](https://images.openai.com/static-rsc-4/2a6WpZQQslPHNf0PHwaBJtwkgprHFRc2O6kp5CUqNJyLxs9TLUmaf0rEDWRXzapnnDpx5XMtMyL0NvBpwVmskYJuCryVKgU7NEQf6UJX9QhuLA8ZlevdDeGqoWQqHoj3HjBs-Jq7oEPqYSuqsVyQSJNUk5uRWGqMHAUG9wLHjko?purpose=inline)

10

Every completed experiment should generate a results package containing:

- Executive summary.
- Original hypothesis.
- Environment description.
- Data sources and dates.
- Assumptions.
- Simulation configuration.
- Variables tested.
- Scenario comparisons.
- Charts and visualisations.
- Risks and uncertainty.
- Recommendations.
- Reproducibility information.

Export formats:

- PDF.
- CSV.
- JSON.
- Reusable experiment configuration.

Also support an interactive results view so users can inspect what happened rather than relying only on a generated report.

## **5. Database architecture**

Use PostgreSQL as the main relational database and PostGIS for spatial data.

I recommend designing the schema around experiments rather than around individual dashboards.

### **Core entities**

| Table                | Purpose                                      |
| -------------------- | -------------------------------------------- |
| users                | User accounts                                |
| organizations        | Teams and workspaces                         |
| projects             | Collections of related experiments           |
| experiments          | Main experiment definitions                  |
| environments         | Real, synthetic or digital twin environments |
| datasets             | External and uploaded data references        |
| experiment_variables | Parameters and assumptions                   |
| scenarios            | Baseline and what-if branches                |
| simulation_runs      | Individual execution records                 |
| engine_registry      | Available simulation engines                 |
| run_metrics          | Numerical outputs                            |
| run_events           | Execution events and progress                |
| artifacts            | Generated files and visualisations           |
| skills               | Registered autonomous skills                 |
| skill_versions       | Versioned skill definitions                  |
| skill_executions     | Individual skill execution history           |
| reports              | Generated experiment reports                 |
| audit_logs           | Important user and system actions            |

### **Important database relationships**

```
User
 └── Organization
      └── Project
           └── Experiment
                ├── Environment
                ├── Dataset References
                ├── Variables
                ├── Scenarios
                │    └── Simulation Runs
                │         ├── Metrics
                │         ├── Events
                │         └── Artifacts
                ├── Skill Executions
                └── Reports
```

### **Important design decisions**

**Experiments must be versioned.**

A user should be able to return to an experiment and understand precisely what was run.

**Simulation runs must be immutable records.**

Never overwrite a completed run. A new configuration produces a new run.

**Scenarios should support branching.**

A baseline can have multiple children, and those children can have further branches.

**Store large files outside PostgreSQL.**

Use S3-compatible storage for datasets, simulation artifacts, exported reports and large result files. Store their metadata and object keys in PostgreSQL.

**Track provenance.**

For every output, record which engine, version, configuration, dataset and random seed produced it.

## **6. API architecture**

Use REST for the main application API and WebSockets for live simulation progress.

Recommended API prefix:

`/api/v1`

### **Authentication and workspace**

| Method | Endpoint         | Purpose         |
| ------ | ---------------- | --------------- |
| POST   | `/auth/register` | Register        |
| POST   | `/auth/login`    | Login           |
| GET    | `/users/me`      | Current user    |
| GET    | `/organizations` | List workspaces |
| POST   | `/projects`      | Create project  |
| GET    | `/projects`      | List projects   |

### **Experiments**

| Method | Endpoint                      | Purpose                         |
| ------ | ----------------------------- | ------------------------------- |
| POST   | `/experiments`                | Create experiment               |
| GET    | `/experiments/{id}`           | Get experiment                  |
| PATCH  | `/experiments/{id}`           | Update experiment               |
| POST   | `/experiments/{id}/interpret` | Interpret natural-language idea |
| POST   | `/experiments/{id}/validate`  | Validate specification          |
| GET    | `/experiments/{id}/versions`  | View history                    |

### **Environments**

| Method | Endpoint                      | Purpose             |
| ------ | ----------------------------- | ------------------- |
| POST   | `/environments`               | Create environment  |
| GET    | `/environments`               | Browse environments |
| GET    | `/environments/{id}`          | Environment details |
| POST   | `/environments/{id}/datasets` | Attach dataset      |
| POST   | `/environments/{id}/clone`    | Clone environment   |

### **Scenarios**

| Method | Endpoint                      | Purpose           |
| ------ | ----------------------------- | ----------------- |
| POST   | `/experiments/{id}/scenarios` | Create scenario   |
| GET    | `/experiments/{id}/scenarios` | List scenarios    |
| POST   | `/scenarios/{id}/branch`      | Branch scenario   |
| PATCH  | `/scenarios/{id}`             | Modify scenario   |
| POST   | `/scenarios/{id}/compare`     | Compare scenarios |

### **Simulation runs**

| Method | Endpoint               | Purpose            |
| ------ | ---------------------- | ------------------ |
| POST   | `/scenarios/{id}/runs` | Start simulation   |
| GET    | `/runs/{id}`           | Run details        |
| POST   | `/runs/{id}/cancel`    | Cancel execution   |
| GET    | `/runs/{id}/results`   | Retrieve results   |
| GET    | `/runs/{id}/events`    | Execution history  |
| GET    | `/runs/{id}/stream`    | WebSocket progress |

### **Autonomous skills**

| Method | Endpoint                  | Purpose                |
| ------ | ------------------------- | ---------------------- |
| GET    | `/skills`                 | Browse skills          |
| POST   | `/skills`                 | Create skill           |
| POST   | `/skills/{id}/versions`   | Publish version        |
| POST   | `/skills/{id}/execute`    | Execute skill          |
| GET    | `/skills/{id}/executions` | Execution history      |
| POST   | `/skills/{id}/install`    | Add skill to workspace |

### **Reports**

| Method | Endpoint                 | Purpose         |
| ------ | ------------------------ | --------------- |
| POST   | `/runs/{id}/reports`     | Generate report |
| GET    | `/reports/{id}`          | Retrieve report |
| GET    | `/reports/{id}/download` | Download report |

Implement pagination, ownership checks, request validation, rate limiting and consistent error responses across these endpoints.

## **7. Simulation execution lifecycle**

This is one of the most important areas to get right.

A simulation might take a few seconds or several hours. It must never depend on a browser request staying open.

Recommended lifecycle:

\#chatgpt-mermaid-\_r_1ji\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(13, 13, 13);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_1ji\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_1ji\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_1ji\_ .error-icon{fill:rgb(243, 243, 243);}#chatgpt-mermaid-\_r_1ji\_ .error-text{fill:rgb(13, 13, 13);stroke:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_1ji\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_1ji\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_1ji\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_1ji\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_1ji\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_1ji\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_1ji\_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_1ji\_ .marker.cross{stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_1ji\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_1ji\_ p{margin:0;}#chatgpt-mermaid-\_r_1ji\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_1ji\_ .cluster-label text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_1ji\_ .cluster-label span{color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_1ji\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_1ji\_ .label text,#chatgpt-mermaid-\_r_1ji\_ span{fill:rgb(13, 13, 13);color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_1ji\_ .node rect,#chatgpt-mermaid-\_r_1ji\_ .node circle,#chatgpt-mermaid-\_r_1ji\_ .node ellipse,#chatgpt-mermaid-\_r_1ji\_ .node polygon,#chatgpt-mermaid-\_r_1ji\_ .node path{fill:rgb(222, 234, 251);stroke:rgb(83, 154, 248);stroke-width:1px;}#chatgpt-mermaid-\_r_1ji\_ .rough-node .label text,#chatgpt-mermaid-\_r_1ji\_ .node .label text,#chatgpt-mermaid-\_r_1ji\_ .image-shape .label,#chatgpt-mermaid-\_r_1ji\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_1ji\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_1ji\_ .rough-node .label,#chatgpt-mermaid-\_r_1ji\_ .node .label,#chatgpt-mermaid-\_r_1ji\_ .image-shape .label,#chatgpt-mermaid-\_r_1ji\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_1ji\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_1ji\_ .root .anchor path{fill:rgb(143, 143, 143)!important;stroke-width:0;stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_1ji\_ .arrowheadPath{fill:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_1ji\_ .edgePath .path{stroke:rgb(143, 143, 143);stroke-width:1px;}#chatgpt-mermaid-\_r_1ji\_ .flowchart-link{stroke:rgb(143, 143, 143);fill:none;}#chatgpt-mermaid-\_r_1ji\_ .edgeLabel{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-\_r_1ji\_ .edgeLabel p{background-color:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_1ji\_ .edgeLabel rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_1ji\_ .labelBkg{background-color:rgba(252, 252, 252, 0.5);}#chatgpt-mermaid-\_r_1ji\_ .cluster rect{fill:rgb(243, 243, 243);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_1ji\_ .cluster text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_1ji\_ .cluster span{color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_1ji\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(243, 243, 243);border:1px solid rgba(0, 0, 0, 0.1);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_1ji\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_1ji\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_1ji\_ .icon-shape,#chatgpt-mermaid-\_r_1ji\_ .image-shape{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-\_r_1ji\_ .icon-shape p,#chatgpt-mermaid-\_r_1ji\_ .image-shape p{background-color:rgb(252, 252, 252);padding:2px;}#chatgpt-mermaid-\_r_1ji\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_1ji\_ .image-shape .label rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_1ji\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_1ji\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_1ji\_ .node .neo-node{stroke:rgb(83, 154, 248);}#chatgpt-mermaid-\_r_1ji\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_1ji\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_1ji\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_1ji\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1ji\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_1ji\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_1ji\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_1ji\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1ji\_ [data-look="neo"].node .neo-line path{stroke:rgb(83, 154, 248);filter:none;}#chatgpt-mermaid-\_r_1ji\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_1ji\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1ji\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_1ji\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_1ji\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1ji\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_1ji\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1ji\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(0, 79, 153);}#chatgpt-mermaid-\_r_1ji\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(0, 79, 153);}#chatgpt-mermaid-\_r_1ji\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_1ji\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_1ji\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-width:1px;}#chatgpt-mermaid-\_r_1ji\_ .node rect,#chatgpt-mermaid-\_r_1ji\_ .node circle,#chatgpt-mermaid-\_r_1ji\_ .node ellipse,#chatgpt-mermaid-\_r_1ji\_ .node polygon,#chatgpt-mermaid-\_r_1ji\_ .node path{fill:rgb(229, 243, 255);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_1ji\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_1ji\_ .mermaid-decision .label-container{fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-dasharray:2,2;}#chatgpt-mermaid-\_r_1ji\_ .edgePaths .flowchart-link{stroke:rgb(143, 143, 143);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_1ji\_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_1ji\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}User creates experimentIdea InterpreterGenerate structuredspecificationValidate configurationValid?Request correctionsCreate scenarioSimulation OrchestratorQueue execution jobIsolated simulation workerExecute selected engineCollect metrics and eventsPersist results and artifactsAnalyse resultsGenerate reportCompleted experimentNoYes

### **Run statuses**

Use a defined state machine:

- `draft`
- `validated`
- `queued`
- `preparing`
- `running`
- `completed`
- `failed`
- `cancel_requested`
- `cancelled`

A run should have:

- Run ID.
- Experiment ID.
- Scenario ID.
- Engine and version.
- Start and end times.
- Execution parameters.
- Random seed.
- Progress information.
- Resource usage.
- Error details.
- Output references.

### **Execution isolation**

Do not run simulation code directly in FastAPI request handlers.

Use dedicated workers.

For initial development, Docker containers with restricted permissions, CPU/memory limits and timeouts are sufficient for controlled built-in engines.

For later execution of untrusted user-created skills or simulation code, introduce stronger sandboxing such as gVisor or microVM isolation, with network access disabled by default.

# **8. Frontend product structure**

I recommend a desktop-first web application that remains responsive on mobile.

The interface should feel like a combination of a scientific research workspace, an engineering control room and a modern AI development environment.

[The Engineering Platform | Precision AI for Design, Simulation & Production — Neodustria](https://images.openai.com/static-rsc-4/bEaafxJcFCpVc5u_ud3Ic4ZDa_Ldmo0IYEPT-5tWxi2xnNihmBxypDUoAFM7sxKAckhujEwLdDQRuGEa9ysEDi2gc6wRmZwsLi3A5Vty0LbP0GgeV0YD5W-psQ_ZC_2pyQbv2Agux0Pzrpz_FEjbqtrXwMP68dWgnUCZBCQ8sfQ?purpose=inline)

[pan-ui — Hermes Agent Workspaces & GUIs | Hermes Atlas](https://images.openai.com/static-rsc-4/0HqpR6lQ07A0nevrEHjuKP_KM-rLeVZQxb03g0MXGGc89tqnbqsueIjHoiNMXoVv_qRMh4Br_lhxa5E3jAKBSvPKCToDnRTSvKfo5ENOf5C_uzcMPY5g3ZAbG0yG1mr9ES5gAK9T8pdT4mifPYtYhbwo79iHhIaZbSgzCoz9Bms?purpose=inline)

[Spatial Intelligence Platform for Territorial Decision-Making | Modern Generation](https://images.openai.com/static-rsc-4/MklejZSP_ZcOBzCY1RRB1qBAH-vPxIGQxWV_K4eHWzZoo3Uei9S1B9GaqM5AqkqeyGXS4UY2d9ndQ7hG6ozd32Z9crz2EoNZggeXHgT2VHZQ1IQ2ShokK5nEasdALVD-_C8FMEjXRM89sWjjVn-i_zOIIoXjEAUs41kSBkRYjns?purpose=inline)

13

### **Main navigation**

| Screen               | Purpose                                        |
| -------------------- | ---------------------------------------------- |
| Dashboard            | Overview of projects and recent experiments    |
| Explore              | Browse environments, simulations and templates |
| Create Experiment    | Describe and configure an idea                 |
| Environment Studio   | Construct and edit environments                |
| Experiment Workspace | Control variables and scenarios                |
| Simulation Monitor   | Watch running simulations                      |
| Results Studio       | Analyse outcomes                               |
| Skills Studio        | Manage autonomous skills                       |
| Reports              | Access previous reports                        |
| Settings             | Account and workspace configuration            |

### **The most important screen: Experiment Workspace**

This is where the real product experience happens.

I would divide it into four sections:

**Left panel — Configuration**

- Experiment information.
- Environment.
- Entities.
- Variables.
- Data sources.
- Skills.

**Centre — Environment**

- Interactive map or 2D/3D environment.
- Visual representation of simulation entities.
- Simulation playback.
- Timeline.

**Right panel — AI and What-If**

- Ask Sandbox.
- Add variables.
- Create alternative scenarios.
- Activate skills.
- Inspect assumptions.

**Bottom panel — Simulation controls**

- Run.
- Pause.
- Resume.
- Stop.
- Speed control, where supported.
- Timeline.
- Execution status.

Do not force every simulation into a 3D viewer. A financial model, for example, may be much better represented by charts and tables.

## **9. Monorepo and folder structure**

I recommend one Git repository with separate frontend, backend, workers and shared contracts.

```
sandbox/
│
├── apps/
│   └── web/
│       ├── app/
│       │   ├── (auth)/
│       │   ├── dashboard/
│       │   ├── projects/
│       │   ├── experiments/
│       │   ├── environments/
│       │   ├── simulations/
│       │   ├── results/
│       │   ├── skills/
│       │   └── settings/
│       │
│       ├── components/
│       │   ├── layout/
│       │   ├── experiment/
│       │   ├── environment/
│       │   ├── simulation/
│       │   ├── visualization/
│       │   └── reports/
│       │
│       ├── hooks/
│       ├── lib/
│       ├── stores/
│       └── types/
│
├── backend/
│   ├── api/
│   │   ├── routes/
│   │   ├── dependencies/
│   │   └── middleware/
│   │
│   ├── core/
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── security.py
│   │   ├── logging.py
│   │   └── exceptions.py
│   │
│   ├── modules/
│   │   ├── users/
│   │   ├── organizations/
│   │   ├── projects/
│   │   ├── experiments/
│   │   ├── environments/
│   │   ├── datasets/
│   │   ├── scenarios/
│   │   ├── skills/
│   │   ├── simulations/
│   │   ├── analytics/
│   │   └── reports/
│   │
│   ├── ai/
│   │   ├── providers/
│   │   ├── interpreter/
│   │   ├── orchestration/
│   │   └── prompts/
│   │
│   ├── simulation/
│   │   ├── contracts/
│   │   ├── registry/
│   │   ├── orchestrator/
│   │   ├── engines/
│   │   │   ├── system_dynamics/
│   │   │   ├── agent_based/
│   │   │   ├── discrete_event/
│   │   │   ├── geospatial/
│   │   │   └── monte_carlo/
│   │   └── evaluation/
│   │
│   ├── skills/
│   │   ├── registry/
│   │   ├── runtime/
│   │   ├── permissions/
│   │   └── builtin/
│   │
│   ├── workers/
│   │   ├── tasks/
│   │   └── runtime/
│   │
│   ├── storage/
│   └── tests/
│
├── packages/
│   └── contracts/
│       ├── schemas/
│       └── api-types/
│
├── infrastructure/
│   ├── docker/
│   ├── compose/
│   ├── database/
│   └── deployment/
│
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── API.md
│   ├── SIMULATION_ENGINES.md
│   ├── SKILLS.md
│   ├── SECURITY.md
│   ├── TESTING.md
│   └── ROADMAP.md
│
├── scripts/
├── .env.example
├── docker-compose.yml
├── AGENTS.md
├── README.md
└── .gitignore
```

Keep the backend modular. Do not split it into microservices at the beginning. A modular monolith with independent worker processes is a much more manageable starting point.

# **10. Development roadmap — from zero to production**

This is the order I would actually build Sandbox in VS Code.

My recommendation is to build the underlying experiment and simulation infrastructure first, not spend weeks making a beautiful dashboard before the engine works.

Recommended implementation order

## **Phase 0 — Research and architecture**

**Objective:** Establish the technical foundation before writing application features.

Tasks:

1. Finalise the PRD.
2. Define the system architecture.
3. Define simulation engine contracts.
4. Define experiment and scenario schemas.
5. Design database relationships.
6. Define API conventions.
7. Create repository structure.
8. Configure development environment.
9. Write Codex development instructions.
10. Record the initial customer, decision they need to make, and the first supported use case in the PRD.
11. Select the first simulation model based on that use case and document its inputs, outputs, assumptions and validation approach.

Deliverables:

- PRD.
- Architecture specification.
- Database ERD.
- API specification.
- Simulation engine interface.
- Repository scaffold.
- Development documentation.

Acceptance criteria:

- Every major module has a defined responsibility.
- Dependencies are documented.
- Database relationships are reviewed.
- The first simulation can be implemented without restructuring the application.
- The MVP scope and roadmap use the same first use case and simulation model.

## **Phase 1 — Backend foundation**

**Objective:** Build a working application backend.

Tasks:

1. Configure FastAPI.
2. Configure Pydantic settings.
3. Connect PostgreSQL.
4. Configure SQLAlchemy.
5. Configure Alembic.
6. Implement authentication.
7. Implement users and workspaces.
8. Implement projects.
9. Implement structured logging.
10. Implement global exception handling.
11. Implement health checks.
12. Configure pytest.

Acceptance criteria:

- Application starts successfully.
- Database migrations work.
- Authentication works.
- Users cannot access another user's projects.
- Automated tests pass.

Keep the initial backend independent of an AI provider. Add AI after the experiment and simulation contracts are stable.

## **Phase 2 — Experiment foundation**

**Objective:** Make it possible to create and manage experiments without AI.

Tasks:

1. Create experiment models.
2. Create experiment schemas.
3. Implement experiment CRUD.
4. Implement experiment configuration.
5. Implement variable definitions.
6. Implement environment references.
7. Implement experiment versioning.
8. Implement validation.
9. Add baseline experiment support.
10. Add experiment audit history.

Acceptance criteria:

- Users can create experiments manually.
- Variables are stored with their types and constraints.
- Experiments can be saved and retrieved.
- Invalid configurations are rejected.
- Changes can be tracked.

This phase is essential because AI-generated experiments will eventually use the same foundation.

## **Phase 3 — First simulation engine**

Most important engineering milestone

**Objective:** Run a real simulation from beginning to end.

I recommend starting with a discrete-event simulation using SimPy.

Why?

It lets you build a working simulation without first having to solve the complexities of geospatial reconstruction or autonomous agents.

For your first demonstration, a supermarket operations simulator is one possible example. Confirm the actual first model against the initial use case recorded in Phase 0.

It should simulate:

- Customer arrivals.
- Checkout queues.
- Service times.
- Available cashiers.
- Inventory consumption.
- Operating hours.
- Customer waiting times.

Tasks:

1. Define the simulation engine interface.
2. Create engine registry.
3. Implement SimPy adapter.
4. Create simulation configuration schema.
5. Create simulation context.
6. Implement simulation execution.
7. Implement run status tracking.
8. Implement job queue.
9. Implement worker execution.
10. Persist metrics and events.
11. Implement cancellation.
12. Add deterministic random seeds.
13. Create simulation tests.

Acceptance criteria:

- A user can submit an experiment.
- The simulation executes in a background worker.
- Progress is observable.
- Results are persisted.
- A completed run can be retrieved.
- Repeating a run with identical inputs and seed produces reproducible results within the defined numerical tolerances.

**The milestone:** Sandbox can execute an experiment and produce measurable results, even without an AI model.

## **Phase 4 — What-If and scenario engine**

**Objective:** Let users experiment with alternative conditions.

Tasks:

1. Implement baseline scenarios.
2. Implement scenario branching.
3. Implement parameter overrides.
4. Implement scenario versioning.
5. Implement scenario comparisons.
6. Implement multiple-run execution.
7. Preserve original experiment configurations.
8. Build scenario result aggregation.
9. Add uncertainty sampling or sensitivity analysis only when required by the chosen model and use case.

Acceptance criteria:

- Users can create multiple branches.
- Each branch has independent parameters.
- The baseline remains unchanged.
- Results can be compared.
- The same experiment can be rerun with different random seeds.

## **Phase 5 — AI-assisted experiment setup**

**Objective:** Let users express the initial use case in natural language and receive an editable, validated experiment configuration. This phase supplies the AI capability described in the MVP; the earlier phases establish the contracts it uses.

Tasks:

1. Create LLM provider interface.
2. Implement initial provider adapter.
3. Write experiment interpretation prompts.
4. Define structured output schemas.
5. Implement variable extraction.
6. Implement environment recommendations.
7. Implement engine recommendations.
8. Implement missing-information detection.
9. Validate generated specifications.
10. Add user approval before execution.

Acceptance criteria:

- A natural-language idea becomes a structured experiment.
- Generated output passes schema validation.
- Unsupported simulation types are rejected or marked as unsupported.
- AI does not fabricate execution results.
- Users can edit generated configurations.

## **Phase 6 — Environment and dataset infrastructure**

**Objective:** Allow users to create real, digital-twin and synthetic environments.

Tasks:

1. Implement environment registry.
2. Implement environment metadata.
3. Implement dataset registry.
4. Implement dataset uploads.
5. Implement storage abstraction.
6. Integrate PostGIS.
7. Integrate OpenStreetMap data.
8. Implement location selection.
9. Implement geographic boundaries.
10. Add weather and population data adapters.
11. Implement synthetic environment generator.
12. Add environment versioning and provenance.

Acceptance criteria:

- Users can select a location.
- Environment metadata is stored.
- Geographic datasets can be attached.
- Data sources and dates are recorded.
- Synthetic environments can be generated and reused.

## **Phase 7 — Agent-based simulation**

**Objective:** Introduce entities that behave independently inside simulated environments.

Use Mesa and NetworkX as initial foundations.

Tasks:

1. Define agent contracts.
2. Implement agent lifecycle.
3. Implement agent state.
4. Implement agent behaviour rules.
5. Implement agent interactions.
6. Implement environmental interactions.
7. Implement event recording.
8. Implement population generation.
9. Implement multi-agent execution.
10. Integrate agent-based results into the common results system.

Example:

Simulate 500 customers interacting with a shopping environment.

Each customer can have:

- Shopping preferences.
- Budget.
- Arrival time.
- Purchase probability.
- Waiting tolerance.
- Movement behaviour.

The system should model these behaviours according to explicit rules and calibrated assumptions, not pretend that generated AI personalities automatically represent real human behaviour.

## **Phase 8 — Autonomous skills**

**Objective:** Build the skill ecosystem.

Tasks:

1. Create skill registry.
2. Define skill manifests.
3. Define skill input/output schemas.
4. Implement skill permissions.
5. Implement built-in skills.
6. Implement skill execution tracking.
7. Implement skill orchestration.
8. Implement user-created skills.
9. Implement versioning.
10. Implement skill installation and sharing.
11. Implement isolated execution for executable skills.
12. Add approval and audit mechanisms.

Acceptance criteria:

- Individual skills can execute independently.
- Multiple skills can collaborate.
- Users can inspect skill actions.
- Permissions are enforced.
- Skills can be versioned and disabled.
- Untrusted skill code cannot access the main application environment.

## **Phase 9 — Frontend and visualization**

Build a thin interface earlier when it helps exercise the backend. This phase completes the user-facing experience required for the MVP.

Tasks:

1. Build authentication screens.
2. Build dashboard.
3. Build project workspace.
4. Build experiment creator.
5. Build environment studio.
6. Build scenario editor.
7. Build simulation monitor.
8. Build interactive visualizations.
9. Build results studio.
10. Build skills studio.
11. Build reports.
12. Integrate WebSocket updates.

Acceptance criteria:

- A user can complete the experiment lifecycle without using the API directly.
- Running simulations display live progress.
- What-if scenarios are editable.
- Results are accessible and exportable.
- Interface works on desktop and mobile.

## **Phase 10 — Reporting and analytics**

**Objective:** Turn simulation outputs into usable decisions.

Tasks:

1. Build metric aggregation.
2. Build statistical analysis.
3. Implement confidence intervals where statistically appropriate.
4. Implement sensitivity analysis reports.
5. Implement scenario comparisons.
6. Implement visual report generation.
7. Implement PDF export.
8. Implement CSV and JSON export.
9. Implement experiment reproducibility metadata.
10. Implement report versioning.

## **Phase 11 — Security, reliability and production**

Tasks:

1. Implement organization-level permissions.
2. Audit authentication and authorization.
3. Add rate limits.
4. Secure file uploads.
5. Isolate execution workers.
6. Add resource limits.
7. Implement secrets management.
8. Implement backups.
9. Add database indexes.
10. Add monitoring.
11. Add error tracking.
12. Run load tests.
13. Test failure recovery.
14. Document deployment procedures.

Acceptance criteria:

- Users cannot access other workspaces' data.
- Long-running jobs survive application restarts.
- Failed workers do not corrupt experiments.
- Untrusted files and skills cannot execute inside the API process.
- Database backups can be restored.
- Resource consumption is controlled.

# **11. The MVP release scope**

Although the long-term architecture supports all the capabilities above, I would not attempt to implement all of them before your first release.

The MVP should prove one complete experience for the initial customer and use case recorded in the PRD. It is a release milestone after the relevant experiment, simulation, scenario, AI, frontend and reporting work is complete; it is not a separate feature list that overrides the roadmap.

**Sandbox MVP**

First release

[SIR Epidemiology Tutorial | Simudyne Docs](https://images.openai.com/static-rsc-4/VMjYEtE9ugxQdIZtXpTclImFZBYF5O1NYmDcWwoWo43HjgoyoKany_h-p-CfMHx1DCk2SvXtSTqWMzI3zur8qd0nppSvPWPnKZX8DQKiGjSaCpoKKyAToXKIB8VzEX7WZJtsRNoO3OXAvmTbjs1xUdRwkJ8_LnhDqXpbxhRK_g4?purpose=inline)

[docs.simudyne.com](https://docs.simudyne.com/tutorials/sir/?utm_source=chatgpt.com)

**A user can:**

1. Describe an idea in natural language.
2. Generate a structured experiment.
3. Choose a supported simulation engine.
4. Configure variables and assumptions.
5. Run a simulation in the background.
6. Create what-if scenarios.
7. Compare results.
8. Download an experiment report.

**MVP boundaries**

- Support the first simulation model selected in Phase 0. The engine table lists possible engine types; Monte Carlo is an example capability, not a required MVP engine.
- Include only the environment data needed by the initial use case. Synthetic or location-aware environments are options, not blanket MVP requirements.
- Implement the AI assistance needed to create and review the first experiment. The skills list describes possible capabilities, not a requirement to ship a skills system or every listed skill.
- Defer additional simulation types, digital twins, agent-based simulation, skill sharing and marketplaces until the initial workflow is validated.

The MVP passes when a user can complete the end-to-end workflow above with a real model, inspect the assumptions and limitations, and reproduce a run from its saved configuration and data references.

The MVP is not a watered-down version of the idea. It is the first working slice of the larger infrastructure.

# **12. Testing and quality strategy**

Sandbox needs more than ordinary frontend and backend tests because simulation software can produce plausible-looking but mathematically incorrect results.

I recommend five testing layers.

| Testing layer         | What to verify                                         |
| --------------------- | ------------------------------------------------------ |
| Unit tests            | Functions, models, schemas and calculations            |
| Integration tests     | Database, APIs, queues and storage                     |
| Simulation tests      | Expected behaviour under known inputs                  |
| Reproducibility tests | Same seed and configuration produce repeatable outputs |
| End-to-end tests      | User can create, run, inspect and export experiments   |

### **Example simulation test**

For the supermarket queue simulator:

- 1 cashier.
- 10 customers.
- Deterministic arrival and service times.
- Fixed operating period.

You should be able to calculate the expected queue behaviour independently and compare the engine output against it.

### **Scientific validity**

Introduce a validation framework that checks:

- Whether assumptions are documented.
- Whether input datasets are suitable.
- Whether units are consistent.
- Whether parameters are within allowed ranges.
- Whether the model has been calibrated.
- Whether the simulation has been validated against independent observations.
- Whether uncertainty is reported.

Do not label an experiment scientifically validated merely because its software tests pass.

## **13. Infrastructure and deployment**

Start locally with Docker Compose.

Your development environment should contain:

| Service    | Responsibility              |
| ---------- | --------------------------- |
| Web        | Next.js application         |
| API        | FastAPI                     |
| Worker     | Simulation execution        |
| Redis      | Queue and job coordination  |
| PostgreSQL | Application data            |
| PostGIS    | Spatial database            |
| MinIO      | Local S3-compatible storage |

Recommended initial hosting arrangement:

- Frontend: Vercel or a self-hosted Node.js deployment.
- Backend: Docker-based VPS or cloud container hosting.
- Database: Managed PostgreSQL with PostGIS.
- Object storage: Cloudflare R2 or another S3-compatible service.
- Redis: Managed Redis or a properly maintained container.
- Workers: Separate compute instances that can scale independently.

For production, do not put expensive simulations on the same small server as your API.

A simulation may require substantial CPU, memory or GPU resources. Design the worker system so compute can be increased independently.

### **Environment variables**

Create `.env.example`:

```
APP_ENV=development
APP_NAME=Sandbox

DATABASE_URL=
REDIS_URL=

SECRET_KEY=
JWT_SECRET=

STORAGE_ENDPOINT=
STORAGE_BUCKET=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=

LLM_PROVIDER=
LLM_API_KEY=
LLM_MODEL=

MAX_SIMULATION_RUNTIME=
MAX_SIMULATION_MEMORY=
```

Never commit `.env` or actual API credentials.

# **14. How to work with Codex in VS Code**

This is where I want you to be particularly disciplined.

Do not give Codex one giant instruction like:

"Build Sandbox with AI, simulations, maps and autonomous agents."

That will encourage it to generate disconnected modules, mock functionality and architectural shortcuts.

Instead, treat Codex as an engineering collaborator working against a documented architecture.

### **Step 1: Create the repository**

```
mkdir sandbox
cd sandbox

git init
code .
```

Create your repository structure and documentation first.

### **Step 2: Create the architecture documents**

Before implementation, create:

```
docs/
  PRD.md
  ARCHITECTURE.md
  DATABASE.md
  API.md
  SIMULATION_ENGINES.md
  SKILLS.md
  SECURITY.md
  TESTING.md
  ROADMAP.md

AGENTS.md
```

These become the source of truth for Codex.

### **Step 3: Establish project instructions**

Your root `AGENTS.md` should contain instructions like:

```

# Sandbox Engineering Instructions

## Product
Sandbox is an independent AI-powered experimentation
and real-world simulation platform.

## Architecture
- Frontend: Next.js and TypeScript.
- Backend: Python and FastAPI.
- Database: PostgreSQL and PostGIS.
- Queue: Redis and Celery.
- Storage: S3-compatible object storage.
- Simulation workers run independently of the API.

## Engineering Rules
1. Read relevant documentation before implementing.
2. Follow existing architecture and module boundaries.
3. Do not create unnecessary microservices.
4. Use typed schemas and explicit contracts.
5. Never place simulation execution in API handlers.
6. Never trust raw LLM output.
7. Never fabricate simulation results.
8. Preserve experiment and run history.
9. Write tests alongside implementation.
10. Update documentation when architecture changes.

## Development Process
For each task:
1. Inspect existing implementation.
2. Explain the intended approach.
3. Identify affected modules.
4. Implement only the requested scope.
5. Run relevant tests.
6. Report changed files.
7. Report test results.
8. Identify remaining limitations.

## Prohibited Shortcuts
- No fake simulation results.
- No hardcoded successful API responses.
- No placeholder implementations presented as complete.
- No arbitrary execution of uploaded code.
- No silent changes to database contracts.
- No breaking existing APIs without documenting migration.

```

### **Step 4: Give Codex one task at a time**

Each implementation task should contain:

1. Task objective.
2. Existing context.
3. Files or modules affected.
4. Expected implementation.
5. Dependencies.
6. Acceptance criteria.
7. Required tests.
8. Documentation updates.
9. Definition of done.

### **Step 5: Use Git checkpoints**

After every completed phase:

```
git status
git add .
git commit -m "Complete phase 1 backend foundation"
```

Do not let Codex make large architectural changes without reviewing the diff.

### **Step 6: Keep a development journal**

Create:

```
docs/DEVELOPMENT_LOG.md
```

Record:

- Completed tasks.
- Architecture decisions.
- Bugs discovered.
- Outstanding issues.
- Database changes.
- Next implementation task.

This gives Codex a reliable way to understand the project's actual state between sessions.

# **15. Codex implementation prompts**

Here is the instruction pattern I would use throughout development.

**Master instruction:**

```

You are the senior software engineer responsible for
implementing Sandbox.

Sandbox is an AI-powered experimentation and simulation
platform.

Read AGENTS.md and all relevant documentation before
making changes.

Your job is to implement the current task without
deviating from the established architecture.

Do not build features outside the requested scope.

Before writing code:
- Inspect the existing repository.
- Identify relevant modules.
- Identify dependencies.
- Explain your implementation approach.
- Identify potential risks.

During implementation:
- Use typed contracts.
- Follow existing naming conventions.
- Write maintainable, modular code.
- Add automated tests.
- Handle errors explicitly.
- Preserve backward compatibility where possible.

After implementation:
- Run relevant tests.
- Run formatting and linting.
- Check for broken imports.
- Check database migrations.
- Update relevant documentation.

Report:
1. What was implemented.
2. Files created or modified.
3. Tests executed and their results.
4. Outstanding limitations.
5. Recommended next task.

Never claim that a feature works without testing it.

```

**Phase implementation instruction:**

```

Implement Phase [NUMBER], Task [NUMBER] from
docs/ROADMAP.md.

First inspect the current repository and determine
whether the dependencies are complete.

Follow the relevant specifications in docs/.

Do not implement future phases.

Do not introduce mock functionality where real
implementation is required.

If an external service or dataset is unavailable,
implement the documented adapter boundary and clearly
report the limitation.

Implement tests and verify the acceptance criteria.

Do not mark the task complete until all required
tests pass.

```

# **16. Product expansion after MVP**

Once the core platform works, expand in this order.

| Expansion | Capability                                            |
| --------- | ----------------------------------------------------- |
| V1.1      | Advanced what-if and sensitivity analysis             |
| V1.2      | Real-world geographic datasets                        |
| V1.3      | Digital twin environments                             |
| V1.4      | Agent-based simulations                               |
| V1.5      | Autonomous skill marketplace                          |
| V1.6      | Collaborative experiments and shared workspaces       |
| V1.7      | Advanced 3D environments                              |
| V1.8      | Public simulation templates and reusable environments |
| V2        | External developer API and simulation SDK             |

### **The Sandbox ecosystem**

Eventually, Sandbox could have three distinct marketplaces:

1. **Simulation Marketplace:** Users publish and reuse simulation models.
2. **Environment Marketplace:** Users share environments and digital twins.
3. **Skills Marketplace:** Developers publish autonomous skills.

This makes Sandbox more than a simulation application. It becomes an extensible experimentation ecosystem.

## **17. Monetization strategy**

I would introduce monetization after the platform has a working simulation engine.

Potential revenue streams:

| Model            | Description                                                    |
| ---------------- | -------------------------------------------------------------- |
| Free tier        | Limited experiments and basic simulation capabilities          |
| Subscription     | More projects, runs and advanced analytics                     |
| Compute credits  | Charge based on simulation resource consumption                |
| Enterprise       | Private environments, team collaboration and dedicated compute |
| Marketplace fees | Commission on paid skills and simulation templates             |
| API usage        | Developers pay to access simulation infrastructure             |

I particularly like compute-based pricing because simulation workloads can vary enormously.

A short Monte Carlo experiment and a complex agent-based simulation should not necessarily cost the same.

# **18. Important engineering decisions not to compromise on**

These decisions will determine whether Sandbox becomes a serious platform or just an impressive-looking demo.

**1. Engine independence**

The application must not depend on a single simulation library.

**2. Reproducibility**

Every experiment must be traceable to its exact configuration, engine version, data and seed.

**3. Environment independence**

An environment should be reusable across different experiments.

**4. AI separation**

AI interprets, assists and coordinates. Deterministic simulation engines calculate the modelled outcomes.

**5. Execution isolation**

Long-running and user-supplied workloads must never compromise the main application.

**6. Uncertainty awareness**

Results must show uncertainty, assumptions and data limitations.

**7. Versioning**

Never silently overwrite experiments, scenarios, skills or completed simulation runs.

**8. Extensibility**

New engines, datasets and skills should be added through contracts rather than changes throughout the codebase.

# **19. Your actual starting checklist**

Here is the order I would follow when you open VS Code.

**Sandbox development tracker**

0/16 completed

Create the Sandbox Git repository

Create the folder structure

Write PRD.md

Write ARCHITECTURE.md

Design the database ERD

Write SIMULATION_ENGINES.md

Write AGENTS.md

Configure Docker Compose

Set up FastAPI and PostgreSQL

Implement experiment schemas

Implement the first SimPy engine

Build the background worker

Run the first reproducible simulation

Implement scenario branching

Connect the frontend

Introduce AI interpretation

&#x20;Copy checklist

## **20. Definition of success**

Your first major product milestone should be the MVP workflow for the initial use case:

A user opens Sandbox, describes an idea, receives a structured experiment specification, chooses an environment, configures a simulation, executes it, changes some variables, runs alternative scenarios, compares the results and downloads a report.

All of this should work using actual simulation logic.

That is the foundation.

Once it works, you have a platform into which you can introduce increasingly sophisticated engines, autonomous agents, geographical environments and skills.

## **My final architectural recommendation**

# **Build the engine before the ecosystem.**

Start with:

1. Experiment specification and validation.
2. Simulation engine abstraction.
3. One working simulation engine.
4. Scenario branching and reproducibility.
5. Results and reporting.
6. AI orchestration and autonomous skills.
7. Geospatial digital twins and additional engines.

This gives you a working technical foundation before the more expensive and complex capabilities arrive.

**One additional recommendation:** Keep the simulation engine as a standalone Python package inside the repository, with its own tests and documented interfaces. This will make it possible to reuse Sandbox's simulation capabilities in other applications in the future.

The blueprint is designed around your Python/backend strengths and your preference for incremental, test-driven implementation rather than dashboard-first development.&#x20;

**Next step:** I can turn this blueprint into a complete Codex-ready implementation backlog, with every phase broken into individual tasks, dependencies, file-level instructions, acceptance criteria and copy-paste prompts for Codex.

When you finish setting up the repository, I can also review the Phase 0 architecture and implementation against this specification.

🧪Review Sandbox Phase 0Tap to set up
