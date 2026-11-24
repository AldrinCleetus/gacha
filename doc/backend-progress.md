# gacha Backend — Implementation Progress

This document tracks the incremental implementation of the gacha backend according to `doc/gacha Backend — Design Doc.md`.

---

## Feature Checklist

| Feature | Description | Status | Verification Summary |
|---|---|---|---|
| **F0** | Scaffold + Docker (Monorepo, Compose, Health API, Worker) | **Done** | `docker compose up` brings up postgres, migrate, api, worker. `GET /health` returns 200 with DB status. Worker logs boot. |
| **F1** | Database schema, migrations & seed for 7 schemes | **Done** | `migrate` runs against clean DB; 8 tables created; 7 schemes seeded; verified via psql queries. |
| **F2** | Shared package: ParsedDraw, parseTicket, checkTicket | **Done** | `checkTicket` and `parseTicket` unit tested (34 tests passing); CLI `pnpm check-ticket` verified against fixture. |
| **F3** | Source adapter interface + Onmanorama adapter | **Done** | Real HTML fixtures saved; listing + article parser built; PoliteHttpClient with rate-limiting, ETag/304 cache, and polite User-Agent; 44 tests passing; CLI `pnpm ingest:onmanorama` verified on live URL and fixture. |
| **F4** | Observations + validation rules + raw payload storage | **Done** | `RawStore` archival; `source_observations` upsert with validation JSON; validation rules (date/weekday, tiers, formats, descending amounts); canonical fingerprinting; CLI `pnpm ingest` verified with valid & broken fixtures. |
| **F5** | Draws + publishing (single-source behind config flag) | **Done** | Atomic publish transaction (`draws`, `prize_tiers`, `prize_entries`, `ingest_events`); idempotent re-ingest; status lifecycle; conflict detection (`needs_review`); verified via psql and CLI. |
| **F6** | Public read API with OpenAPI/Swagger & ticket check | **Done** | Fastify read API under `/v1`; 6 endpoints; Zod validation; ETag & 304 handling; Cache-Control headers; per-IP rate limiting; Swagger UI at `/docs`; 64 tests passing; verified live with curl. |
| **F7** | Scheduler (pg-boss jobs, IST windows, single-flight) | **Done** | pg-boss scheduler running in Docker worker; polling windows computed in IST; expected draw created automatically; single-flight deduplication; manual CLI `pnpm poll:manual` tested with live Onmanorama, faked clock, and fixtures; 76 tests passing. |
| **F8** | keralalotteries.net adapter & winner agencies | **Done** | Adapter for keralalotteries.net built with live & fixture discovery; parsed winner agencies inserted into `winner_agencies`; exact `ParsedDraw` validated across Karunya KR-762 and Samrudhi SM-82 fixtures; CLI `pnpm ingest:keralalotteries` verified; 86 tests passing. |
| **F9** | Reconciler (two-source agreement, needs_review diff) | **Done** | Two-source agreement rule enforced; compareDraws() and diff renderer built; reconciliation engine handles consensus, conflict, and late corrections; admin CLI (review, diff, publish) verified live; single-source publish flag disabled by default; 95 tests passing. |
| **F10** | Official source: PDF parser & manual upload route | **Done** | Positioned PDF text extractor using pdfjs-dist coordinate clustering; official PDF parser for departmental headers, tiers, tickets, and winner agencies; POST /admin/ingest/pdf with multipart/binary upload and token auth; authoritative reconciliation rule; admin CLI pnpm ingest:official verified live; 114 tests passing. |
| **F11** | Backfill, alert checks, metrics, deployment hardening | **Done** | Historical draw backfill command (`pnpm backfill`) with rate limiting and dry-run; canary drift check (`pnpm canary`) catching layout drift before draw day; alert engine (`GET /admin/alerts`) checking 6:30 PM threshold, needs_review draws, degraded sources; Prometheus metrics (`GET /metrics`); production compose verification; 128 tests passing. |

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

---

## Feature 1: Database Schema, Migrations & Seeds

### What Was Built
- **Drizzle Schema Definitions (`packages/db/src/schema/`)**:
  - `schemes`: Primary table for Kerala lottery schemes (`code`, `name`, `weekday`, `ticket_price`, `is_bumper`, `structure` jsonb).
  - `scheme_series`: Composite primary key table (`scheme_code`, `series`) referencing `schemes` with cascade delete.
  - `draws`: Historical and scheduled draws (`id` UUID, `scheme_code`, `draw_code`, `draw_date`, `status`, `published_at`, `fingerprint`, unique on `(scheme_code, draw_code)`, index on `draw_date desc`).
  - `prize_tiers`: Tiers per draw (`draw_id`, `tier`, `amount` in rupees, `match_type`, primary key `(draw_id, tier)`).
  - `prize_entries`: Winning ticket numbers / last-4 entries per draw tier (`draw_id`, `tier`, `entry`, composite primary key, index on `(draw_id, entry)`).
  - `source_observations`: Raw ingest payloads and parsed observations per source (`draw_id`, `source`, `source_url`, `fetched_at`, `raw_object_key`, `content_hash`, `parsed` jsonb, `fingerprint`, `validation` jsonb, unique on `(draw_id, source, content_hash)`).
  - `winner_agencies`: Agency details for winning tickets where published (`draw_id`, `tier`, `ticket`, `agency_name`, `agency_code`, `place`, `source`, composite primary key).
  - `ingest_events`: Immutable audit log table (`id` bigserial, `draw_id`, `kind`, `detail` jsonb, `at` timestamptz).
  - `relations`: Complete Drizzle relation mappings between all tables.
- **SQL Migration (`packages/db/drizzle/0000_colorful_doctor_spectrum.sql`)**:
  - Generated via `drizzle-kit` adhering strictly to Section 7 of the design document.
- **Migration Runner (`packages/db/src/migrate.ts`)**:
  - Automatically locates migration directory across host and container paths.
  - Runs Drizzle migrations programmatically using `migrate()` from `drizzle-orm/node-postgres/migrator`.
  - Automatically seeds the 7 weekly schemes on clean database startup.
- **Weekly Scheme Seeds (`packages/db/src/seed.ts`)**:
  - 1: `BT` - Bhagyathara (Mon, confirmed)
  - 2: `SS` - Sthree Sakthi (Tue, confirmed)
  - 3: `DL` - Dhanalekshmi (Wed, confirmed)
  - 4: `KN` - Karunya Plus (Thu, confirmed)
  - 5: `SK` - Suvarna Keralam (Fri, marked `needsConfirmation: true`, `confirmed: false`)
  - 6: `KR` - Karunya (Sat, confirmed)
  - 7: `SM` - Samrudhi (Sun, confirmed)
  - Idempotent upsert via `onConflictDoUpdate`.
- **Tests (`packages/db/src/__tests__/schema.test.ts`)**:
  - Unit tests asserting 8 table definitions, 7 scheme seeds covering days 1-7, Suvarna Keralam confirmation flag, and drizzle SQL folder resolution.

### Verification Steps
```bash
# 1. Reset database volume to verify clean migration and seeding
docker compose down -v
docker compose up -d

# 2. Check migration runner logs
docker compose logs migrate

# 3. Query PostgreSQL for tables
docker compose exec postgres psql -U postgres -d gacha -c "\dt"

# 4. Query PostgreSQL for seeded schemes
docker compose exec postgres psql -U postgres -d gacha -c "SELECT code, name, weekday, ticket_price, is_bumper FROM schemes ORDER BY weekday;"
docker compose exec postgres psql -U postgres -d gacha -c "SELECT code, name, structure->>'dayName' as day, structure->>'confirmed' as confirmed, structure->>'note' as note FROM schemes ORDER BY weekday;"
```

### Decisions Made & Deviations from Design
1. **Suvarna Keralam (Friday) Scheme Code**:
   - As instructed, Friday's Suvarna Keralam scheme is assigned code `SK` and explicitly marked with `{ confirmed: false, needsConfirmation: true, note: "Scheme code 'SK' needs confirmation from real draw data (e.g. Suvarna Keralam Friday draw)" }` in its `structure` JSON. Once real draw data is parsed in F3/F4, the code can be confirmed or updated.
2. **Prize Amount BigInt Representation**:
   - `prize_tiers.amount` is defined as `bigint("amount", { mode: "number" })` in Drizzle. This fits lottery prize numbers cleanly without requiring custom BigInt JSON serialization while accurately storing values up to millions/crores in standard Postgres `bigint`.
3. **Automated Seeding during Migration**:
   - Integrated `seedSchemes()` directly into `runMigrations()` in `migrate.ts` so that whenever the `migrate` service runs on a fresh database, both table creation and initial scheme seeding happen before the API and worker services boot.

### Known Issues
- None.

