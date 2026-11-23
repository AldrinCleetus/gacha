import { describe, it, expect, vi } from "vitest";
import { checkDbHealth } from "../health.js";
import type pg from "pg";

describe("checkDbHealth", () => {
  it("should return ok: true when SELECT 1 succeeds", async () => {
    const mockPool = {
      query: vi.fn().mockResolvedValue({ rows: [{ alive: 1 }] }),
    } as unknown as pg.Pool;

    const res = await checkDbHealth(mockPool);
    expect(res.ok).toBe(true);
    expect(res.latencyMs).toBeGreaterThanOrEqual(0);
    expect(res.error).toBeUndefined();
  });

  it("should return ok: false with error message when query fails", async () => {
    const mockPool = {
      query: vi.fn().mockRejectedValue(new Error("Connection refused")),
    } as unknown as pg.Pool;

    const res = await checkDbHealth(mockPool);
    expect(res.ok).toBe(false);
    expect(res.error).toContain("Connection refused");
  });
});
