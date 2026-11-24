import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { compareDraws, renderDiffText } from "../diff.js";
import { reconcileDraw, forcePublishDraw } from "../reconciliation.js";
import { parseArticle as parseOnmanorama } from "../onmanorama/parser.js";
import { parseArticle as parseKeralalotteries } from "../keralalotteries/parser.js";
import { ParsedDraw } from "@gacha/shared";
import { draws, ingestEvents } from "@gacha/db";
import { computeDrawFingerprint } from "../fingerprint.js";

const FIXTURES_DIR_ONM = path.resolve(__dirname, "../onmanorama/fixtures");
const FIXTURES_DIR_KL = path.resolve(__dirname, "../keralalotteries/fixtures");

const onmSm82Html = fs.readFileSync(path.join(FIXTURES_DIR_ONM, "samrudhi-sm-82.html"), "utf8");
const klSm82Html = fs.readFileSync(path.join(FIXTURES_DIR_KL, "samrudhi-sm-82.html"), "utf8");

describe("Reconciliation & Diff Engine", () => {
  const baseDraw: ParsedDraw = {
    source: "onmanorama",
    sourceUrl: "https://example.com/draw1",
    fetchedAt: "2026-11-23T10:00:00Z",
    schemeName: "Bhagyathara",
    schemeCode: "BT",
    drawCode: "BT-80",
    drawDate: "2026-11-23",
    tiers: [
      { tier: "1", amount: 10000000, matchType: "full", entries: ["BT123456"] },
      { tier: "consolation", amount: 5000, matchType: "consolation", entries: ["BA123456", "BC123456"] },
      { tier: "2", amount: 2500000, matchType: "full", entries: ["BT654321"] },
      { tier: "4", amount: 5000, matchType: "last4", entries: ["1111", "2222"] },
    ],
    raw: { contentHash: "hash1" },
  };

  describe("compareDraws", () => {
    it("reports hasDiff: false when two draws are completely identical", () => {
      const draw2: ParsedDraw = {
        ...baseDraw,
        source: "keralalotteries_net",
        raw: { contentHash: "hash2" },
      };

      const diff = compareDraws(baseDraw, draw2);
      expect(diff.hasDiff).toBe(false);
      expect(diff.tierDifferences).toHaveLength(0);
      expect(diff.sourceA.fingerprint).toBe(diff.sourceB.fingerprint);

      const rendered = renderDiffText(diff);
      expect(rendered).toContain("MATCH (Consensus)");
    });

    it("detects amount mismatch in prize tier", () => {
      const draw2: ParsedDraw = {
        ...baseDraw,
        source: "keralalotteries_net",
        tiers: [
          { tier: "1", amount: 20000000, matchType: "full", entries: ["BT123456"] },
          ...baseDraw.tiers.slice(1),
        ],
      };

      const diff = compareDraws(baseDraw, draw2);
      expect(diff.hasDiff).toBe(true);
      expect(diff.tierDifferences.some((t) => t.issue === "amount_mismatch")).toBe(true);
      const rendered = renderDiffText(diff);
      expect(rendered).toContain("AMOUNT_MISMATCH");
    });

    it("detects entry mismatch in winning ticket", () => {
      const draw2: ParsedDraw = {
        ...baseDraw,
        source: "keralalotteries_net",
        tiers: [
          { tier: "1", amount: 10000000, matchType: "full", entries: ["BT999999"] },
          ...baseDraw.tiers.slice(1),
        ],
      };

      const diff = compareDraws(baseDraw, draw2);
      expect(diff.hasDiff).toBe(true);
      const tier1Diff = diff.tierDifferences.find((t) => t.tier === "1");
      expect(tier1Diff?.issue).toBe("entries_mismatch");
      expect(tier1Diff?.onlyInA).toContain("BT123456");
      expect(tier1Diff?.onlyInB).toContain("BT999999");
    });

    it("detects tier missing in one source", () => {
      const draw2: ParsedDraw = {
        ...baseDraw,
        source: "keralalotteries_net",
        tiers: baseDraw.tiers.slice(0, 2), // missing tier 2 and tier 4
      };

      const diff = compareDraws(baseDraw, draw2);
      expect(diff.hasDiff).toBe(true);
      expect(diff.tierDifferences.some((t) => t.issue === "missing_in_b")).toBe(true);
    });

    it("accurately compares real-world SM-82 fixtures", () => {
      const onmDraw = parseOnmanorama(onmSm82Html, "https://onmanorama.com/sm82");
      const klDraw = parseKeralalotteries(klSm82Html, "https://keralalotteries.net/sm82");

      const diff = compareDraws(onmDraw, klDraw);
      expect(diff.hasDiff).toBe(true);
      // Both agree on 1st prize
      const t1 = diff.tierDifferences.find((t) => t.tier === "1");
      expect(t1).toBeUndefined(); // no diff in tier 1!

      // Consolation: Onmanorama had 0 entries while keralalotteries had 11 entries
      const consDiff = diff.tierDifferences.find((t) => t.tier === "consolation");
      expect(consDiff).toBeDefined();
      expect(consDiff?.issue).toBe("entries_mismatch");
      expect(consDiff?.onlyInB?.length).toBeGreaterThan(0);
    });
  });

  describe("reconcileDraw State Transitions (Mock DB)", () => {
    it("transitions draw to 'observed' when only one valid source is observed", async () => {
      const mockDraw = {
        id: "d1",
        drawCode: "BT-80",
        drawDate: "2026-11-23",
        status: "expected" as const,
        fingerprint: null,
      };

      const mockObservations = [
        {
          id: "obs1",
          drawId: "d1",
          source: "onmanorama",
          sourceUrl: "https://onmanorama.com",
          fingerprint: "fp123",
          parsed: baseDraw,
          validation: { ok: true, errors: [] },
        },
      ];

      const updates: Array<{ table: string; data: unknown }> = [];
      const inserts: Array<{ table: string; data: unknown }> = [];

      const mockTx = {
        select: () => ({
          from: (table: unknown) => ({
            where: () => {
              if (table === draws) {
                return {
                  for: () => [mockDraw],
                };
              }
              return mockObservations;
            },
          }),
        }),
        update: (table: unknown) => ({
          set: (data: unknown) => {
            updates.push({ table: table === draws ? "draws" : "other", data });
            return {
              where: () => Promise.resolve(),
            };
          },
        }),
        insert: (table: unknown) => ({
          values: (data: unknown) => {
            inserts.push({ table: table === ingestEvents ? "ingest_events" : "other", data });
            return {
              onConflictDoNothing: () => Promise.resolve(),
              returning: () => [{ id: "generated" }],
            };
          },
        }),
        transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx),
      };

      const mockDb = {
        transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx),
      };

      const result = await reconcileDraw(mockDb as never, "d1");
      expect(result.status).toBe("observed");
      expect(result.singleSource).toBe(true);
      expect(updates.some((u) => u.table === "draws" && (u.data as { status: string }).status === "observed")).toBe(true);
    });

    it("publishes draw with consensus when two independent sources agree on fingerprint", async () => {
      const fp = computeDrawFingerprint(baseDraw);
      const mockDraw = {
        id: "d2",
        drawCode: "BT-80",
        drawDate: "2026-11-23",
        status: "observed" as const,
        fingerprint: null,
      };

      const mockObservations = [
        {
          id: "obs1",
          drawId: "d2",
          source: "onmanorama",
          sourceUrl: "https://onmanorama.com",
          fingerprint: fp,
          parsed: baseDraw,
          validation: { ok: true, errors: [] },
        },
        {
          id: "obs2",
          drawId: "d2",
          source: "keralalotteries_net",
          sourceUrl: "https://keralalotteries.net",
          fingerprint: fp,
          parsed: { ...baseDraw, source: "keralalotteries_net" },
          validation: { ok: true, errors: [] },
        },
      ];

      const updates: Array<{ table: string; data: unknown }> = [];
      const inserts: Array<{ table: string; data: unknown }> = [];

      const mockTx = {
        select: () => ({
          from: (table: unknown) => ({
            where: () => {
              if (table === draws) {
                return {
                  for: () => [mockDraw],
                };
              }
              return mockObservations;
            },
          }),
        }),
        update: (table: unknown) => ({
          set: (data: unknown) => {
            updates.push({ table: table === draws ? "draws" : "other", data });
            return {
              where: () => Promise.resolve(),
            };
          },
        }),
        insert: (table: unknown) => ({
          values: (data: unknown) => {
            inserts.push({ table: table === ingestEvents ? "ingest_events" : "other", data });
            return {
              onConflictDoNothing: () => Promise.resolve(),
              returning: () => [{ id: "generated" }],
            };
          },
        }),
        transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx),
      };

      const mockDb = {
        transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx),
      };

      const result = await reconcileDraw(mockDb as never, "d2");
      expect(result.status).toBe("published");
      expect(result.published).toBe(true);
      expect(result.consensus).toBe(true);
      expect(result.sources).toEqual(["onmanorama", "keralalotteries_net"]);
      expect(inserts.some((i) => i.table === "ingest_events" && (i.data as { kind: string }).kind === "consensus_reached")).toBe(true);
    });

    it("moves draw to 'needs_review' when two sources have conflicting fingerprints", async () => {
      const mockDraw = {
        id: "d3",
        drawCode: "BT-80",
        drawDate: "2026-11-23",
        status: "observed" as const,
        fingerprint: null,
      };

      const draw2: ParsedDraw = {
        ...baseDraw,
        source: "keralalotteries_net",
        tiers: [
          { tier: "1", amount: 10000000, matchType: "full", entries: ["BT999999"] },
          ...baseDraw.tiers.slice(1),
        ],
      };

      const mockObservations = [
        {
          id: "obs1",
          drawId: "d3",
          source: "onmanorama",
          sourceUrl: "https://onmanorama.com",
          fingerprint: computeDrawFingerprint(baseDraw),
          parsed: baseDraw,
          validation: { ok: true, errors: [] },
        },
        {
          id: "obs2",
          drawId: "d3",
          source: "keralalotteries_net",
          sourceUrl: "https://keralalotteries.net",
          fingerprint: computeDrawFingerprint(draw2),
          parsed: draw2,
          validation: { ok: true, errors: [] },
        },
      ];

      const updates: Array<{ table: string; data: unknown }> = [];
      const inserts: Array<{ table: string; data: unknown }> = [];

      const mockTx = {
        select: () => ({
          from: (table: unknown) => ({
            where: () => {
              if (table === draws) {
                return {
                  for: () => [mockDraw],
                };
              }
              return mockObservations;
            },
          }),
        }),
        update: (table: unknown) => ({
          set: (data: unknown) => {
            updates.push({ table: table === draws ? "draws" : "other", data });
            return {
              where: () => Promise.resolve(),
            };
          },
        }),
        insert: (table: unknown) => ({
          values: (data: unknown) => {
            inserts.push({ table: table === ingestEvents ? "ingest_events" : "other", data });
            return {
              onConflictDoNothing: () => Promise.resolve(),
              returning: () => [{ id: "generated" }],
            };
          },
        }),
        transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx),
      };

      const mockDb = {
        transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx),
      };

      const result = await reconcileDraw(mockDb as never, "d3");
      expect(result.status).toBe("needs_review");
      expect(result.conflict).toBe(true);
      expect(result.diff).toBeDefined();
      expect(result.diffText).toBeDefined();
      expect(updates.some((u) => u.table === "draws" && (u.data as { status: string }).status === "needs_review")).toBe(true);
    });

    it("admin force-publish publishes the draw with audit logging", async () => {
      const mockDraw = {
        id: "d4",
        drawCode: "BT-80",
        drawDate: "2026-11-23",
        status: "needs_review" as const,
        fingerprint: null,
      };

      const mockObs = {
        id: "obs1",
        drawId: "d4",
        source: "onmanorama",
        sourceUrl: "https://onmanorama.com",
        fingerprint: computeDrawFingerprint(baseDraw),
        parsed: baseDraw,
        validation: { ok: true, errors: [] },
      };

      const updates: Array<{ table: string; data: unknown }> = [];
      const inserts: Array<{ table: string; data: unknown }> = [];
      const deletes: Array<{ table: string }> = [];

      const mockTx = {
        query: {
          draws: {
            findFirst: () => Promise.resolve(mockDraw),
          },
          sourceObservations: {
            findFirst: () => Promise.resolve(mockObs),
          },
        },
        select: () => ({
          from: () => ({
            where: () => ({
              for: () => [mockDraw],
            }),
          }),
        }),
        update: (table: unknown) => ({
          set: (data: unknown) => {
            updates.push({ table: table === draws ? "draws" : "other", data });
            return {
              where: () => Promise.resolve(),
            };
          },
        }),
        insert: (table: unknown) => ({
          values: (data: unknown) => {
            inserts.push({ table: table === ingestEvents ? "ingest_events" : "other", data });
            return {
              onConflictDoNothing: () => Promise.resolve(),
            };
          },
        }),
        delete: (table: unknown) => ({
          where: () => {
            deletes.push({ table: table === draws ? "draws" : "other" });
            return Promise.resolve();
          },
        }),
        transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx),
      };

      const mockDb = {
        transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx),
      };

      const result = await forcePublishDraw(
        mockDb as never,
        "BT-80",
        "onmanorama",
        "Admin verified official gazette scan"
      );

      expect(result.status).toBe("published");
      expect(result.published).toBe(true);
      expect(inserts.some((i) => i.table === "ingest_events" && (i.data as { kind: string }).kind === "force_published")).toBe(true);
    });
  });
});