### Next Feature
- **F2: Shared Package**: `ParsedDraw` and related Zod schemas, `parseTicket` (accepts "AB123456", "AB 123456", "ab-123456"), `checkTicket(ticket, draw) -> MatchResult` (full match, consolation, last-4, none, with `matchedIndices` and closest-match info). Thorough unit tests. CLI: `pnpm check-ticket <ticket> <fixture>`. No network.

---

## Feature 2: Shared Package (Schemas, Parser, Matcher & CLI)

### What Was Built
- **Zod Schemas (`packages/shared/src/schemas.ts`)**:
  - `ParsedDrawSchema`: Validates full draw structure (`source`, `sourceUrl`, `fetchedAt`, `schemeName`, `schemeCode`, `drawCode`, `drawDate`, `tiers`, `agents`, `raw.contentHash`).
  - `PrizeTierSchema`: Tier details (`tier`, `amount`, `matchType` ("full" | "consolation" | "last4"), `entries`).
  - `ParsedTicketSchema`: Structured parsed ticket representation (`schemeCode`, `seriesChar`, `series`, `digits`, `fullTicketString`, `characters`, `isValid`, `error`).
  - `MatchResultSchema`: Standardized outcome (`kind` ("jackpot" | "mid" | "small" | "none"), `tier`, `amount`, `formattedAmount`, `matchedIndices`, `closestMatch`, `summary`).
  - `DrawRefSchema`: Source discovery reference (`schemeCode`, `drawCode`, `drawDate`, `url`).
- **Ticket Parser (`packages/shared/src/parser.ts`)**:
  - `parseTicket(raw: string)`: Robust pure function accepting:
    - `"AB 123456"` (standard space format)
    - `"AB123456"` (compact format)
    - `"ab-123456"` (hyphenated lowercase format)
    - `"  w a - 5 8 4 9 2 0 "` (scattered spaces and punctuation)
    - Rejects invalid tickets (short, long, non-letters in series, non-digits in number) with friendly error descriptions.
- **Ticket Matcher (`packages/shared/src/checkTicket.ts`)**:
  - Pure function evaluating tickets against draw results offline without network access.
  - Handles:
    1. Full match (series + 6 digits) -> Jackpot 1st prize (`matchedIndices: [0..7]`).
    2. Consolation prize (same 6 digits, different series) -> Mid prize with truthful note (`"Same number as the 1st prize, different series"`).
    3. Secondary full prizes (2nd / 3rd prize).
    4. Last-4 digits match -> Mid / Small prize (`matchedIndices: [4, 5, 6, 7]`).
    5. Truthful near-miss calculation for no-win:
       - 5 of 6 digits of 1st prize (`"Matched 5 of the 6 digits of the 1st prize (XXXXXX)"`).
       - 3 of 4 digits of drawn 4-digit numbers (`"Off by one digit from drawn number XXXX"`).
       - Same series as 1st prize (`"Same series (XX) as the 1st prize winner"`).
       - Coincidental character matches for realistic ticket card scanning.
    6. Unpublished draws -> returns `"Results Pending"` status.
    7. Supports demo forced outcomes (`jackpot`, `mid`, `small`, `none`).
- **CLI Utility (`packages/shared/src/cli.ts`)**:
  - `pnpm check-ticket <ticket> <fixture-path>`
  - Evaluates ticket against fixture JSON, printing both human-readable overview and JSON output.
- **Sample Fixture (`packages/shared/fixtures/sample-draw.json`)**:
  - Real sample draw of Karunya KR-777.
- **Unit Tests (`packages/shared/src/__tests__/ticket.test.ts`)**:
  - 21 thorough unit tests covering all formats, win tiers, near-misses, edge cases, and formatting.

### Verification Steps
```bash
# 1. Run all unit tests across the monorepo
pnpm test

# 2. Check 1st Prize (Jackpot) via CLI
pnpm check-ticket WA584920 packages/shared/fixtures/sample-draw.json

# 3. Check Consolation Prize via CLI
pnpm check-ticket WB584920 packages/shared/fixtures/sample-draw.json

# 4. Check Last-4 Prize via CLI
pnpm check-ticket "KL 114920" packages/shared/fixtures/sample-draw.json

# 5. Check No-Win Near-Miss (5 of 6 digits) via CLI
pnpm check-ticket "wa-584921" packages/shared/fixtures/sample-draw.json
```

### Decisions Made & Deviations from Design
1. **Dual Draw Input Compatibility**:
   `checkTicket` accepts either `ParsedDraw` (backend schema with `tiers[]`) or `CheckTicketDrawInput` (frontend schema with `prizes{}`), allowing full code sharing between backend Fastify API endpoints and the React frontend.
2. **Indian Number Formatting**:
   Added `formatINR()` in shared package to produce official Rupee representations (e.g. `₹80,00,000`, `₹5,000`).

### Known Issues
- None.

### Next Feature
- **F3: Source Adapter Interface + Onmanorama Adapter**: Fetch the topic listing page and live result articles, save real HTML fixtures into `packages/sources/onmanorama/fixtures/`, write the Cheerio parser, assert exact `ParsedDraw` output in tests, respect `robots.txt`, rate limiting (~1 req/few secs per host), and add CLI `pnpm ingest:onmanorama --url <url>`.

---

## Feature 3: Source Adapter Interface + Onmanorama Adapter

### What Was Built
- **Source Adapter Interface (`packages/sources/src/types.ts`)**:
  - `SourceAdapter`: Contract with `id`, `name`, `discover(): Promise<DrawRef[]>`, `fetchAndParse(refOrUrl): Promise<ParsedDraw>`.
  - `HttpResponse`, `HttpOptions` interfaces.
- **Polite HTTP Client (`packages/sources/src/http.ts`)**:
  - Host-based rate limiting (enforces >=2000ms delay between consecutive requests per host).
  - Clear, informative User-Agent (`gacha-bot/1.0 (+https://github.com/project-gacha; bot@gacha.local)`).
  - Conditional HTTP requests with `If-None-Match` (ETag) and `If-Modified-Since` (Last-Modified).
  - In-memory cache handling `304 Not Modified` responses transparently.
  - AbortController timeout handling (defaults to 15s).
- **Real Fixtures Saved (`packages/sources/src/onmanorama/fixtures/`)**:
  - `listing.html` (210 KB): Real HTML from Onmanorama lottery topic listing (`https://www.onmanorama.com/topic/general-topics/78/kerala-lottery-results.html`).
  - `samrudhi-sm-82.html` (376 KB): Real HTML from live result article (`https://www.onmanorama.com/news/kerala/2026/11/22/samrudhi-sm-82-lottery-results-kerala-1-crore-first-prize-list-winners-live.html`).
- **Onmanorama Parser (`packages/sources/src/onmanorama/parser.ts`)**:
  - `parseListing(html)`: Extracts `DrawRef[]` sorted newest first. Discovered draws match all 7 weekly schemes (`SM-82`, `KR-777`, `SK-78`, `KN-650`, `DL-78`, `SS-546`, `BT-80`), validating scheme codes.
  - `parseArticle(html, sourceUrl?)`: Parses Onmanorama lottery articles into exact `ParsedDraw` structures:
    - Extracts `schemeName`, `schemeCode`, `drawCode`, `drawDate` from canonical URL or titles/headings.
    - Preserves inline paragraph breaks (`<br>` -> `\n`) to parse multi-tier paragraphs reliably.
    - Extracts 1st prize (full ticket: series + 6 digits).
    - Extracts consolation prize (amount and matchType).
    - Extracts 2nd and 3rd prizes (full tickets).
    - Extracts 4th through 9th prizes (last 4-digit numbers, e.g. 150 numbers for 9th prize).
    - Parses currency representations (`"1 cr"`, `"25 lakh"`, `"5000"`, `"500"`, `"100"`).
    - Generates SHA-256 `contentHash` of the raw HTML.
    - Validates strictly against `ParsedDrawSchema`.
  - Robust error handling: Throws typed `ParseError` if 1st prize is missing, ticket numbers are empty, or draw metadata cannot be resolved. Never guesses.
- **Onmanorama Adapter (`packages/sources/src/onmanorama/adapter.ts`)**:
  - Implements `SourceAdapter` using `PoliteHttpClient` and parser functions.
- **CLI Utility (`packages/sources/src/onmanorama/cli.ts`)**:
  - Script in `backend/package.json`: `"ingest:onmanorama": "tsx packages/sources/src/onmanorama/cli.ts"`
  - Supports `--url <url>` and `--fixture <path>`. Prints `ParsedDraw` JSON to stdout and does NOT write to database.
- **Unit Tests (`packages/sources/src/__tests__/onmanorama.test.ts`)**:
  - 10 comprehensive tests covering `parseAmount`, `parseListing`, exact `parseArticle` assertions, and `ParseError` scenarios.
  - All 44 tests passing across the monorepo.
  - Lint and typecheck passing with 0 errors.

