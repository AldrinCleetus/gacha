import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkSystemAlerts } from "../alerts.js";
import { FakeClock } from "@gacha/shared";
import { DbClient } from "@gacha/db";

describe("System Alerts Engine", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("reports ok: true when all systems are healthy", async () => {
    // 14:00 IST (before draw time, no alerts expected)
    const clock = new FakeClock(new Date("2026-11-23T08:30:00Z")); // 14:00 IST

    const mockDb = {
      query: {
        draws: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
        },
        sourceObservations: {
          findFirst: vi.fn().mockResolvedValue({
            source: "onmanorama",
            fetchedAt: new Date(),
            validation: { ok: true, errors: [] },
          }),
        },
        ingestEvents: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      }),
    };

    const res = await checkSystemAlerts({
      db: mockDb as unknown as DbClient,
      clock,
      recordEvents: false,
    });

    expect(res.ok).toBe(true);
    expect(res.alertCount).toBe(0);
    expect(res.activeAlerts).toHaveLength(0);
  });

  it("triggers UNPUBLISHED_PAST_630PM alert when draw is unpublished past 6:30 PM IST", async () => {
    // 19:00 IST (13:30 UTC)
    const clock = new FakeClock(new Date("2026-11-23T13:30:00Z"));

    const mockDb = {
      query: {
        draws: {
          findFirst: vi.fn().mockResolvedValue({
            id: "draw-uuid-1",
            drawCode: "BT-80",
            drawDate: "2026-11-23",
            status: "expected",
          }),
          findMany: vi.fn().mockResolvedValue([]),
        },
        sourceObservations: {
          findFirst: vi.fn().mockResolvedValue({
            source: "onmanorama",
            fetchedAt: new Date(),
            validation: { ok: true, errors: [] },
          }),
        },
        ingestEvents: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      }),
    };

    const res = await checkSystemAlerts({
      db: mockDb as unknown as DbClient,
      clock,
      recordEvents: false,
    });

    expect(res.ok).toBe(false);
    expect(res.alertCount).toBe(1);
    const alert = res.activeAlerts[0];
    expect(alert.kind).toBe("UNPUBLISHED_PAST_630PM");
    expect(alert.severity).toBe("critical");
    expect(alert.drawCode).toBe("BT-80");
    expect(alert.message).toContain("6:30 PM IST threshold");
  });

  it("triggers DRAWS_NEEDING_REVIEW alert when a draw is in needs_review state", async () => {
    const clock = new FakeClock(new Date("2026-11-23T08:30:00Z"));

    const mockDb = {
      query: {
        draws: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([
            {
              id: "review-draw-1",
              drawCode: "SM-82",
              drawDate: "2026-11-20",
              status: "needs_review",
              schemeCode: "SM",
            },
          ]),
        },
        sourceObservations: {
          findFirst: vi.fn().mockResolvedValue({
            source: "onmanorama",
            fetchedAt: new Date(),
            validation: { ok: true, errors: [] },
          }),
        },
        ingestEvents: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      }),
    };

    const res = await checkSystemAlerts({
      db: mockDb as unknown as DbClient,
      clock,
      recordEvents: false,
    });

    expect(res.ok).toBe(false);
    const alert = res.activeAlerts.find((a) => a.kind === "DRAWS_NEEDING_REVIEW");
    expect(alert).toBeDefined();
    expect(alert?.severity).toBe("warning");
    expect(alert?.drawCode).toBe("SM-82");
  });

  it("triggers DEGRADED_SOURCES alert when an active source observation failed validation", async () => {
    const clock = new FakeClock(new Date("2026-11-23T08:30:00Z"));

    const mockDb = {
      query: {
        draws: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
        },
        sourceObservations: {
          findFirst: vi.fn().mockImplementation((_options) => {
            return Promise.resolve({
              source: "onmanorama",
              fetchedAt: new Date(),
              sourceUrl: "https://example.com/bad",
              validation: { ok: false, errors: ["Tier 1 entries missing"] },
            });
          }),
        },
        ingestEvents: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      }),
    };

    const res = await checkSystemAlerts({
      db: mockDb as unknown as DbClient,
      clock,
      recordEvents: false,
    });

    expect(res.ok).toBe(false);
    const alert = res.activeAlerts.find((a) => a.kind === "DEGRADED_SOURCES");
    expect(alert).toBeDefined();
    expect(alert?.source).toBe("onmanorama");
    expect(alert?.message).toContain("degraded");
  });

  it("records alert in ingest_events table when recordEvents is true", async () => {
    const clock = new FakeClock(new Date("2026-11-23T08:30:00Z"));
    const insertValuesSpy = vi.fn().mockResolvedValue([]);

    const mockDb = {
      query: {
        draws: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([
            {
              id: "review-draw-1",
              drawCode: "SM-82",
              drawDate: "2026-11-20",
              status: "needs_review",
              schemeCode: "SM",
            },
          ]),
        },
        sourceObservations: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        ingestEvents: {
          findFirst: vi.fn().mockResolvedValue(null), // no previous log
        },
      },
      insert: vi.fn().mockReturnValue({
        values: insertValuesSpy,
      }),
    };

    await checkSystemAlerts({
      db: mockDb as unknown as DbClient,
      clock,
      recordEvents: true,
    });

    expect(insertValuesSpy).toHaveBeenCalled();
    const insertedArg = insertValuesSpy.mock.calls[0][0];
    expect(insertedArg.kind).toBe("alert_triggered");
    expect(insertedArg.detail.kind).toBe("DRAWS_NEEDING_REVIEW");
  });
});
