import { getDb, DbClient, draws, sourceObservations, eq, and } from "@gacha/db";
import { onmanoramaAdapter } from "./onmanorama/adapter.js";
import { keralalotteriesAdapter } from "./keralalotteries/adapter.js";
import { ingestObservation, IngestObservationResult } from "./ingest.js";
import { SourceAdapter } from "./types.js";

export interface BackfillOptions {
  source?: "onmanorama" | "keralalotteries_net" | "all";
  limit?: number;
  delayMs?: number;
  force?: boolean;
  dryRun?: boolean;
  db?: DbClient;
}

export interface BackfillResultItem {
  source: string;
  drawCode: string;
  drawDate: string;
  url: string;
  status: "ingested" | "skipped_existing" | "failed" | "dry_run";
  error?: string;
  observation?: IngestObservationResult;
}

export interface BackfillSummary {
  source: string;
  discovered: number;
  processed: number;
  ingested: number;
  skipped: number;
  failed: number;
  items: BackfillResultItem[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runBackfill(options: BackfillOptions = {}): Promise<BackfillSummary[]> {
  const db = options.db || getDb();
  const targetSource = options.source || "all";
  const limit = options.limit || 50;
  const delayMs = options.delayMs !== undefined ? options.delayMs : 2000;
  const force = options.force || false;
  const dryRun = options.dryRun || false;

  const sourcesToRun: SourceAdapter[] = [];
  if (targetSource === "all" || targetSource === "onmanorama") {
    sourcesToRun.push(onmanoramaAdapter);
  }
  if (targetSource === "all" || targetSource === "keralalotteries_net") {
    sourcesToRun.push(keralalotteriesAdapter);
  }

  const summaries: BackfillSummary[] = [];

  for (const adapter of sourcesToRun) {
    const summary: BackfillSummary = {
      source: adapter.id,
      discovered: 0,
      processed: 0,
      ingested: 0,
      skipped: 0,
      failed: 0,
      items: [],
    };

    try {
      // 1. Discover draw links from listing page
      const discoveredRefs = await adapter.discover();
      summary.discovered = discoveredRefs.length;

      // Slice up to limit
      const targetRefs = discoveredRefs.slice(0, limit);

      for (const ref of targetRefs) {
        summary.processed++;

        // 2. Check if already observed for this source
        if (!force) {
          const existingDraw = await db.query.draws.findFirst({
            where: eq(draws.drawCode, ref.drawCode),
          });

          if (existingDraw) {
            const existingObs = await db.query.sourceObservations.findFirst({
              where: and(
                eq(sourceObservations.drawId, existingDraw.id),
                eq(sourceObservations.source, adapter.id)
              ),
            });

            if (existingObs) {
              summary.skipped++;
              summary.items.push({
                source: adapter.id,
                drawCode: ref.drawCode,
                drawDate: ref.drawDate,
                url: ref.url,
                status: "skipped_existing",
              });
              continue;
            }
          }
        }

        if (dryRun) {
          summary.ingested++;
          summary.items.push({
            source: adapter.id,
            drawCode: ref.drawCode,
            drawDate: ref.drawDate,
            url: ref.url,
            status: "dry_run",
          });
          continue;
        }

        // 3. Ingest observation
        try {
          const obsResult = await ingestObservation({
            source: adapter.id as "onmanorama" | "keralalotteries_net",
            url: ref.url,
            db,
            autoPublish: true,
          });

          summary.ingested++;
          summary.items.push({
            source: adapter.id,
            drawCode: ref.drawCode,
            drawDate: ref.drawDate,
            url: ref.url,
            status: "ingested",
            observation: obsResult,
          });
        } catch (err: unknown) {
          summary.failed++;
          const msg = err instanceof Error ? err.message : String(err);
          summary.items.push({
            source: adapter.id,
            drawCode: ref.drawCode,
            drawDate: ref.drawDate,
            url: ref.url,
            status: "failed",
            error: msg,
          });
        }

        // 4. Polite rate limiting between consecutive fetches
        if (delayMs > 0) {
          await sleep(delayMs);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.failed++;
      summary.items.push({
        source: adapter.id,
        drawCode: "DISCOVERY_ERROR",
        drawDate: "",
        url: "",
        status: "failed",
        error: `Discovery failed: ${msg}`,
      });
    }

    summaries.push(summary);
  }

  return summaries;
}
