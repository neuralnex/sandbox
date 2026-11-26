# Deploy Sandbox with Vercel and Render

This setup hosts the Next.js frontend on Vercel and runs the FastAPI API and Celery worker together in one Render web service. You build and push one backend image to Docker Hub. Both processes share the web service's CPU and memory; the worker defaults to one concurrent task.

## 1. Publish the backend image

Create a Docker Hub repository for the backend. From the repository root, sign in to Docker Hub and build a `linux/amd64` image with a versioned tag:

```sh
docker login
docker buildx build --platform linux/amd64 \
  -f backend/Dockerfile \
  -t YOUR_DOCKERHUB_USERNAME/sandbox-backend:v1 \
  --push .
```

Use a new tag for each release, such as `v2` or a Git commit hash. Render image-backed services do not automatically redeploy when a tag changes; after pushing, use **Manual Deploy → Deploy latest reference**. Render requires `linux/amd64` for prebuilt images. [Render prebuilt image guide](https://render.com/docs/deploying-an-image)

## 2. Create the API service in Render

In the Render dashboard:

1. Choose **New → Web Service → Existing Image**.
2. Enter `docker.io/YOUR_DOCKERHUB_USERNAME/sandbox-backend:v1`. Add Docker Hub credentials if the repository is private.
3. Set a service name such as `sandbox-api`, choose a region, and select a plan.
4. Set the health check path to `/health`.
5. Add the API environment variables listed below.
6. Under **Advanced → Docker Command**, enter:

   ```sh
   python backend/start-all.py
   ```

   The script runs migrations, then starts both the API and Celery worker. If either process exits, the other is stopped so Render can restart the service. It runs migrations on each service restart; `alembic upgrade head` is a no-op when the database is current. Keep the service at one instance while using startup migrations; use a separate migration job before scaling to multiple instances to avoid concurrent migrations.
7. Deploy. The API binds to `0.0.0.0` and Render's `PORT` (normally `10000`). [Render web services](https://render.com/docs/web-services)

Copy the public API URL after the service is live, for example `https://sandbox-api.onrender.com`. The frontend needs the `/api/v1` path appended.

## 3. Configure Render environment variables

Set these variables on the single Render web service:

| Variable | Value |
| --- | --- |
| `APP_ENV` | `production` |
| `DATABASE_URL` | Production PostgreSQL URL using `postgresql+psycopg://...`; URL-encode special characters in credentials. |
| `REDIS_URL` | Production Redis URL. Use `rediss://` when the provider requires TLS. |
| `CORS_ORIGINS` (API) | JSON string of exact browser origins, e.g. `["https://your-app.vercel.app"]`. Add your custom domain origin too, with no trailing slash or path. |
| `WAITLIST_ADMIN_EMAILS` (API) | JSON list of Sandbox account emails allowed to view waitlist entries, e.g. `["you@example.com"]`. Only those signed-in accounts see the Waitlist panel in `/studio`. |
| `FIREBASE_PROJECT_ID` (API) | Firebase project ID. |
| `FIREBASE_WEB_API_KEY` (API) | Firebase web API key. The API uses it for Firebase email/password auth flows. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` (API) | Firebase Admin service-account JSON stored as a secret. Do not put this in Vercel or commit it. Alternatively configure ADC in the container. |
| `OPENROUTER_API_KEY` (API, optional) | Secret for AI draft and commentary features. |
| `OPENROUTER_MODEL` (API, optional) | Model identifier; set with the key to enable OpenRouter features. |
| `FIRECRAWL_API_KEY` (API) | Server-side key for live search and page extraction during founder research. |
| `SOLANA_PAY_TO` (API, optional) | Base58 Solana recipient wallet. Enables the optional x402 agent endpoint. Leave empty to disable paid API access. |
| `SOLANA_NETWORK` (API, optional) | Defaults to Solana Devnet (`solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`). Use a production CAIP-2 network only with a production facilitator and tested token configuration. |
| `SOLANA_RPC_URL` (API, optional) | RPC URL used to enrich x402 payment requirements. Use a suitable managed RPC in production. |
| `X402_FACILITATOR_URL` (API, optional) | Defaults to the public x402 facilitator for devnet demonstrations. Configure a production facilitator before accepting real payments. |
| `X402_RESEARCH_PRICE` (API, optional) | Price for one agent decision brief; defaults to `$0.05`. |
| `CELERY_CONCURRENCY` (optional) | Worker concurrency; defaults to `1` so the API and worker share resources conservatively. |

`DATABASE_URL` and `REDIS_URL` should point to managed, persistent services reachable from Render. `DATABASE_URL` can use your Supabase Postgres connection string; use the Supavisor session pooler if Render cannot reach the direct database host. The app continues to use SQLAlchemy/Alembic against standard Postgres. The local Compose URLs that use `localhost` are not suitable for deployed services. Avoid placing credentials in Docker build arguments or image layers.

## 4. Deploy the frontend to Vercel

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

## 5. Finish Firebase and domain setup

- In Firebase Authentication, enable Email/Password and Google. GitHub sign-in is disabled in the app until you configure it.
- Add the deployed Vercel hostname and any custom frontend domain under Firebase Authentication's authorized domains.
- Set Render `CORS_ORIGINS` to those same exact frontend origins, serialized as a JSON array.
- If you later enable GitHub sign-in, create a GitHub OAuth app, enable the GitHub provider in Firebase Authentication, enter its client ID and secret, and set Firebase's OAuth redirect URI as the GitHub callback URL. [Firebase GitHub provider setup](https://firebase.google.com/docs/auth/web/github-auth)
- Confirm the Vercel deployment can reach `https://YOUR-RENDER-API.onrender.com/health`, sign in with Google or email/password, and queue a simulation that the co-located worker completes.

The API and worker share one service's CPU and memory. Keep concurrency at `1` initially; raise it only if the service has enough resources. For higher traffic or independent scaling, move the worker back to a separate background service.

## Local Docker workflow

For local development, continue using the Compose setup described in [Development](../docs/DEVELOPMENT.md). Compose supplies local PostgreSQL and Redis and overrides the API command to run migrations and listen on port `8000`.

## Product limits

The queueing, inventory, and Monte Carlo engines still use simplified assumptions. Firecrawl searches and extracts public web evidence for the founder brief; source evidence does not calibrate simulation inputs. x402 is optional and agent-facing; founders can use the product without a wallet. See [Hackathon architecture](../docs/HACKATHON.md) and the product [README](../README.md) for scope and limitations.
