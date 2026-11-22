import { Draw, MatchResult, ParsedTicket } from "@/types/lottery";
import { parseTicket } from "./parser";
import { ForcedOutcome } from "@/store/useAppStore";

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
 * Evaluates ticket against draw rules in priority order:
 * 1. Full Match (Series + all 6 digits) -> Jackpot
 * 2. Consolation Prize (All 6 digits match 1st prize, but different series) -> Mid Win
 * 3. 2nd/3rd prize number match (if present) -> Mid Win
 * 4. Last 4 Digits Match (matches any drawn last-4 numbers) -> Small Win
 * 5. No Win -> None
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
      ruleHit: "none",
      tierName: "Invalid Ticket",
      amount: 0,
      formattedAmount: "₹0",
      matchedIndices: [],
      summary: "Invalid ticket format",
      detailedExplanation: ticket.error || "Please check your ticket number format.",
    };
  }

  // Handle Demo Mode forced outcomes if requested
  if (forcedOutcome === "jackpot") {
    return {
      kind: "jackpot",
      ruleHit: "full_match",
      tierName: "1st Prize (Jackpot)",
      amount: draw.prizes.firstPrize.amount || 7500000,
      formattedAmount: formatINR(draw.prizes.firstPrize.amount || 7500000),
      matchedIndices: [0, 1, 2, 3, 4, 5, 6, 7],
      summary: "Jackpot Winner! First Prize!",
      detailedExplanation: `Full match on series ${ticket.series} and number ${ticket.digits}. All 8 characters matched the 1st prize draw!`,
    };
  }

  if (forcedOutcome === "mid") {
    return {
      kind: "mid",
      ruleHit: "consolation",
      tierName: "Consolation Prize",
      amount: draw.prizes.consolationPrize.amount || 8000,
      formattedAmount: formatINR(draw.prizes.consolationPrize.amount || 8000),
      matchedIndices: [2, 3, 4, 5, 6, 7],
      summary: "Consolation Prize Winner!",
      detailedExplanation: `Your 6 digits (${ticket.digits}) match the 1st prize winning number in a different series.`,
    };
  }

  if (forcedOutcome === "small") {
    const smallPrizeAmount = draw.prizes.last4Prizes?.[0]?.amount || 5000;
    return {
      kind: "small",
      ruleHit: "last_4",
      tierName: "7th Prize (Last 4 Digits)",
      amount: smallPrizeAmount,
      formattedAmount: formatINR(smallPrizeAmount),
      matchedIndices: [4, 5, 6, 7],
      summary: "Prize Winner! Last 4 Digits Matched",
      detailedExplanation: `The last 4 digits (${ticket.digits.slice(2)}) matched the official drawn winning sequence.`,
    };
  }

  if (forcedOutcome === "none") {
    return {
      kind: "none",
      ruleHit: "none",
      tierName: "Better Luck Next Time",
      amount: 0,
      formattedAmount: "₹0",
      matchedIndices: [],
      summary: "No Winning Match",
      detailedExplanation: "Your ticket did not hit any prize tier for this draw. Thank you for participating responsibly.",
    };
  }

  // Real Draw evaluation
  const firstPrize = draw.prizes.firstPrize;
  const isSeriesMatch = ticket.series.toUpperCase() === firstPrize.series.toUpperCase();
  const isNumberMatch = ticket.digits === firstPrize.number;

  // 1. FULL MATCH (1st Prize / Jackpot)
  if (isSeriesMatch && isNumberMatch) {
    return {
      kind: "jackpot",
      ruleHit: "full_match",
      tierName: "1st Prize (Jackpot)",
      amount: firstPrize.amount,
      formattedAmount: formatINR(firstPrize.amount),
      matchedIndices: [0, 1, 2, 3, 4, 5, 6, 7],
      summary: "Bumper First Prize Winner!",
      detailedExplanation: `Incredible! All 8 characters (${ticket.series} ${ticket.digits}) match the 1st prize winning ticket.`,
    };
  }

  // 2. CONSOLATION PRIZE (Same 6 digits, different series)
  if (isNumberMatch && !isSeriesMatch) {
    return {
      kind: "mid",
      ruleHit: "consolation",
      tierName: "Consolation Prize",
      amount: draw.prizes.consolationPrize.amount,
      formattedAmount: formatINR(draw.prizes.consolationPrize.amount),
      matchedIndices: [2, 3, 4, 5, 6, 7], // 6 digits match
      summary: "Consolation Prize Winner!",
      detailedExplanation: `Your 6 digits (${ticket.digits}) matched the 1st prize number! Awarded Kerala State Consolation Prize.`,
    };
  }

  // 2b. Check 2nd Prize if applicable (same 6 digits)
  if (draw.prizes.secondPrize && ticket.digits === draw.prizes.secondPrize.number) {
    return {
      kind: "mid",
      ruleHit: "full_match",
      tierName: "2nd Prize",
      amount: draw.prizes.secondPrize.amount,
      formattedAmount: formatINR(draw.prizes.secondPrize.amount),
      matchedIndices: [2, 3, 4, 5, 6, 7],
      summary: "2nd Prize Winner!",
      detailedExplanation: `Your 6 digits (${ticket.digits}) match the 2nd prize draw number!`,
    };
  }

  // 3. LAST 4 DIGITS MATCH (Checks all last-4 prize tiers, e.g. 5000, 1000, 500, 100)
  const ticketLast4 = ticket.digits.slice(2, 6); // characters at index 4, 5, 6, 7
  if (draw.prizes.last4Prizes && draw.prizes.last4Prizes.length > 0) {
    for (const prizeGroup of draw.prizes.last4Prizes) {
      if (prizeGroup.numbers.includes(ticketLast4)) {
        return {
          kind: prizeGroup.amount >= 5000 ? "mid" : "small",
          ruleHit: "last_4",
          tierName: `${prizeGroup.tier || "Drawn Prize"} (Last 4 Digits)`,
          amount: prizeGroup.amount,
          formattedAmount: formatINR(prizeGroup.amount),
          matchedIndices: [4, 5, 6, 7], // indices of last 4 digits
          summary: `Winner! ${formatINR(prizeGroup.amount)} Prize`,
          detailedExplanation: `Last 4 digits (${ticketLast4}) matched winning number in the ${prizeGroup.tier || "drawn"} category.`,
        };
      }
    }
  }

  // 4. NO WIN
  // Calculate any coincidental individual digit matches for realistic scan animation
  const coincidentMatches: number[] = [];
  const firstPrizeFull = `${firstPrize.series}${firstPrize.number}`;
  const ticketFull = `${ticket.series}${ticket.digits}`;
  for (let i = 0; i < 8; i++) {
    if (ticketFull.charAt(i) === firstPrizeFull.charAt(i)) {
      coincidentMatches.push(i);
    }
  }

  return {
    kind: "none",
    ruleHit: "none",
    tierName: "No Prize",
    amount: 0,
    formattedAmount: "₹0",
    matchedIndices: coincidentMatches,
    summary: "No Winning Match",
    detailedExplanation: "Your ticket was not drawn for a prize in this draw. Every draw is independent.",
  };
}
