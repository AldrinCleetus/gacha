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
  ingestEvents,
  DrawStatus,
  sql,
  eq,
  and,
} from "@gacha/db";
import { ParsedDraw, LocalRawStore, RawStore } from "@gacha/shared";
import { parseArticle as parseOnmanoramaArticle } from "./onmanorama/parser.js";
import { parseArticle as parseKeralalotteriesArticle } from "./keralalotteries/parser.js";
import { defaultHttpClient } from "./http.js";
import { validateParsedDraw, ValidationResult } from "./validation.js";
import { computeDrawFingerprint } from "./fingerprint.js";
import { publishDraw, isSingleSourcePublishEnabled } from "./publish.js";
import { reconcileDraw } from "./reconciliation.js";
import { DrawDiff } from "./diff.js";

export interface IngestObservationOptions {
  source?: "onmanorama" | "keralalotteries_net" | "official";
  url?: string;
  fixturePath?: string;
  html?: string;
  rawStore?: RawStore;
  db?: DbClient;
  autoPublish?: boolean; // Defaults to isSingleSourcePublishEnabled()
}

export interface IngestObservationResult {
  observationId: string;
  drawId?: string;
  drawStatus?: DrawStatus;
  published?: boolean;
  alreadyPublished?: boolean;
  conflict?: boolean;
  consensus?: boolean;
  diff?: DrawDiff;
  source: string;
  sourceUrl?: string;
  rawObjectKey: string;
  contentHash: string;
  validation: ValidationResult;
  fingerprint?: string;
  tierCount?: number;
  entryCount?: number;
  parsed?: ParsedDraw;
}

/**
 * Ingests an observation from a URL or fixture into RawStore and PostgreSQL.
 * Validates the draw, records errors if validation fails, links/creates the draw,
 * and if valid and single-source publishing is enabled, publishes the draw
 * with tiers, entries, and an audit log in one atomic transaction.
 */
export async function ingestObservation(
  options: IngestObservationOptions
): Promise<IngestObservationResult> {
  const source =
    options.source ||
    (options.url?.includes("keralalotteries.net") || options.fixturePath?.includes("keralalotteries")
      ? "keralalotteries_net"
      : "onmanorama");
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
    if (source === "keralalotteries_net") {
      parsed = parseKeralalotteriesArticle(html, resolvedUrl);
    } else {
      parsed = parseOnmanoramaArticle(html, resolvedUrl);
    }
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
  let drawStatus: DrawStatus | undefined;
  let isPublished = false;
  let isAlreadyPublished = false;
  let isConflict = false;
  let isConsensus = false;
  let diffResult: DrawDiff | undefined;
  let tierCount = 0;
  let entryCount = 0;

  if (parsed) {
    tierCount = parsed.tiers.length;
    entryCount = parsed.tiers.reduce((acc, t) => acc + t.entries.length, 0);

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

    // Initial status for draw creation if not existing
    const initialStatus: DrawStatus = validation.ok ? "observed" : "needs_review";

    const [drawRecord] = await db
      .insert(draws)
      .values({
        schemeCode: parsed.schemeCode,
        drawCode: parsed.drawCode,
        drawDate: parsed.drawDate,
        status: initialStatus,
        fingerprint: validation.ok ? fingerprint : null,
      })
      .onConflictDoUpdate({
        target: [draws.schemeCode, draws.drawCode],
        set: {
          // If already published, retain status; otherwise update
          status: sql`CASE WHEN ${draws.status} = 'published' THEN ${draws.status} ELSE ${initialStatus} END`,
        },
      })
      .returning({ id: draws.id, status: draws.status });

    drawId = drawRecord.id;
    drawStatus = drawRecord.status;

    // Register 1st prize series if valid
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

  // 8. Publishing & Status Lifecycle
  if (drawId && parsed) {
    if (!validation.ok) {
      // If validation failed, flag draw as needs_review (unless already published)
      await db
        .update(draws)
        .set({ status: "needs_review" })
        .where(and(eq(draws.id, drawId), sql`${draws.status} != 'published'`));

      drawStatus = "needs_review";

      await db.insert(ingestEvents).values({
        drawId,
        kind: "validation_failed",
        detail: {
          source,
          sourceUrl: resolvedUrl,
          errors: validation.errors,
        },
      });
    } else {
      // Observation is valid
      const shouldAutoPublish =
        options.autoPublish !== undefined
          ? options.autoPublish
          : isSingleSourcePublishEnabled();

      if (shouldAutoPublish) {
        // Publish draw in an atomic transaction (legacy single-source or test mode)
        const pubResult = await publishDraw(db, drawId, parsed, {
          source,
          sourceUrl: resolvedUrl,
          singleSource: true,
        });

        drawStatus = pubResult.status;
        isPublished = pubResult.published;
        isAlreadyPublished = pubResult.alreadyPublished ?? false;
        isConflict = pubResult.conflict ?? false;
      } else {
        // Run reconciler to enforce the two-source agreement rule
        const recResult = await reconcileDraw(db, drawId);
        drawStatus = recResult.status;
        isPublished = recResult.published;
        isConsensus = recResult.consensus ?? false;
        isConflict = recResult.conflict ?? false;
        diffResult = recResult.diff;
      }
    }
  }

  return {
    observationId,
    drawId,
    drawStatus,
    published: isPublished,
    alreadyPublished: isAlreadyPublished,
    conflict: isConflict,
    consensus: isConsensus,
    diff: diffResult,
    source: parsed ? parsed.source : source,
    sourceUrl: resolvedUrl,
    rawObjectKey,
    contentHash,
    validation,
    fingerprint,
    tierCount,
    entryCount,
    parsed: parsed || undefined,
  };
}
