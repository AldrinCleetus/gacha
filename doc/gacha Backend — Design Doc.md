# gacha Backend — Design Doc

Phase 2: result ingestion, storage and a fast read API. The React frontend (Phase 1) already expects most of these endpoints through its `LotteryApi` interface.

## 1. Goals

- Always have every published Kerala draw stored in Postgres within minutes of the results going out.
- Ticket checks and result lists answer in a few milliseconds, because they are plain database reads.
- Several independent sources, each with its own scraper and parser, cross-checked against each other before anything is shown to users. Prize data is money-adjacent, so a wrong parse must never reach a user.
- Easy to add, swap or disable a source without touching the rest.

**Non-goals for this phase:** user accounts and saved tickets (small follow-up, see section 12), payments, notifications.

## 2. What the screenshots tell us

The official results list shows seven weekly schemes and their latest draws:

| Draw date | Scheme | Draw code |
| --- | --- | --- |
| Mon 16 Nov 2026 | Bhagyathara | BT-80 |
| Tue 17 Nov | Sthree Sakthi | SS-546 |
| Wed 18 Nov | Dhanalekshmi | DL-78 |
| Thu 19 Nov | Karunya Plus | KN-650 |
| Fri 20 Nov | Suvarna Keralam | (code to confirm) |
| Sat 21 Nov | Karunya | KR-777 |
| Sun 22 Nov | Samrudhi | SM-82 |

Three consequences:

1. **The scheme list in the Phase 1 mock is out of date.** It used Win-Win on Mondays. The scheme table must be replaced with the real seven above, and it should be filled from parsed data, not typed by hand (see 4.2).
2. **Use the Draw Date column, not the date inside the name.** Names like `KARUNYA-10/11/2025 (KR-777)` carry a different date (it looks like a scheme reference date), which is not the draw date.
3. **Bumper lotteries** (Onam, Christmas and so on) exist on top of the weekly seven. The model must allow schemes that are added mid-year.

## 3. Sources

Three adapters, each fully independent.

| Source | Format | Strengths | Risks |
| --- | --- | --- | --- |
| **Onmanorama** (topic page plus per-draw live articles) | HTML | Consistent article pattern, posts live during the draw, easy to parse | Third-party site; layout can change without notice |
| **keralalotteries.net** (per-draw posts) | HTML | Has winning-ticket agent information not on the official site | Blog-style site; layout can vary between posts; agent data is secondary |
| **Official site** (results list, PDF per draw) | PDF | Ground truth | Download is behind a maths challenge (see 3.3) |

### 3.1 Adapter contract

Every source implements the same interface, so the rest of the system never knows which source it is talking to.

```ts
interface SourceAdapter {
  id: 'onmanorama' | 'keralalotteries_net' | 'official'
  // find draws this source currently lists (cheap: one listing page)
  discover(): Promise<DrawRef[]>        // { schemeCode, drawCode, drawDate, url }
  // fetch one draw and parse it into the shared shape
  fetchAndParse(ref: DrawRef): Promise<ParsedDraw>
}
```

`ParsedDraw` is a Zod schema shared by all adapters:

```ts
ParsedDraw {
  source, sourceUrl, fetchedAt,
  schemeName, schemeCode, drawCode, drawDate,   // drawDate is a calendar date in IST
  tiers: [{ tier, amount, matchType, entries: string[] }],
  agents?: [{ tier, ticket, agencyName?, agencyCode?, place? }],
  raw: { contentHash }
}
```

Rules every adapter follows:

- Parse **only facts**: numbers, amounts, dates, agency details. Never copy article text, images or layout.
- Keep the raw payload (HTML or PDF) in object storage and a hash in Postgres, so any parse can be replayed later when a parser is fixed.
- Fail loudly: unexpected structure throws a typed `ParseError`, which raises an alert. Never guess.

### 3.2 Per-source approach

**Onmanorama**

- Discovery: the topic listing page plus the date-based article URL pattern for the expected draw.
- Fetch: plain HTTP GET, parse with Cheerio. No headless browser unless a page turns out to be client-rendered.
- Parse: locate prize blocks by headings (1st, 2nd, 3rd, consolation, 4th to 9th) and read the ticket numbers beneath each.
- Live articles update during the draw. Only accept a snapshot as complete when every expected tier is present.

**keralalotteries.net**

- Discovery: monthly archive or the per-draw URL pattern (the date and draw code are in the slug).
- Parse: same facts, plus the agent line next to winning tickets where present.
- Agent data goes into its own table, shown only as "per source". We do not treat it as authoritative.

**Official**