### Verification Steps
```bash
# 1. Run all tests across the monorepo
cd backend
pnpm test

# 2. Run lint and typecheck
pnpm lint
pnpm typecheck

# 3. Test CLI against the real saved HTML fixture (offline)
pnpm ingest:onmanorama --fixture packages/sources/src/onmanorama/fixtures/samrudhi-sm-82.html

# 4. Test CLI against the live Onmanorama URL (network)
pnpm ingest:onmanorama --url https://www.onmanorama.com/news/kerala/2026/11/22/samrudhi-sm-82-lottery-results-kerala-1-crore-first-prize-list-winners-live.html

# 5. Verify running docker stack
docker compose ps
curl http://localhost:3001/health
```

### Decisions Made & Deviations from Design
1. **Preserving `<br>` in Cheerio**:
   Onmanorama groups the 1st prize, consolation prize, 2nd prize, and 3rd prize inside a single `<p>` separated by `<br>` tags. Replacing `<br>` with `\n` before line extraction isolates each tier cleanly without fragile DOM traversal.
2. **Dynamic Entry Format Detection**:
   Tiers are categorized dynamically: entries matching `[A-Z]{2}\s*\d{6}` are classified as `full`, entries with `\d{4}` are classified as `last4`, and consolation is classified as `consolation`. This makes the parser resilient across different lottery formats (weekly vs bumper).
3. **Confirmed Friday Scheme Code 'SK'**:
   The Onmanorama listing fixture explicitly contains `/news/kerala/2026/11/20/suvarna-keralam-sk-78-...` and `sk-77`, confirming that Friday's Suvarna Keralam scheme code is indeed `SK`.

### Known Issues
- None.

### Next Feature
- **F4: Observations + Validation**: Store raw payloads via `RawStore`, write `source_observations`, implement validation rules from the design (draw date and weekday match, expected tiers and counts from scheme structure config, ticket formats, descending amounts), record failures without throwing away, add CLI to ingest one URL into database.

---

## Feature 4: Observations + Validation

### What Was Built
- **Validation Engine (`packages/sources/src/validation.ts`)**:
  - Implements the strict validation rules from Section 4.3 of the design doc:
    1. **Date validity**: Draw date must be a valid calendar date in IST format (`YYYY-MM-DD`) and must not be in the future (`drawDate <= todayIST`).
    2. **Weekday match**: If the scheme is weekly (`schemes.weekday` 1 = Mon ... 7 = Sun), `getWeekdayFromDate(drawDate)` must exactly match the scheme's weekday.
    3. **Expected tiers presence**: Verifies all expected tiers are present (`1`, `consolation`, `2`, `3`, `4`, `5`, `6`, `7`, `8`, etc.) from scheme structure configuration.
    4. **Ticket format well-formedness**: Full tickets must be 2 uppercase letters + 6 digits (`/^[A-Z]{2}\d{6}$/`); last-4 numbers must be 4 digits (`/^\d{4}$/`).
    5. **Amounts positive & descending**: Every tier amount must be positive. Major prize tiers must descend (Tier 1 > Tier 2 > Tier 3 > Tier 4 >= Tier 5 >= Tier 6...).
    6. **1st prize series check**: Series must be 2 uppercase letters and belong to known series registered for the scheme if known series are present.
  - Returns structured `ValidationResult`: `{ ok: boolean, errors: string[] }`.
- **Draw Fingerprint Generator (`packages/sources/src/fingerprint.ts`)**:
  - Implements Section 4.2 of the design doc.
  - Canonicalizes prize tiers and sorts all entries within each tier before generating SHA-256 hash.
  - Guarantees that two independent sources reporting the same draw results will yield the identical fingerprint regardless of entry ordering.
- **Ingestion Service (`packages/sources/src/ingest.ts`)**:
  - Coordinates end-to-end ingestion from URL, fixture path, or HTML payload:
    1. Stores raw payload into `RawStore` under `sources/<source>/<schemeCode>/<drawCode>/<contentHash>.html`.
    2. Parses draw or captures parse errors.
    3. Runs validation rules against the parsed draw and scheme config from PostgreSQL.
    4. Computes normalized prize fingerprint.
    5. Upserts draw into `draws` table with initial status (`observed` if valid, `needs_review` if invalid).
    6. Upserts observation into `source_observations` table with `{ ok, errors }` validation JSON.
    7. Registers newly observed series into `scheme_series`.
    8. Failures are recorded and never thrown away. Idempotent on re-ingest.
- **CLI Utility (`packages/sources/src/cli/ingest.ts`)**:
  - Added npm script in `backend/package.json`: `"ingest": "tsx packages/sources/src/cli/ingest.ts"`.
  - Supports: `pnpm ingest --fixture <path>` and `pnpm ingest --url <url>`.
  - Ingests draw, writes raw payload to `RawStore`, and upserts database records in PostgreSQL.
- **Fixtures & Tests**:
  - Real valid fixture: `packages/sources/src/onmanorama/fixtures/samrudhi-sm-82.html`.
  - Deliberately broken fixture: `packages/sources/src/onmanorama/fixtures/broken-invalid-draw.html` (weekday mismatch + descending amount violation).
  - Unit tests:
    - `packages/sources/src/__tests__/validation.test.ts` (8 tests)
    - `packages/sources/src/__tests__/fingerprint.test.ts` (2 tests)
  - Monorepo test suite: 9 test files, 54 tests passing.

### Verification Steps
```bash
# 1. Ingest valid draw fixture into database
cd backend
pnpm ingest --fixture packages/sources/src/onmanorama/fixtures/samrudhi-sm-82.html

# 2. Ingest deliberately broken draw fixture into database
pnpm ingest --fixture packages/sources/src/onmanorama/fixtures/broken-invalid-draw.html

# 3. Query PostgreSQL source_observations table
docker compose exec postgres psql -U postgres -d gacha -c "SELECT id, draw_id, source, raw_object_key, validation->>'ok' as ok, validation->>'errors' as errors FROM source_observations;"

# 4. Query PostgreSQL draws table
docker compose exec postgres psql -U postgres -d gacha -c "SELECT id, scheme_code, draw_code, draw_date, status, fingerprint FROM draws;"

# 5. Check raw payload archival storage
ls backend/data/raw/sources/onmanorama/SM/SM-82

# 6. Run all unit tests, lint, and typecheck
pnpm test
pnpm lint
pnpm typecheck
```

### Decisions Made & Deviations from Design
1. **Handling Ingestion Failures Gracefully**:
   Even if an article is malformed or validation fails, `ingestObservation` stores the raw HTML in `RawStore` and inserts the observation into `source_observations` with `validation: { ok: false, errors: [...] }`. Associated draws are placed in `needs_review` status.
2. **Deterministic Canonical Fingerprints**:
   Tiers are ordered numerically (`1`, `2`, `3`, ..., `consolation`), and all entry arrays are sorted before hashing to eliminate source ordering discrepancies.
3. **Database URL Host Mapping in .env**:
   Configured `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/gacha` in `.env` for host-side CLI operations, while `docker-compose.yml` provides internal container hostnames (`postgres:5432`).

### Known Issues
- None.

### Next Feature
- **F5: Draws + Publishing (single-source behind config flag)**: Turn a valid observation into a published draw with tiers and entries in one atomic transaction, status lifecycle (`expected`, `observed`, `published`, `needs_review`), `ingest_events` audit logging, and idempotent re-ingestion.

---

## Feature 5: Draws + Publishing (Single-Source)

### What Was Built
- **Publishing Engine (`packages/sources/src/publish.ts`)**:
  - `publishDraw(db, drawId, parsed, options)`:
    - Atomically publishes a draw within a single PostgreSQL transaction (`db.transaction`).
    - Obtains exclusive row-level lock on the target draw using `SELECT ... FOR UPDATE` to avoid race conditions.
    - Idempotency guard: If the draw is already in `published` status with the identical fingerprint, returns `{ alreadyPublished: true, published: false }` with zero duplicate rows created.
    - Conflict detection: If an observation arrives for an already-published draw with a conflicting fingerprint, transitions status to `needs_review` and inserts an audit log event of kind `conflict`.
    - Inserts all `prize_tiers` (`draw_id`, `tier`, `amount`, `match_type`).
    - Batch inserts all `prize_entries` (`draw_id`, `tier`, `entry`) in chunks of 250 rows to avoid query parameter limits.
    - Inserts `winner_agencies` if agent info is present in the observation.
    - Updates `draws` status to `'published'`, sets `published_at = NOW()`, and records `fingerprint`.
    - Inserts audit log record into `ingest_events` with kind `'published'` and metadata (`source`, `sourceUrl`, `fingerprint`, `tierCount`, `entryCount`, `singleSource: true`).
  - `isSingleSourcePublishEnabled()`: Helper checking `process.env.SINGLE_SOURCE_PUBLISH !== 'false'` (defaults to `true` for early development).
