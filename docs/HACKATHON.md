# Solana University hackathon build

## Product promise

**One idea in. One decision out.** Sandbox researches an idea, gives a candid `promising`, `weak`, or `uncertain` assessment, ranks exactly three load-bearing assumptions, and gives a low-cost test for each. Source links and explicit unknowns stay attached to the result. Existing simulation engines remain available for bounded follow-up questions; they do not prove market demand.

## What each sponsor technology does

| Technology | Role in Sandbox | What it does not claim |
| --- | --- | --- |
| Firecrawl | Live web search with page extraction during idea review. Retrieved evidence is sent server-side to the model, and displayed source links are restricted to the URLs returned by Firecrawl. | A source link is not validation. The app does not automatically calibrate simulation parameters from web pages. |
| Supabase | Hosted PostgreSQL database for Sandbox users, workspaces, explorations, scenarios, and reports. The existing SQLAlchemy/Alembic models and migrations run against Supabase Postgres through `DATABASE_URL`. | Firebase Auth remains in place in this branch. The app does not use Supabase Auth or Storage. |
| Solana + x402 | Optional paid, machine-readable decision endpoint. An AI agent requests `/api/v1/agent/decision`; x402 returns payment requirements, verifies the signed payment before running the handler, and returns the brief only after successful settlement on Solana. | Founders do not need a wallet. The API, research, and database remain hosted services; this is not a fully decentralized app or an on-chain research system. |

Payment is not necessary for the founder workflow. x402 is a small, optional Solana-native commerce surface for agent clients and a concrete way for the product to participate in the agentic app track. Keep it disabled until the receiving wallet, facilitator, network, and price are configured. The default example is Devnet and must not be presented as mainnet-ready.

## Configure

### Supabase Postgres

1. Create a Supabase project and open **Connect** in the project dashboard.
2. Copy the Postgres connection string. Use the session pooler URL if the API host cannot reach Supabase's direct IPv6 endpoint.
3. Set Render's `DATABASE_URL` to the connection string, using the `postgresql+psycopg://` SQLAlchemy driver prefix. URL-encode special characters in the password.
4. Keep local Docker Compose on its local PostgreSQL service. Do not point local migrations at production unless intentionally operating on that database.
5. The Render start command runs `alembic upgrade head` before starting API and worker processes.

Supabase provides managed Postgres here; access to application data still goes through the existing API and Firebase identity checks. Do not expose the database password or service role credentials in the browser.

### Firecrawl and OpenRouter

Set these server-only Render variables:

```dotenv
FIRECRAWL_API_KEY=your_firecrawl_key
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=your_structured_output_model
OPENROUTER_SITE_URL=https://sandbox.helixqa.tech
```

The current integration calls Firecrawl `POST /v2/search` with page extraction enabled. It bounds each request to eight results and sends page evidence to OpenRouter as untrusted source material. If Firecrawl is not configured, the research endpoint returns `503`; it does not silently fall back to fabricated sources.

### Optional x402 on Solana Devnet

Create or use a Devnet receiving wallet and set:

```dotenv
SOLANA_PAY_TO=your_base58_devnet_wallet
SOLANA_NETWORK=solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1
SOLANA_RPC_URL=https://your-devnet-rpc
X402_FACILITATOR_URL=https://x402.org/facilitator
X402_RESEARCH_PRICE=$0.05
```

The Python x402 v2 SDK protects `GET /api/v1/agent/decision`. Without `SOLANA_PAY_TO`, the route returns `503` and no payment middleware is registered. The recipient address is public; never put a wallet seed phrase or private key in Render or this repository. The facilitator must support exact SVM payments on the configured network. Before a live demo, confirm the current testnet facilitator and supported token details from the [Solana x402 guide](https://solana.com/developers/docs/payments/agentic-payments/x402).

For real funds, explicitly choose a production network and facilitator, validate settlement and replay behavior end to end, and set a price that covers Firecrawl and model usage. The development facilitator and Devnet config are for demonstration only.

## Demo path

1. Sign in to the existing founder UI and describe an idea in plain language.
2. Complete the founder discovery questions, including audience and geography.
3. Review the evidence-backed assessment, three ranked assumptions, cheapest tests, and citations. Challenge a citation by opening the source; the web is fallible.
4. Save the exploration. Its discovery and source metadata are persisted in Supabase Postgres through the API.
5. Optional agent demo: request the paid route without a payment signature and show the x402 `402 Payment Required` response. Then use an x402-compatible Devnet client with test USDC to pay and retrieve a decision brief.
6. Run a simulation only where one of the founder's questions fits the simple queueing, inventory, or Monte Carlo model. Explain its assumptions and limits.

## API surface

- `POST /api/v1/ai/interpret` — Firebase-authenticated founder research and simulation draft, backed by Firecrawl evidence and OpenRouter structured output.
- `GET /api/v1/agent/decision?idea=...` — x402-protected agent-facing decision brief. Payment is verified before research work executes and settled before the result is returned.
- `GET /health` — Render health check.

The decision response includes a verdict, its reasoning, three assumptions with practical tests, evidence excerpts, source URLs, largest risk, and next decision. The x402 middleware verifies payment before research begins and settles after the handler returns successfully; if settlement fails, it withholds the result, though external research costs may already have been incurred. It is an assessment for exploration, not a validated forecast or investment advice.

## Decentralization and honest limits

Solana is used for payment settlement, not as a marketing label. Buyers can be independent agents, recipients control the receiving wallet, and x402 communicates the payment terms over HTTP. The service operator still controls the API, Firecrawl/OpenRouter credentials, and database. User accounts still use Firebase. Research text and founder ideas are not published on-chain. The decision brief is not currently anchored as a blockchain attestation.

This scope is intentional for a two-day hackathon build: prove an agent can buy one useful research output on Solana while keeping the founder experience familiar. A later iteration could let a founder wallet sign a salted digest of a final brief for tamper evidence, without putting the private idea or report itself on-chain.

## Verification checklist before submission

- `FIRECRAWL_API_KEY` is present in Render and absent from client builds.
- OpenRouter returns valid structured output for a real idea, and each displayed source URL came from Firecrawl.
- Supabase's database URL works from Render and Alembic reaches the expected head revision.
- x402 is disabled unless the Devnet recipient/facilitator/network settings are correct.
- An unpaid x402 request receives `402`; a valid Devnet payment receives exactly one result.
- A founder can complete the discovery flow without ever opening a wallet prompt.
- Demo language labels generated assessments and simplified simulations honestly.
