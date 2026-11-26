from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.routes import (
    auth,
    ai,
    agent,
    environments,
    experiments,
    organizations,
    projects,
    reports,
    scenarios,
    simulations,
    users,
    waitlist,
)
from backend.app.core.config import settings


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
payment_server = None
if settings.solana_pay_to:
    from x402 import x402ResourceServer
    from x402.http import HTTPFacilitatorClient, PaymentOption, RouteConfig
    from x402.http.middleware.fastapi import PaymentMiddlewareASGI
    from x402.mechanisms.svm.exact import ExactSvmServerScheme

    payment_server = x402ResourceServer(
        HTTPFacilitatorClient({"url": settings.x402_facilitator_url})
    )
    payment_server.register(
        settings.solana_network,
        ExactSvmServerScheme(rpc_url=settings.solana_rpc_url),
    )
    app.add_middleware(
        PaymentMiddlewareASGI,
        server=payment_server,
        routes={
            f"GET {settings.api_v1_prefix}/agent/decision": RouteConfig(
                accepts=PaymentOption(
                    scheme="exact",
                    price=settings.x402_research_price,
                    network=settings.solana_network,
                    pay_to=settings.solana_pay_to,
                ),
                description="Firecrawl researched founder idea decision brief",
                mime_type="application/json",
                service_name="Sandbox research",
                tags=["AI", "research", "founder-tools"],
            )
        },
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "PAYMENT-SIGNATURE"],
    expose_headers=["PAYMENT-REQUIRED", "PAYMENT-RESPONSE"],
)

app.include_router(auth.router, prefix=settings.api_v1_prefix)
app.include_router(ai.router, prefix=settings.api_v1_prefix)
app.include_router(agent.router, prefix=settings.api_v1_prefix)
app.include_router(users.router, prefix=settings.api_v1_prefix)
app.include_router(organizations.router, prefix=settings.api_v1_prefix)
app.include_router(projects.router, prefix=settings.api_v1_prefix)
app.include_router(experiments.router, prefix=settings.api_v1_prefix)
app.include_router(scenarios.router, prefix=settings.api_v1_prefix)
app.include_router(simulations.router, prefix=settings.api_v1_prefix)
app.include_router(environments.router, prefix=settings.api_v1_prefix)
app.include_router(reports.router, prefix=settings.api_v1_prefix)
app.include_router(waitlist.router, prefix=settings.api_v1_prefix)


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}