- **Ingestion Pipeline Integration (`packages/sources/src/ingest.ts`)**:
  - Updated `ingestObservation` to automatically invoke `publishDraw()` when validation succeeds and single-source publishing is active (`autoPublish`).
  - Added CLI flag `--no-publish` in `packages/sources/src/cli/ingest.ts` to allow testing observations without publishing when desired.
- **Unit & Integration Tests (`packages/sources/src/__tests__/publish.test.ts`)**:
  - Added tests asserting:
    1. Single-source flag check defaults to true and honors `process.env.SINGLE_SOURCE_PUBLISH='false'`.
    2. Atomic transaction structure and conflict event recording.
  - Test suite now includes 10 test files and 56 passing tests across the monorepo.
  - Lint and typecheck clean with 0 errors.

### Verification Steps
```bash
# 1. Ingest fixture and publish draw into PostgreSQL
cd backend
pnpm ingest --fixture packages/sources/src/onmanorama/fixtures/samrudhi-sm-82.html

# Output:
# {
#   "observationId": "...",
#   "drawId": "501eb8a1-64ac-4d22-a9b9-95dbc3945512",
#   "drawStatus": "published",
#   "published": true,
#   "alreadyPublished": false,
#   "fingerprint": "48c35a8abb1409dfb7727344808f409c8f09311d6c9d1c8424539f8be60505f8",
#   "tierCount": 10,
#   "entryCount": 371
# }

# 2. Test Idempotency (re-running the exact same ingest command)
pnpm ingest --fixture packages/sources/src/onmanorama/fixtures/samrudhi-sm-82.html

# Output:
# {
#   "drawStatus": "published",
#   "published": false,
#   "alreadyPublished": true
# }

# 3. Query PostgreSQL draws table
docker compose exec postgres psql -U postgres -d gacha -c "SELECT id, scheme_code, draw_code, draw_date, status, published_at, fingerprint FROM draws;"

# 4. Query PostgreSQL prize_tiers table
docker compose exec postgres psql -U postgres -d gacha -c "SELECT tier, amount, match_type FROM prize_tiers ORDER BY tier;"

# 5. Query PostgreSQL prize_entries count per tier
docker compose exec postgres psql -U postgres -d gacha -c "SELECT tier, count(*) FROM prize_entries GROUP BY tier ORDER BY tier;"

# 6. Query PostgreSQL ingest_events audit log
docker compose exec postgres psql -U postgres -d gacha -c "SELECT id, draw_id, kind, detail FROM ingest_events;"

# 7. Run all monorepo checks
pnpm test
pnpm lint
pnpm typecheck
```

### Decisions Made & Deviations from Design
1. **Row Locking (`FOR UPDATE`)**:
   Used `tx.select().from(draws).where(eq(draws.id, drawId)).for("update")` inside the transaction to prevent concurrent scraper workers from attempting to publish the same draw simultaneously.
2. **Chunked Prize Entry Inserts**:
   High-count prize tiers (such as 9th prize with 150 entries, or bumper draws with thousands of entries) can exceed Postgres query parameter limits if inserted in a single query. Chunking into batches of 250 ensures safe, fast insertion.
3. **Audit Trail on Conflict**:
   If an incoming observation differs in fingerprint from an already-published draw, the system does not overwrite the published results; instead, it safely flips the draw to `needs_review` and creates an audit event (`kind: "conflict"`) with both fingerprints and source details.

### Known Issues
- None.

### Next Feature
- **F6: Public Read API**: Fastify read API with `GET /v1/schemes`, `GET /v1/draws` (with pagination, scheme filter, before filter), `GET /v1/draws/latest`, `GET /v1/draws/:id`, `POST /v1/draws/:id/check` using shared `checkTicket`, `GET /v1/draws/status`. Zod validation, ETag + Cache-Control, per-IP rate limiting, and OpenAPI/Swagger documentation at `/docs`.

---

## Feature 6: Public Read API with OpenAPI/Swagger & Ticket Check

### What Was Built
- **Endpoints (`apps/api/src/routes/v1/`)**:
  - `GET /v1/schemes`: Returns all 7 weekly schemes with weekday, ticket price, known series letters (aggregated from `scheme_series`), and prize structure configuration.
  - `GET /v1/draws`: Lists published draws sorted newest first with pagination (`limit`, defaults to 20, max 100), optional `scheme` filter (e.g. `SM`), and optional `before` date filter (`YYYY-MM-DD`).
  - `GET /v1/draws/latest`: Returns the latest published draw (optionally filtered by `scheme`). Returns 404 if no published draw exists for the criteria.
  - `GET /v1/draws/:id`: Returns full draw details including all prize tiers (`amount`, `matchType`, `entries`) and winner agencies. Supports lookup by UUID or draw code (`SM-82`, case-insensitive). Returns 404 if not found or not published.
  - `POST /v1/draws/:id/check`: Verifies ticket number string (e.g. `"MO 747323"`) against the draw using the shared `checkTicket` engine. Returns complete `MatchResult` with celebration `kind`, winning `tier`, `amount`, `formattedAmount`, `matchedIndices`, truthful `closestMatch`, and summary.
  - `GET /v1/draws/status`: Checks draw state for any calendar date in IST (defaults to current date). Identifies scheduled weekly scheme, status (`expected`, `observed`, `published`, `needs_review`), and attaches published draw metadata when available.
- **Caching & HTTP Semantics (Design Doc Section 8.2)**:
  - `@fastify/etag`: Automatic strong ETag generation on all GET endpoints with transparent `304 Not Modified` on `If-None-Match`.
  - `/v1/draws/:id`: `Cache-Control: public, max-age=31536000, immutable`.
  - `/v1/schemes`: `Cache-Control: public, max-age=300, stale-while-revalidate=60`.
  - `/v1/draws` & `/v1/draws/latest`: `Cache-Control: public, max-age=60, s-maxage=60`.
  - `/v1/draws/status`: `Cache-Control: public, max-age=15, stale-while-revalidate=15`.
  - `/v1/draws/:id/check`: `Cache-Control: private, no-cache`.
- **Security & Protection**:
  - `@fastify/rate-limit`: Per-IP rate limiting (120 req/minute, standard `X-RateLimit-*` headers, localhost allowlisted).
  - CORS enabled via `@fastify/cors`.
- **OpenAPI / Swagger Documentation**:
  - Full OpenAPI 3.0.3 specification dynamically generated via `fastify-type-provider-zod` + `@fastify/swagger`.
  - Interactive Swagger UI served at `http://localhost:3001/docs`.
  - Machine-readable specification served at `http://localhost:3001/docs/json`.
- **Tests & Quality**:
  - Added 8 unit/integration tests in `apps/api/src/__tests__/routes.test.ts` covering all endpoints, cache headers, error states, and Swagger spec generation.
  - Test suite now includes **11 test files and 64 passing tests** across the monorepo.
  - `pnpm lint` and `pnpm typecheck` both pass with 0 errors.

### Verification Steps
```bash
# 1. Health check
curl -i http://localhost:3001/health

# 2. Get schemes list (with cache headers and known series)
curl -i http://localhost:3001/v1/schemes

# 3. List published draws
curl -i http://localhost:3001/v1/draws?limit=5

# 4. Get full draw by draw code (immutable cache: max-age=31536000, immutable)
curl -i http://localhost:3001/v1/draws/SM-82

# 5. Check 1st Prize Jackpot winning ticket
curl -i -X POST http://localhost:3001/v1/draws/SM-82/check \
  -H "Content-Type: application/json" \
  -d '{"ticket":"MO 747323"}'
# Expected response: {"kind":"jackpot","tier":"1st Prize","amount":10000000,"formattedAmount":"₹1,00,00,000","matchedIndices":[0,1,2,3,4,5,6,7],"summary":"Bumper 1st prize winner"}

# 6. Check Consolation Prize ticket
curl -i -X POST http://localhost:3001/v1/draws/SM-82/check \
  -H "Content-Type: application/json" \
  -d '{"ticket":"MN 747323"}'
# Expected response: {"kind":"mid","tier":"Consolation Prize","amount":5000,"formattedAmount":"₹5,00,00","matchedIndices":[2,3,4,5,6,7],"closestMatch":"Same number as the 1st prize, different series"}

# 7. Check 4th Prize (Last 4) ticket
curl -i -X POST http://localhost:3001/v1/draws/SM-82/check \
  -H "Content-Type: application/json" \
  -d '{"ticket":"KL 110606"}'
# Expected response: {"kind":"mid","tier":"4th Prize (Last 4)","amount":5000,"formattedAmount":"₹5,000","matchedIndices":[4,5,6,7]}

# 8. Check Losing Ticket (with truthful near-miss calculation)
curl -i -X POST http://localhost:3001/v1/draws/SM-82/check \
  -H "Content-Type: application/json" \
  -d '{"ticket":"MO 747324"}'
# Expected response: {"kind":"none","tier":"No Prize","amount":0,"formattedAmount":"₹0","matchedIndices":[0,1,2,3,4,5,6],"closestMatch":"Matched 5 of the 6 digits of the 1st prize (747323)"}

# 9. Check draw status for today (results not out yet)
curl -i http://localhost:3001/v1/draws/status

# 10. Check draw status for past published draw date
curl -i "http://localhost:3001/v1/draws/status?date=2026-11-22"

# 11. View OpenAPI JSON specification
curl -i http://localhost:3001/docs/json

# 12. View Swagger UI in browser
# http://localhost:3001/docs
```

