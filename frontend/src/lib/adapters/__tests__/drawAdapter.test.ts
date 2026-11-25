import { describe, it, expect } from "vitest";
import { toFrontendDraw, toFrontendDrawListItem, BackendFullDraw } from "../drawAdapter";

describe("drawAdapter", () => {
  it("converts a published backend full draw into the frontend Draw structure", () => {
    const backendDraw: BackendFullDraw = {
      id: "uuid-sm-82",
      schemeCode: "SM",
      schemeName: "Samrudhi",
      drawCode: "SM-82",
      drawDate: "2026-11-22",
      status: "published",
      publishedAt: "2026-11-24T00:00:00Z",
      tiers: [
        {
          tier: "1",
          amount: 10000000,
          matchType: "full",
          entries: ["SM123456"],
        },
        {
          tier: "consolation",
          amount: 5000,
          matchType: "consolation",
          entries: ["SA123456", "SB123456"],
        },
        {
          tier: "2",
          amount: 2500000,
          matchType: "full",
          entries: ["SM654321"],
        },
        {
          tier: "3",
          amount: 100000,
          matchType: "full",
          entries: ["112233", "445566"],
        },
        {
          tier: "4",
          amount: 5000,
          matchType: "last4",
          entries: ["1234", "5678"],
        },
      ],
      agencies: [
        {
          tier: "1",
          ticket: "SM123456",
          agencyName: "Kairali Lottery Agency",
          agencyCode: "K-1234",
          place: "Kottayam",
          source: "official",
        },
      ],
    };

    const frontend = toFrontendDraw(backendDraw);

    expect(frontend.id).toBe("SM-82");
    expect(frontend.schemeCode).toBe("SM");
    expect(frontend.drawNumber).toBe(82);
    expect(frontend.drawDate).toBe("2026-11-22");
    expect(frontend.isPublished).toBe(true);

    expect(frontend.prizes).toBeDefined();
    expect(frontend.prizes?.firstPrize).toEqual({
      series: "SM",
      number: "123456",
      amount: 10000000,
    });
    expect(frontend.prizes?.consolationPrize).toEqual({
      amount: 5000,
    });
    expect(frontend.prizes?.secondPrize).toEqual({
      number: "SM654321",
      amount: 2500000,
    });
    expect(frontend.prizes?.thirdPrize).toEqual({
      numbers: ["112233", "445566"],
      amount: 100000,
    });
    expect(frontend.prizes?.last4Prizes).toHaveLength(1);
    expect(frontend.prizes?.last4Prizes[0]).toEqual({
      tier: "4th Prize",
      numbers: ["1234", "5678"],
      amount: 5000,
    });

    expect(frontend.agencies).toHaveLength(1);
    expect(frontend.agencies?.[0].agencyName).toBe("Kairali Lottery Agency");
    expect(frontend.agencies?.[0].place).toBe("Kottayam");
  });

  it("handles unpublished/expected draws with empty tiers gracefully", () => {
    const unpublished: BackendFullDraw = {
      id: "uuid-bt-80",
      schemeCode: "BT",
      schemeName: "Bhagyathara",
      drawCode: "BT-80",
      drawDate: "2026-11-23",
      status: "expected",
      publishedAt: null,
      tiers: [],
    };

    const frontend = toFrontendDraw(unpublished);

    expect(frontend.id).toBe("BT-80");
    expect(frontend.drawNumber).toBe(80);
    expect(frontend.isPublished).toBe(false);
    expect(frontend.prizes).toBeUndefined();
  });

  it("converts a backend draw list item into a minimal frontend Draw", () => {
    const listItem = {
      id: "uuid-kr-777",
      schemeCode: "KR",
      schemeName: "Karunya",
      drawCode: "KR-777",
      drawDate: "2026-11-21",
      status: "published",
      publishedAt: "2026-11-21T18:00:00Z",
      firstPrize: {
        ticket: "KA445566",
        amount: 8000000,
      },
    };

    const frontend = toFrontendDrawListItem(listItem);

    expect(frontend.id).toBe("KR-777");
    expect(frontend.schemeCode).toBe("KR");
    expect(frontend.drawNumber).toBe(777);
    expect(frontend.drawDate).toBe("2026-11-21");
    expect(frontend.isPublished).toBe(true);
    expect(frontend.prizes).toBeUndefined();
    expect(frontend.headlinePrize).toEqual({
      series: "KA",
      number: "445566",
      amount: 8000000,
    });
  });
});
