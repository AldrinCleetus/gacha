import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildServer } from "../server.js";
import * as dbModule from "@gacha/db";
import * as sourcesModule from "@gacha/sources";

describe("Admin API (/admin)", () => {
  const TEST_KEY = "test-admin-secret-key";

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.ADMIN_API_KEY = TEST_KEY;
  });

  describe("Authentication", () => {
    it("rejects requests without admin credentials with 401 Unauthorized", async () => {
      const app = buildServer();
      const res = await app.inject({
        method: "GET",
        url: "/admin/review",
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload);
      expect(body.error).toBe("Unauthorized");
    });

    it("rejects requests with invalid admin key with 401 Unauthorized", async () => {
      const app = buildServer();
      const res = await app.inject({
        method: "GET",
        url: "/admin/review",
        headers: {
          "x-admin-key": "wrong-key",
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it("accepts requests with valid X-Admin-Key header", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };
      vi.spyOn(dbModule, "getDb").mockReturnValue(mockDb as unknown as dbModule.DbClient);

      const app = buildServer();
      const res = await app.inject({
        method: "GET",
        url: "/admin/review",
        headers: {
          "x-admin-key": TEST_KEY,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.draws).toEqual([]);
    });

    it("accepts requests with valid Authorization Bearer header", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };
      vi.spyOn(dbModule, "getDb").mockReturnValue(mockDb as unknown as dbModule.DbClient);

      const app = buildServer();
      const res = await app.inject({
        method: "GET",
        url: "/admin/review",
        headers: {
          authorization: `Bearer ${TEST_KEY}`,
        },
      });

      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /admin/ingest/pdf", () => {
    it("returns 400 when body is empty", async () => {
      const app = buildServer();
      const res = await app.inject({
        method: "POST",
        url: "/admin/ingest/pdf",
        headers: {
          "x-admin-key": TEST_KEY,
          "content-type": "application/pdf",
        },
        payload: Buffer.alloc(0),
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.ok).toBe(false);
      expect(body.error).toContain("Empty PDF payload");
    });

    it("successfully ingests PDF and returns 200 with draw info", async () => {
      vi.spyOn(sourcesModule, "ingestObservation").mockResolvedValue({
        observationId: "obs-1234",
        drawId: "draw-5678",
        drawStatus: "published",
        published: true,
        source: "official",
        rawObjectKey: "sources/official/SM/SM-82/hash.pdf",
        contentHash: "dummyhash",
        validation: { ok: true, errors: [] },
        fingerprint: "canonical-fingerprint-123",
        tierCount: 10,
        entryCount: 371,
        parsed: {
          source: "official",
          sourceUrl: "manual-upload",
          fetchedAt: new Date().toISOString(),
          schemeName: "Samrudhi",
          schemeCode: "SM",
          drawCode: "SM-82",
          drawDate: "2026-11-22",
          tiers: [],
          raw: { contentHash: "dummyhash" },
        },
      });

      const app = buildServer();
      const res = await app.inject({
        method: "POST",
        url: "/admin/ingest/pdf",
        headers: {
          "x-admin-key": TEST_KEY,
          "content-type": "application/pdf",
        },
        payload: Buffer.from("%PDF-1.4 sample pdf content"),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.ok).toBe(true);
      expect(body.drawCode).toBe("SM-82");
      expect(body.published).toBe(true);
      expect(body.tierCount).toBe(10);
      expect(body.entryCount).toBe(371);
    });

    it("returns 400 when PDF parsing/ingestion fails", async () => {
      vi.spyOn(sourcesModule, "ingestObservation").mockRejectedValue(
        new Error("Invalid Kerala lottery PDF layout")
      );

      const app = buildServer();
      const res = await app.inject({
        method: "POST",
        url: "/admin/ingest/pdf",
        headers: {
          "x-admin-key": TEST_KEY,
          "content-type": "application/pdf",
        },
        payload: Buffer.from("%PDF-1.4 broken content"),
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.ok).toBe(false);
      expect(body.error).toContain("Invalid Kerala lottery PDF layout");
    });
  });

  describe("POST /admin/draws/:id/publish", () => {
    it("force-publishes a draw with admin override", async () => {
      vi.spyOn(sourcesModule, "forcePublishDraw").mockResolvedValue({
        drawId: "draw-123",
        drawCode: "SM-82",
        status: "published",
        published: true,
        fingerprint: "fp-123",
      });

      const app = buildServer();
      const res = await app.inject({
        method: "POST",
        url: "/admin/draws/SM-82/publish",
        headers: {
          "x-admin-key": TEST_KEY,
        },
        payload: {
          source: "official",
          reason: "Manual verification against official Gazette",
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.ok).toBe(true);
      expect(body.drawCode).toBe("SM-82");
      expect(body.published).toBe(true);
    });
  });
});
