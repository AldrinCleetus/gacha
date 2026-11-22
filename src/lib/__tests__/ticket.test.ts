import { describe, it, expect } from "vitest";
import { parseTicket } from "../parser";
import { checkTicket } from "../checkTicket";
import { Draw } from "@/types/lottery";

const mockDraw: Draw = {
  id: "W-790",
  schemeCode: "W",
  drawNumber: 790,
  drawDate: "2026-11-23",
  allSeries: ["WA", "WB", "WC", "WD", "WE", "WF", "WG", "WH", "WJ", "WK", "WL", "WM"],
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
    thirdPrize: {
      numbers: ["128945", "384729"],
      amount: 100000,
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

describe("parseTicket", () => {
  it("should parse standard format 'AB 123456'", () => {
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
    expect(parsed.fullTicketString).toBe("AB 123456");
  });

  it("should parse space-scattered 'w a 5 8 4 9 2 0'", () => {
    const parsed = parseTicket("w a 5 8 4 9 2 0");
    expect(parsed.isValid).toBe(true);
    expect(parsed.schemeCode).toBe("W");
    expect(parsed.series).toBe("WA");
    expect(parsed.digits).toBe("584920");
  });

  it("should reject incomplete tickets", () => {
    const parsed = parseTicket("AB 123");
    expect(parsed.isValid).toBe(false);
    expect(parsed.error).toContain("Incomplete ticket");
  });

  it("should reject invalid series format", () => {
    const parsed = parseTicket("12 123456");
    expect(parsed.isValid).toBe(false);
    expect(parsed.error).toContain("First two characters must be series letters");
  });

  it("should reject tickets with letters in digit portion", () => {
    const parsed = parseTicket("AB 12345A");
    expect(parsed.isValid).toBe(false);
    expect(parsed.error).toContain("Last 6 characters must be numeric digits");
  });
});

describe("checkTicket", () => {
  it("should award 1st prize (jackpot) on full match (series + 6 digits)", () => {
    const result = checkTicket("WA 584920", mockDraw);
    expect(result.kind).toBe("jackpot");
    expect(result.ruleHit).toBe("full_match");
    expect(result.amount).toBe(7500000);
    expect(result.matchedIndices).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("should award Consolation Prize on same 6 digits but different series", () => {
    const result = checkTicket("WB 584920", mockDraw);
    expect(result.kind).toBe("mid");
    expect(result.ruleHit).toBe("consolation");
    expect(result.amount).toBe(8000);
    expect(result.matchedIndices).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it("should award last-4 prize on matching last 4 digits", () => {
    // 4920 is in last-4 prizes list
    const result = checkTicket("WA 114920", mockDraw);
    expect(result.kind).toBe("mid"); // 5000 >= 5000 is mid or small
    expect(result.ruleHit).toBe("last_4");
    expect(result.amount).toBe(5000);
    expect(result.matchedIndices).toEqual([4, 5, 6, 7]);
  });

  it("should award small prize for 8th prize last-4 match", () => {
    // 3391 is in 8th prize (1000)
    const result = checkTicket("WC 993391", mockDraw);
    expect(result.kind).toBe("small");
    expect(result.ruleHit).toBe("last_4");
    expect(result.amount).toBe(1000);
    expect(result.matchedIndices).toEqual([4, 5, 6, 7]);
  });

  it("should report No Win gently when no numbers match", () => {
    const result = checkTicket("WC 000000", mockDraw);
    expect(result.kind).toBe("none");
    expect(result.ruleHit).toBe("none");
    expect(result.amount).toBe(0);
  });

  it("should respect demo forced outcomes", () => {
    const jackpotForced = checkTicket("WC 000000", mockDraw, "jackpot");
    expect(jackpotForced.kind).toBe("jackpot");
    expect(jackpotForced.matchedIndices).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);

    const smallForced = checkTicket("WC 000000", mockDraw, "small");
    expect(smallForced.kind).toBe("small");
    expect(smallForced.matchedIndices).toEqual([4, 5, 6, 7]);
  });
});
