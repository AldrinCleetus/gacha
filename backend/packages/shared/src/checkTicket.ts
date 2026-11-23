import { MatchResult, ParsedDraw, ParsedTicket, PrizeTier } from "./schemas.js";
import { parseTicket } from "./parser.js";
import { formatINR } from "./format.js";

export type ForcedOutcome = "jackpot" | "mid" | "small" | "none";

/**
 * Flexible input type representing a draw:
 * Accepts either the backend ParsedDraw (with tiers[]) or frontend Draw (with prizes{}).
 */
export interface CheckTicketDrawInput {
  isPublished?: boolean;
  tiers?: PrizeTier[];
  prizes?: {
    firstPrize: {
      series: string;
      number: string;
      amount: number;
    };
    consolationPrize: {
      amount: number;
    };
    secondPrize?: {
      number: string;
      amount: number;
    };
    thirdPrize?: {
      numbers: string[];
      amount: number;
    };
    last4Prizes: Array<{
      tier: string;
      numbers: string[];
      amount: number;
    }>;
  };
}

/**
 * Evaluates a lottery ticket against draw results.
 * Pure function with no side effects or network calls.
 *
 * Evaluation rules:
 * 1. Full Match (Series + 6 digits) -> 1st Prize / Jackpot
 * 2. Consolation Prize (Same 6 digits, different series) -> Mid Win
 * 3. 2nd / 3rd Prize (if matching 6 digits) -> Mid Win
 * 4. Last 4 Digits Match -> Mid / Small Win
 * 5. No Win -> None (with truthful near-miss closestMatch and coincidental character matches)
 */
