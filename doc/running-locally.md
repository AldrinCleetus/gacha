# Running gacha Backend Locally

This guide covers running the gacha backend services locally for development and testing.

## Prerequisites
- [Docker](https://www.docker.com/) and Docker Compose v2.
- [Node.js 22 LTS](https://nodejs.org/) and [pnpm](https://pnpm.io/) (v10+).

---

## Quickstart (Docker Compose - Recommended)

From the `backend/` directory:

1. **Configure Environment**:
   ```bash
   cp .env.example .env
   ```
   (The default credentials in `.env.example` work out-of-the-box for local docker compose).

2. **Start All Services**:
   ```bash
   docker compose up -d
   ```
   This will:
   - Start PostgreSQL 16 container (`gacha_postgres`) with a healthcheck on port `5432`.
   - Run the `migrate` service (`gacha_migrate`) once PostgreSQL is healthy.
   - Boot the Fastify API (`gacha_api`) on port `3001` with hot-reload.
   - Boot the worker (`gacha_worker`) with hot-reload.

3. **Verify API Health**:
   ```bash
   curl http://localhost:3001/health
   ```
   Expected response:
   ```json
   {
     "status": "ok",
     "db": "connected",
     "dbLatencyMs": 3,
     "timestamp": "2026-11-23T02:00:00.000Z",
     "uptimeSeconds": 15
   }
   ```

4. **View Logs**:
   ```bash
   docker compose logs -f api
   docker compose logs -f worker
   ```

5. **Stop Services**:
   ```bash
   docker compose down
   ```

---

## Native Development (Running on Host Machine)

If you prefer to run Node.js processes natively on your machine:

1. Start only PostgreSQL via Docker:
   ```bash
   docker compose up -d postgres
   ```

2. Update `DATABASE_URL` in `.env`:
   ```bash
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gacha
   ```

3. Install monorepo dependencies:
   ```bash
   pnpm install
   ```

4. Run tests:
   ```bash
   pnpm test
   ```

5. Run typecheck and lint:
   ```bash
   pnpm typecheck
   pnpm lint
   ```

6. Start API in dev mode:
   ```bash
   pnpm --filter @gacha/api dev
   ```

7. Start Worker in dev mode:
   ```bash
   pnpm --filter @gacha/worker dev
   ```

---

## Handy Makefile Commands
- `make up` - Start all containers in background
- `make down` - Stop and remove containers
- `make logs` - Stream logs
- `make migrate` - Run database migrations
- `make psql` - Open an interactive psql shell inside the database container
- `make reset-db` - Wipe database volume and re-run migrations from scratch
- `make test` - Run all Vitest suites
