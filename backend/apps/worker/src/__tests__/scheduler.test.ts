import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeClock } from "@gacha/shared";
import { DbClient } from "@gacha/db";
import { PgBoss } from "pg-boss";
import { getPollingWindowInfo } from "../pollingWindow.js";
import { ensureExpectedDraw } from "../expectedDraw.js";
import { pollSourceForDraw } from "../poller.js";
import { runNightlyReconcile } from "../reconcile.js";
import { Scheduler, QUEUES } from "../scheduler.js";

describe("F7 Scheduler & Polling Engine", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Polling Windows in IST", () => {
    it("identifies before-window phase (e.g. 10:00 AM IST)", () => {
      // 10:00 AM IST = 04:30 UTC
      const date = new Date("2026-11-23T04:30:00.000Z");
      const info = getPollingWindowInfo(date);

      expect(info.phase).toBe("before_window");
      expect(info.intervalMinutes).toBeNull();
      expect(info.hoursIST).toBe(10);
      expect(info.minutesIST).toBe(0);
      expect(info.shouldAlert).toBe(false);
    });

    it("identifies peak live window (15:00 - 17:30 IST, every 2 mins)", () => {
      // 15:15 IST = 09:45 UTC
      const date = new Date("2026-11-23T09:45:00.000Z");
      const info = getPollingWindowInfo(date);

      expect(info.phase).toBe("peak");
      expect(info.intervalMinutes).toBe(2);
      expect(info.hoursIST).toBe(15);
      expect(info.minutesIST).toBe(15);
      expect(info.shouldAlert).toBe(false);
    });

    it("identifies evening window (17:30 - 21:00 IST, every 10 mins)", () => {
      // 18:00 IST = 12:30 UTC
      const date = new Date("2026-11-23T12:30:00.000Z");
      const info = getPollingWindowInfo(date);

      expect(info.phase).toBe("evening");
      expect(info.intervalMinutes).toBe(10);
      expect(info.hoursIST).toBe(18);
      expect(info.minutesIST).toBe(0);
      expect(info.shouldAlert).toBe(false);
    });

    it("triggers alert threshold past 18:30 IST (6:30 PM) per Section 9", () => {
      // 18:45 IST = 13:15 UTC
      const date = new Date("2026-11-23T13:15:00.000Z");
      const info = getPollingWindowInfo(date);

      expect(info.phase).toBe("evening");
      expect(info.shouldAlert).toBe(true);
    });

    it("identifies night window (21:00 - 06:00 IST, every 60 mins)", () => {
      // 22:00 IST = 16:30 UTC
      const date = new Date("2026-11-23T16:30:00.000Z");
      const info = getPollingWindowInfo(date);

      expect(info.phase).toBe("night");
      expect(info.intervalMinutes).toBe(60);
      expect(info.hoursIST).toBe(22);
      expect(info.shouldAlert).toBe(true);
    });
  });

  describe("Expected Draw Creation from Weekday Schedule", () => {
    it("creates expected draw for today's scheme if not present", async () => {
      const mockDb = {
        query: {
          schemes: {
            findFirst: vi.fn().mockResolvedValue({
              code: "BT",
              name: "Bhagyathara",
              weekday: 1,
              isBumper: false,
            }),
          },
          draws: {
            findFirst: vi.fn().mockResolvedValue(null),
            findMany: vi.fn().mockResolvedValue([
              { drawCode: "BT-80", drawDate: "2026-11-16" },
            ]),
          },
        },
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoNothing: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: "new-draw-uuid", status: "expected" }]),
            }),
          }),
        }),
      } as unknown as DbClient;

      const clock = new FakeClock("2026-11-23T15:00:00+05:30"); // Monday
      const result = await ensureExpectedDraw(mockDb, "2026-11-23", clock);

      expect(result).not.toBeNull();
      expect(result?.created).toBe(true);
      expect(result?.schemeCode).toBe("BT");
      expect(result?.drawCode).toBe("BT-81"); // Incremented from BT-80
      expect(result?.status).toBe("expected");
    });

    it("returns existing draw if already created", async () => {
      const mockDb = {
        query: {
          schemes: {
            findFirst: vi.fn().mockResolvedValue({
              code: "BT",
              name: "Bhagyathara",
              weekday: 1,
              isBumper: false,
            }),
          },
          draws: {
            findFirst: vi.fn().mockResolvedValue({
              id: "existing-uuid",
              schemeCode: "BT",
              drawCode: "BT-81",
              drawDate: "2026-11-23",
              status: "published",
            }),
          },
        },
      } as unknown as DbClient;

      const clock = new FakeClock("2026-11-23T15:00:00+05:30");
      const result = await ensureExpectedDraw(mockDb, "2026-11-23", clock);

      expect(result).not.toBeNull();
      expect(result?.created).toBe(false);
      expect(result?.drawCode).toBe("BT-81");
      expect(result?.status).toBe("published");
    });
  });

  describe("Single-Flight Poller Rules", () => {
    it("skips polling when draw is already published", async () => {
      const mockDb = {
        query: {
          draws: {
            findFirst: vi.fn().mockResolvedValue({
              id: "draw-uuid",
              drawCode: "SM-82",
              status: "published",
            }),
          },
        },
      } as unknown as DbClient;

      const result = await pollSourceForDraw({ drawCode: "SM-82" }, mockDb);
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe("draw_already_published");
      expect(result.published).toBe(true);
    });

    it("skips polling when source has already been observed for this draw", async () => {
      const mockDb = {
        query: {
          draws: {
            findFirst: vi.fn().mockResolvedValue({
              id: "draw-uuid",
              drawCode: "SM-82",
              status: "observed",
            }),
          },
          sourceObservations: {
            findFirst: vi.fn().mockResolvedValue({
              id: "obs-uuid",
              parsed: { tiers: [] },
            }),
          },
        },
      } as unknown as DbClient;

      const result = await pollSourceForDraw({ drawCode: "SM-82", source: "onmanorama" }, mockDb);
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe("source_already_observed");
    });
  });

  describe("Nightly Reconcile Stub", () => {
    it("re-checks draws from the last 7 days and records audit event", async () => {
      const mockDb = {
        query: {
          draws: {
            findMany: vi.fn().mockResolvedValue([
              {
                id: "d1",
                drawCode: "SM-82",
                drawDate: "2026-11-22",
                status: "published",
                fingerprint: "fp1",
                observations: [{}],
              },
              {
                id: "d2",
                drawCode: "KR-777",
                drawDate: "2026-11-21",
                status: "needs_review",
                fingerprint: null,
                observations: [{}],
              },
            ]),
          },
        },
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      } as unknown as DbClient;

      const clock = new FakeClock("2026-11-23T02:00:00+05:30");
      const result = await runNightlyReconcile(mockDb, clock);

      expect(result.checkedDrawsCount).toBe(2);
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0]).toContain("KR-777");
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe("Scheduler Lifecycle & Clock Fast-Forward", () => {
    it("does not dispatch poll when fake clock is outside active window (e.g. 10:00 AM)", async () => {
      const mockBoss = {
        send: vi.fn(),
      } as unknown as PgBoss;
      const mockDb = {
        query: {
          schemes: { findFirst: vi.fn().mockResolvedValue(null) },
          draws: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
        },
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoNothing: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
          }),
        }),
      } as unknown as DbClient;

      const fakeClock = new FakeClock("2026-11-23T10:00:00+05:30");
      const scheduler = new Scheduler({
        boss: mockBoss,
        db: mockDb,
        clock: fakeClock,
      });

      const cycle = await scheduler.runPollCycleOnce();
      expect(cycle.window.phase).toBe("before_window");
      expect(cycle.dispatched).toBe(false);
      expect(mockBoss.send).not.toHaveBeenCalled();
    });

    it("dispatches single-flight job when fast-forwarding clock to 15:30 IST", async () => {
      const mockBoss = {
        send: vi.fn().mockResolvedValue("job-123"),
      } as unknown as PgBoss;
      const mockDb = {
        query: {
          schemes: {
            findFirst: vi.fn().mockResolvedValue({
              code: "BT",
              name: "Bhagyathara",
              weekday: 1,
              isBumper: false,
            }),
          },
          draws: {
            findFirst: vi.fn().mockResolvedValue({
              id: "draw-bt-81",
              drawCode: "BT-81",
              schemeCode: "BT",
              drawDate: "2026-11-23",
              status: "expected",
            }),
          },
        },
      } as unknown as DbClient;

      const fakeClock = new FakeClock("2026-11-23T15:30:00+05:30"); // Monday 3:30 PM IST
      const scheduler = new Scheduler({
        boss: mockBoss,
        db: mockDb,
        clock: fakeClock,
      });

      const cycle = await scheduler.runPollCycleOnce();
      expect(cycle.window.phase).toBe("peak");
      expect(cycle.dispatched).toBe(true);
      expect(cycle.jobId).toBe("job-123");
      expect(mockBoss.send).toHaveBeenCalledWith(
        QUEUES.POLL_SOURCE_DRAW,
        {
          source: "onmanorama",
          drawCode: "BT-81",
          drawId: "draw-bt-81",
        },
        {
          singletonKey: "onmanorama:BT-81",
        }
      );
    });
  });
});
