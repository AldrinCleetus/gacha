import { Draw, MatchResult, ParsedTicket } from "@/types";
import { parseTicket } from "./parser";
import { ForcedOutcome } from "@/store/useDemoStore";

export function formatINR(amount: number): string {
  if (amount === 0) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Pure function: checkTicket(ticket, draw, forcedOutcome?) -> MatchResult
 * Evaluates ticket against draw rules:
 * 1. Full Match (Series + 6 digits) -> Jackpot
 * 2. Consolation Prize (Same 6 digits, different series) -> Mid Win
 * 3. Last-4 Match -> Small/Mid Win
 * 4. No Win -> None (with truthful near-miss closestMatch if genuine)
 */
export function checkTicket(
  ticketInput: ParsedTicket | string,
  draw: Draw,
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
      summary: "Invalid ticket format",
    };
  }

  // Handle unpublished draw state
  if (!draw.isPublished || !draw.prizes) {
    return {
      kind: "none",
      tier: "Results Pending",
      amount: 0,
      formattedAmount: "₹0",
      matchedIndices: [],
      summary: "Draw results not published yet. Please check back later.",
    };
  }

  const prizes = draw.prizes;

  // Forced outcomes for testing/demo
  if (forcedOutcome === "jackpot") {
    return {
      kind: "jackpot",
      tier: "1st Prize",
      amount: prizes.firstPrize.amount,
      formattedAmount: formatINR(prizes.firstPrize.amount),
      matchedIndices: [0, 1, 2, 3, 4, 5, 6, 7],
      summary: "Bumper 1st prize winner",
    };
  }

  if (forcedOutcome === "mid") {
    return {
      kind: "mid",
      tier: "Consolation Prize",
      amount: prizes.consolationPrize.amount,
      formattedAmount: formatINR(prizes.consolationPrize.amount),
      matchedIndices: [2, 3, 4, 5, 6, 7],
      closestMatch: "Same number as the 1st prize, different series",
      summary: "Consolation prize winner",
    };
  }

  if (forcedOutcome === "small") {
    const smallAmount = prizes.last4Prizes?.[0]?.amount || 5000;
    return {
      kind: "small",
      tier: "7th Prize (Last 4)",
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

  // 1. FULL MATCH (1st Prize / Jackpot)
  const isSeriesMatch = ticket.series.toUpperCase() === prizes.firstPrize.series.toUpperCase();
  const isNumberMatch = ticket.digits === prizes.firstPrize.number;

  if (isSeriesMatch && isNumberMatch) {
    return {
      kind: "jackpot",
      tier: "1st Prize",
      amount: prizes.firstPrize.amount,
      formattedAmount: formatINR(prizes.firstPrize.amount),
      matchedIndices: [0, 1, 2, 3, 4, 5, 6, 7],
      summary: "Bumper 1st prize winner",
    };
  }

  // 2. CONSOLATION PRIZE (Same 6 digits, different series)
  if (isNumberMatch && !isSeriesMatch) {
    return {
      kind: "mid",
      tier: "Consolation Prize",
      amount: prizes.consolationPrize.amount,
      formattedAmount: formatINR(prizes.consolationPrize.amount),
      matchedIndices: [2, 3, 4, 5, 6, 7],
      closestMatch: "Same number as the 1st prize, different series",
      summary: "Consolation prize winner",
    };
  }

  // 3. 2nd PRIZE (if defined and 6 digits match)
  if (prizes.secondPrize && ticket.digits === prizes.secondPrize.number) {
    return {
      kind: "mid",
      tier: "2nd Prize",
      amount: prizes.secondPrize.amount,
      formattedAmount: formatINR(prizes.secondPrize.amount),
      matchedIndices: [2, 3, 4, 5, 6, 7],
      summary: "2nd prize winner",
    };
  }

  // 4. LAST 4 DIGITS MATCH
  const ticketLast4 = ticket.digits.slice(2, 6); // character indices 4, 5, 6, 7
  if (prizes.last4Prizes) {
    for (const group of prizes.last4Prizes) {
      if (group.numbers.includes(ticketLast4)) {
        return {
          kind: group.amount >= 5000 ? "mid" : "small",
          tier: `${group.tier} (Last 4)`,
          amount: group.amount,
          formattedAmount: formatINR(group.amount),
          matchedIndices: [4, 5, 6, 7],
          summary: `Won ${formatINR(group.amount)}`,
        };
      }
    }
  }

  // 5. NO WIN (Calculate truthful near-miss without exaggerating)
  let closestMatch: string | undefined = undefined;

  // Check how many digits matched 1st prize
  let digitMatchCount = 0;
  for (let i = 0; i < 6; i++) {
    if (ticket.digits.charAt(i) === prizes.firstPrize.number.charAt(i)) {
      digitMatchCount++;
    }
  }

  if (digitMatchCount >= 5) {
    closestMatch = `Matched 5 of the 6 digits of the 1st prize (${prizes.firstPrize.number})`;
  } else if (prizes.last4Prizes) {
    // Check if 3 of last 4 digits matched any drawn 4-digit number
    for (const group of prizes.last4Prizes) {
      for (const num of group.numbers) {
        let last4Matches = 0;
        for (let j = 0; j < 4; j++) {
          if (ticketLast4.charAt(j) === num.charAt(j)) last4Matches++;
        }
        if (last4Matches === 3) {
          closestMatch = `Off by one digit from drawn number ${num}`;
          break;
        }
      }
      if (closestMatch) break;
    }
  }

  if (!closestMatch && isSeriesMatch) {
    closestMatch = `Same series (${ticket.series}) as the 1st prize winner`;
  }

  // Individual coincidental character matches for realistic scan visual
  const coincidences: number[] = [];
  const fullTarget = prizes.firstPrize.series + prizes.firstPrize.number;
  const fullTicket = ticket.series + ticket.digits;
  for (let i = 0; i < 8; i++) {
    if (fullTicket.charAt(i) === fullTarget.charAt(i)) {
      coincidences.push(i);
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
