# Copilot Instructions for `combustiveis-intranet`

## Build, test, and lint commands

### Frontend (`client/`)
- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Preview production build: `npm run preview`

### Backend (`server/`)
- Install: `npm install`
- Dev server: `npm run dev`
- Run server: `npm start`
- Prisma client generation: `npx prisma generate`
- Apply migrations: `npx prisma migrate deploy`

### Tests
- There is no automated test suite configured in this repository yet.
- `server/package.json` has `"test": "echo \"Error: no test specified\" && exit 1"`.
- Single-test execution is not available until a test runner is added.

## High-level architecture

- The app is split into:
  - **React + Vite frontend** (`client/`)
  - **Express + Prisma backend** (`server/`)
  - **PostgreSQL** (via Docker Compose, exposed on `5434`)

- API routing path is always `/api` from the frontend:
  - In local dev, Vite proxies `/api` to `http://localhost:3000` (`client/vite.config.js`).
  - In containerized runtime, Nginx proxies `/api/` to `backend:3000` (`client/nginx.conf`).
  - Frontend axios client uses `baseURL: "/api"` (`client/src/api/combustivel.js`).

- Backend entrypoint (`server/index.js`) mounts route modules:
  - `/api/combustivel` (search, map, history, export, sync trigger, status)
  - `/api/dashboard` (analytics aggregations and charts data)
  - `/api/parametrizacao` (BCB indicators)
  - `/api/telegram` (webhook endpoint)

- Data ingestion and freshness model:
  - Scheduled jobs run at **04:00, 12:00, 18:00** (`sync.worker`) and a Telegram summary at **07:00**, timezone `America/Maceio` (`server/src/jobs/sync.job.js`).
  - Sync fetches SEFAZ data for all AL municipalities and fuel types, then persists via Prisma upserts (`server/src/services/sefazIngest.service.js`).
  - For `/combustivel`, backend prefers DB data and falls back to live SEFAZ fetch only when DB has no records for the requested slice (`server/src/controllers/combustivel.controller.js`).

- Analytics shape:
  - Dashboard endpoint mixes Prisma aggregations (`groupBy`, `findMany`) and raw SQL (`$queryRaw`) for grouped metrics, then returns a single payload for cards/charts/tables (`server/src/controllers/dashboard.controller.js`).
  - Map endpoint deduplicates per CNPJ, filters to valid coordinates, applies a 50km Haversine radius around centroid, and returns marker/stats payload (`getMapaPostos` in `combustivel.controller.js`).

- Persistence model (`server/prisma/schema.prisma`):
  - Core tables: `Municipio`, `Posto`, `Combustivel`, `Preco`
  - `Preco` uniqueness is per `(postoId, combustivelId, dataVenda)` for idempotent sync upserts.
  - Extra cache table: `IndicadorBCB` for BCB indicator values/validity.

## Key conventions specific to this codebase

- **Fuel type IDs are domain-critical and shared front/back** (`client/src/constants/combustiveis.js`, backend controllers/services):
  - `1` gasolina comum, `2` gasolina aditivada, `3` etanol, `4` diesel comum, `5` diesel S10, `6` GNV, `7` aditivado (local bucket).
  - Type `7` is local: when querying SEFAZ it maps to type `6`, then records are filtered by description keywords (`ehAditivado`).

- **Always treat “latest price per station” as CNPJ-deduplicated data**:
  - Queries intentionally sort by newest (`dataVenda`, `updatedAt`, `id`) then keep the first record per CNPJ.
  - This behavior is reused across search, map, dashboard, and Telegram summary flows.

- **Coordinate enrichment must preserve high-quality coordinates**:
  - In sync ingest, latitude/longitude are only updated when incoming coordinates are valid and non-zero.
  - This avoids overwriting previously enriched coordinates from backfill scripts.

- **Credenciado logic is hard-coded and mirrored in both layers**:
  - CNPJ allowlist exists in backend Excel export service and frontend constants.
  - If updating this list, keep both copies aligned.

- **Formatting and timezone conventions matter for UI/API consistency**:
  - Display formatting uses `pt-BR`.
  - Sale dates are frequently formatted with `timeZone: "UTC"` to avoid day-shift issues.
  - Cron scheduling is explicitly `America/Maceio`.

- **BCB indicator handling includes a domain override**:
  - Indicator code `20635` (“crédito livre”) is currently served from a fixed manual value path in `bcb.service.js`, while other indicators come from BCB API with DB caching/validity.

- **Required env behavior**:
  - Backend exits on startup if `APP_TOKEN` is missing (SEFAZ access dependency).
  - Prisma adapter expects `DATABASE_URL`.
