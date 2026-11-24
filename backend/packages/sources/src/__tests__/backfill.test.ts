import { describe, it, expect, vi, beforeEach } from "vitest";
import { runBackfill } from "../backfill.js";
import { onmanoramaAdapter } from "../onmanorama/adapter.js";
import * as ingestModule from "../ingest.js";
import { DbClient } from "@gacha/db";

describe("Historical Draw Backfill", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockDiscovered = [
    {
      schemeCode: "SM",
      drawCode: "SM-82",
      drawDate: "2026-11-20",
      url: "https://example.com/sm-82",
    },
    {
      schemeCode: "BT",
      drawCode: "BT-80",
      drawDate: "2026-11-19",
      url: "https://example.com/bt-80",
    },
  ];

  it("discovers links and ingests missing draws", async () => {
    vi.spyOn(onmanoramaAdapter, "discover").mockResolvedValue(mockDiscovered);

    // Mock DB queries: neither draw exists
    const mockDb = {
      query: {
        draws: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        sourceObservations: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
    };

    const mockIngestResult = {
      drawId: "test-uuid-1",
      drawCode: "SM-82",
      source: "onmanorama",
      observationId: "obs-uuid-1",
      rawObjectKey: "raw/test-key",
      contentHash: "hash-test",
      fingerprint: "fp123",
      validation: { ok: true, errors: [] },
      status: "published" as const,
    };

    vi.spyOn(ingestModule, "ingestObservation").mockResolvedValue(mockIngestResult);

    const summaries = await runBackfill({
      source: "onmanorama",
      limit: 10,
      delayMs: 0,
      db: mockDb as unknown as DbClient,
    });

    expect(summaries).toHaveLength(1);
    const s = summaries[0];
    expect(s.source).toBe("onmanorama");
    expect(s.discovered).toBe(2);
    expect(s.processed).toBe(2);
    expect(s.ingested).toBe(2);
    expect(s.skipped).toBe(0);
    expect(s.failed).toBe(0);
    expect(s.items).toHaveLength(2);
    expect(s.items[0].status).toBe("ingested");
  });

  it("skips existing observations when force is false", async () => {
    vi.spyOn(onmanoramaAdapter, "discover").mockResolvedValue(mockDiscovered);

    // Mock DB queries: first draw and observation already exist
    const mockDb = {
      query: {
        draws: {
          findFirst: vi.fn().mockResolvedValue({ id: "existing-draw-id", drawCode: "SM-82" }),
        },
        sourceObservations: {
          findFirst: vi.fn().mockResolvedValue({ id: "existing-obs-id", source: "onmanorama" }),
        },
      },
    };

    const summaries = await runBackfill({
      source: "onmanorama",
      limit: 10,
      delayMs: 0,
      force: false,
      db: mockDb as unknown as DbClient,
    });

    const s = summaries[0];
    expect(s.processed).toBe(2);
    expect(s.skipped).toBe(2);
    expect(s.ingested).toBe(0);
    expect(s.items[0].status).toBe("skipped_existing");
  });

  it("handles dry-run mode without calling ingestObservation", async () => {
    vi.spyOn(onmanoramaAdapter, "discover").mockResolvedValue(mockDiscovered);

    const mockDb = {
      query: {
        draws: { findFirst: vi.fn().mockResolvedValue(null) },
        sourceObservations: { findFirst: vi.fn().mockResolvedValue(null) },
      },
    };

    const ingestSpy = vi.spyOn(ingestModule, "ingestObservation");

    const summaries = await runBackfill({
      source: "onmanorama",
      limit: 10,
      delayMs: 0,
      dryRun: true,
      db: mockDb as unknown as DbClient,
    });

    const s = summaries[0];
    expect(ingestSpy).not.toHaveBeenCalled();
    expect(s.items[0].status).toBe("dry_run");
  });

  it("respects the limit option", async () => {
    vi.spyOn(onmanoramaAdapter, "discover").mockResolvedValue(mockDiscovered);

    const mockDb = {
      query: {
        draws: { findFirst: vi.fn().mockResolvedValue(null) },
        sourceObservations: { findFirst: vi.fn().mockResolvedValue(null) },
      },
    };

    const summaries = await runBackfill({
      source: "onmanorama",
      limit: 1, // only 1 of 2
      delayMs: 0,
      dryRun: true,
      db: mockDb as unknown as DbClient,
    });

    const s = summaries[0];
    expect(s.discovered).toBe(2);
    expect(s.processed).toBe(1);
    expect(s.items).toHaveLength(1);
  });
});
