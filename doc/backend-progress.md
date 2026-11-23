# gacha Backend — Implementation Progress

This document tracks the incremental implementation of the gacha backend according to `doc/gacha Backend — Design Doc.md`.

---

## Feature Checklist

| Feature | Description | Status | Verification Summary |
|---|---|---|---|
| **F0** | Scaffold + Docker (Monorepo, Compose, Health API, Worker) | **Done** | `docker compose up` brings up postgres, migrate, api, worker. `GET /health` returns 200 with DB status. Worker logs boot. |
| **F1** | Database schema, migrations & seed for 7 schemes | Todo | Pending |
| **F2** | Shared package: ParsedDraw, parseTicket, checkTicket | Todo | Pending |
| **F3** | Source adapter interface + Onmanorama adapter | Todo | Pending |
| **F4** | Observations + validation rules + raw payload storage | Todo | Pending |
| **F5** | Draws + publishing (single-source behind config flag) | Todo | Pending |
| **F6** | Public read API with OpenAPI/Swagger & ticket check | Todo | Pending |
| **F7** | Scheduler (pg-boss jobs, IST windows, single-flight) | Todo | Pending |
| **F8** | keralalotteries.net adapter & winner agencies | Todo | Pending |
| **F9** | Reconciler (two-source agreement, needs_review diff) | Todo | Pending |
| **F10** | Official source: PDF parser & manual upload route | Todo | Pending |
| **F11** | Backfill, alert checks, metrics, deployment hardening | Todo | Pending |

---

## Feature 0: Scaffold + Docker

### What Was Built
- **Monorepo Layout** (`backend/`):
  - Root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `tsconfig.json`, `vitest.config.ts`, `.eslintrc.cjs`, `.prettierrc`.
  - `apps/api`: Fastify server with CORS, health check endpoint (`/health`), graceful shutdown.
  - `apps/worker`: Ingestion worker bootstrapper with DB health verification and graceful shutdown.
  - `packages/shared`: `RawStore` interface, `LocalRawStore` disk driver with SHA-256 hashing, shared types.
  - `packages/db`: PostgreSQL connection pool, Drizzle client helper, DB health check, bootstrap migration runner.
  - `packages/sources`: Source adapter interfaces and types.
- **Docker Infrastructure**:
  - `Dockerfile`: Multi-stage Dockerfile (`base` -> `dependencies` -> `dev` / `builder` -> `runner` non-root `node` user on Alpine).
  - `docker-compose.yml`: Local development setup with `postgres:16-alpine`, `migrate` bootstrap runner, `api` (port 3001), `worker`, source mounts for hot reload, named volumes for DB and raw data.
  - `compose.prod.yml`: Production configuration with Caddy reverse proxy, resource memory caps (Node heap 384MB), isolated internal network (Postgres not exposed), named volumes.
  - `Caddyfile`: Reverse proxies `/api/*` and `/health` to API container, provides automatic TLS and security headers.
  - `backend/scripts/backup.sh`: Automated `pg_dump` with gzip compression and retention pruning.
  - `backend/Makefile`: Convenience commands (`up`, `down`, `logs`, `migrate`, `test`, `psql`, `reset-db`).

### Verification Steps
```bash
# 1. Start containers with Docker Compose
docker compose up -d

# 2. Check health endpoint of the API
curl -i http://localhost:3001/health

# 3. Check worker container logs
docker compose logs worker

# 4. Check migration runner logs
docker compose logs migrate
```

### Decisions Made & Deviations from Design
1. **Container Hot Reloading**: In `docker-compose.yml`, mounted `./<package>/src` to `/app/<package>/src` rather than the entire workspace root. This prevents host OS file differences (e.g. Windows symlinks) from corrupting the container's Linux `node_modules` while still providing instant hot-reloading via `tsx watch`.
2. **Alpine Linux Base**: Used `node:22-alpine` for compact image footprint (< 180MB) and fast builds.
3. **F0 Bootstrap Migration**: Since full schema tables are scheduled for F1, the F0 migration runner checks and logs database connectivity to satisfy the container health dependency chain (`depends_on: migrate: condition: service_completed_successfully`).

### Known Issues
- None.

### Next Feature
- **F1: Database**: Drizzle schema and migrations for schemes, scheme_series, draws, prize_tiers, prize_entries, source_observations, winner_agencies, ingest_events, plus seed data for the 7 current weekly schemes.
