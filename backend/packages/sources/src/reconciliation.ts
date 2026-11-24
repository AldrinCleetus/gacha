import {
  DbClient,
  draws,
  sourceObservations,
  ingestEvents,
  DrawStatus,
  eq,
  and,
} from "@gacha/db";
import { ParsedDraw } from "@gacha/shared";
import { publishDraw } from "./publish.js";
import { compareDraws, renderDiffText, DrawDiff } from "./diff.js";

export interface ReconcileResult {
  drawId: string;
  drawCode: string;
  status: DrawStatus;
  published: boolean;
  consensus?: boolean;
  conflict?: boolean;
  singleSource?: boolean;
  sources?: string[];
  fingerprint?: string;
  diff?: DrawDiff;
  diffText?: string;
  reason?: string;
}

/**
 * Reconciles all source observations for a given draw according to Section 4.2:
 * - Two independent sources produce the exact same fingerprint -> Published (consensus)
 * - Sources disagree on fingerprint or validation fails -> needs_review with structured diff
 * - Only 1 valid source observed -> observed (waiting for second source)
 * - Contradicts an already-published draw -> needs_review (late correction)
 */
export async function reconcileDraw(
  db: DbClient,
  drawId: string
): Promise<ReconcileResult> {
  return await db.transaction(async (tx) => {
    // 1. Lock and fetch target draw
    const [draw] = await tx
      .select()
      .from(draws)
      .where(eq(draws.id, drawId))
      .for("update");

    if (!draw) {
      throw new Error(`Draw with id "${drawId}" not found for reconciliation`);
    }

    // 2. Fetch all observations for this draw
    const obsList = await tx
      .select()
      .from(sourceObservations)
      .where(eq(sourceObservations.drawId, drawId));

    const validObs = obsList.filter(
      (o) => o.parsed !== null && o.validation && (o.validation as { ok: boolean }).ok
    );
    const invalidObs = obsList.filter(
      (o) => !o.validation || !(o.validation as { ok: boolean }).ok
    );

    // Case 1: Draw is already published
    if (draw.status === "published") {
      // Check if any observation contradicts the published fingerprint
      for (const obs of validObs) {
        if (obs.fingerprint && obs.fingerprint !== draw.fingerprint) {
          // Late correction or contradicting source!
          await tx
            .update(draws)
            .set({ status: "needs_review" })
            .where(eq(draws.id, drawId));

          const publishedParsed = validObs.find((o) => o.fingerprint === draw.fingerprint)?.parsed as ParsedDraw | undefined;
          let diff: DrawDiff | undefined;
          let diffText: string | undefined;

          if (publishedParsed && obs.parsed) {
            diff = compareDraws(publishedParsed, obs.parsed as ParsedDraw);
            diffText = renderDiffText(diff);
          }

          await tx.insert(ingestEvents).values({
            drawId,
            kind: "conflict",
            detail: {
              reason: "late_correction",
              publishedFingerprint: draw.fingerprint,
              conflictingSource: obs.source,
              conflictingFingerprint: obs.fingerprint,
              diff,
              diffText,
            },
          });

          return {
            drawId,
            drawCode: draw.drawCode,
            status: "needs_review",
            published: false,
            conflict: true,
            fingerprint: draw.fingerprint || undefined,
            diff,
            diffText,
            reason: "late_correction",
          };
        }
      }

      // No conflict with published draw
      return {
        drawId,
        drawCode: draw.drawCode,
        status: "published",
        published: true,
        fingerprint: draw.fingerprint || undefined,
      };
    }

    // Case 2: Draw is NOT published yet (expected, observed, or needs_review)

    // Check if any fingerprint has >= 2 independent sources
    const fingerprintToSources = new Map<string, Array<{ source: string; parsed: ParsedDraw }>>();
    for (const obs of validObs) {
      if (obs.fingerprint && obs.parsed) {
        const list = fingerprintToSources.get(obs.fingerprint) || [];
        // Unique per source
        if (!list.some((item) => item.source === obs.source)) {
          list.push({ source: obs.source, parsed: obs.parsed as ParsedDraw });
        }
        fingerprintToSources.set(obs.fingerprint, list);
      }
    }

    // Look for consensus (2+ matching sources)
    for (const [fp, items] of fingerprintToSources.entries()) {
      if (items.length >= 2) {
        // CONSENSUS REACHED!
        const consensusSources = items.map((i) => i.source);
        const parsedToPublish = items[0].parsed;

        // Merge any agents from the second source if the first lacked them
        if (!parsedToPublish.agents || parsedToPublish.agents.length === 0) {
          const other = items.find((i) => i.parsed.agents && i.parsed.agents.length > 0);
          if (other?.parsed.agents) {
            parsedToPublish.agents = other.parsed.agents;
          }
        }

        await publishDraw(tx as DbClient, drawId, parsedToPublish, {
          source: consensusSources.join("+"),
          agreement: true,
        });

        await tx.insert(ingestEvents).values({
          drawId,
          kind: "consensus_reached",
          detail: {
            sources: consensusSources,
            fingerprint: fp,
            tierCount: parsedToPublish.tiers.length,
            message: `Two-source consensus reached between ${consensusSources.join(" and ")}`,
          },
        });

        return {
          drawId,
          drawCode: draw.drawCode,
          status: "published",
          published: true,
          consensus: true,
          sources: consensusSources,
          fingerprint: fp,
        };
      }
    }

    // Official source rule (Design Doc Section 4.2):
    // "the official parse (manual or fetched) passes validation and no other source contradicts it."
    const officialObs = validObs.find((o) => o.source === "official");
    if (officialObs && officialObs.fingerprint && officialObs.parsed) {
      const contradictorySources = Array.from(fingerprintToSources.entries())
        .filter(([fp]) => fp !== officialObs.fingerprint)
        .flatMap(([, items]) => items.map((i) => i.source));

      if (contradictorySources.length === 0) {
        // Authoritative official source passes validation with zero contradictions!
        const parsedToPublish = officialObs.parsed as ParsedDraw;
        await publishDraw(tx as DbClient, drawId, parsedToPublish, {
          source: "official",
          agreement: false,
        });

        await tx.insert(ingestEvents).values({
          drawId,
          kind: "official_published",
          detail: {
            source: "official",
            fingerprint: officialObs.fingerprint,
            tierCount: parsedToPublish.tiers.length,
            message: "Published via authoritative official source without contradiction",
          },
        });

        return {
          drawId,
          drawCode: draw.drawCode,
          status: "published",
          published: true,
          sources: ["official"],
          fingerprint: officialObs.fingerprint,
        };
      }
    }

    // Check if we have multiple valid observations with differing fingerprints
    if (fingerprintToSources.size > 1) {
      // DISAGREEMENT!
      const allObs = Array.from(fingerprintToSources.values()).flatMap((v) => v);
      let obsA = allObs[0];
      let obsB = allObs[1];

      // Prefer comparing official against contradictory source if official is available
      const officialItem = allObs.find((o) => o.source === "official");
      if (officialItem) {
        const otherItem = allObs.find((o) => o.source !== "official");
        if (otherItem) {
          obsA = officialItem;
          obsB = otherItem;
        }
      }

      const diff = compareDraws(obsA.parsed, obsB.parsed);
      const diffText = renderDiffText(diff);

      await tx
        .update(draws)
        .set({ status: "needs_review" })
        .where(eq(draws.id, drawId));

      await tx.insert(ingestEvents).values({
        drawId,
        kind: "conflict",
        detail: {
          reason: "source_disagreement",
          sourceA: obsA.source,
          sourceB: obsB.source,
          fingerprintA: diff.sourceA.fingerprint,
          fingerprintB: diff.sourceB.fingerprint,
          diff,
          diffText,
        },
      });

      return {
        drawId,
        drawCode: draw.drawCode,
        status: "needs_review",
        published: false,
        conflict: true,
        diff,
        diffText,
        reason: "source_disagreement",
      };
    }

    // If we only have 1 valid observation so far
    if (validObs.length === 1) {
      const singleObs = validObs[0];
      if (draw.status !== "observed") {
        await tx
          .update(draws)
          .set({ status: "observed" })
          .where(eq(draws.id, drawId));

        await tx.insert(ingestEvents).values({
          drawId,
          kind: "observed",
          detail: {
            source: singleObs.source,
            fingerprint: singleObs.fingerprint,
            message: `First valid observation recorded from ${singleObs.source}. Awaiting second source for consensus.`,
          },
        });
      }

      return {
        drawId,
        drawCode: draw.drawCode,
        status: "observed",
        published: false,
        singleSource: true,
        sources: [singleObs.source],
        fingerprint: singleObs.fingerprint || undefined,
      };
    }

    // If observations were made but all failed validation
    if (invalidObs.length > 0) {
      await tx
        .update(draws)
        .set({ status: "needs_review" })
        .where(eq(draws.id, drawId));

      await tx.insert(ingestEvents).values({
        drawId,
        kind: "conflict",
        detail: {
          reason: "validation_failure",
          errors: invalidObs.map((o) => ({
            source: o.source,
            validation: o.validation,
          })),
        },
      });

      return {
        drawId,
        drawCode: draw.drawCode,
        status: "needs_review",
        published: false,
        conflict: true,
        reason: "validation_failure",
      };
    }

    // No observations yet -> remain in current status
    return {
      drawId,
      drawCode: draw.drawCode,
      status: draw.status,
      published: false,
    };
  });
}