### Decisions Made & Deviations from Design
1. **Flexible Draw Identifier (`:id`)**:
   `GET /v1/draws/:id` and `POST /v1/draws/:id/check` accept either UUID (`draws.id`) or human-readable draw code (`draws.drawCode` e.g. `SM-82`, `KR-777`, case-insensitive). This makes API usage friendly and matches the frontend URLs.
2. **Date Utility Extraction into `@gacha/shared`**:
   Moved `getTodayIST()` and `getWeekdayFromDate()` into `@gacha/shared/src/date.ts` so date resolution in IST is centralized across source validation, API status queries, and worker scheduling.
3. **Global Swagger Registration**:
   Registered `@fastify/swagger` and `@fastify/swagger-ui` directly on root Fastify instance to ensure child routes (`/v1/*`) are discovered by the OpenAPI generator.

### Known Issues
- None.

### Next Feature
- **F7: Scheduler**: pg-boss jobs, polling windows in IST per the design, single-flight per (source, draw), expected-draw creation from the weekday schedule, "results not out yet" behaviour, a nightly reconcile stub. Include a way to trigger a poll manually and to run on a faked clock for testing.

---

## Feature 7: Scheduler

### What Was Built
- **Clock Abstraction (`packages/shared/src/clock.ts`)**:
  - `Clock` interface with `now(): Date` and `setTimeout` capabilities.
  - `SystemClock`: Default production implementation using real wall clock.
  - `FakeClock`: Test and simulation implementation allowing deterministic setting and advancing of time across IST timezone tests.
- **IST Polling Window Calculator (`apps/worker/src/pollingWindow.ts`)**:
  - Implements the polling schedule defined in Section 6.2 of the design doc:
    - **Before Window** (< 15:00 IST): sleep / idle (or 1-hour heartbeat).
    - **Peak Window** (15:00 – 17:30 IST): 2-minute polling interval.
    - **Evening Window** (17:30 – 21:00 IST): 10-minute polling interval.
    - **Night Window** (21:00 – 06:00 IST): 60-minute interval.
    - **Alert Threshold**: `shouldAlert = true` if draw is not published by 18:30 IST (6:30 PM).
- **Expected Draw Provisioner (`apps/worker/src/expectedDraw.ts`)**:
  - Automatically identifies the scheduled weekly scheme for any target date in IST (`BT`, `SS`, `DL`, `KN`, `SK`, `KR`, `SM`).
  - Computes the next sequential draw number (e.g. `BT-77` -> `BT-78`).
  - Inserts the draw into `draws` with `status: 'expected'` if not already created.
  - Logs `expected_created` in `ingest_events`.
- **Single-Flight Poller & Source Polling Logic (`apps/worker/src/poller.ts`)**:
  - `pollSourceForDraw()` enforces critical termination rules:
    1. If the draw is already `published` in `draws`, polling immediately terminates.
    2. If the draw has already been observed by this source (valid or invalid), polling for this source terminates to prevent redundant scrape traffic.
  - Fetches the listing page polite rate-limited via `PoliteHttpClient` with ETag/304 caching.
  - Locates the live article URL matching the draw date / scheme name, downloads raw payload, archives via `RawStore`, creates `source_observations`, validates, and publishes via atomic `publishObservation()`.
- **Nightly Reconcile Stub (`apps/worker/src/reconcile.ts`)**:
  - Queries draws published or expected across the trailing 7 days.
  - Validates source observation coverage and logs `reconcile_nightly` in `ingest_events`.
- **pg-boss Scheduler (`apps/worker/src/scheduler.ts`)**:
  - Queues created:
    - `daily-expected-draw`: Scheduled at `00:05` IST (`cron: '5 0 * * *'`) with `tz: 'Asia/Kolkata'`.
    - `poll-cycle`: Scheduled at `*/2 15-17 * * *` (peak), `*/10 18-20 * * *` (evening), `0 21-23,0-5 * * *` (night).
    - `poll-source-draw`: Dispatched for active sources using pg-boss `singletonKey: '${source}:${drawCode}'` to ensure strictly one active poll per source/draw.
    - `nudge-poll`: Manual trigger queue for on-demand polling.
    - `nightly-reconcile`: Scheduled at `23:30` IST (`cron: '30 23 * * *'`).
  - Supports `scheduler.triggerPoll()` and manual polling on demand.
- **Worker Integration (`apps/worker/src/index.ts`)**:
  - Boots `Scheduler` instance on worker startup, connects pg-boss to the PostgreSQL database, registers workers, schedules cron jobs, and performs graceful teardown on SIGTERM / SIGINT.
- **Manual Poller CLI (`apps/worker/src/cli/poll.ts` & `pnpm poll:manual`)**:
  - CLI allowing developers or operators to trigger a poll cycle manually, simulate any IST wall-clock time via `--fake-time`, ingest via local fixture via `--fixture`, or `--force` re-poll.
- **Comprehensive Unit Tests (`apps/worker/src/__tests__/scheduler.test.ts`)**:
  - 12 comprehensive tests covering:
    - IST date and window calculation across all periods (before window, peak, evening, night).
    - 6:30 PM alert threshold flag.
    - Deterministic expected draw creation and sequential draw numbering.
    - Single-flight poller skipping already published draws and existing observations.
    - Nightly reconcile audit trail.
    - Fast-forwarding time with `FakeClock`.

### Verification Steps
```bash
# 1. Verify worker logs in Docker (pg-boss starts and registers cron jobs in IST)
docker logs gacha_worker --tail 30
# Expected:
# [info]: Initializing pg-boss scheduler...
# [info]: pg-boss scheduler started and polling jobs active.

# 2. Run manual poll cycle against live Onmanorama adapter
pnpm poll:manual
# Expected output:
# [info]: Current IST time: ... Window phase: ...
# [info]: Expected draw exists or created: BT-77 (or current weekday)
# [info]: Discovered live article URL -> Ingested and published successfully!

# 3. Simulate peak polling window (3:30 PM IST) using FakeClock
pnpm poll:manual --fake-time 2026-11-23T15:30:00+05:30
# Expected output:
# [info]: Simulated FakeClock IST time: 2026-11-23T15:30:00+05:30
# [info]: Window phase: peak, Interval: 2m, Polls active: true

# 4. Trigger poll with a specific fixture and forced execution
pnpm poll:manual --fixture packages/sources/src/onmanorama/fixtures/samrudhi-sm-82.html --force
# Expected output:
# [info]: Forcing ingestion using local fixture...
# [info]: Draw published successfully or observation recorded!

# 5. Run full test suite (76 tests across 12 files)
pnpm test
```

### Decisions Made & Deviations from Design
1. **Queue Initialization in pg-boss v12**:
   In `pg-boss` v12+, workers cannot subscribe to a queue until it has been created. The scheduler explicitly calls `boss.createQueue()` before calling `boss.work()` to ensure smooth bootstrapping.
2. **Native pg-boss Timezone Option**:
   Configured cron jobs using pg-boss's native `{ tz: 'Asia/Kolkata' }` option, guaranteeing that daylight saving or container UTC offsets do not alter IST draw window timings.
3. **Pluggable Clock Interface**:
   Introduced `Clock` interface with `FakeClock` in `@gacha/shared` to allow zero-wait testing of time-based scheduling transitions, alert thresholds, and IST boundary calculations.

### Known Issues
- None.

### Next Feature
- **F8: keralalotteries.net adapter & winner agencies**: Implement adapter for keralalotteries.net (second source), capture agent / seller agency details into `winner_agencies`, add fixtures, assert exact ParsedDraw output in tests, and verify ingest via CLI.

---

## Feature 8: keralalotteries.net Adapter & Winner Agencies