- Discovery: the results list gives scheme, draw code and draw date.
- Fetch: the result PDF.
- Parse: extract positioned text from the PDF (see 5.2) and map it to tiers. Highest-fidelity source, so it wins in any dispute.

### 3.3 The official site's maths challenge

The challenge is an explicit signal that the department does not want automated access. I have deliberately **not** designed a solver for it. It also tends to get an IP blocked, and it is the one part with real legal and reputational risk.

Using the official source without bypassing it:

1. **Manual ingest (recommended starting point).** An admin downloads the PDF in a browser and uploads it to an admin endpoint (`POST /admin/ingest/pdf`). The same parser runs. This takes about 30 seconds per draw and gives you an authoritative cross-check.
2. **Kerala Gazette.** Results are also published in the Government Gazette. This is a slower, secondary route for backfill.
3. **Ask the department.** An email requesting a feed or permission to fetch automatically costs nothing. If they agree, add a fetch step to the official adapter later; nothing else changes.

The official adapter therefore has two entry points (manual upload now, fetch later) feeding the same parser.

### 3.4 Good-citizen rules for third-party sites

- Check robots.txt and each site's terms before enabling an adapter.
- Identify the bot with a clear user agent and contact address.
- Poll rarely and conditionally (ETag and If-Modified-Since), with a per-host limit of about one request per few seconds.
- Winning numbers are facts, but each site's own writing and design are not ours. Link to sources as provenance. Do not republish their text.
- If a site objects or blocks us, disable that adapter. The system is designed to keep working with two sources.

I am not a lawyer; read the terms yourself before launch.

## 4. Reconciliation: one trusted draw from many sources

### 4.1 Draw lifecycle

```
expected  ->  observed  ->  published
                 \
                  ->  needs_review  (sources disagree, or validation failed)
```

- `expected`: created from the weekday schedule (e.g. Monday 3 pm Bhagyathara) so the system knows what to look for.
- `observed`: at least one source has produced a parse that passed validation.
- `published`: visible to users. This is the only state the public API serves.
- `needs_review`: held for an admin; triggers an alert.

### 4.2 Publish rule

Compute a **normalised fingerprint** of each source's prize data (sorted tiers, amounts and entries). A draw is published when either:

- **two independent sources produce the same fingerprint**, or
- **the official parse (manual or fetched) passes validation** and no other source contradicts it.

If sources differ, the draw goes to `needs_review` with a diff for the admin to resolve. An admin can force-publish a specific source's version, and that action is logged.

Fast first-prize preview is optional later (show "1st prize announced, full list loading" from a single source), clearly labelled and never used for ticket checking.

### 4.3 Validation per source parse

- Draw date is a past or current date, and its weekday matches the scheme's weekday.
- Every expected tier is present, and entry counts match the scheme's prize structure (counts differ by scheme, so they live in config and are tuned from the first few real draws).
- Ticket formats are well formed: two letters plus six digits for full tickets, four digits for last-4 lists.
- Amounts are positive and descending by tier.
- The 1st prize ticket's series letters belong to the scheme's known series set.

### 4.4 Series letters come from data, not from a typed table

The frontend infers the scheme from a ticket's letters. Do not hard-code that mapping. Each parsed draw lists the series letters it covers. Store them per scheme and derive the lookup from stored draws. Be ready for two schemes sharing a first letter (Karunya and Karunya Plus both start with K), so the lookup is on the full series pair and the UI falls back to asking the user which draw they mean when it is ambiguous.

## 5. Stack

### 5.1 Decision: TypeScript on Node.js

The API is almost entirely indexed database reads. At that workload the language is not the bottleneck: Fastify with a connection pool answers such reads in a few milliseconds. The slow parts are network fetches and PDF parsing, and those are I/O-bound and happen about once per draw per source. A faster language would not change the user's experience.

So choose for productivity and sharing:

- You run Node.js backends already.
- **`checkTicket`, the Zod schemas and the types are shared with the React frontend** as one package. One implementation of the prize-matching logic, used by both sides.
- Cheerio for HTML, a mature PDF text library for PDFs.

(Go would also be fast and good at concurrent fetching, but it would split the prize logic into two languages and has weaker PDF tooling. Python has the best PDF libraries, so keep it as an escape hatch: if the official PDF layout proves too awkward in Node, put just the PDF parser in a small Python sidecar that returns `ParsedDraw` JSON.)

### 5.2 Components

