# Sandbox

Sandbox is an experimentation workspace for turning questions into explicit model configurations, running reproducible scenarios, comparing outputs, and exporting reports. It keeps the AI draft separate from the simulation engine: the model executes the run and records the configuration, seed, engine version, and result.

The executable model catalog currently includes: (1) a discrete event queueing simulation using SimPy, with exponential arrivals and service times across identical parallel servers; (2) an inventory replenishment model with daily demand, reorder thresholds, fixed lead times, stockouts, and basic cost outputs; and (3) a seeded Monte Carlo business outcome model using triangular low/most-likely/high estimates for demand, price, and variable cost. Each model validates bounded inputs and records reproducible outputs. Industry templates help set the question and model type; users still enter and review the model assumptions.

## Included workflow

- Firebase email/password, Google, and GitHub authentication.
- PostgreSQL-backed workspaces, projects, experiment revisions, environments, datasets, scenarios, runs, events, and report snapshots.
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

`COMPOSE_BAKE=false` selects Compose's built-in builder. It avoids a Bake panic in affected Docker Compose installations. The API and worker build steps use host networking so dependency installation can use the host's DNS configuration. Open the app at `http://localhost:3000` and API documentation at `http://localhost:8000/docs`. The API container applies Alembic migrations on startup. The local PostgreSQL credentials in `docker-compose.yml` are for development only.

## Run the web app locally

Configure the backend `.env` as above, then copy `web/.env.example` to `web/.env.local` and add the Firebase web app settings. Start PostgreSQL, Redis, API, and worker with Docker:

```sh
COMPOSE_BAKE=false docker compose up --build db redis api worker
```

In another terminal:

```sh
cd web
npm install
npm run dev
```

Visit `http://localhost:3000`. The web app requires Node.js 20.9 or newer.

## Authentication and API

The web client signs in through Firebase and sends Firebase ID tokens as bearer tokens. Email/password login accepts either a username or email. The API also exposes `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/refresh`, and `/api/v1/auth/sync`. `/auth/sync` creates a Sandbox profile for a federated sign-in and links legacy users only when Firebase confirms a verified email.

The API base path is `/api/v1`. The main resource routes are:

- `/organizations`, `/projects`, `/experiments` — workspace and experiment setup. Workspace profiles include business type and optional city, region, country, time zone and coordinates.
- `/environments` — environment and source-provenance records.
- `/ai/interpret` — optional OpenRouter experiment draft.
- `/ai/runs/{id}/interpret` — optional commentary grounded in a completed run's metrics and assumptions.
- `/experiments/{id}/scenarios`, `/scenarios/{id}/runs` — scenario branching and simulation runs.
- `/experiments/{id}/runs`, `/experiments/{id}/scenarios/compare` — run history and comparison.
- `/runs/{id}/reports` — create downloadable PDF, CSV, or JSON snapshots.

## Product boundaries

Environment locations are user-entered or captured only after an explicit browser location request. Firebase Authentication does not supply a business address or GPS position. Environment dataset entries currently record source metadata; they do not import or validate external data. The workspace provides conceptual 2D flow diagrams, run charts, and generated summaries for the available models. These visuals do not represent calibrated geography or a digital twin. Industry starter prompts help frame a question but do not provide business facts. The current models have bounded, simplified assumptions and do not include live demand feeds, schedules, perishability, supplier constraints, or correlated uncertainty. Treat results as outputs of the configured model, not factual forecasts.
