import {
  DbClient,
  getDb,
  draws,
  sourceObservations,
  eq,
  and,
} from "@gacha/db";
import {
  ingestObservation,
  onmanoramaAdapter,
  IngestObservationResult,
} from "@gacha/sources";
import { logger } from "./index.js";

export interface PollDrawOptions {
  source?: "onmanorama" | "keralalotteries_net" | "official";
  drawId?: string;
  drawCode?: string;
  url?: string;
  fixturePath?: string;
  force?: boolean;
}

export interface PollDrawResult {
  drawId?: string;
  drawCode?: string;
  source: string;
  skipped: boolean;
  skipReason?: string;
  published: boolean;
  observed: boolean;
  resultsOut: boolean;
  observation?: IngestObservationResult;
}

/**
 * Polls a specific source for lottery draw results.
 * Follows Section 6 rules:
 * - "Stop everything once the draw is published"
 * - "Stop polling a source as soon as that source has been observed for that draw"
 * - Ingests observation and auto-publishes if single-source publishing is active.
 */
export async function pollSourceForDraw(
  options: PollDrawOptions = {},
  db: DbClient = getDb()
): Promise<PollDrawResult> {
  const source = options.source || "onmanorama";

  // 1. Find target draw record if drawId or drawCode is supplied
  let drawRecord = null;
  if (options.drawId) {
    drawRecord = await db.query.draws.findFirst({
      where: eq(draws.id, options.drawId),
    });
  } else if (options.drawCode) {
    drawRecord = await db.query.draws.findFirst({
      where: eq(draws.drawCode, options.drawCode),
    });
  }

  // 2. Rule: "Stop everything once the draw is published"
  if (drawRecord && drawRecord.status === "published" && !options.force) {
    logger.info({ drawCode: drawRecord.drawCode }, "Draw is already published. Skipping poll.");
    return {
      drawId: drawRecord.id,
      drawCode: drawRecord.drawCode,
      source,
      skipped: true,
      skipReason: "draw_already_published",
      published: true,
      observed: true,
      resultsOut: true,
    };
  }

  // 3. Rule: "Stop polling a source as soon as that source has been observed for that draw"
  if (drawRecord && !options.force) {
    const existingObs = await db.query.sourceObservations.findFirst({
      where: and(
        eq(sourceObservations.drawId, drawRecord.id),
        eq(sourceObservations.source, source)
      ),
    });

    if (existingObs && existingObs.parsed) {
      logger.info(
        { drawCode: drawRecord.drawCode, source },
        "Source already observed for this draw. Skipping poll."
      );
      return {
        drawId: drawRecord.id,
        drawCode: drawRecord.drawCode,
        source,
        skipped: true,
        skipReason: "source_already_observed",
        published: drawRecord.status === "published",
        observed: true,
        resultsOut: true,
      };
    }
  }

  // 4. Resolve URL or fixture to ingest
  let targetUrl = options.url;
  if (!targetUrl && !options.fixturePath) {
    if (source === "onmanorama") {
      try {
        const discovered = await onmanoramaAdapter.discover();
        if (drawRecord) {
          const match = discovered.find(
            (d) =>
              d.schemeCode === drawRecord?.schemeCode &&
              (d.drawCode === drawRecord?.drawCode || d.drawDate === drawRecord?.drawDate)
          );
          if (match) targetUrl = match.url;
        } else if (discovered.length > 0) {
          targetUrl = discovered[0].url;
        }
      } catch (err) {
        logger.warn({ err, source }, "Discovery failed; results may not be out yet");
      }
    }
  }

  if (!targetUrl && !options.fixturePath) {
    logger.info({ source, drawCode: options.drawCode }, "Results not out yet on source");
    return {
      drawId: drawRecord?.id,
      drawCode: drawRecord?.drawCode || options.drawCode,
      source,
      skipped: false,
      published: false,
      observed: false,
      resultsOut: false,
      skipReason: "results_not_out_yet",
    };
  }

  // 5. Ingest observation
  try {
    const result = await ingestObservation({
      source,
      url: targetUrl,
      fixturePath: options.fixturePath,
      db,
    });

    return {
      drawId: result.drawId,
      drawCode: result.parsed?.drawCode || drawRecord?.drawCode,
      source,
      skipped: false,
      published: result.published || result.alreadyPublished || false,
      observed: result.validation.ok,
      resultsOut: true,
      observation: result,
    };
  } catch (err) {
    logger.error({ err, source, targetUrl }, "Ingestion failed during poll cycle");
    return {
      drawId: drawRecord?.id,
      drawCode: drawRecord?.drawCode || options.drawCode,
      source,
      skipped: false,
      published: false,
      observed: false,
      resultsOut: false,
      skipReason: "parse_or_network_error",
    };
  }
}
