import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildServer } from "../server.js";
import * as dbModule from "@gacha/db";

describe("GET /health", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should return 200 and status ok when DB is connected", async () => {
    vi.spyOn(dbModule, "checkDbHealth").mockResolvedValue({
      ok: true,
      latencyMs: 3,
    });

    const app = buildServer();
    const res = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe("ok");
    expect(body.db).toBe("connected");
    expect(body.dbLatencyMs).toBe(3);
    expect(body.timestamp).toBeDefined();
  });

  it("should return 503 and status degraded when DB is down", async () => {
    vi.spyOn(dbModule, "checkDbHealth").mockResolvedValue({
      ok: false,
      latencyMs: 50,
      error: "connection refused",
    });

    const app = buildServer();
    const res = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe("degraded");
    expect(body.db).toBe("disconnected");
    expect(body.error).toBe("connection refused");
  });
});