### What Was Built
- **`keralalotteries.net` HTML Fixtures (`packages/sources/src/keralalotteries/fixtures/`)**:
  - Saved real HTML pages:
    - `karunya-kr-762.html`: Real historical Saturday draw (25-07-2026) for Karunya KR-762 requested in the task prompt.
    - `samrudhi-sm-82.html`: Real Sunday draw (22-11-2026) for Samrudhi SM-82, providing a shared two-source cross-check against Onmanorama's SM-82 fixture.
    - `listing.html`: Real homepage / topic listing of recent draws.
    - `broken-invalid-draw.html`: Truncated page lacking draw results to assert `ParseError` throwing.
- **`keralalotteries.net` Parser (`packages/sources/src/keralalotteries/parser.ts`)**:
  - `parseListing(html: string): DrawRef[]`: Extracts and deduplicates draw reference links matching the URL schema `/YYYY/MM/<scheme>-kerala-lottery-result-<code>-<drawNum>-today-DD-MM-YYYY.html`.
  - `parseArticle(html: string, sourceUrl?: string): ParsedDraw`:
    - Robust extraction of scheme code, draw code, and ISO draw date (`YYYY-MM-DD`).
    - Dedicated `parseKeralalotteriesAmount()` to accurately distinguish ordinal tier numbers (e.g. `4th`, `5th`) from prize amounts (`₹5,000/-`, `₹2,000/-`, `₹1,00,00,000/- [1 Crore]`).
    - Parses full prize tiers (`1st`, `Consolation`, `2nd`, `3rd`, `4th`–`9th`/`10th`), matching all 12 series tickets and 4-digit last4 entries.
    - Captures winner agency details (agent name, agency number, district/place) from 1st, 2nd, and 3rd prize blocks into `WinnerAgency[]`.
- **Winner Agencies Database Integration (`packages/sources/src/publish.ts`)**:
  - Ingestion pipeline maps parsed `draw.agents` into the `winner_agencies` table (`draw_id`, `tier`, `ticket`, `agency_name`, `agency_code`, `place`, `source`).
  - Idempotent upsert via `onConflictDoNothing()`.
- **Source Adapter (`packages/sources/src/keralalotteries/adapter.ts`)**:
  - `KeralalotteriesNetAdapter` implementing `SourceAdapter` (`id: "keralalotteries_net"`, `name: "Kerala Lotteries Net"`).
  - Uses `PoliteHttpClient` with custom user-agent, polite rate-limiting, and conditional ETag/304 headers.
- **Worker Poller Integration (`apps/worker/src/poller.ts` & `apps/worker/src/scheduler.ts`)**:
  - Integrated `keralalotteriesAdapter` into the multi-source poller discovery logic.
  - Scheduler dispatches single-flight jobs for both `onmanorama` and `keralalotteries_net` per active window.
- **CLI Commands**:
  - `pnpm ingest:keralalotteries --url <url> | --fixture <path>`: Prints parsed draw JSON without DB mutation.
  - `pnpm ingest --fixture <path> --source keralalotteries_net`: Ingests and stores raw payload, creates observation, validates, and publishes with winner agencies.
- **Unit Tests (`packages/sources/src/__tests__/keralalotteries.test.ts`)**:
  - 10 comprehensive tests covering listing discovery, Karunya KR-762 full prize parsing, winner agency extraction, Samrudhi SM-82 cross-source parsing, and `ParseError` on broken fixtures. 86 tests total passing.

### Verification Steps
```bash
# 1. Run unit test suite (86 tests across 13 files)
pnpm test

# 2. Test CLI parser against local fixture
pnpm ingest:keralalotteries --fixture packages/sources/src/keralalotteries/fixtures/karunya-kr-762.html

# 3. Test CLI parser against live URL
pnpm ingest:keralalotteries --url https://www.keralalotteries.net/2026/07/karunya-kerala-lottery-result-kr-762-today-25-07-2026.html

# 4. Ingest Karunya KR-762 into the database
pnpm ingest --fixture packages/sources/src/keralalotteries/fixtures/karunya-kr-762.html --source keralalotteries_net

# 5. Verify winner agencies in PostgreSQL
docker exec -i gacha_postgres psql -U postgres -d gacha -c "SELECT tier, ticket, agency_name, agency_code, place, source FROM winner_agencies WHERE draw_id IN (SELECT id FROM draws WHERE draw_code = 'KR-762');"

# 6. Verify draw and prize entries via public API
curl -s http://localhost:3001/v1/draws/KR-762

# 7. Check ticket against KR-762 (e.g. 1st prize winner KB 845108)
curl -s -X POST http://localhost:3001/v1/draws/KR-762/check -H "Content-Type: application/json" -d '{"ticket":"KB 845108"}'
```

### Decisions Made & Deviations from Design
1. **Dedicated Amount Parser for keralalotteries.net**:
   `keralalotteries.net` formats prize tiers as inline headings (e.g. `4th Prize: ₹5,000/-`). A standard number regex could confuse the ordinal prefix (`4th`) with the prize amount. Built `parseKeralalotteriesAmount()` to specifically isolate currency symbols (`₹`, `Rs.`), bracketed multipliers (`[1 Crore]`, `[25 Lakhs]`), or amounts preceding `/-`.
2. **Consolation Ticket Whitespace Boundary**:
   In some articles, consolation tickets appear concatenated without intervening spaces (e.g. `MN 747323MP 747323`). Removed word boundary assertions (`\b`) from the ticket series regex to ensure all series tickets are parsed without omission.
3. **Agency Extraction Pattern**:
   Agent names and agency codes frequently reside on lines without trailing punctuation (e.g. `Agent Name: SHINE D TAgency No.: T 3795---`). Added positive lookaheads in regex extraction to cleanly separate agency names from agency codes and strip decorative trailing dashes.

### Known Issues
- None.

### Next Feature
- **F9: Reconciler**: Two-source agreement rule, canonical fingerprints, `needs_review` state with diff rendering, admin CLI to inspect and force-publish with audit logging, and removal of the single-source publish flag.

---

## Feature 9: Reconciler (Two-Source Agreement & Admin CLI)

### What Was Built
- **Draw Comparison & Diff Engine (`packages/sources/src/diff.ts`)**:
  - `compareDraws(drawA, drawB)`: Computes granular differences between two parsed draw representations:
    - **Metadata differences**: `drawDate`, `schemeCode`, `drawCode`.
    - **Prize tier differences**:
      - `AMOUNT_MISMATCH`: Identifies when sources report different prize values for the same tier.
      - `MATCH_TYPE_MISMATCH`: Detects disagreements in match type (e.g. `full` vs `last4` vs `consolation`).
      - `MISSING_IN_A` / `MISSING_IN_B`: Flags when one source reports a tier not found in the other (e.g., 9th prize).
      - `ENTRIES_MISMATCH`: Pinpoints differences in winning ticket entries and lists sample tickets unique to each source.
    - **Winner agency differences**: Reports discrepancies in reported winner agent counts.
  - `renderDiffText(diff)`: Produces a clean, formatted terminal/console report with ANSI-friendly section headers, side-by-side fingerprint comparisons, and clear discrepancy explanations.
- **Reconciliation Engine (`packages/sources/src/reconciliation.ts`)**:
  - `reconcileDraw(db, drawId)`:
    - Enforces the strict two-source agreement rule from Section 4.2 of the design doc.
    - Gathers all valid `source_observations` for the draw and groups them by canonical fingerprint (`computeDrawFingerprint`).
    - **Consensus (>= 2 matching sources)**: If two or more independent sources share the exact same fingerprint, consensus is achieved. Automatically calls `publishDraw()` with the consensus observation, records `published` with `reconciled: true` in `ingest_events`, and transitions draw to `published`.
    - **Conflict (< 2 matching sources and conflicting fingerprints)**: When sources disagree, the draw is transitioned to `needs_review`. Generates structured diff via `compareDraws()`, saves the diff into `ingest_events` (`kind: 'conflict'`), and updates draw status.
    - **Single Observation**: Transitions draw to `observed` (awaiting second source confirmation).
    - **Late Correction Handling**: If an observation arrives for an already-published draw with a differing fingerprint, the engine safely flags the draw as `needs_review` and creates an audit trail entry.
  - `forcePublishDraw(db, drawIdOrCode, source, reason)`:
    - Admin override mechanism allowing an operator to force-publish results from a chosen source when sources disagree.
    - Validates draw identifier (UUID or draw code e.g. `SM-82`).
    - Overrides status to `published`, records `force_published` in `ingest_events` with admin audit detail (`source`, `reason`, `fingerprint`), and updates prize tiers/entries.
- **Single-Source Publish Default Removal (`packages/sources/src/publish.ts`)**:
  - Updated `isSingleSourcePublishEnabled()` to default to `false`. Single-source auto-publishing is now only enabled if `process.env.SINGLE_SOURCE_PUBLISH === 'true'` is explicitly set. Production and normal runs require two independent sources to reach consensus before publishing.
  - Integrated `reconcileDraw()` into `ingestObservation()` in `packages/sources/src/ingest.ts`.
