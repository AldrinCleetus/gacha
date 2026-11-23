import { describe, it, expect } from "vitest";
import { parseTicket } from "../parser.js";
import { checkTicket } from "../checkTicket.js";
import { formatINR } from "../format.js";
import { ParsedDraw } from "../schemas.js";

const sampleParsedDraw: ParsedDraw = {
  source: "official",
  sourceUrl: "https://statelottery.kerala.gov.in/results/KR-777.pdf",
  fetchedAt: "2026-11-21T11:30:00.000Z",
  schemeName: "Karunya",
  schemeCode: "KR",
  drawCode: "KR-777",
  drawDate: "2026-11-21",
  tiers: [
    {
      tier: "1",
      amount: 8000000,
      matchType: "full",
      entries: ["WA584920"],
    },
    {
      tier: "consolation",
      amount: 8000,
      matchType: "consolation",
      entries: [],
    },
    {
      tier: "2",
      amount: 500000,
      matchType: "full",
      entries: ["WB743219"],
    },
    {
      tier: "7",
      amount: 5000,
      matchType: "last4",
      entries: ["4920", "8371", "2910"],
    },
    {
      tier: "8",
      amount: 1000,
      matchType: "last4",
      entries: ["3391", "6724"],
    },
  ],
  agents: [
    {
      tier: "1",
      ticket: "WA584920",
      agencyName: "A-One Lucky Centre",
      place: "Thrissur",
    },
  ],
  raw: {
    contentHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  },
};

describe("formatINR", () => {
  it("should format 0 as ₹0", () => {
    expect(formatINR(0)).toBe("₹0");
  });

  it("should format amounts in Indian number format", () => {
    expect(formatINR(8000000)).toMatch(/₹\s?80,00,000/);
    expect(formatINR(5000)).toMatch(/₹\s?5,000/);
    expect(formatINR(8000)).toMatch(/₹\s?8,000/);
  });
});

describe("parseTicket", () => {
  it("should accept standard format 'AB 123456'", () => {
    const parsed = parseTicket("AB 123456");
    expect(parsed.isValid).toBe(true);
    expect(parsed.schemeCode).toBe("A");
    expect(parsed.seriesChar).toBe("B");
    expect(parsed.series).toBe("AB");
    expect(parsed.digits).toBe("123456");
    expect(parsed.fullTicketString).toBe("AB 123456");
    expect(parsed.characters).toEqual(["A", "B", "1", "2", "3", "4", "5", "6"]);
  });

  it("should accept compact format 'AB123456'", () => {
    const parsed = parseTicket("AB123456");
    expect(parsed.isValid).toBe(true);
    expect(parsed.series).toBe("AB");
    expect(parsed.digits).toBe("123456");
    expect(parsed.fullTicketString).toBe("AB 123456");
  });

  it("should accept hyphenated lowercase 'ab-123456'", () => {
    const parsed = parseTicket("ab-123456");
    expect(parsed.isValid).toBe(true);
    expect(parsed.series).toBe("AB");
    expect(parsed.digits).toBe("123456");
  });

  it("should accept scattered spaces and punctuation '  w a - 5 8 4 9 2 0 '", () => {
    const parsed = parseTicket("  w a - 5 8 4 9 2 0 ");
    expect(parsed.isValid).toBe(true);
    expect(parsed.series).toBe("WA");
    expect(parsed.digits).toBe("584920");
  });

  it("should reject incomplete tickets", () => {
    const parsed = parseTicket("WA 123");
    expect(parsed.isValid).toBe(false);
    expect(parsed.error).toContain("Incomplete ticket");
  });

  it("should reject tickets exceeding 8 characters", () => {
    const parsed = parseTicket("WA 1234567");
    expect(parsed.isValid).toBe(false);
    expect(parsed.error).toContain("cannot exceed 8 characters");
  });

  it("should reject numbers in series portion", () => {
    const parsed = parseTicket("12 123456");
    expect(parsed.isValid).toBe(false);
    expect(parsed.error).toContain("First two characters must be series letters");
  });

  it("should reject letters in digit portion", () => {
    const parsed = parseTicket("WA 12345X");
    expect(parsed.isValid).toBe(false);
    expect(parsed.error).toContain("Last 6 characters must be numeric digits");
  });

  it("should handle empty string", () => {
    const parsed = parseTicket("");
    expect(parsed.isValid).toBe(false);
    expect(parsed.error).toBe("Ticket number is empty");
  });
});

