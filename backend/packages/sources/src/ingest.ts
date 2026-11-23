import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import {
  getDb,
  DbClient,
  draws,
  sourceObservations,
  schemes,
  schemeSeries,
  sql,
  eq,
} from "@gacha/db";
import { ParsedDraw, LocalRawStore, RawStore } from "@gacha/shared";
import { parseArticle } from "./onmanorama/parser.js";
import { defaultHttpClient } from "./http.js";
import { validateParsedDraw, ValidationResult } from "./validation.js";
import { computeDrawFingerprint } from "./fingerprint.js";

export interface IngestObservationOptions {
  source?: "onmanorama" | "keralalotteries_net" | "official";
  url?: string;
  fixturePath?: string;
  html?: string;
  rawStore?: RawStore;
  db?: DbClient;
}

export interface IngestObservationResult {
  observationId: string;
  drawId?: string;
  source: string;
  sourceUrl?: string;
  rawObjectKey: string;
  contentHash: string;
  validation: ValidationResult;
  fingerprint?: string;
  parsed?: ParsedDraw;
}

/**
 * Ingests an observation from a URL or fixture into RawStore and PostgreSQL.
 * Validates the draw, records errors if validation fails, and creates/links the draw record.
 */
export async function ingestObservation(
  options: IngestObservationOptions
): Promise<IngestObservationResult> {
  const source = options.source || "onmanorama";
  let html = options.html;
  let resolvedUrl = options.url;

  // 1. Fetch or read payload
  if (!html) {
    if (options.fixturePath) {
      const resolved = path.resolve(process.cwd(), options.fixturePath);
      html = fs.readFileSync(resolved, "utf8");
    } else if (options.url) {
      const response = await defaultHttpClient.get(options.url);
      html = response.body;
      resolvedUrl = response.url;
    } else {
      throw new Error("Either 'url', 'fixturePath', or 'html' must be provided to ingestObservation");
    }
  }

  // 2. Compute raw payload content hash
  const contentHash = crypto.createHash("sha256").update(html).digest("hex");

  // 3. Initialize RawStore
  const rawStoragePath = process.env.RAW_STORAGE_PATH || path.resolve(process.cwd(), "data/raw");
  const rawStore = options.rawStore || new LocalRawStore(rawStoragePath);

  // 4. Parse the payload
  let parsed: ParsedDraw | null = null;
  let parseError: Error | null = null;

  try {
    parsed = parseArticle(html, resolvedUrl);
    if (!resolvedUrl && parsed.sourceUrl) {
      resolvedUrl = parsed.sourceUrl;
    }
  } catch (err: unknown) {
    parseError = err instanceof Error ? err : new Error(String(err));
  }

  // 5. Store raw payload into RawStore
  const rawObjectKey = parsed
    ? `sources/${parsed.source}/${parsed.schemeCode}/${parsed.drawCode}/${contentHash}.html`
    : `sources/${source}/unknown/${contentHash}.html`;

  await rawStore.put(rawObjectKey, html);

  // 6. Database operations & validation
  const db = options.db || getDb();
  let validation: ValidationResult;
  let fingerprint: string | undefined;
  let drawId: string | undefined;

  if (parsed) {
    // Look up scheme config from database
    const schemeRecord = await db.query.schemes.findFirst({
      where: eq(schemes.code, parsed.schemeCode),
    });

    // Look up known series from database
    const seriesRows = await db.query.schemeSeries.findMany({
      where: eq(schemeSeries.schemeCode, parsed.schemeCode),
    });
    const knownSeries = seriesRows.map((r) => r.series);

    // Run validation rules
    validation = validateParsedDraw(
      parsed,
      schemeRecord
        ? {
            code: schemeRecord.code,
            name: schemeRecord.name,
            weekday: schemeRecord.weekday,
            isBumper: schemeRecord.isBumper,
            structure: schemeRecord.structure,
          }
        : null,
      knownSeries
    );

    fingerprint = computeDrawFingerprint(parsed);

    // Upsert draw record in database
    const drawStatus = validation.ok ? "observed" : "needs_review";

    const [drawRecord] = await db
      .insert(draws)
      .values({
        schemeCode: parsed.schemeCode,
        drawCode: parsed.drawCode,
        drawDate: parsed.drawDate,
        status: drawStatus,
        fingerprint: validation.ok ? fingerprint : null,
      })
      .onConflictDoUpdate({
        target: [draws.schemeCode, draws.drawCode],
        set: {
          status: sql`CASE WHEN ${draws.status} = 'published' THEN ${draws.status} ELSE ${drawStatus} END`,
          fingerprint: sql`CASE WHEN ${draws.status} = 'published' THEN ${draws.fingerprint} ELSE ${validation.ok ? fingerprint : null} END`,
        },
      })
      .returning({ id: draws.id });

    drawId = drawRecord.id;

    // If valid, register 1st prize ticket series if not already registered
    if (validation.ok) {
      const firstPrize = parsed.tiers.find((t) => t.tier === "1");
      if (firstPrize && firstPrize.entries.length > 0) {
        const series = firstPrize.entries[0].slice(0, 2);
        if (/^[A-Z]{2}$/.test(series)) {
          await db
            .insert(schemeSeries)
            .values({ schemeCode: parsed.schemeCode, series })
            .onConflictDoNothing();
        }
      }
    }
  } else {
    validation = {
      ok: false,
      errors: [parseError ? parseError.message : "Failed to parse draw payload"],
    };
  }

  // 7. Insert observation into source_observations table
  let observationId: string;

  if (drawId) {
    const [obsRecord] = await db
      .insert(sourceObservations)
      .values({
        drawId,
        source: parsed ? parsed.source : source,
        sourceUrl: resolvedUrl || null,
        fetchedAt: parsed ? new Date(parsed.fetchedAt) : new Date(),
        rawObjectKey,
        contentHash,
        parsed: parsed || null,
        fingerprint: fingerprint || null,
        validation,
      })
      .onConflictDoUpdate({
        target: [
          sourceObservations.drawId,
          sourceObservations.source,
          sourceObservations.contentHash,
        ],
        set: {
          validation,
          parsed: parsed || null,
          fingerprint: fingerprint || null,
          sourceUrl: resolvedUrl || null,
        },
      })
      .returning({ id: sourceObservations.id });

    observationId = obsRecord.id;
  } else {
    // Unparsed observation without draw linkage
    const [obsRecord] = await db
      .insert(sourceObservations)
      .values({
        drawId: null,
        source,
        sourceUrl: resolvedUrl || null,
        fetchedAt: new Date(),
        rawObjectKey,
        contentHash,
        parsed: null,
        fingerprint: null,
        validation,
      })
      .returning({ id: sourceObservations.id });

    observationId = obsRecord.id;
  }

  return {
    observationId,
    drawId,
    source: parsed ? parsed.source : source,
    sourceUrl: resolvedUrl,
    rawObjectKey,
    contentHash,
    validation,
    fingerprint,
    parsed: parsed || undefined,
  };
}