- **Admin CLI (`packages/sources/src/cli/admin.ts`)**:
  - Registered `"admin": "tsx packages/sources/src/cli/admin.ts"` in `backend/package.json`.
  - Commands:
    - `pnpm admin review`: Lists draws currently in `needs_review` or `observed` awaiting consensus, detailing available observations and source fingerprints.
    - `pnpm admin diff --draw <drawCodeOrId>`: Fetches observations for the draw, compares them using `compareDraws()`, and renders a side-by-side terminal diff.
    - `pnpm admin publish --draw <drawCodeOrId> --source <source> [--reason <reason>]`: Force-publishes the draw using the specified source observation with full audit logging.
- **Comprehensive Unit Tests (`packages/sources/src/__tests__/reconcile.test.ts`)**:
  - 9 thorough tests covering:
    - Identical draws producing 0 diffs.
    - Amount mismatch detection.
    - Entry difference identification.
    - Missing tier detection.
    - Diff between real-world Onmanorama and keralalotteries.net SM-82 fixtures.
    - Single source moving draw to `observed` without premature publishing.
    - Two matching sources achieving consensus and publishing atomically.
    - Conflicting sources transitioning draw to `needs_review` and logging diffs.
    - Admin force-publish path with audit logging.
  - Monorepo test suite now stands at **14 test files, 95 passing tests**.

### Verification Steps
```bash
# 1. Run all unit tests across the monorepo (95 tests passing)
pnpm test

# 2. Check for draws needing review via Admin CLI
pnpm admin review

# 3. View side-by-side reconciliation diff between Onmanorama and keralalotteries.net for SM-82
pnpm admin diff --draw SM-82

# 4. Force-publish a draw via Admin CLI (with audit logging)
pnpm admin publish --draw SM-82 --source keralalotteries_net --reason "keralalotteries.net contains full consolation series tickets"

# 5. Verify PostgreSQL audit trail for reconciliation events
docker exec -i gacha_postgres psql -U postgres -d gacha -c "SELECT id, draw_id, kind, detail->>'source' as source, detail->>'action' as action, at FROM ingest_events ORDER BY id DESC LIMIT 5;"

# 6. Verify public read API displays the published draw
curl -s http://localhost:3001/v1/draws/SM-82 | jq .status
```

### Decisions Made & Deviations from Design
1. **Consolation Series Ticket Discrepancies**:
   In breaking news coverage, Onmanorama often publishes the 1st prize without generating all 11 individual series consolation ticket numbers, whereas `keralalotteries.net` explicitly lists all 11 series tickets (`MN747323`..`MZ747323`). This results in differing canonical fingerprints and places draws into `needs_review`. The admin diff CLI clearly surfaces these entry differences for operators to force-publish the more complete source.
2. **UUID vs Draw Code Parameter Flexibility**:
   `reconcileDraw` and `forcePublishDraw` automatically detect whether the input string is a UUID or a lottery draw code (e.g. `SM-82`), avoiding PostgreSQL invalid UUID syntax errors when CLI users specify draw codes.
3. **Safe Transaction Reuse**:
   `publishDraw()` adapts dynamically to whether it is called standalone (`db.transaction()`) or within an existing transaction context (`tx`), preventing nested transaction exceptions.

### Known Issues
- None.

### Next Feature
- **F10: Official source: PDF parser & manual upload route**: Parse official Kerala state lottery PDF results (text layout, tables, ticket numbers, prizes), and implement `POST /admin/ingest/pdf` on the API (protected by `ADMIN_API_KEY`) for manual official result uploads.

---

## Feature 10: Official Source (PDF Parser & Manual Upload Admin Route)

### What Was Built
- **Positioned PDF Text Extractor (`packages/sources/src/official/extractor.ts`)**:
  - `extractTextLinesFromPdf(buffer)`: Uses `pdfjs-dist` to extract positioned text elements with exact coordinates `(x, y)`.
  - Implements y-coordinate clustering (tolerance +/- 3.5 points) to group items into visual lines.
  - Sorts lines from top to bottom (y descending) and sorts items within lines from left to right (x ascending), maintaining column and table layout integrity.
  - `computeBufferHash(buffer)`: Calculates SHA-256 content hash of the raw binary PDF.
- **Official PDF Result Parser (`packages/sources/src/official/parser.ts`)**:
  - `parseOfficialAmount(raw)`: Accurately parses Kerala lottery prize amounts formatted in official currency expressions (e.g. `Rs :1,00,00,000/- [1 Crore]`, `Rs. 5,000/-`, `Rs :25,00,000/- [25 Lakhs]`).
  - `parseOfficialPdf(buffer, sourceUrl)`:
    - Verifies official departmental header markers (`KERALA STATE LOTTERIES`, `DIRECTORATE OF STATE LOTTERIES`, `GORKY BHAVAN`).
    - Extracts scheme name, scheme code, draw code, and ISO draw date (`DD/MM/YYYY` -> `YYYY-MM-DD`).
    - Extracts 1st prize winning ticket, district/location, and winner agency details (`Agent Name`, `Agency No.`).
    - Extracts all 11 consolation prize series tickets.
    - Extracts 2nd and 3rd prize series tickets and agent details.
    - Extracts 4th through 9th/10th prize 4-digit numbers.
    - Validates strictly against `ParsedDrawSchema`.
    - Throws typed `OfficialParseError` on non-lottery or corrupt PDFs.
- **Official Source Adapter (`packages/sources/src/official/adapter.ts`)**:
  - Implements `SourceAdapter` contract (`id: "official"`, `name: "Official Kerala State Lotteries"`).
  - Primary path: manual upload (`fetchAndParse` accepts local paths, URLs, or Buffers). Auto-discovery returns empty by design to respect the departmental maths challenge.
- **Authoritative Reconciliation Rule (`packages/sources/src/reconciliation.ts`)**:
  - Implements Section 4.2 of the design doc: If an official source observation passes validation and no other source contradicts it, the draw is published immediately without requiring a second source.
  - If a third party contradicts official, flags `needs_review` and prioritizes official in the rendered diff.
- **Admin API Routes (`apps/api/src/routes/admin/index.ts`)**:
  - Token-based authentication hook enforcing `ADMIN_API_KEY` (via `X-Admin-Key` header or `Authorization: Bearer <key>`).
  - `POST /admin/ingest/pdf`: Accepts official PDF result files via `multipart/form-data` or raw binary `application/pdf`. Archives raw payload into `RawStore` under `sources/official/<scheme>/<draw>/<hash>.pdf`, parses, validates, and reconciles draw.
  - `GET /admin/review`: Lists pending review draws with side-by-side diff summaries.
  - `POST /admin/draws/:id/publish`: Force-publishes a specific source observation with audit trail.
- **Admin CLI (`packages/sources/src/official/cli.ts`)**:
  - Added script to root `package.json`: `"ingest:official": "tsx packages/sources/src/official/cli.ts"`.
  - Supports `--pdf <path>`, `--no-publish`, `--print-only`.
- **Fixtures & Tests**:
  - Fixtures generated with `pdf-lib` using real historical draw data:
    - `packages/sources/src/official/fixtures/samrudhi-sm-82.pdf` (Real Sunday draw 22-11-2026)
    - `packages/sources/src/official/fixtures/karunya-kr-762.pdf` (Real Saturday draw 25-07-2026)
    - `packages/sources/src/official/fixtures/broken-invalid.pdf` (Negative control)
  - Unit tests:
    - `packages/sources/src/__tests__/official.test.ts` (11 tests)
    - `apps/api/src/__tests__/admin.test.ts` (8 tests)
  - Total test suite: **16 test files, 114 tests passing**, 0 lint/typecheck errors.

### Verification Steps
```bash
# 1. Run all unit tests, typecheck, and lint (114 passing)
pnpm test
pnpm typecheck
pnpm lint

# 2. Test unauthorized access to admin endpoint (401 Unauthorized)
curl -i http://localhost:3001/admin/review

# 3. Test authorized access to review endpoint
curl -i -H "X-Admin-Key: gacha-admin-secret-key" http://localhost:3001/admin/review

# 4. Ingest official PDF via HTTP POST /admin/ingest/pdf (multipart upload)
curl -i -X POST http://localhost:3001/admin/ingest/pdf \
  -H "X-Admin-Key: gacha-admin-secret-key" \
  -F "file=@packages/sources/src/official/fixtures/karunya-kr-762.pdf"

# 5. Ingest official PDF via CLI
pnpm ingest:official --pdf packages/sources/src/official/fixtures/samrudhi-sm-82.pdf

# 6. Force-publish official source via admin API
curl -i -X POST http://localhost:3001/admin/draws/KR-762/publish \
  -H "X-Admin-Key: gacha-admin-secret-key" \
  -H "Content-Type: application/json" \
  --data '{"source":"official","reason":"Authoritative Kerala Government Gazette PDF"}'

# 7. Verify official source observations in PostgreSQL
docker exec -i gacha_postgres psql -U postgres -d gacha -c "SELECT source, raw_object_key, validation->>'ok' as ok, fingerprint FROM source_observations WHERE source = 'official';"

# 8. Verify audit events in PostgreSQL
docker exec -i gacha_postgres psql -U postgres -d gacha -c "SELECT id, draw_id, kind, detail->>'source' as source, detail->>'reason' as reason, at FROM ingest_events ORDER BY id DESC LIMIT 5;"
```

