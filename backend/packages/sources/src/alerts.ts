import { DbClient, getDb, draws, sourceObservations, ingestEvents, eq, and, desc, gte } from "@gacha/db";
import { Clock, SystemClock, getPollingWindowInfo } from "@gacha/shared";

export type AlertKind = "UNPUBLISHED_PAST_630PM" | "DRAWS_NEEDING_REVIEW" | "DEGRADED_SOURCES";
export type AlertSeverity = "critical" | "warning";

export interface SystemAlert {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  message: string;
  drawId?: string;
  drawCode?: string;
  source?: string;
  details?: Record<string, unknown>;
  detectedAt: string;
}

export interface CheckAlertsResult {
  ok: boolean;
  alertCount: number;
  activeAlerts: SystemAlert[];
  evaluatedAt: string;
}

export interface CheckAlertsOptions {
  db?: DbClient;
  clock?: Clock;
  recordEvents?: boolean;
}

export async function checkSystemAlerts(options: CheckAlertsOptions = {}): Promise<CheckAlertsResult> {
  const db = options.db || getDb();
  const clock = options.clock || new SystemClock();
  const recordEvents = options.recordEvents !== false; // default true

  const now = clock.now();
  const nowIso = now.toISOString();
  const activeAlerts: SystemAlert[] = [];

  // -------------------------------------------------------------
  // Check 1: UNPUBLISHED_PAST_630PM
  // Page condition: If today is a draw day and it's past 18:30 IST,
  // but today's draw is not in 'published' state.
  // -------------------------------------------------------------
  const windowInfo = getPollingWindowInfo(now);
  if (windowInfo.shouldAlert) {
    const todayDraw = await db.query.draws.findFirst({
      where: eq(draws.drawDate, windowInfo.istDateStr),
    });

    if (todayDraw && todayDraw.status !== "published") {
      activeAlerts.push({
        id: `alert-unpublished-${todayDraw.drawCode}-${windowInfo.istDateStr}`,
        kind: "UNPUBLISHED_PAST_630PM",
        severity: "critical",
        message: `Draw ${todayDraw.drawCode} (${todayDraw.drawDate}) is not published past 6:30 PM IST threshold (current status: ${todayDraw.status}).`,
        drawId: todayDraw.id,
        drawCode: todayDraw.drawCode,
        details: {
          drawDate: todayDraw.drawDate,
          drawStatus: todayDraw.status,
          istTime: windowInfo.istTimeStr,
          istPhase: windowInfo.phase,
        },
        detectedAt: nowIso,
      });
    }
  }

  // -------------------------------------------------------------
  // Check 2: DRAWS_NEEDING_REVIEW
  // Condition: Any draw held in 'needs_review' state awaiting admin action
  // -------------------------------------------------------------
  const reviewDraws = await db.query.draws.findMany({
    where: eq(draws.status, "needs_review"),
    orderBy: [desc(draws.drawDate)],
  });

  for (const rd of reviewDraws) {
    activeAlerts.push({
      id: `alert-needs-review-${rd.id}`,
      kind: "DRAWS_NEEDING_REVIEW",
      severity: "warning",
      message: `Draw ${rd.drawCode} (${rd.drawDate}) is held in needs_review state awaiting admin intervention.`,
      drawId: rd.id,
      drawCode: rd.drawCode,
      details: {
        drawDate: rd.drawDate,
        schemeCode: rd.schemeCode,
      },
      detectedAt: nowIso,
    });
  }

  // -------------------------------------------------------------
  // Check 3: DEGRADED_SOURCES
  // Condition: Active source whose most recent observation failed validation,
  // or has multiple recent validation failures indicating website layout drift.
  // -------------------------------------------------------------
  const activeSources = ["onmanorama", "keralalotteries_net"];
  for (const src of activeSources) {
    const latestObs = await db.query.sourceObservations.findFirst({
      where: eq(sourceObservations.source, src),
      orderBy: [desc(sourceObservations.fetchedAt)],
    });

    if (latestObs && latestObs.validation && !latestObs.validation.ok) {
      activeAlerts.push({
        id: `alert-degraded-source-${src}`,
        kind: "DEGRADED_SOURCES",
        severity: "warning",
        message: `Source '${src}' is degraded: latest observation failed validation (${latestObs.validation.errors.join(", ")}).`,
        source: src,
        drawId: latestObs.drawId ?? undefined,
        details: {
          errors: latestObs.validation.errors,
          fetchedAt: latestObs.fetchedAt.toISOString(),
          sourceUrl: latestObs.sourceUrl,
        },
        detectedAt: nowIso,
      });
    }
  }

  // -------------------------------------------------------------
  // Record alerts in ingest_events (deduped within 15 minutes)
  // -------------------------------------------------------------
  if (recordEvents && activeAlerts.length > 0) {
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

    for (const alert of activeAlerts) {
      // Check if logged recently
      const recentLog = await db.query.ingestEvents.findFirst({
        where: and(
          eq(ingestEvents.kind, "alert_triggered"),
          gte(ingestEvents.at, fifteenMinutesAgo)
        ),
      });

      const alreadyLogged =
        recentLog &&
        (recentLog.detail as Record<string, unknown> | null)?.alertId === alert.id;

      if (!alreadyLogged) {
        await db.insert(ingestEvents).values({
          drawId: alert.drawId ?? null,
          kind: "alert_triggered",
          detail: {
            alertId: alert.id,
            kind: alert.kind,
            severity: alert.severity,
            message: alert.message,
            source: alert.source,
            drawCode: alert.drawCode,
            details: alert.details,
            detectedAt: alert.detectedAt,
          },
          at: now,
        });
      }
    }
  }

  return {
    ok: activeAlerts.length === 0,
    alertCount: activeAlerts.length,
    activeAlerts,
    evaluatedAt: nowIso,
  };
}
