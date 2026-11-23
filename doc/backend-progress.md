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



