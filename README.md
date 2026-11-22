# Sandbox

Sandbox is an experimentation workspace for turning questions into explicit model configurations, running reproducible scenarios, comparing outputs, and exporting reports. It keeps the AI draft separate from the simulation engine: the model executes the run and records the configuration, seed, engine version, and result.

The executable model catalog currently includes: (1) a discrete event queueing simulation using SimPy, with exponential arrivals and service times across identical parallel servers; (2) an inventory replenishment model with daily demand, reorder thresholds, fixed lead times, stockouts, and basic cost outputs; and (3) a seeded Monte Carlo business outcome model using triangular low/most-likely/high estimates for demand, price, and variable cost. Each model validates bounded inputs and records reproducible outputs. Industry templates help set the question and model type; users still enter and review the model assumptions.

### Model setup

- **Queueing:** arrivals per hour, service completions per server per hour, number of parallel servers, and duration in hours. The optional seed makes a run repeatable. Outputs include completions by the time horizon, unfinished work at that cutoff, average and 95th-percentile wait for all jobs that arrived before it, utilization, and an hourly series. Arrival and service times are exponential; servers are identical and continuously available. Jobs are drained after the cutoff to calculate full waiting times; post-cutoff completions remain marked unfinished at the cutoff.
- **Inventory:** average daily demand, demand standard deviation, reorder point, order quantity, supplier lead time, starting stock, and duration in days. The form also asks for unit revenue, unit purchase cost, holding cost, and stockout cost. Outputs include fill rate, stockouts, orders, ending stock, and a basic net operating result. Demand is sampled from a normal distribution and clipped at zero; the model has no perishability or seasonality.
- **Monte Carlo business range:** low, most-likely, and high estimates for demand, revenue per unit, and variable cost per unit, plus fixed cost per period. The form also asks for trials, periods, and starting cash. Outputs are a profit distribution, P10/median/P90, and the share of trials with positive profit. This share is conditional on the entered assumptions, not a calibrated real-world probability.

Industry starter prompts cover service operations and inventory examples in retail, healthcare, logistics, manufacturing, finance, education, hospitality, public services, technology, agriculture, and general business. These are prompts, not separate model types. The AI configuration draft currently supports queueing; inventory and Monte Carlo are configured directly from their input forms.

## Included workflow

- Firebase email/password, Google, and GitHub authentication.
- PostgreSQL-backed workspaces, projects, experiment revisions, environments, datasets, scenarios, runs, events, and report snapshots.
- World Bank Data360 indicator search, filtered time-series previews, environment source records, and source details in exported reports.
- OpenRouter-assisted experiment drafts and grounded run commentary, both schema validated and clearly labeled as AI output.
- Scenario branching, background execution through Celery and Redis, run history, cancellation, and run comparison.
- PDF, CSV, and JSON reports.
- Responsive Next.js workspace UI with light and dark appearance, industry starter prompts, workspace business profiles, and optional location context.

## Configure Firebase

1. Create a Firebase project and web app.
2. Enable **Email/Password**, **Google**, and **GitHub** in **Authentication → Sign-in method**.
3. For GitHub, create an OAuth app and add Firebase's callback URL to the OAuth app configuration.
4. Add `localhost` under **Authentication → Settings → Authorized domains** for local development.
5. Copy `.env.example` to `.env`. Set the Firebase project ID, Web API key, auth domain, and app ID from the web app settings. Provide Firebase Admin credentials with Application Default Credentials or `FIREBASE_SERVICE_ACCOUNT_JSON`.
6. Set `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` to enable AI drafting. This is optional; a user can configure and run an experiment without AI.

Keep service-account credentials and provider keys out of source control. Firebase's web API key is a public client configuration value; restrict it to your app's domains in Google Cloud where appropriate.

## Run with Docker

After configuring `.env`, start the full stack:

```sh
COMPOSE_BAKE=false docker compose up --build
```

`COMPOSE_BAKE=false` selects Compose's built-in builder. It avoids a Bake panic in affected Docker Compose installations. The API and worker build steps use host networking so dependency installation can use the host's DNS configuration. At runtime, the API and worker also use host networking because this Linux development setup's Docker bridge cannot reliably reach the configured external Neon and Upstash services. The API listens on port 8000 directly on the host; the web app is at `http://localhost:3000` and API documentation at `http://localhost:8000/docs`. The development API container applies Alembic migrations on startup. The local PostgreSQL and Redis services remain available for development, and their credentials are for local use only.

For separate web and backend image builds, release migrations, and API/worker deployment configuration, see [deploy/README.md](deploy/README.md). The web image uses Next.js standalone output. The backend image can run as the API or as the Celery worker; production migrations are a separate one-off release command.

## Run the web app locally

Configure the backend `.env` as above, then copy `web/.env.example` to `web/.env.local` and add the Firebase web app settings. Start PostgreSQL, Redis, API, and worker with Docker:

```sh
COMPOSE_BAKE=false docker compose up --build db redis api worker
```

In another terminal:

```sh
cd web
npm ci
npm run dev
```

Visit `http://localhost:3000`. The web app requires Node.js 20.9 or newer.

## Authentication and API

The web client signs in through Firebase and sends Firebase ID tokens as bearer tokens. Email/password login accepts either a username or email. The API also exposes `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/refresh`, and `/api/v1/auth/sync`. `/auth/sync` creates a profile for a first-time federated sign-in (suggesting a stable handle if none is supplied) and links legacy users only when Firebase confirms a verified email, preserving their existing Sandbox handle and data.

The API base path is `/api/v1`. The main resource routes are:

- `/organizations`, `/projects`, `/experiments` — workspace and experiment setup. Workspace profiles include business type and optional city, region, country, time zone and coordinates.
- `/environments` — environment and source-provenance records.
- `/data-sources/data360/search` and `/data-sources/data360/data` — authenticated proxy to the public World Bank Data360 catalog and observations API.
- `/ai/interpret` — optional OpenRouter experiment draft.
- `/ai/runs/{id}/interpret` — optional commentary grounded in a completed run's metrics and assumptions.
- `/experiments/{id}/scenarios`, `/scenarios/{id}/runs` — scenario branching and simulation runs.
- `/experiments/{id}/runs`, `/experiments/{id}/scenarios/compare` — run history and comparison.
- `/runs/{id}/reports` — create downloadable PDF, CSV, or JSON snapshots.

## Product boundaries

Environment locations are user-entered or captured only after an explicit browser location request. Firebase Authentication does not supply a business address or GPS position. Data360 series can be searched, previewed, saved with observations and attribution notes, and recorded in later report exports. Those country or sector indicators are contextual inputs only: the engines do not consume them to set queue rates, inventory policies, or financial distributions. The Data360 API is public, and terms can vary for third-party indicators; verify indicator-specific terms before redistribution. The workspace provides conceptual 2D flow diagrams, run charts, and generated summaries. There is no 3D, geospatial engine, or digital twin. Industry starter prompts help frame a question but do not provide business facts. The current models have bounded, simplified assumptions and do not include live demand feeds, schedules, perishability, supplier constraints, or correlated uncertainty. Treat results as outputs of the configured model, not factual forecasts.

## Alpha scope

Sandbox is suitable for a limited product alpha focused on learning whether users can define, run, compare, and explain simple operational models. The supported model families are queueing, inventory replenishment, and Monte Carlo ranges. Data360 adds discovery and source traceability for public context; it is not model calibration. Before using a model to inform real operating decisions, validate its assumptions against business-level records and domain expertise. See [deploy/README.md](deploy/README.md) for deployment setup and [World Bank Data360](https://data360.worldbank.org/en/api) for the source API documentation.
