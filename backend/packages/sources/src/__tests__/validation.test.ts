import { describe, expect, it } from "vitest";
import { validateParsedDraw, getWeekdayFromDate } from "../validation.js";
import { ParsedDraw } from "@gacha/shared";

describe("Validation Rules", () => {
  const validDraw: ParsedDraw = {
    source: "onmanorama",
    sourceUrl: "https://www.onmanorama.com/news/kerala/2026/11/22/samrudhi-sm-82.html",
    fetchedAt: "2026-11-22T10:00:00.000Z",
    schemeName: "Samrudhi",
    schemeCode: "SM",
    drawCode: "SM-82",
    drawDate: "2026-11-22", // Sunday
    tiers: [
      { tier: "1", amount: 10000000, matchType: "full", entries: ["MO747323"] },
      { tier: "consolation", amount: 5000, matchType: "consolation", entries: [] },
      { tier: "2", amount: 2500000, matchType: "full", entries: ["MN147266"] },
      { tier: "3", amount: 500000, matchType: "full", entries: ["MZ766542"] },
      { tier: "4", amount: 5000, matchType: "last4", entries: ["0606", "1547"] },
      { tier: "5", amount: 2000, matchType: "last4", entries: ["5323", "5867"] },
      { tier: "6", amount: 1000, matchType: "last4", entries: ["1048", "1080"] },
      { tier: "7", amount: 500, matchType: "last4", entries: ["0219", "0246"] },
      { tier: "8", amount: 200, matchType: "last4", entries: ["0152", "0189"] },
    ],
    raw: { contentHash: "abcdef1234567890" },
  };

  const schemeSM = {
    code: "SM",
    name: "Samrudhi",
    weekday: 7, // Sunday
    structure: {
      expectedTiers: ["1", "consolation", "2", "3", "4", "5", "6", "7", "8"],
    },
  };

  it("calculates weekday correctly (1=Mon ... 7=Sun)", () => {
    expect(getWeekdayFromDate("2026-11-16")).toBe(1); // Monday
    expect(getWeekdayFromDate("2026-11-17")).toBe(2); // Tuesday
    expect(getWeekdayFromDate("2026-11-18")).toBe(3); // Wednesday
    expect(getWeekdayFromDate("2026-11-19")).toBe(4); // Thursday
    expect(getWeekdayFromDate("2026-11-20")).toBe(5); // Friday
    expect(getWeekdayFromDate("2026-11-21")).toBe(6); // Saturday
    expect(getWeekdayFromDate("2026-11-22")).toBe(7); // Sunday
  });

  it("passes validation for a completely valid draw", () => {
    const res = validateParsedDraw(validDraw, schemeSM, ["MO", "MN"]);
    expect(res.ok).toBe(true);
    expect(res.errors).toEqual([]);
  });

  it("detects weekday mismatch", () => {
    const wrongDateDraw: ParsedDraw = {
      ...validDraw,
      drawDate: "2026-11-17", // Tuesday, but SM is Sunday
    };
    const res = validateParsedDraw(wrongDateDraw, schemeSM);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes("Weekday mismatch"))).toBe(true);
  });

  it("detects missing expected tiers", () => {
    const missingTierDraw: ParsedDraw = {
      ...validDraw,
      tiers: validDraw.tiers.filter((t) => t.tier !== "2"),
    };
    const res = validateParsedDraw(missingTierDraw, schemeSM);
    expect(res.ok).toBe(false);
    expect(res.errors).toContain("Missing expected prize tier '2'");
  });

  it("detects invalid ticket numbers in full tier", () => {
    const invalidTicketDraw: ParsedDraw = {
      ...validDraw,
      tiers: validDraw.tiers.map((t) =>
        t.tier === "1" ? { ...t, entries: ["M12345"] } : t
      ),
    };
    const res = validateParsedDraw(invalidTicketDraw, schemeSM);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes("not a valid 8-character ticket"))).toBe(true);
  });

  it("detects invalid ticket numbers in last4 tier", () => {
    const invalidLast4Draw: ParsedDraw = {
      ...validDraw,
      tiers: validDraw.tiers.map((t) =>
        t.tier === "4" ? { ...t, entries: ["123", "9999"] } : t
      ),
    };
    const res = validateParsedDraw(invalidLast4Draw, schemeSM);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes("not a valid 4-digit number"))).toBe(true);
  });

  it("detects non-descending amounts (Tier 2 amount >= Tier 1)", () => {
    const nonDescendingDraw: ParsedDraw = {
      ...validDraw,
      tiers: validDraw.tiers.map((t) =>
        t.tier === "2" ? { ...t, amount: 20000000 } : t // Tier 2 is 2 cr, Tier 1 is 1 cr
      ),
    };
    const res = validateParsedDraw(nonDescendingDraw, schemeSM);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes("Descending amount violation"))).toBe(true);
  });

  it("detects 1st prize series not belonging to known series", () => {
    const unknownSeriesDraw: ParsedDraw = {
      ...validDraw,
      tiers: validDraw.tiers.map((t) =>
        t.tier === "1" ? { ...t, entries: ["ZZ747323"] } : t
      ),
    };
    const res = validateParsedDraw(unknownSeriesDraw, schemeSM, ["MO", "MN", "MZ"]);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes("does not belong to known series"))).toBe(true);
  });
});