| Concern | Choice | Why |
| --- | --- | --- |
| HTTP API | **Fastify** | Fast, schema-first, small |
| Validation | **Zod** (shared package) | Same types in API, workers, frontend |
| Database | **PostgreSQL** with **Drizzle ORM** or plain SQL via `postgres` | Strong typing, easy migrations |
| Job queue and scheduling | **pg-boss** | Queue and cron inside Postgres, so no Redis to run |
| HTML parsing | **Cheerio** over `undici`/`fetch` | Fast, no browser needed |
| PDF parsing | **pdfjs-dist** (positioned text), Python sidecar only if needed | Table-like layout needs coordinates, not just plain text |
| Raw payload storage | S3-compatible bucket (or local disk in dev) | Replayable parses |
| Cache | In-process LRU plus HTTP caching | Published draws never change |
| Logging and errors | pino plus Sentry | Parse failures must alert |
| Tests | Vitest with saved HTML/PDF fixtures | Parsers are regression-tested offline |

### 5.3 Repo layout

```
gacha/
  frontend/            (React app, exists)
  backend/
    apps/
      api/             Fastify read API + admin routes
      worker/          pollers, parsers, reconciler (pg-boss)
    packages/
      shared/          Zod schemas, types, checkTicket, parseTicket
      sources/         onmanorama/, keralalotteries-net/, official/ (adapters + fixtures)
      db/              schema, migrations, queries
```

The API and worker deploy as two processes from one codebase, so a slow scrape can never slow a user request.

## 6. Scheduling and polling

- Draws happen at 3 pm IST on the scheme's weekday; the full list tends to appear a bit later. Schedule in IST explicitly.
- **Poll window per expected draw:** start at about 3:00 pm, poll every 2 minutes until about 5:30 pm, then every 10 minutes until the draw is published or 9 pm. After that, once an hour until the next morning, then stop and alert.
- Stop polling a source as soon as that source has been observed for that draw. Stop everything once the draw is published.
- **Single-flight:** one job per (source, draw). A user-triggered refresh (section 8.3) re-uses the same job rather than creating another.
- A nightly reconcile job re-checks the last 7 days against all sources and flags changes (late corrections do happen).
- A **backfill** command walks historical draws for each source at a polite rate, for the Results history.

## 7. Data Model (Postgres)

Times are stored in UTC. `draw_date` is a plain `date` (the IST calendar day).

```sql
schemes (
  code text primary key,            -- 'BT', 'SS', 'DL', 'KN', 'KR', 'SM', ...
  name text not null,               -- 'Bhagyathara'
  weekday smallint,                 -- null for bumpers
  ticket_price numeric(8,2),
  is_bumper boolean default false,
  structure jsonb                   -- expected entries per tier, tuned from real draws
);

scheme_series (
  scheme_code text references schemes,
  series text,                      -- 'WA', 'WB' ... derived from parsed draws
  primary key (scheme_code, series)
);

draws (
  id uuid primary key,
  scheme_code text references schemes,
  draw_code text not null,          -- 'BT-80'
  draw_date date not null,
  status text not null,             -- expected | observed | published | needs_review
  published_at timestamptz,
  fingerprint text,                 -- of the published data
  unique (scheme_code, draw_code)
);
create index on draws (draw_date desc);

prize_tiers (
  draw_id uuid references draws,
  tier text,                        -- '1','2','3','consolation','4'..'9'
  amount bigint not null,           -- rupees
  match_type text not null,         -- full | consolation | last4
  primary key (draw_id, tier)
);

prize_entries (
  draw_id uuid references draws,
  tier text,
  entry text not null,              -- 'WA584920' or '4821'
  primary key (draw_id, tier, entry)
);
create index on prize_entries (draw_id, entry);

source_observations (
  id uuid primary key,
  draw_id uuid references draws,
  source text not null,
  source_url text,
  fetched_at timestamptz,
  raw_object_key text,              -- stored HTML/PDF
  content_hash text,
  parsed jsonb,                     -- ParsedDraw
  fingerprint text,
  validation jsonb,                 -- { ok, errors[] }
  unique (draw_id, source, content_hash)
);

winner_agencies (                   -- from sources that provide it
  draw_id uuid references draws,
  tier text,
  ticket text,
  agency_name text,
  agency_code text,
  place text,
  source text,
  primary key (draw_id, tier, ticket, source)
);

ingest_events (                     -- audit log: publishes, overrides, conflicts
  id bigserial primary key,
  draw_id uuid,
  kind text,
  detail jsonb,
  at timestamptz default now()
);
```

`draws` plus its tiers and entries are written in one transaction when a draw is published, and are never edited afterwards. A correction publishes a new version through the admin path and records it in `ingest_events`.

## 8. API