export function checkTicket(
  ticketInput: ParsedTicket | string,
  draw: ParsedDraw | CheckTicketDrawInput,
  forcedOutcome?: ForcedOutcome
): MatchResult {
  const ticket = typeof ticketInput === "string" ? parseTicket(ticketInput) : ticketInput;

  if (!ticket.isValid) {
    return {
      kind: "none",
      tier: "Invalid Ticket",
      amount: 0,
      formattedAmount: "₹0",
      matchedIndices: [],
      summary: ticket.error || "Invalid ticket format",
    };
  }

  // Handle explicitly unpublished draw
  if ("isPublished" in draw && draw.isPublished === false) {
    return {
      kind: "none",
      tier: "Results Pending",
      amount: 0,
      formattedAmount: "₹0",
      matchedIndices: [],
      summary: "Draw results not published yet. Please check back later.",
    };
  }

  // Standardize draw into normalized prize structures
  let firstPrizeSeries = "";
  let firstPrizeNumber = "";
  let firstPrizeAmount = 0;
  let consolationAmount = 8000;
  const secondaryFullPrizes: Array<{ tier: string; amount: number; number: string; series?: string }> = [];
  const last4Prizes: Array<{ tier: string; amount: number; numbers: string[] }> = [];

  if ("prizes" in draw && draw.prizes) {
    // Frontend structure
    const p = draw.prizes;
    firstPrizeSeries = p.firstPrize.series.toUpperCase();
    firstPrizeNumber = p.firstPrize.number;
    firstPrizeAmount = p.firstPrize.amount;
    consolationAmount = p.consolationPrize.amount;

    if (p.secondPrize) {
      secondaryFullPrizes.push({
        tier: "2nd Prize",
        amount: p.secondPrize.amount,
        number: p.secondPrize.number,
      });
    }

    if (p.last4Prizes) {
      for (const group of p.last4Prizes) {
        last4Prizes.push({
          tier: group.tier,
          amount: group.amount,
          numbers: group.numbers,
        });
      }
    }
  } else if ("tiers" in draw && draw.tiers && draw.tiers.length > 0) {
    // Backend ParsedDraw structure
    const t1 = draw.tiers.find((t) => t.tier === "1");
    if (t1 && t1.entries.length > 0) {
      const entry = t1.entries[0].toUpperCase().replace(/[^A-Z0-9]/g, "");
      firstPrizeSeries = entry.slice(0, 2);
      firstPrizeNumber = entry.slice(2, 8);
      firstPrizeAmount = t1.amount;
    }

    const tCons = draw.tiers.find(
      (t) => t.matchType === "consolation" || t.tier.toLowerCase().includes("consolation")
    );
    if (tCons) {
      consolationAmount = tCons.amount;
    }

    const t2 = draw.tiers.find((t) => t.tier === "2");
    if (t2) {
      for (const entry of t2.entries) {
        const clean = entry.toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (clean.length === 8) {
          secondaryFullPrizes.push({
            tier: "2nd Prize",
            amount: t2.amount,
            series: clean.slice(0, 2),
            number: clean.slice(2, 8),
          });
        } else if (clean.length === 6) {
          secondaryFullPrizes.push({
            tier: "2nd Prize",
            amount: t2.amount,
            number: clean,
          });
        }
      }
    }

    for (const t of draw.tiers) {
      if (t.matchType === "last4") {
        const cleanNumbers = t.entries.map((e) => e.trim().slice(-4));
        last4Prizes.push({
          tier: `${t.tier}th Prize`,
          amount: t.amount,
          numbers: cleanNumbers,
        });
      }
    }
  }

  // Support demo forced outcomes
  if (forcedOutcome === "jackpot") {
    return {
      kind: "jackpot",
      tier: "1st Prize",
      amount: firstPrizeAmount || 7500000,
      formattedAmount: formatINR(firstPrizeAmount || 7500000),
      matchedIndices: [0, 1, 2, 3, 4, 5, 6, 7],
      summary: "Bumper 1st prize winner",
    };
  }

  if (forcedOutcome === "mid") {
    return {
      kind: "mid",
      tier: "Consolation Prize",
      amount: consolationAmount || 8000,
      formattedAmount: formatINR(consolationAmount || 8000),
      matchedIndices: [2, 3, 4, 5, 6, 7],
      closestMatch: "Same number as the 1st prize, different series",
      summary: "Consolation prize winner",
    };
  }

  if (forcedOutcome === "small") {
    const smallAmount = last4Prizes[0]?.amount || 5000;
    return {
      kind: "small",
      tier: `${last4Prizes[0]?.tier || "7th Prize"} (Last 4)`,
      amount: smallAmount,
      formattedAmount: formatINR(smallAmount),
      matchedIndices: [4, 5, 6, 7],
      summary: "Last 4 digits matched",
    };
  }

  if (forcedOutcome === "none") {
    return {
      kind: "none",
      tier: "No Prize",
      amount: 0,
      formattedAmount: "₹0",
      matchedIndices: [],
      summary: "No prize this time",
    };
  }

  // 1. FULL MATCH (1st Prize / Jackpot: series + 6 digits)
  const isSeriesMatch = ticket.series.toUpperCase() === firstPrizeSeries.toUpperCase();
  const isNumberMatch = ticket.digits === firstPrizeNumber;

  if (isSeriesMatch && isNumberMatch && firstPrizeAmount > 0) {
    return {
      kind: "jackpot",
      tier: "1st Prize",
      amount: firstPrizeAmount,
      formattedAmount: formatINR(firstPrizeAmount),
      matchedIndices: [0, 1, 2, 3, 4, 5, 6, 7],
      summary: "Bumper 1st prize winner",
    };
  }

  // 2. CONSOLATION PRIZE (Same 6 digits as 1st prize, different series)
  if (isNumberMatch && !isSeriesMatch && firstPrizeNumber.length === 6) {
    return {
      kind: "mid",
      tier: "Consolation Prize",
      amount: consolationAmount,
      formattedAmount: formatINR(consolationAmount),
      matchedIndices: [2, 3, 4, 5, 6, 7],
      closestMatch: "Same number as the 1st prize, different series",
      summary: "Consolation prize winner",
    };
  }

  // 3. SECONDARY FULL PRIZES (2nd prize, etc.)
  for (const prize of secondaryFullPrizes) {
    const numMatch = ticket.digits === prize.number;
    const sMatch = !prize.series || ticket.series.toUpperCase() === prize.series.toUpperCase();
    if (numMatch && sMatch) {
      return {
        kind: "mid",
        tier: prize.tier,
        amount: prize.amount,
        formattedAmount: formatINR(prize.amount),
        matchedIndices: prize.series ? [0, 1, 2, 3, 4, 5, 6, 7] : [2, 3, 4, 5, 6, 7],
        summary: `${prize.tier} winner`,
      };
    }
  }

  // 4. LAST 4 DIGITS MATCH
  const ticketLast4 = ticket.digits.slice(2, 6); // character indices 4, 5, 6, 7
  for (const group of last4Prizes) {
    if (group.numbers.includes(ticketLast4)) {
      return {
        kind: group.amount >= 5000 ? "mid" : "small",
        tier: group.tier.includes("Last 4") ? group.tier : `${group.tier} (Last 4)`,
        amount: group.amount,
        formattedAmount: formatINR(group.amount),
        matchedIndices: [4, 5, 6, 7],
        summary: `Won ${formatINR(group.amount)}`,
      };
    }
  }

  // 5. NO WIN (Evaluate truthful near-miss)
  let closestMatch: string | undefined = undefined;

  // Check digit matches against 1st prize
  if (firstPrizeNumber.length === 6) {
    let digitMatchCount = 0;
    for (let i = 0; i < 6; i++) {
      if (ticket.digits.charAt(i) === firstPrizeNumber.charAt(i)) {
        digitMatchCount++;
      }
    }

    if (digitMatchCount >= 5) {
      closestMatch = `Matched 5 of the 6 digits of the 1st prize (${firstPrizeNumber})`;
    }
  }

  // Check near miss on last-4 drawn numbers
  if (!closestMatch && last4Prizes.length > 0) {
    for (const group of last4Prizes) {
      for (const num of group.numbers) {
        if (num.length === 4) {
          let last4Matches = 0;
          for (let j = 0; j < 4; j++) {
            if (ticketLast4.charAt(j) === num.charAt(j)) last4Matches++;
          }
          if (last4Matches === 3) {
            closestMatch = `Off by one digit from drawn number ${num}`;
            break;
          }
        }
      }
      if (closestMatch) break;
    }
  }

  if (!closestMatch && isSeriesMatch && firstPrizeSeries) {
    closestMatch = `Same series (${ticket.series}) as the 1st prize winner`;
  }

  // Character coincidences against 1st prize for scan visual
  const coincidences: number[] = [];
  if (firstPrizeSeries && firstPrizeNumber) {
    const fullTarget = firstPrizeSeries + firstPrizeNumber;
    const fullTicket = ticket.series + ticket.digits;
    for (let i = 0; i < 8; i++) {
      if (fullTicket.charAt(i) === fullTarget.charAt(i)) {
        coincidences.push(i);
      }
    }
  }

  return {
    kind: "none",
    tier: "No Prize",
    amount: 0,
    formattedAmount: "₹0",
    matchedIndices: coincidences,
    closestMatch,
    summary: "No prize this time",
  };
}
