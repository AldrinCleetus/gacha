import {
  DbClient,
  getDb,
  draws,
  ingestEvents,
  gte,
  and,
  desc,
} from "@gacha/db";
import { Clock, SystemClock } from "@gacha/shared";
import { getISTDateParts } from "./pollingWindow.js";
import { logger } from "./index.js";

export interface ReconcileResult {
  checkedDrawsCount: number;
  drawsChecked: Array<{
    id: string;
    drawCode: string;
    drawDate: string;
    status: string;
    fingerprint: string | null;
  }>;
  alerts: string[];
}

/**
 * Nightly reconciliation job stub per Section 6:
 * Re-checks the last 7 days of draws against sources and audit logs.
 * Expanded in F9 for two-source diffs and late corrections.
 */
export async function runNightlyReconcile(
  db: DbClient = getDb(),
  clock: Clock = new SystemClock()
): Promise<ReconcileResult> {
  logger.info("Running nightly reconciliation job (stub for 7-day recheck)...");

  // Calculate cutoff: 7 days ago in IST
  const now = clock.now();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const cutoffDateStr = getISTDateParts(sevenDaysAgo).dateStr;

  const recentDraws = await db.query.draws.findMany({
    where: and(gte(draws.drawDate, cutoffDateStr)),
    with: {
      observations: true,
    },
    orderBy: [desc(draws.drawDate)],
  });

  const alerts: string[] = [];

  for (const d of recentDraws) {
    if (d.status === "needs_review") {
      alerts.push(`Draw ${d.drawCode} (${d.drawDate}) is currently flagged as needs_review`);
    } else if (d.status === "expected") {
      alerts.push(`Draw ${d.drawCode} (${d.drawDate}) was expected but never observed or published`);
    }
  }

  // Record audit log event
  await db.insert(ingestEvents).values({
    kind: "reconcile_nightly",
    detail: {
      date: getISTDateParts(now).dateStr,
      checkedCount: recentDraws.length,
      drawCodes: recentDraws.map((d) => d.drawCode),
      alerts,
    },
  });

  logger.info(
    { count: recentDraws.length, alertsCount: alerts.length },
    "Nightly reconciliation check completed"
  );

  return {
    checkedDrawsCount: recentDraws.length,
    drawsChecked: recentDraws.map((d) => ({
      id: d.id,
      drawCode: d.drawCode,
      drawDate: d.drawDate,
      status: d.status,
      fingerprint: d.fingerprint,
    })),
    alerts,
  };
}
