import { eq } from "drizzle-orm";
import {
  DbClient,
  draws,
  prizeTiers,
  prizeEntries,
  winnerAgencies,
  ingestEvents,
  DrawStatus,
} from "@gacha/db";
import { ParsedDraw } from "@gacha/shared";
import { computeDrawFingerprint } from "./fingerprint.js";

export interface PublishOptions {
  source: string;
  sourceUrl?: string;
  singleSource?: boolean;
  agreement?: boolean;
  force?: boolean;
}

export interface PublishResult {
  drawId: string;
  status: DrawStatus;
  published: boolean;
  alreadyPublished?: boolean;
  conflict?: boolean;
  fingerprint: string;
  tierCount: number;
  entryCount: number;
}

/**
 * In F9+, single-source publishing is disabled by default.
 * Publishing requires two-source agreement or manual admin override,
 * unless explicitly enabled by setting SINGLE_SOURCE_PUBLISH=true.
 */
export function isSingleSourcePublishEnabled(): boolean {
  return process.env.SINGLE_SOURCE_PUBLISH === "true";
}

/**
 * Atomically publishes a draw with its prize tiers, entries, and audit log.
 * Idempotent: If the draw is already published with the identical fingerprint,
 * no changes are made and alreadyPublished=true is returned.
 * If the fingerprint conflicts with an already-published draw, the draw is moved
 * to 'needs_review' and an audit event of kind 'conflict' is recorded.
 */
export async function publishDraw(
  db: DbClient,
  drawId: string,
  parsed: ParsedDraw,
  options: PublishOptions
): Promise<PublishResult> {
  const fingerprint = computeDrawFingerprint(parsed);
  const runTx =
    typeof db.transaction === "function"
      ? (cb: (tx: DbClient) => Promise<PublishResult>) => db.transaction(cb as never) as Promise<PublishResult>
      : (cb: (tx: DbClient) => Promise<PublishResult>) => cb(db);

  return await runTx(async (tx) => {
    // 1. Lock and fetch current draw record
    const [existingDraw] = await tx
      .select()
      .from(draws)
      .where(eq(draws.id, drawId))
      .for("update");

    if (!existingDraw) {
      throw new Error(`Draw with id ${drawId} not found`);
    }

    const tierCount = parsed.tiers.length;
    const entryCount = parsed.tiers.reduce((acc, t) => acc + t.entries.length, 0);

    // 2. Check if already published
    if (existingDraw.status === "published" && !options.force) {
      if (existingDraw.fingerprint === fingerprint) {
        // Idempotent: already published with identical data
        return {
          drawId,
          status: "published",
          published: false,
          alreadyPublished: true,
          fingerprint,
          tierCount,
          entryCount,
        };
      } else {
        // Conflicting fingerprint on an already published draw -> Move to needs_review
        await tx
          .update(draws)
          .set({ status: "needs_review" })
          .where(eq(draws.id, drawId));

        await tx.insert(ingestEvents).values({
          drawId,
          kind: "conflict",
          detail: {
            source: options.source,
            sourceUrl: options.sourceUrl,
            publishedFingerprint: existingDraw.fingerprint,
            conflictingFingerprint: fingerprint,
            message: "Observation fingerprint conflicts with published draw",
          },
        });

        return {
          drawId,
          status: "needs_review",
          published: false,
          conflict: true,
          fingerprint,
          tierCount,
          entryCount,
        };
      }
    }

    // If force publishing, clear existing tiers/entries first
    if (options.force) {
      await tx.delete(prizeEntries).where(eq(prizeEntries.drawId, drawId));
      await tx.delete(prizeTiers).where(eq(prizeTiers.drawId, drawId));
      await tx.delete(winnerAgencies).where(eq(winnerAgencies.drawId, drawId));
    }

    // 3. Prepare prize tiers and prize entries
    const tiersToInsert = parsed.tiers.map((t) => ({
      drawId,
      tier: t.tier,
      amount: t.amount,
      matchType: t.matchType,
    }));

    const entriesToInsert: Array<{ drawId: string; tier: string; entry: string }> = [];
    for (const t of parsed.tiers) {
      for (const entry of t.entries) {
        entriesToInsert.push({
          drawId,
          tier: t.tier,
          entry,
        });
      }
    }

    // 4. Update draw to published
    await tx
      .update(draws)
      .set({
        status: "published",
        publishedAt: new Date(),
        fingerprint,
      })
      .where(eq(draws.id, drawId));

    // 5. Insert prize tiers
    if (tiersToInsert.length > 0) {
      await tx.insert(prizeTiers).values(tiersToInsert).onConflictDoNothing();
    }

    // 6. Insert prize entries in batches
    const BATCH_SIZE = 250;
    for (let i = 0; i < entriesToInsert.length; i += BATCH_SIZE) {
      const batch = entriesToInsert.slice(i, i + BATCH_SIZE);
      await tx.insert(prizeEntries).values(batch).onConflictDoNothing();
    }

    // 7. Insert winner agencies if present
    if (parsed.agents && parsed.agents.length > 0) {
      const agenciesToInsert = parsed.agents.map((a) => ({
        drawId,
        tier: a.tier,
        ticket: a.ticket,
        agencyName: a.agencyName || null,
        agencyCode: a.agencyCode || null,
        place: a.place || null,
        source: options.source,
      }));
      await tx.insert(winnerAgencies).values(agenciesToInsert).onConflictDoNothing();
    }

    // 8. Record audit log in ingest_events
    await tx.insert(ingestEvents).values({
      drawId,
      kind: "published",
      detail: {
        source: options.source,
        sourceUrl: options.sourceUrl,
        fingerprint,
        tierCount,
        entryCount,
        singleSource: options.singleSource ?? false,
      },
    });

    return {
      drawId,
      status: "published",
      published: true,
      alreadyPublished: false,
      fingerprint,
      tierCount,
      entryCount,
    };
  });
}
