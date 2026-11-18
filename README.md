# Sandbox

Sandbox is an experimentation workspace for turning questions into explicit model configurations, running reproducible scenarios, comparing outputs, and exporting reports. It keeps the AI draft separate from the simulation engine: the model executes the run and records the configuration, seed, engine version, and result.

The current executable model is a discrete event queueing simulation using SimPy. It models exponential arrivals and service times with identical parallel servers. Other domains and simulation engines can be added behind the engine registry as the product's initial use case expands.

## Included workflow

- Firebase email/password, Google, and GitHub authentication.
- PostgreSQL-backed workspaces, projects, experiment revisions, environments, datasets, scenarios, runs, events, and report snapshots.
- OpenRouter-assisted experiment drafts and grounded run commentary, both schema validated and clearly labeled as AI output.
- Scenario branching, background execution through Celery and Redis, run history, cancellation, and run comparison.
- PDF, CSV, and JSON reports.
- Responsive Next.js workspace UI with light and dark appearance.

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
docker compose up --build
```

Open the app at `http://localhost:3000` and API documentation at `http://localhost:8000/docs`. The API container applies Alembic migrations on startup. The local PostgreSQL credentials in `docker-compose.yml` are for development only.

## Run the web app locally

Configure the backend `.env` as above, then copy `web/.env.example` to `web/.env.local` and add the Firebase web app settings. Start PostgreSQL, Redis, API, and worker with Docker:

```sh
docker compose up --build db redis api worker
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

- `/organizations`, `/projects`, `/experiments` — workspace and experiment setup.
- `/environments` — environment and source-provenance records.
- `/ai/interpret` — optional OpenRouter experiment draft.
- `/ai/runs/{id}/interpret` — optional commentary grounded in a completed run's metrics and assumptions.
- `/experiments/{id}/scenarios`, `/scenarios/{id}/runs` — scenario branching and simulation runs.
- `/experiments/{id}/runs`, `/experiments/{id}/scenarios/compare` — run history and comparison.
- `/runs/{id}/reports` — create downloadable PDF, CSV, or JSON snapshots.

## Product boundaries

An environment's dataset entries currently record source metadata; they do not import or validate external data. The first queueing engine has bounded inputs and simple stochastic assumptions. It does not represent a complete business, urban, agricultural, or other domain model. Treat results as outputs of the configured model, not factual forecasts.
