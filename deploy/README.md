# Deploy Sandbox with Vercel and Render

This setup hosts the Next.js frontend on Vercel and runs the FastAPI API plus Celery worker on Render. You build and push one backend image to Docker Hub, then select that image for two services in the Render dashboard. The API and worker need the same database, Redis, Firebase, and AI environment settings.

## 1. Publish the backend image

Create a Docker Hub repository for the backend. From the repository root, sign in to Docker Hub and build a `linux/amd64` image with a versioned tag:

```sh
docker login
docker buildx build --platform linux/amd64 \
  -f backend/Dockerfile \
  -t YOUR_DOCKERHUB_USERNAME/sandbox-backend:v1 \
  --push .
```

Use a new tag for each release, such as `v2` or a Git commit hash. Render image-backed services do not automatically redeploy when a tag changes; after pushing, use **Manual Deploy → Deploy latest reference** for both Render services. Render requires `linux/amd64` for prebuilt images. [Render prebuilt image guide](https://render.com/docs/deploying-an-image)

## 2. Create the API service in Render

In the Render dashboard:

1. Choose **New → Web Service → Existing Image**.
2. Enter `docker.io/YOUR_DOCKERHUB_USERNAME/sandbox-backend:v1`. Add Docker Hub credentials if the repository is private.
3. Set a service name such as `sandbox-api`, choose a region, and select a plan.
4. Set the health check path to `/health`.
5. Add the API environment variables listed below.
6. Under **Advanced → Docker Command**, enter this to run migrations before starting the API:

   ```sh
   sh backend/start-api.sh
   ```

   The script runs migrations and starts Uvicorn only if they succeed. It is included in the backend image. This runs each time Render starts or restarts the API; `alembic upgrade head` is a no-op when the database is already current. Keep the API at one instance while using startup migrations; use a separate migration job before scaling to multiple API instances to avoid concurrent migrations.
7. Deploy. The command binds Uvicorn to `0.0.0.0` and Render's `PORT` (normally `10000`). [Render web services](https://render.com/docs/web-services)

Copy the public API URL after the service is live, for example `https://sandbox-api.onrender.com`. The frontend needs the `/api/v1` path appended.

## 3. Create the worker service in Render

1. Choose **New → Background Worker → Existing Image**.
2. Use the exact same image and tag as the API service.
3. Set the Docker command to:

   ```sh
   celery -A backend.app.workers.celery_app:celery_app worker --loglevel=INFO
   ```

4. Add the same runtime environment variables as the API service, especially `DATABASE_URL` and `REDIS_URL`.
5. Deploy. A background worker does not need a public port or health check.

Keep this worker running continuously. The API accepts simulation jobs and the worker executes them. Updating an image-backed service requires a manual deploy after publishing a new image.

## 4. Configure Render environment variables

Set `APP_ENV`, `DATABASE_URL`, and `REDIS_URL` on **both** the API and worker. Set the remaining variables on the API service:

| Variable | Value |
| --- | --- |
| `APP_ENV` | `production` |
| `DATABASE_URL` | Production PostgreSQL URL using `postgresql+psycopg://...`; URL-encode special characters in credentials. |
| `REDIS_URL` | Production Redis URL. Use `rediss://` when the provider requires TLS. |
| `CORS_ORIGINS` (API) | JSON string of exact browser origins, e.g. `["https://your-app.vercel.app"]`. Add your custom domain origin too, with no trailing slash or path. |
| `FIREBASE_PROJECT_ID` (API) | Firebase project ID. |
| `FIREBASE_WEB_API_KEY` (API) | Firebase web API key. The API uses it for Firebase email/password auth flows. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` (API) | Firebase Admin service-account JSON stored as a secret. Do not put this in Vercel or commit it. Alternatively configure ADC in the container. |
| `OPENROUTER_API_KEY` (API, optional) | Secret for AI draft and commentary features. |
| `OPENROUTER_MODEL` (API, optional) | Model identifier; set with the key to enable OpenRouter features. |

`DATABASE_URL` and `REDIS_URL` should point to managed, persistent services reachable from Render. They can be Render resources or your existing providers. The local Compose URLs that use `localhost` are not suitable for deployed services. Avoid placing credentials in Docker build arguments or image layers.

## 5. Deploy the frontend to Vercel

1. Import this repository into Vercel.
2. Set the project **Root Directory** to `web`.
3. Add these environment variables for Production (and Preview if desired):

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_API_URL` | `https://YOUR-RENDER-API.onrender.com/api/v1` |
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web API key |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain, usually `YOUR_PROJECT_ID.firebaseapp.com` |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase web app ID |

4. Deploy the project. If an environment variable changes later, redeploy so the new value is included in the deployment. [Vercel environment variables](https://vercel.com/docs/environment-variables/managing-environment-variables)

These `NEXT_PUBLIC_*` settings are client-side Firebase configuration and the public API address. Never put Firebase Admin credentials, database URLs, Redis passwords, or OpenRouter keys in Vercel's `NEXT_PUBLIC_*` variables.

## 6. Finish Firebase and domain setup

- In Firebase Authentication, enable Email/Password and Google. GitHub sign-in is disabled in the app until you configure it.
- Add the deployed Vercel hostname and any custom frontend domain under Firebase Authentication's authorized domains.
- Set Render `CORS_ORIGINS` to those same exact frontend origins, serialized as a JSON array.
- If you later enable GitHub sign-in, create a GitHub OAuth app, enable the GitHub provider in Firebase Authentication, enter its client ID and secret, and set Firebase's OAuth redirect URI as the GitHub callback URL. [Firebase GitHub provider setup](https://firebase.google.com/docs/auth/web/github-auth)
- Confirm the Vercel deployment can reach `https://YOUR-RENDER-API.onrender.com/health`, sign in with Google or email/password, and queue a simulation that the worker completes.

## Local Docker workflow

For local development, continue using the Compose setup described in [Development](../docs/DEVELOPMENT.md). Compose supplies local PostgreSQL and Redis and overrides the API command to run migrations and listen on port `8000`.

## Product limits

The queueing, inventory, and Monte Carlo engines still use simplified assumptions. The Data360 connector saves source records and observations for context; it does not calibrate simulation inputs. See the product [README](../README.md) for the model and data limits.
