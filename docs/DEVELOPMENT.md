# Development guide

This guide covers local setup and the API surface. For the product overview, simulation scope, and alpha boundaries, see the [project README](../README.md).

## Configure Firebase

1. Create a Firebase project and web app.
2. Enable **Email/Password**, **Google**, and **GitHub** in **Authentication → Sign-in method**.
3. For GitHub, create an OAuth app and add Firebase's callback URL to the OAuth app configuration.
4. Add `localhost` under **Authentication → Settings → Authorized domains** for local development.
5. Copy `.env.example` to `.env`. Set the Firebase project ID, Web API key, auth domain, and app ID from the web app settings. Provide Firebase Admin credentials with Application Default Credentials or `FIREBASE_SERVICE_ACCOUNT_JSON`.
6. Set `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, and `FIRECRAWL_API_KEY` to enable research-led AI drafting.

Keep service-account credentials and provider keys out of source control. Firebase's web API key is a public client configuration value; restrict it to your app's domains in Google Cloud where appropriate.

## Run with Docker

After configuring `.env`, start the full stack:

```sh
COMPOSE_BAKE=false docker compose up --build
```

`COMPOSE_BAKE=false` selects Compose's built-in builder. It avoids a Bake panic in affected Docker Compose installations. The API and worker build steps use host networking so dependency installation can use the host's DNS configuration. At runtime, the API and worker also use host networking because this Linux development setup's Docker bridge cannot reliably reach the configured external Neon and Upstash services. The API listens on port 8000 directly on the host; the web app is at `http://localhost:3000` and API documentation at `http://localhost:8000/docs`. The development API container applies Alembic migrations on startup. The local PostgreSQL and Redis services remain available for development, and their credentials are for local use only.

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

The web client signs in through Firebase and sends Firebase ID tokens as bearer tokens. Email/password login accepts either a username or email. The API also exposes `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/refresh`, and `/api/v1/auth/sync`. `/auth/sync` creates a profile for a first-time federated sign-in and links legacy users only when Firebase confirms a verified email.

The API base path is `/api/v1`. Main resource routes include:

- `/organizations`, `/projects`, `/experiments` — workspace and experiment setup.
- `/environments` — environments and source provenance.
- `/ai/interpret` — Firecrawl search and scrape evidence is gathered server-side and passed to OpenRouter for the structured discovery draft. Returned citations are restricted to URLs Firecrawl supplied.
- `/agent/decision` — optional x402-gated agent endpoint. Configure `SOLANA_PAY_TO` to enable it; it returns a cited decision brief after exact Solana payment.
- `/ai/runs/{id}/interpret` — optional commentary grounded in a completed run's metrics and assumptions.
- `/experiments/{id}/scenarios`, `/scenarios/{id}/runs` — scenario branching and simulation runs.
- `/experiments/{id}/runs`, `/experiments/{id}/scenarios/compare` — run history and comparison.
- `/runs/{id}/reports` — create downloadable PDF, CSV, or JSON snapshots.

## Configuration references

- Backend environment template: [`../.env.example`](../.env.example)
- Web environment template: [`../web/.env.example`](../web/.env.example)
- Deployment instructions: [`../deploy/README.md`](../deploy/README.md)
- Hackathon architecture, demo path, and Solana/Supabase/Firecrawl setup: [`HACKATHON.md`](HACKATHON.md)