Public, read-only, versioned under `/v1`. Responses for published draws are immutable and cacheable.

### 8.1 Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/v1/schemes` | Schemes with weekday, price, series letters |
| GET | `/v1/draws?limit=&scheme=&before=` | Recent published draws (list view) |
| GET | `/v1/draws/latest?scheme=` | Latest published draw (optionally per scheme) |
| GET | `/v1/draws/:id` | Full draw: tiers and entries |
| POST | `/v1/draws/:id/check` | Body `{ ticket }`. Returns the `MatchResult` |
| GET | `/v1/draws/status?date=` | Expected vs published state, for the "results not out yet" message |

Admin (token-protected): `POST /admin/ingest/pdf`, `GET /admin/review`, `POST /admin/draws/:id/publish`, `POST /admin/sources/:id/disable`.

The check endpoint exists as a convenience and a second implementation path; the frontend can also fetch a draw once and run the shared `checkTicket` locally, which makes repeat checks instant and offline-friendly.

### 8.2 Performance

- A published draw is a few hundred rows. Serve it as one precomputed JSON snapshot per draw (stored in a `jsonb` column or generated once at publish time) and cache it in memory.
- `ETag` plus `Cache-Control: public, max-age=31536000, immutable` on `/v1/draws/:id`, and short max-age on list endpoints so a new draw appears quickly.
- Ticket check = one indexed lookup by (draw, series, number, last 4). Target p95 under 20 ms at the API.
- Put a CDN in front of `/v1` later if traffic warrants it.

### 8.3 Results not out yet

If a user checks a draw that is expected but unpublished, the API returns a clear `pending` state with the draw's scheduled time, and nudges the worker to run that draw's polling job now (debounced; at most one run per few minutes). The user is never blocked on a scrape.

## 9. Failure Handling and Monitoring

- **Parser breaks** (site layout change): `ParseError` raised, source marked `degraded`, alert sent, the other sources continue. Fix the parser, replay it against the stored raw payloads.
- **Sources disagree:** draw goes to `needs_review` with a rendered diff.
- **No draw published by 6:30 pm:** alert (this is the main page-me condition).
- **Late corrections:** the nightly reconcile detects fingerprint changes after publishing and flags them rather than silently overwriting.
- Metrics: parse success rate per source, time from 3 pm to published, API latency, queue depth. Simple dashboard plus Sentry alerts is enough.

## 10. Security and Operations

- The public API is read-only; the admin routes need a token or SSO and are not exposed publicly.
- Rate-limit the public API per IP.
- Secrets in environment variables; the database is reachable only from the API and worker.
- Hosting suggestion for a start: one small VM or container host running the API, the worker and a managed Postgres. Scale the API horizontally later; the worker stays a single instance (pg-boss handles locking).
- Backups: managed Postgres snapshots plus the raw-payload bucket.

## 11. Testing

- **Parser fixtures:** for each source keep several saved HTML/PDF samples (normal, bumper, partial live page, corrected page). Unit tests assert exact `ParsedDraw` output.
- **Reconciler tests:** agree, disagree, partial, late correction.
- **Contract tests** on `ParsedDraw` for every adapter.
- **Weekly canary:** a job that fetches the current listing page for each source and checks the parser still runs, so layout drift is detected before draw day.
- `checkTicket` keeps its existing unit tests, now shared.

## 12. Follow-up: Users and Tickets

Not in this phase, but the schema leaves room: `users` (Google sub, name, email), `saved_tickets` (user, ticket, draw, cost, result, checked\_at, unique on user plus ticket plus draw). That is what powers the Dashboard and My Tickets pages from the real backend instead of local storage.

## 13. Milestones

1. Monorepo scaffold, shared package (move `checkTicket`, `parseTicket`, schemas), database schema and migrations.
2. Source adapter interface and the **Onmanorama** adapter with fixtures.
3. Observation storage, validation and the reconciler (single-source publish behind a feature flag for development).
4. **keralalotteries.net** adapter, then switch to the two-source agreement rule.
5. **Official PDF** parser with the manual upload admin endpoint.
6. Public read API and caching; connect the frontend's `LotteryApi` to it.
7. Scheduler, polling windows, alerts, the nightly reconcile, and backfill.
8. Hardening: canary job, load test, admin review screen.

## 14. Open Questions

- Confirm the full scheme list with series letters and the exact Suvarna Keralam code, from parsed draws.
- Terms of use and robots.txt review for each third-party source.
- Whether to email the Lotteries Department about permitted automated access.
- Hosting provider and budget.
- How far back the backfill should go.
- Whether to expose the API publicly for others, or keep it internal to the app.
