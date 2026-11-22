import { describe, it, expect } from "vitest";
import { parseTicket } from "../parser";
import { checkTicket } from "../checkTicket";
import { Draw } from "@/types";

const mockDraw: Draw = {
  id: "W-790",
  schemeCode: "W",
  drawNumber: 790,
  drawDate: "2026-11-21",
  isPublished: true,
  prizes: {
    firstPrize: {
      series: "WA",
      number: "584920",
      amount: 7500000,
    },
    consolationPrize: {
      amount: 8000,
    },
    secondPrize: {
      number: "743219",
      amount: 500000,
    },
    last4Prizes: [
      {
        tier: "7th Prize",
        numbers: ["4920", "8371", "2910"],
        amount: 5000,
      },
      {
        tier: "8th Prize",
        numbers: ["3391", "6724"],
        amount: 1000,
      },
    ],
  },
};

const unpublishedDraw: Draw = {
  id: "SS-451",
  schemeCode: "S",
  drawNumber: 451,
  drawDate: "2026-11-22",
  isPublished: false,
};

describe("parseTicket", () => {
  it("should parse standard space format 'AB 123456'", () => {
    const parsed = parseTicket("AB 123456");
    expect(parsed.isValid).toBe(true);
    expect(parsed.schemeCode).toBe("A");
    expect(parsed.seriesChar).toBe("B");
    expect(parsed.series).toBe("AB");
    expect(parsed.digits).toBe("123456");
    expect(parsed.fullTicketString).toBe("AB 123456");
    expect(parsed.characters).toEqual(["A", "B", "1", "2", "3", "4", "5", "6"]);
  });

  it("should parse compact format 'AB123456'", () => {
    const parsed = parseTicket("AB123456");
    expect(parsed.isValid).toBe(true);
    expect(parsed.series).toBe("AB");
    expect(parsed.digits).toBe("123456");
    expect(parsed.fullTicketString).toBe("AB 123456");
  });

  it("should parse hyphenated lowercase 'ab-123456'", () => {
    const parsed = parseTicket("ab-123456");
    expect(parsed.isValid).toBe(true);
    expect(parsed.series).toBe("AB");
    expect(parsed.digits).toBe("123456");
  });

  it("should parse pasted text with spaces and dashes", () => {
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

  it("should reject invalid series format", () => {
    const parsed = parseTicket("12 123456");
    expect(parsed.isValid).toBe(false);
    expect(parsed.error).toContain("First two characters must be series letters");
  });

  it("should reject tickets with letters in digit portion", () => {
    const parsed = parseTicket("WA 12345X");
    expect(parsed.isValid).toBe(false);
    expect(parsed.error).toContain("Last 6 characters must be numeric digits");
  });
});

describe("checkTicket", () => {
  it("should award 1st prize (jackpot) on full match (series + 6 digits)", () => {
    const result = checkTicket("WA 584920", mockDraw);
    expect(result.kind).toBe("jackpot");
    expect(result.amount).toBe(7500000);
    expect(result.matchedIndices).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("should award Consolation Prize on same 6 digits but different series with truthful near-miss text", () => {
    const result = checkTicket("WB 584920", mockDraw);
    expect(result.kind).toBe("mid");
    expect(result.amount).toBe(8000);
    expect(result.matchedIndices).toEqual([2, 3, 4, 5, 6, 7]);
    expect(result.closestMatch).toBe("Same number as the 1st prize, different series");
  });

  it("should award last-4 prize on matching last 4 digits", () => {
    // 4920 is in drawn last-4 list
    const result = checkTicket("WA 114920", mockDraw);
    expect(result.kind).toBe("mid"); // 5000 >= 5000
    expect(result.amount).toBe(5000);
    expect(result.matchedIndices).toEqual([4, 5, 6, 7]);
  });

  it("should report No Win calmly with genuine near-miss text when applicable", () => {
    // WA 584921 matches 5 of 6 digits with 1st prize (584920)
    const result = checkTicket("WA 584921", mockDraw);
    expect(result.kind).toBe("none");
    expect(result.amount).toBe(0);
    expect(result.closestMatch).toContain("Matched 5 of the 6 digits");
  });

  it("should report calm message if results are not published yet", () => {
    const result = checkTicket("WA 584920", unpublishedDraw);
    expect(result.kind).toBe("none");
    expect(result.tier).toBe("Results Pending");
    expect(result.summary).toContain("not published yet");
  });

  it("should respect demo forced outcomes", () => {
    const forcedJackpot = checkTicket("WA 000000", mockDraw, "jackpot");
    expect(forcedJackpot.kind).toBe("jackpot");
    expect(forcedJackpot.matchedIndices).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);

    const forcedNone = checkTicket("WA 584920", mockDraw, "none");
    expect(forcedNone.kind).toBe("none");
    expect(forcedNone.amount).toBe(0);
  });
});
