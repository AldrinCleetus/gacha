import { Draw, WinnerAgency } from "@/types";

export interface BackendPrizeTier {
  tier: string;
  amount: number;
  matchType: "full" | "consolation" | "last4";
  entries: string[];
}

export interface BackendWinnerAgency {
  tier: string;
  ticket: string;
  agencyName: string | null;
  agencyCode: string | null;
  place: string | null;
  source?: string;
}

export interface BackendFullDraw {
  id: string;
  schemeCode: string;
  schemeName: string;
  drawCode: string;
  drawDate: string;
  status: string; // 'expected' | 'observed' | 'published' | 'needs_review'
  publishedAt: string | null;
  fingerprint?: string | null;
  tiers?: BackendPrizeTier[];
  agencies?: BackendWinnerAgency[];
}

export interface BackendDrawListItem {
  id: string;
  schemeCode: string;
  schemeName: string;
  drawCode: string;
  drawDate: string;
  status: string;
  publishedAt: string | null;
  fingerprint?: string | null;
  firstPrize?: {
    ticket: string;
    amount: number;
  } | null;
}

function splitTicketEntry(entry: string): { series: string; number: string } {
  const clean = entry.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length >= 8) {
    return { series: clean.slice(0, 2), number: clean.slice(2) };
  }
  return { series: "", number: clean };
}

/**
 * Converts a backend draw full response into the frontend's hierarchical Draw model.
 */
export function toFrontendDraw(backend: BackendFullDraw): Draw {
  const isPublished = backend.status === "published";
  const drawNum = parseInt(backend.drawCode.replace(/\D/g, ""), 10) || 0;

  if (!isPublished || !backend.tiers || backend.tiers.length === 0) {
    return {
      id: backend.drawCode,
      schemeCode: backend.schemeCode,
      drawNumber: drawNum,
      drawDate: backend.drawDate,
      isPublished: false,
      agencies: [],
    };
  }

  // 1st Prize
  const tier1 = backend.tiers.find((t) => t.tier === "1");
  const firstPrizeEntry = tier1?.entries[0] || "";
  // In Kerala lotteries: e.g. "WA123456" -> series="WA", number="123456"
  const firstSeries = firstPrizeEntry.length >= 8 ? firstPrizeEntry.slice(0, 2) : "";
  const firstNumber = firstPrizeEntry.length >= 8 ? firstPrizeEntry.slice(2) : firstPrizeEntry;

  // Consolation Prize
  const consol = backend.tiers.find((t) => t.tier === "consolation");

  // 2nd Prize
  const tier2 = backend.tiers.find((t) => t.tier === "2");
  const secondPrize = tier2
    ? {
        number: tier2.entries[0] || "",
        amount: tier2.amount,
      }
    : undefined;

  // 3rd Prize
  const tier3 = backend.tiers.find((t) => t.tier === "3");
  const thirdPrize = tier3
    ? {
        numbers: tier3.entries,
        amount: tier3.amount,
      }
    : undefined;

  // Remaining Lower Tiers (4th through 9th)
  const lowerTiers = backend.tiers.filter(
    (t) => t.matchType === "last4" || (!["1", "2", "3", "consolation"].includes(t.tier))
  );

  const last4Prizes = lowerTiers.map((t) => {
    const isNumeric = !isNaN(Number(t.tier));
    const label = isNumeric ? `${t.tier}th Prize` : t.tier;
    return {
      tier: label,
      numbers: t.entries,
      amount: t.amount,
    };
  });

  // Map Winner Agencies if available
  const agencies: WinnerAgency[] = (backend.agencies || []).map((a) => ({
    tier: a.tier,
    ticket: a.ticket,
    agencyName: a.agencyName,
    agencyCode: a.agencyCode,
    place: a.place,
    source: a.source,
  }));

  return {
    id: backend.drawCode,
    schemeCode: backend.schemeCode,
    drawNumber: drawNum,
    drawDate: backend.drawDate,
    isPublished: true,
    prizes: {
      firstPrize: {
        series: firstSeries,
        number: firstNumber,
        amount: tier1?.amount || 0,
      },
      consolationPrize: {
        amount: consol?.amount || 8000,
      },
      secondPrize,
      thirdPrize,
      last4Prizes,
    },
    headlinePrize: firstNumber
      ? {
          series: firstSeries,
          number: firstNumber,
          amount: tier1?.amount || 0,
        }
      : undefined,
    agencies,
  };
}

/**
 * Converts a backend list item into a lightweight frontend Draw.
 */
export function toFrontendDrawListItem(item: BackendDrawListItem): Draw {
  const drawNum = parseInt(item.drawCode.replace(/\D/g, ""), 10) || 0;
  const headline =
    item.status === "published" && item.firstPrize?.ticket
      ? {
          ...splitTicketEntry(item.firstPrize.ticket),
          amount: item.firstPrize.amount,
        }
      : undefined;

  return {
    id: item.drawCode,
    schemeCode: item.schemeCode,
    drawNumber: drawNum,
    drawDate: item.drawDate,
    isPublished: item.status === "published",
    headlinePrize: headline,
  };
}