### Decisions Made & Deviations from Design
1. **pdfjs-dist in Node.js Pure Uint8Array**:
   `pdfjs-dist` strictly requires a pure `Uint8Array` rather than a Node.js `Buffer`. In `extractor.ts`, buffers are converted via `new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)` to avoid binary decoding exceptions.
2. **Dual-Format Upload Support**:
   `POST /admin/ingest/pdf` supports both `multipart/form-data` (standard browser / curl file upload via `-F "file=@path.pdf"`) and raw binary stream `application/pdf` (via `--data-binary "@path.pdf"`), allowing flexible scripting and web UI file drop support.
3. **Departmental Maths Challenge Integrity**:
   In strict compliance with user instructions and Section 3.3 of the design doc, no solver was built for the official website's challenge. The official adapter's auto-discovery intentionally returns empty, while the manual upload route and CLI provide a 30-second workflow for admins to feed authoritative PDFs into the pipeline.

### Known Issues
- None.

### Next Feature
- **F11: Backfill, alert checks, metrics, deployment hardening**: History backfill command, draw window alert thresholds (6:30 PM un-published notification), Prometheus metrics, health checks, and production compose verification.

---

## Feature 11: Backfill, Alert Checks, Metrics, Deployment Hardening

### What Was Built
- **Historical Draw Backfill Engine & CLI** (`backend/packages/sources/src/backfill.ts` & `backend/packages/sources/src/cli/backfill.ts`):
  - `runBackfill(options)`: Implements historical draw backfill for `onmanorama`, `keralalotteries_net`, or both (`all`).
  - Idempotent: checks for existing observations per source and skips them by default unless `--force` is specified.
  - Polite rate-limiting: default 2000ms delay between network requests (configurable via `--delay <ms>`).
  - Supports `--limit <n>`, `--dry-run`, and `--source <name>`.
  - CLI script `"backfill": "tsx packages/sources/src/cli/backfill.ts"` with formatted terminal output and summary tables.
- **Source Canary Drift Detection & CLI** (`backend/packages/sources/src/canary.ts` & `backend/packages/sources/src/cli/canary.ts`):
  - `runCanaryCheck()`: Evaluates discovery and latest draw parsing against active sources (`onmanorama`, `keralalotteries_net`) to catch HTML structural drift before draw day.
  - Intelligent fallback: inspects up to the first 3 links to handle pre-draw live blog / announcement placeholders on draw days before results are announced.
  - Reports ok/failure status, discovered counts, latest draw code/date, tier count, entry count, and roundtrip network latency.
  - CLI script `"canary": "tsx packages/sources/src/cli/canary.ts"` exiting with 0 on healthy parsers and 1 on drift.
- **System Alert Engine & Admin Alert Endpoint** (`backend/packages/sources/src/alerts.ts`, `backend/apps/api/src/routes/admin/index.ts`, `backend/apps/worker/src/alerts.ts`):
  - `checkSystemAlerts(options)`: Evaluates critical conditions defined in Design Doc Sections 9 & 11:
    1. `UNPUBLISHED_PAST_630PM` (Critical): Today's scheduled draw remains unpublished past the 18:30 IST alert threshold.
    2. `DRAWS_NEEDING_REVIEW` (Warning): Draws held in `needs_review` state awaiting manual admin intervention.
    3. `DEGRADED_SOURCES` (Warning): Active sources whose most recent observation failed validation or encountered repeated errors.
  - Automatic event logging: records `alert_triggered` in `ingest_events` with 15-minute deduplication to prevent event spam.
  - `GET /admin/alerts`: Token-authenticated admin endpoint returning `{ ok, alertCount, activeAlerts, evaluatedAt }`.
  - Worker integration: `Scheduler` registers a `SYSTEM_ALERTS` queue and a recurring 15-minute IST schedule (`*/15 * * * *`).
- **Prometheus Metrics Endpoint** (`backend/apps/api/src/routes/metrics.ts`):
  - `GET /metrics`: Standard Prometheus text exposition format (`version=0.0.4`):
    - `gacha_up` (gauge: 1)
    - `gacha_database_up` (gauge: 1 if DB ping succeeds, 0 otherwise)
    - `gacha_uptime_seconds` (process uptime)
    - `gacha_db_latency_ms` (live database query roundtrip latency)
    - `gacha_process_heap_bytes` (process heap memory usage)
    - `gacha_draws_total{status="..."}` (counts grouped by `published`, `expected`, `observed`, `needs_review`)
    - `gacha_unresolved_reviews_count` (draws needing review)
    - `gacha_source_observations_total{source="...",valid="..."}` (observation counts per source and validation state)
    - `gacha_active_alerts_count{severity="..."}` (active critical and warning alerts count)
- **Production Compose Verification** (`backend/compose.prod.yml`):
  - Verified syntax, service topologies, memory resource limits (384M-512M), health checks, network isolation, and volume mappings via `docker compose -f compose.prod.yml config`.
- **Test Suite**:
  - `packages/sources/src/__tests__/backfill.test.ts` (4 tests)
  - `packages/sources/src/__tests__/canary.test.ts` (2 tests)
  - `packages/sources/src/__tests__/alerts.test.ts` (5 tests)
  - `apps/api/src/__tests__/metrics.test.ts` (3 tests)
  - Overall test suite expanded to **20 test files, 128 tests passing (100% pass rate)**.

### Verification Performed
1. **Unit and Integration Tests**:
   - `pnpm test` -> 20 test files, 128 tests passed.
   - `pnpm typecheck` -> Clean pass (0 errors).
   - `pnpm lint` -> Clean pass (0 errors).
2. **Production Compose Config Validation**:
   - `docker compose -f backend/compose.prod.yml config` -> Validated complete compose file structure.
3. **Canary CLI Live Execution**:
   - `pnpm canary` -> Discovered 10 Onmanorama links and 91 Keralalotteries links; parsed latest draws BT-77 and BT-81 with 10 tiers each; all checks passed.
4. **Historical Backfill Live Execution**:
   - `pnpm backfill --dry-run -n 3` -> Verified discovery and skip logic.
   - `pnpm backfill -s onmanorama -n 3 --delay 1000` -> Ingested historical draw `KR-777` with rate limiting.
5. **Live API Endpoints**:
   - `curl http://localhost:3001/metrics` -> Verified Prometheus exposition format with DB latency and draw status gauges.
   - `curl -H "x-admin-key: gacha-admin-secret-key" http://localhost:3001/admin/alerts` -> Verified detection of `DRAWS_NEEDING_REVIEW` alert for `SM-82`.

### Decisions Made & Deviations from Design
1. **Canary Pre-Draw Placeholder Tolerance**:
   On draw days before 3:00 PM IST, websites publish placeholder articles ("Kerala lottery results today live"). To prevent false positive canary failures, `runCanaryCheck` evaluates up to the first 3 links until a completed draw is parsed.
2. **Prometheus Text Generation**:
   Rather than introducing large external Prometheus client dependencies, the Prometheus exposition format is generated directly via standard text templating, ensuring zero overhead and instant response times.
3. **Alert Deduplication**:
   When `checkSystemAlerts` detects active conditions, it checks `ingest_events` for a recent `alert_triggered` event for the same condition within the last 15 minutes before inserting, avoiding database event pollution on high-frequency polling.

### Known Issues
- None.

---

## Roadmap Completion Summary (F0 — F11)

All 12 features outlined in `doc/gacha Backend — Design Doc.md` have been fully implemented, rigorously tested, docker-verified, and documented:
- **F0**: Scaffold + Docker
- **F1**: Database Schema, Migrations, Seeds
- **F2**: Shared Package (`@gacha/shared`)
- **F3**: Onmanorama Adapter
- **F4**: Observations + Validation Engine
- **F5**: Draws + Publishing
- **F6**: Public Read API (`/v1`)
- **F7**: Scheduler (pg-boss, IST polling windows)
- **F8**: keralalotteries.net Adapter & Winner Agencies
- **F9**: Reconciler (two-source consensus)
- **F10**: Official Source: PDF Parser & Manual Upload Admin Route
- **F11**: Backfill, Alert Checks, Metrics, Deployment Hardening









