import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { getDb, draws, sourceObservations, sql } from "@gacha/db";
import { checkSystemAlerts } from "@gacha/sources";

export const metricsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get(
    "/metrics",
    {
      schema: {
        description: "Prometheus metrics exposition endpoint",
        tags: ["monitoring"],
      },
    },
    async (_req, reply) => {
      const db = getDb();

      // Measure DB latency
      let dbLatencyMs = 0;
      let dbUp = 1;
      try {
        const pingStart = performance.now();
        await db.execute(sql`SELECT 1`);
        dbLatencyMs = Math.round((performance.now() - pingStart) * 100) / 100;
      } catch {
        dbUp = 0;
      }

      // Draw counts by status
      const drawCounts: Record<string, number> = {
        published: 0,
        expected: 0,
        observed: 0,
        needs_review: 0,
      };

      try {
        const drawRows = await db
          .select({
            status: draws.status,
            count: sql<number>`count(*)::int`,
          })
          .from(draws)
          .groupBy(draws.status);

        for (const row of drawRows) {
          if (row.status in drawCounts) {
            drawCounts[row.status] = row.count;
          }
        }
      } catch {
        // use defaults if query fails
      }

      // Observation counts by source and validity
      const obsCounts: Record<string, { valid: number; invalid: number }> = {
        onmanorama: { valid: 0, invalid: 0 },
        keralalotteries_net: { valid: 0, invalid: 0 },
        official: { valid: 0, invalid: 0 },
      };

      try {
        const obsRows = await db
          .select({
            source: sourceObservations.source,
            isValid: sql<boolean>`COALESCE((validation->>'ok')::boolean, false)`,
            count: sql<number>`count(*)::int`,
          })
          .from(sourceObservations)
          .groupBy(sourceObservations.source, sql`COALESCE((validation->>'ok')::boolean, false)`);

        for (const row of obsRows) {
          if (!obsCounts[row.source]) {
            obsCounts[row.source] = { valid: 0, invalid: 0 };
          }
          if (row.isValid) {
            obsCounts[row.source].valid = row.count;
          } else {
            obsCounts[row.source].invalid = row.count;
          }
        }
      } catch {
        // use defaults if query fails
      }

      // Alerts check (read-only, without recording events to avoid spamming ingest_events)
      let criticalAlerts = 0;
      let warningAlerts = 0;
      try {
        const alertsResult = await checkSystemAlerts({ db, recordEvents: false });
        for (const a of alertsResult.activeAlerts) {
          if (a.severity === "critical") criticalAlerts++;
          else warningAlerts++;
        }
      } catch {
        // ignore
      }

      const uptimeSeconds = Math.round(process.uptime() * 10) / 10;
      const mem = process.memoryUsage();

      const lines: string[] = [
        "# HELP gacha_up Indicates if the gacha API server is operational",
        "# TYPE gacha_up gauge",
        "gacha_up 1",
        "",
        "# HELP gacha_database_up Indicates if PostgreSQL is reachable",
        "# TYPE gacha_database_up gauge",
        `gacha_database_up ${dbUp}`,
        "",
        "# HELP gacha_uptime_seconds Process uptime in seconds",
        "# TYPE gacha_uptime_seconds gauge",
        `gacha_uptime_seconds ${uptimeSeconds}`,
        "",
        "# HELP gacha_db_latency_ms Database roundtrip query latency in milliseconds",
        "# TYPE gacha_db_latency_ms gauge",
        `gacha_db_latency_ms ${dbLatencyMs}`,
        "",
        "# HELP gacha_process_heap_bytes Process heap memory usage in bytes",
        "# TYPE gacha_process_heap_bytes gauge",
        `gacha_process_heap_bytes ${mem.heapUsed}`,
        "",
        "# HELP gacha_draws_total Total count of lottery draws by status",
        "# TYPE gacha_draws_total gauge",
        `gacha_draws_total{status="published"} ${drawCounts.published}`,
        `gacha_draws_total{status="expected"} ${drawCounts.expected}`,
        `gacha_draws_total{status="observed"} ${drawCounts.observed}`,
        `gacha_draws_total{status="needs_review"} ${drawCounts.needs_review}`,
        "",
        "# HELP gacha_unresolved_reviews_count Number of draws held in needs_review state",
        "# TYPE gacha_unresolved_reviews_count gauge",
        `gacha_unresolved_reviews_count ${drawCounts.needs_review}`,
        "",
        "# HELP gacha_source_observations_total Total source observations ingested by source and validity",
        "# TYPE gacha_source_observations_total gauge",
      ];

      for (const [src, counts] of Object.entries(obsCounts)) {
        lines.push(`gacha_source_observations_total{source="${src}",valid="true"} ${counts.valid}`);
        lines.push(`gacha_source_observations_total{source="${src}",valid="false"} ${counts.invalid}`);
      }

      lines.push("");
      lines.push("# HELP gacha_active_alerts_count Number of currently active system alerts");
      lines.push("# TYPE gacha_active_alerts_count gauge");
      lines.push(`gacha_active_alerts_count{severity="critical"} ${criticalAlerts}`);
      lines.push(`gacha_active_alerts_count{severity="warning"} ${warningAlerts}`);
      lines.push("");

      return reply
        .header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
        .send(lines.join("\n"));
    }
  );
};
