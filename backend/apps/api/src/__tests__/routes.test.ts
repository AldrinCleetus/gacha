import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildServer } from "../server.js";
import * as dbModule from "@gacha/db";

describe("Public Read API (/v1)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockDb = {
    query: {
      schemes: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      draws: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
    },
  };

  it("GET /v1/schemes returns scheme list with series and cache headers", async () => {
    vi.spyOn(dbModule, "getDb").mockReturnValue(mockDb as unknown as dbModule.DbClient);
    mockDb.query.schemes.findMany.mockResolvedValue([
      {
        code: "BT",
        name: "Bhagyathara",
        weekday: 1,
        ticketPrice: "50.00",
        isBumper: false,
        structure: null,
        series: [{ series: "WA" }, { series: "WB" }],
      },
      {
        code: "SM",
        name: "Samrudhi",
        weekday: 7,
        ticketPrice: "50.00",
        isBumper: false,
        structure: null,
        series: [{ series: "SA" }],
      },
    ]);

    const app = buildServer();
    const res = await app.inject({
      method: "GET",
      url: "/v1/schemes",
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toContain("public");
    expect(res.headers["cache-control"]).toContain("max-age=300");
    expect(res.headers["etag"]).toBeDefined();

    const body = JSON.parse(res.payload);
    expect(body.schemes).toHaveLength(2);
    expect(body.schemes[0]).toEqual({
      code: "BT",
      name: "Bhagyathara",
      weekday: 1,
      ticketPrice: 50,
      isBumper: false,
      series: ["WA", "WB"],
      structure: null,
    });
  });

  it("GET /v1/draws returns list of published draws with firstPrize and pagination", async () => {
    vi.spyOn(dbModule, "getDb").mockReturnValue(mockDb as unknown as dbModule.DbClient);
    mockDb.query.draws.findMany.mockResolvedValue([
      {
        id: "draw-uuid-1",
        schemeCode: "SM",
        drawCode: "SM-82",
        drawDate: "2026-11-22",
        status: "published",
        publishedAt: new Date("2026-11-22T12:00:00Z"),
        fingerprint: "hash123",
        scheme: { name: "Samrudhi" },
        tiers: [{ tier: "1", amount: 10000000 }],
        entries: [{ tier: "1", entry: "SA123456" }],
      },
    ]);

    const app = buildServer();
    const res = await app.inject({
      method: "GET",
      url: "/v1/draws?limit=10&offset=0&scheme=SM&q=SM",
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toContain("max-age=60");

    const body = JSON.parse(res.payload);
    expect(body.draws).toHaveLength(1);
    expect(body.draws[0].drawCode).toBe("SM-82");
    expect(body.draws[0].schemeName).toBe("Samrudhi");
    expect(body.draws[0].firstPrize).toEqual({
      ticket: "SA123456",
      amount: 10000000,
    });
    expect(body.limit).toBe(10);
    expect(body.offset).toBe(0);
    expect(body.total).toBe(1);
    expect(body.hasMore).toBe(false);
  });

  it("GET /v1/draws/latest returns 404 when no published draw found", async () => {
    vi.spyOn(dbModule, "getDb").mockReturnValue(mockDb as unknown as dbModule.DbClient);
    mockDb.query.draws.findFirst.mockResolvedValue(null);

    const app = buildServer();
    const res = await app.inject({
      method: "GET",
      url: "/v1/draws/latest?scheme=UNKNOWN",
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.message).toContain("No published draw found");
  });

  it("GET /v1/draws/:id returns full draw with immutable cache header", async () => {
    vi.spyOn(dbModule, "getDb").mockReturnValue(mockDb as unknown as dbModule.DbClient);
    mockDb.query.draws.findFirst.mockResolvedValue({
      id: "draw-uuid-1",
      schemeCode: "SM",
      drawCode: "SM-82",
      drawDate: "2026-11-22",
      status: "published",
      publishedAt: new Date("2026-11-22T12:00:00Z"),
      fingerprint: "fingerprint-abc",
      scheme: { name: "Samrudhi" },
      tiers: [
        { tier: "1", amount: 10000000, matchType: "full" },
        { tier: "consolation", amount: 5000, matchType: "consolation" },
      ],
      entries: [
        { tier: "1", entry: "SA123456" },
        { tier: "consolation", entry: "123456" },
      ],
      agencies: [
        {
          tier: "1",
          ticket: "SA123456",
          agencyName: "Kairali Agencies",
          agencyCode: "K123",
          place: "Ernakulam",
          source: "onmanorama",
        },
      ],
    });

    const app = buildServer();
    const res = await app.inject({
      method: "GET",
      url: "/v1/draws/SM-82",
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(res.headers["etag"]).toBeDefined();

    const body = JSON.parse(res.payload);
    expect(body.drawCode).toBe("SM-82");
    expect(body.tiers).toHaveLength(2);
    expect(body.tiers[0].entries).toEqual(["SA123456"]);
    expect(body.agencies).toHaveLength(1);
    expect(body.agencies[0].agencyName).toBe("Kairali Agencies");
  });

  it("POST /v1/draws/:id/check verifies ticket jackpot win", async () => {
    vi.spyOn(dbModule, "getDb").mockReturnValue(mockDb as unknown as dbModule.DbClient);
    mockDb.query.draws.findFirst.mockResolvedValue({
      id: "draw-uuid-1",
      schemeCode: "SM",
      drawCode: "SM-82",
      drawDate: "2026-11-22",
      status: "published",
      scheme: { name: "Samrudhi" },
      tiers: [
        { tier: "1", amount: 10000000, matchType: "full" },
        { tier: "consolation", amount: 5000, matchType: "consolation" },
      ],
      entries: [
        { tier: "1", entry: "SA123456" },
        { tier: "consolation", entry: "123456" },
      ],
    });

    const app = buildServer();
    const res = await app.inject({
      method: "POST",
      url: "/v1/draws/SM-82/check",
      payload: {
        ticket: "SA 123456",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("private, no-cache");

    const body = JSON.parse(res.payload);
    expect(body.kind).toBe("jackpot");
    expect(body.tier).toBe("1st Prize");
    expect(body.amount).toBe(10000000);
    expect(body.matchedIndices).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("POST /v1/draws/:id/check verifies ticket consolation win", async () => {
    vi.spyOn(dbModule, "getDb").mockReturnValue(mockDb as unknown as dbModule.DbClient);
    mockDb.query.draws.findFirst.mockResolvedValue({
      id: "draw-uuid-1",
      schemeCode: "SM",
      drawCode: "SM-82",
      drawDate: "2026-11-22",
      status: "published",
      scheme: { name: "Samrudhi" },
      tiers: [
        { tier: "1", amount: 10000000, matchType: "full" },
        { tier: "consolation", amount: 5000, matchType: "consolation" },
      ],
      entries: [
        { tier: "1", entry: "SA123456" },
        { tier: "consolation", entry: "123456" },
      ],
    });

    const app = buildServer();
    const res = await app.inject({
      method: "POST",
      url: "/v1/draws/SM-82/check",
      payload: {
        ticket: "SB 123456",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.kind).toBe("mid");
    expect(body.tier).toBe("Consolation Prize");
    expect(body.amount).toBe(5000);
  });

  it("GET /v1/draws/status returns expected state for today", async () => {
    vi.spyOn(dbModule, "getDb").mockReturnValue(mockDb as unknown as dbModule.DbClient);
    mockDb.query.schemes.findFirst.mockResolvedValue({
      code: "BT",
      name: "Bhagyathara",
      weekday: 1,
    });
    mockDb.query.draws.findFirst.mockResolvedValue(null);

    const app = buildServer();
    const res = await app.inject({
      method: "GET",
      url: "/v1/draws/status?date=2026-11-23",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.date).toBe("2026-11-23");
    expect(body.weekday).toBe(1);
    expect(body.status).toBe("expected");
    expect(body.isOut).toBe(false);
    expect(body.scheduledScheme?.code).toBe("BT");
    expect(body.scheduledTime).toBe("15:00 IST");
  });

  it("GET /docs/json returns valid OpenAPI specification", async () => {
    const app = buildServer();
    await app.ready();
    const res = await app.inject({
      method: "GET",
      url: "/docs/json",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.openapi).toBeDefined();
    expect(body.info.title).toBe("gacha API");
    expect(body.paths["/v1/schemes"]).toBeDefined();
    expect(body.paths["/v1/draws"]).toBeDefined();
    expect(body.paths["/v1/draws/latest"]).toBeDefined();
    expect(body.paths["/v1/draws/{id}"]).toBeDefined();
    expect(body.paths["/v1/draws/{id}/check"]).toBeDefined();
    expect(body.paths["/v1/draws/status"]).toBeDefined();
  });
});
