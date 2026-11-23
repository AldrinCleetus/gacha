import { describe, it, expect, vi, beforeEach } from "vitest";
import { bootWorker } from "../index.js";
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

    const res = await bootWorker();
    expect(res.ready).toBe(true);
    expect(res.dbConnected).toBe(true);
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
  });
});