describe("checkTicket", () => {
  it("should award 1st prize (jackpot) on full series and 6 digits match", () => {
    const result = checkTicket("WA 584920", sampleParsedDraw);
    expect(result.kind).toBe("jackpot");
    expect(result.amount).toBe(8000000);
    expect(result.tier).toBe("1st Prize");
    expect(result.matchedIndices).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(result.summary).toContain("1st prize winner");
  });

  it("should award Consolation Prize on same 6 digits but different series", () => {
    const result = checkTicket("WB 584920", sampleParsedDraw);
    expect(result.kind).toBe("mid");
    expect(result.amount).toBe(8000);
    expect(result.tier).toBe("Consolation Prize");
    expect(result.matchedIndices).toEqual([2, 3, 4, 5, 6, 7]);
    expect(result.closestMatch).toBe("Same number as the 1st prize, different series");
  });

  it("should award 2nd prize on matching 2nd prize entry", () => {
    const result = checkTicket("WB 743219", sampleParsedDraw);
    expect(result.kind).toBe("mid");
    expect(result.amount).toBe(500000);
    expect(result.tier).toBe("2nd Prize");
    expect(result.matchedIndices).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("should award Last-4 prize on matching last 4 digits", () => {
    // 4920 is in tier 7 list
    const result = checkTicket("KL 114920", sampleParsedDraw);
    expect(result.kind).toBe("mid");
    expect(result.amount).toBe(5000);
    expect(result.tier).toContain("7th Prize");
    expect(result.matchedIndices).toEqual([4, 5, 6, 7]);
  });

  it("should award smaller Last-4 prize (tier 8)", () => {
    // 3391 is in tier 8 list
    const result = checkTicket("ZZ 993391", sampleParsedDraw);
    expect(result.kind).toBe("small");
    expect(result.amount).toBe(1000);
    expect(result.tier).toContain("8th Prize");
    expect(result.matchedIndices).toEqual([4, 5, 6, 7]);
  });

  it("should calculate truthful near-miss when 5 of 6 digits match 1st prize", () => {
    // 584921 matches 5 of 6 digits with 1st prize (584920)
    const result = checkTicket("WA 584921", sampleParsedDraw);
    expect(result.kind).toBe("none");
    expect(result.amount).toBe(0);
    expect(result.closestMatch).toContain("Matched 5 of the 6 digits of the 1st prize (584920)");
  });

  it("should calculate truthful near-miss when off by one digit on drawn last-4", () => {
    // 4921 is off by 1 digit from drawn 4920
    const result = checkTicket("ZZ 004921", sampleParsedDraw);
    expect(result.kind).toBe("none");
    expect(result.closestMatch).toContain("Off by one digit from drawn number 4920");
  });

  it("should indicate same series when only series matches 1st prize", () => {
    const result = checkTicket("WA 000000", sampleParsedDraw);
    expect(result.kind).toBe("none");
    expect(result.closestMatch).toContain("Same series (WA) as the 1st prize winner");
  });

  it("should report calm pending status if draw is unpublished", () => {
    const result = checkTicket("WA 584920", { isPublished: false, tiers: [] });
    expect(result.kind).toBe("none");
    expect(result.tier).toBe("Results Pending");
    expect(result.summary).toContain("not published yet");
  });

  it("should support demo forced outcomes", () => {
    const forcedJackpot = checkTicket("WA 000000", sampleParsedDraw, "jackpot");
    expect(forcedJackpot.kind).toBe("jackpot");
    expect(forcedJackpot.matchedIndices).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);

    const forcedMid = checkTicket("WA 000000", sampleParsedDraw, "mid");
    expect(forcedMid.kind).toBe("mid");
    expect(forcedMid.tier).toBe("Consolation Prize");

    const forcedSmall = checkTicket("WA 000000", sampleParsedDraw, "small");
    expect(forcedSmall.kind).toBe("small");

    const forcedNone = checkTicket("WA 584920", sampleParsedDraw, "none");
    expect(forcedNone.kind).toBe("none");
    expect(forcedNone.amount).toBe(0);
  });
});