/**
 * Admin action: Forces publication of a specific source's observation,
 * recording an immutable audit log entry in ingest_events.
 */
export async function forcePublishDraw(
  db: DbClient,
  drawIdOrCode: string,
  chosenSource: string,
  reason: string = "Admin manual override"
): Promise<ReconcileResult> {
  return await db.transaction(async (tx) => {
    // 1. Find draw by id or drawCode
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      drawIdOrCode
    );
    const draw = await tx.query.draws.findFirst({
      where: isUuid
        ? eq(draws.id, drawIdOrCode)
        : eq(draws.drawCode, drawIdOrCode.toUpperCase()),
    });

    if (!draw) {
      throw new Error(`Draw "${drawIdOrCode}" not found`);
    }

    // 2. Find observation for the chosen source
    const obs = await tx.query.sourceObservations.findFirst({
      where: and(
        eq(sourceObservations.drawId, draw.id),
        eq(sourceObservations.source, chosenSource)
      ),
    });

    if (!obs || !obs.parsed) {
      throw new Error(
        `No parsed observation found for draw "${draw.drawCode}" from source "${chosenSource}"`
      );
    }

    const parsed = obs.parsed as ParsedDraw;

    // 3. Atomically publish
    const publishRes = await publishDraw(tx as DbClient, draw.id, parsed, {
      source: chosenSource,
      sourceUrl: obs.sourceUrl || undefined,
      force: true,
    });

    // 4. Record audit log
    await tx.insert(ingestEvents).values({
      drawId: draw.id,
      kind: "force_published",
      detail: {
        adminReason: reason,
        chosenSource,
        fingerprint: publishRes.fingerprint,
        tierCount: publishRes.tierCount,
        entryCount: publishRes.entryCount,
        previousStatus: draw.status,
      },
    });

    return {
      drawId: draw.id,
      drawCode: draw.drawCode,
      status: "published",
      published: true,
      sources: [chosenSource],
      fingerprint: publishRes.fingerprint,
      reason,
    };
  });
}
