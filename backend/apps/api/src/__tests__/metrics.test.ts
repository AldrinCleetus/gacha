import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildServer } from "../server.js";
import * as dbModule from "@gacha/db";
import * as sourcesModule from "@gacha/sources";

describe("Metrics & Alerts Endpoints", () => {
  const TEST_KEY = "test-admin-secret-key";

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.ADMIN_API_KEY = TEST_KEY;
  });

  describe("GET /metrics", () => {
    it("returns Prometheus exposition text format with expected metrics", async () => {
      const mockDb = {
        execute: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
      vi.spyOn(dbModule, "getDb").mockReturnValue(mockDb as unknown as dbModule.DbClient);

      vi.spyOn(sourcesModule, "checkSystemAlerts").mockResolvedValue({
        ok: true,
        alertCount: 0,
        activeAlerts: [],
        evaluatedAt: new Date().toISOString(),
      });

      const app = buildServer();
      const res = await app.inject({
        method: "GET",
        url: "/metrics",
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("text/plain");

      const text = res.payload;
      expect(text).toContain("gacha_up 1");
      expect(text).toContain("gacha_uptime_seconds");
      expect(text).toContain("gacha_db_latency_ms");
      expect(text).toContain("gacha_draws_total{status=\"published\"}");
      expect(text).toContain("gacha_source_observations_total{source=\"onmanorama\"");
      expect(text).toContain("gacha_unresolved_reviews_count");
      expect(text).toContain("gacha_active_alerts_count");
    });
  });

  describe("GET /admin/alerts", () => {
    it("rejects unauthorized requests with 401", async () => {
      const app = buildServer();
      const res = await app.inject({
        method: "GET",
        url: "/admin/alerts",
      });

      expect(res.statusCode).toBe(401);
    });

    it("returns active system alerts with 200 for authorized admin request", async () => {
      const mockDb = {
        query: {
          draws: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
          sourceObservations: { findFirst: vi.fn().mockResolvedValue(null) },
          ingestEvents: { findFirst: vi.fn().mockResolvedValue(null) },
        },
        insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
      };
      vi.spyOn(dbModule, "getDb").mockReturnValue(mockDb as unknown as dbModule.DbClient);

      vi.spyOn(sourcesModule, "checkSystemAlerts").mockResolvedValue({
        ok: false,
        alertCount: 1,
        activeAlerts: [
          {
            id: "test-alert-1",
            kind: "DRAWS_NEEDING_REVIEW",
            severity: "warning",
            message: "Draw SM-82 needs review",
            drawCode: "SM-82",
            detectedAt: new Date().toISOString(),
          },
        ],
        evaluatedAt: new Date().toISOString(),
      });

      const app = buildServer();
      const res = await app.inject({
        method: "GET",
        url: "/admin/alerts",
        headers: {
          "x-admin-key": TEST_KEY,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.ok).toBe(false);
      expect(body.alertCount).toBe(1);
      expect(body.activeAlerts[0].drawCode).toBe("SM-82");
    });
  });
});
