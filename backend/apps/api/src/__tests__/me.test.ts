import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildServer } from "../server.js";
import * as dbModule from "@gacha/db";
import * as clerkFastify from "@clerk/fastify";

vi.mock("@clerk/fastify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/fastify")>();
  return {
    ...actual,
    getAuth: vi.fn(),
  };
});

describe("Authenticated User API (/v1/me)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /v1/me returns 401 when unauthenticated", async () => {
    vi.mocked(clerkFastify.getAuth).mockReturnValue({
      userId: null,
    } as ReturnType<typeof clerkFastify.getAuth>);

    const app = buildServer();
    const res = await app.inject({
      method: "GET",
      url: "/v1/me",
    });

    expect(res.statusCode).toBe(401);
  });

  it("GET /v1/me/stats computes user analytics from Postgres rows", async () => {
    vi.mocked(clerkFastify.getAuth).mockReturnValue({
      userId: "user_clerk_test_1",
    } as ReturnType<typeof clerkFastify.getAuth>);

    const orderByMock = vi.fn().mockResolvedValue([
      {
        id: "tkt_1",
        userId: "user_clerk_test_1",
        ticketString: "BB 573685",
        normalizedTicket: "BB573685",
        schemeCode: "BT",
        series: "BB",
        digits: "573685",
        drawCode: "BT-81",
        drawDate: "2026-11-23",
        checkedAt: new Date("2026-11-24T10:00:00Z"),
        cost: 50,
        wonAmount: 5000,
        result: {
          kind: "mid",
          tier: "Consolation Prize",
          amount: 5000,
          formattedAmount: "₹5,000",
          matchedIndices: [2, 3, 4, 5, 6, 7],
          summary: "Consolation prize winner",
        },
      },
      {
        id: "tkt_2",
        userId: "user_clerk_test_1",
        ticketString: "SM 111111",
        normalizedTicket: "SM111111",
        schemeCode: "SM",
        series: "SM",
        digits: "111111",
        drawCode: "SM-82",
        drawDate: "2026-11-22",
        checkedAt: new Date("2026-11-24T11:00:00Z"),
        cost: 50,
        wonAmount: 0,
        result: {
          kind: "none",
          tier: "No Prize",
          amount: 0,
          formattedAmount: "₹0",
          matchedIndices: [],
          summary: "No prize this time",
        },
      },
    ]);

    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: orderByMock,
          })),
        })),
      })),
    };

    vi.spyOn(dbModule, "getDb").mockReturnValue(mockDb as unknown as dbModule.DbClient);

    const app = buildServer();
    const res = await app.inject({
      method: "GET",
      url: "/v1/me/stats",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.totalTickets).toBe(2);
    expect(body.totalSpent).toBe(100);
    expect(body.totalWon).toBe(5000);
    expect(body.netProfitLoss).toBe(4900);
    expect(body.bestWin).toBe(5000);
    expect(body.winRate).toBe(50);
    expect(body.longestDrySpell).toBe(1);
    expect(body.schemeBreakdown.BT.wins).toBe(1);
  });
});
