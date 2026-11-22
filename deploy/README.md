# Deploy web and backend separately

Sandbox has two independently deployable images. Build and deploy the web image from `web/`. Build the backend image from the repository root and run it as two services: the FastAPI API and the Celery worker. Both backend services use the same image and must be able to reach PostgreSQL and Redis. These instructions are provider-neutral; adapt the image, environment variable, port, and health check settings to your hosting platform.

## 1. Prepare the backend

Build and publish the backend image from the repository root:

```sh
docker build -f backend/Dockerfile -t YOUR_REGISTRY/sandbox-backend:latest .
docker push YOUR_REGISTRY/sandbox-backend:latest
```

Create a backend runtime environment in your hosting provider. Set at least:

- `APP_ENV=production`
- `DATABASE_URL` to the production PostgreSQL connection string using the `postgresql+psycopg://` scheme
- `REDIS_URL` to the production Redis connection string; use `rediss://` when the provider requires TLS
- `CORS_ORIGINS` to a JSON array containing the exact web origin, for example `["https://sandbox.example.com"]`
- `FIREBASE_PROJECT_ID` to the Firebase project ID
- Firebase Admin credentials through the provider's secret manager as `FIREBASE_SERVICE_ACCOUNT_JSON`, or configure Application Default Credentials for the service
- `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` only if AI drafting and run commentary should be enabled

Never bake database passwords, Redis credentials, Firebase service-account keys, or OpenRouter keys into an image or build argument. `FIREBASE_WEB_API_KEY` is a browser client setting and is not a Firebase Admin credential.

Before deploying a new backend version, run the migration command once as a release job using the same image and database environment:

```sh
docker run --rm --env-file backend.production.env YOUR_REGISTRY/sandbox-backend:latest alembic upgrade head
```

Then deploy two backend processes from that image:

```sh
# API service; expose port 8000 and use GET /health as its HTTP health check.
docker run --rm --env-file backend.production.env -p 8000:8000 YOUR_REGISTRY/sandbox-backend:latest

# Worker service; do not expose a public port.
docker run --rm --env-file backend.production.env YOUR_REGISTRY/sandbox-backend:latest celery -A backend.app.workers.celery_app:celery_app worker --loglevel=INFO
```

In a managed container platform, set those commands in the API and worker service definitions instead of using `docker run`. Keep the worker running continuously so queued simulations can execute. The API readiness endpoint is `/health`; it currently confirms that the application process responds and does not check PostgreSQL, Redis, or Firebase connectivity.

## 2. Prepare the web app

The browser needs the public HTTPS API URL and Firebase web app configuration at build time. Build from the `web/` directory:

```sh
docker build -t YOUR_REGISTRY/sandbox-web:latest \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api/v1 \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_FIREBASE_WEB_API_KEY \
  --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_FIREBASE_AUTH_DOMAIN \
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID \
  --build-arg NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_FIREBASE_APP_ID \
  .
docker push YOUR_REGISTRY/sandbox-web:latest
```

Run the web image on port 3000 and route your web hostname to it. `NEXT_PUBLIC_*` values are embedded in browser JavaScript; changing them requires rebuilding the web image. Do not pass private credentials as build arguments.

## 3. Finish provider configuration

1. Add the deployed web hostname in Firebase Authentication's authorized domains and enable the sign-in providers you use.
2. Set backend `CORS_ORIGINS` to the web origin, including its scheme and no path, such as `https://sandbox.example.com`.
3. Make sure the web container can serve HTTPS traffic and that browsers can reach the API hostname over HTTPS.
4. Configure persistent, backed-up PostgreSQL storage and managed Redis. Keep the backend and worker in a private network where possible.
5. Confirm the API health check passes, a user can sign in, and a simulation can be queued and completed before inviting users.

## Model and data readiness

The three implemented engines remain simplified queueing, inventory, and Monte Carlo models. Industry starter prompts are framing aids, not calibrated sector models. The World Bank Data360 connector searches indicators, fetches observations, and saves them with source and attribution metadata in an environment; report exports include that source context. Data360 observations are not consumed by the simulation engines. Verify indicator-level reuse terms because third-party indicators may have different terms from Data360's default CC BY 4.0. There is no 3D or geospatial simulation. Sandbox is appropriate for a limited product alpha that gathers usability feedback; do not present results as operational forecasts until a selected domain has business-level validation data, model assumptions, and calibration evidence.
