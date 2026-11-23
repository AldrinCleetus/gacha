import { describe, it, expect, vi, beforeEach } from "vitest";
import { bootWorker } from "../index.js";
import { Scheduler } from "../scheduler.js";
import * as dbModule from "@gacha/db";

describe("Worker boot", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should boot and verify database connection when DB is healthy", async () => {
    vi.spyOn(dbModule, "checkDbHealth").mockResolvedValue({
      ok: true,
      latencyMs: 2,
    });

    const mockScheduler = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    } as unknown as Scheduler;

    const res = await bootWorker(mockScheduler);
    expect(res.ready).toBe(true);
    expect(res.dbConnected).toBe(true);
    expect(res.schedulerStarted).toBe(true);
    expect(mockScheduler.start).toHaveBeenCalled();
  });

  it("should handle initial DB disconnection gracefully", async () => {
    vi.spyOn(dbModule, "checkDbHealth").mockResolvedValue({
      ok: false,
      latencyMs: 10,
      error: "connection timeout",
    });

    const res = await bootWorker();
    expect(res.ready).toBe(true);
    expect(res.dbConnected).toBe(false);
    expect(res.schedulerStarted).toBe(false);
  });
});
