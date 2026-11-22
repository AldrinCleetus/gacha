import { Draw, SavedTicket } from "@/types";
import { checkTicket } from "./checkTicket";

// Compute ISO date relative to today (0 = today, 1 = yesterday, etc.)
export function getRelativeDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

const todayStr = getRelativeDate(0);
const d1 = getRelativeDate(1);
const d2 = getRelativeDate(2);
const d3 = getRelativeDate(3);
const d4 = getRelativeDate(4);
const d7 = getRelativeDate(7);
const d14 = getRelativeDate(14);

export const SEED_DRAWS: Draw[] = [
  // Primary Draw where sample tickets hit every tier:
  // - Jackpot: WA 584920
  // - Consolation: WB 584920
  // - Last-4: WA 114920
  // - No Win: WA 999999
  {
    id: "W-790",
    schemeCode: "W",
    drawNumber: 790,
    drawDate: d1,
    isDrawnToday: false,
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
          numbers: ["3391", "6724", "8823"],
          amount: 1000,
        },
        {
          tier: "9th Prize",
          numbers: ["1294", "9482", "5512"],
          amount: 500,
        },
      ],
    },
  },
  {
    id: "SS-450",
    schemeCode: "S",
    drawNumber: 450,
    drawDate: d2,
    isDrawnToday: false,
    isPublished: true,
    prizes: {
      firstPrize: {
        series: "SF",
        number: "392817",
        amount: 7500000,
      },
      consolationPrize: {
        amount: 8000,
      },
      secondPrize: {
        number: "812049",
        amount: 1000000,
      },
      last4Prizes: [
        {
          tier: "6th Prize",
          numbers: ["2817", "6491", "3052"],
          amount: 5000,
        },
        {
          tier: "7th Prize",
          numbers: ["4190", "7721", "9083"],
          amount: 1000,
        },
      ],
    },
  },
  {
    id: "AK-680",
    schemeCode: "A",
    drawNumber: 680,
    drawDate: d3,
    isDrawnToday: false,
    isPublished: true,
    prizes: {
      firstPrize: {
        series: "AC",
        number: "918234",
        amount: 7000000,
      },
      consolationPrize: {
        amount: 8000,
      },
      secondPrize: {
        number: "441920",
        amount: 500000,
      },
      last4Prizes: [
        {
          tier: "6th Prize",
          numbers: ["8234", "1904", "5567"],
          amount: 5000,
        },
        {
          tier: "7th Prize",
          numbers: ["3290", "8812"],
          amount: 1000,
        },
      ],
    },
  },
  {
    id: "KN-540",
    schemeCode: "K",
    drawNumber: 540,
    drawDate: d4,
    isDrawnToday: false,
    isPublished: true,
    prizes: {
      firstPrize: {
        series: "KD",
        number: "651982",
        amount: 8000000,
      },
      consolationPrize: {
        amount: 8000,
      },
      last4Prizes: [
        {
          tier: "6th Prize",
          numbers: ["1982", "4430", "7129"],
          amount: 5000,
        },
        {
          tier: "7th Prize",
          numbers: ["9901", "2384"],
          amount: 1000,
        },
      ],
    },
  },
  {
    id: "W-789",
    schemeCode: "W",
    drawNumber: 789,
    drawDate: d7,
    isDrawnToday: false,
    isPublished: true,
    prizes: {
      firstPrize: {
        series: "WB",
        number: "419820",
        amount: 7500000,
      },
      consolationPrize: {
        amount: 8000,
      },
      last4Prizes: [
        {
          tier: "7th Prize",
          numbers: ["9820", "3312"],
          amount: 5000,
        },
      ],
    },
  },
  // Results pending / not published yet state (drawn today)
  {
    id: "SS-451",
    schemeCode: "S",
    drawNumber: 451,
    drawDate: todayStr,
    isDrawnToday: true,
    isPublished: false, // Results not published yet!
  },
];

// Generate ~40 checked tickets with NO duplicates
export function generateSeedTickets(): SavedTicket[] {
  const tickets: SavedTicket[] = [];
  const existingKeys = new Set<string>();

  const addTicket = (
    ticketString: string,
    schemeCode: string,
    drawId: string,
    drawDate: string,
    daysAgo: number,
    forcedPrize?: { amount: number; tier: string; kind: "small" | "mid" | "jackpot"; indices: number[] }
  ) => {
    const key = `${ticketString}_${drawId}`;
    if (existingKeys.has(key)) return;
    existingKeys.add(key);

    const checkDate = new Date();
    checkDate.setDate(checkDate.getDate() - daysAgo);

    const series = ticketString.slice(0, 2);
    const digits = ticketString.replace(/[^0-9]/g, "");

    const draw = SEED_DRAWS.find((d) => d.id === drawId) || SEED_DRAWS[0];
    const evaluated = forcedPrize
      ? {
          kind: forcedPrize.kind,
          tier: forcedPrize.tier,
          amount: forcedPrize.amount,
          formattedAmount: `₹${forcedPrize.amount.toLocaleString("en-IN")}`,
          matchedIndices: forcedPrize.indices,
          summary: `Won ₹${forcedPrize.amount.toLocaleString("en-IN")}`,
        }
      : checkTicket(ticketString, draw);

    tickets.push({
      id: `tkt_seed_${tickets.length + 1}`,
      ticketString,
      schemeCode,
      series,
      digits,
      drawId,
      drawDate,
      checkedAt: checkDate.toISOString(),
      cost: 40,
      wonAmount: evaluated.amount,
      result: evaluated,
    });
  };

  // Seed 4 specific wins:
  // 1. ₹5,000 Last-4 win
  addTicket("WA 294920", "W", "W-790", d1, 1, {
    amount: 5000,
    tier: "7th Prize (Last 4)",
    kind: "small",
    indices: [4, 5, 6, 7],
  });

  // 2. ₹8,000 Consolation Prize
  addTicket("WB 584920", "W", "W-790", d1, 1, {
    amount: 8000,
    tier: "Consolation Prize",
    kind: "mid",
    indices: [2, 3, 4, 5, 6, 7],
  });

  // 3. ₹1,000 Last-4 win
  addTicket("SA 847721", "S", "SS-450", d2, 2, {
    amount: 1000,
    tier: "7th Prize (Last 4)",
    kind: "small",
    indices: [4, 5, 6, 7],
  });

  // 4. ₹500 win
  addTicket("AK 319482", "A", "AK-680", d3, 3, {
    amount: 500,
    tier: "8th Prize (Last 4)",
    kind: "small",
    indices: [4, 5, 6, 7],
  });

  // 36 non-winning tickets with distinct numbers across past days
  const schemes = ["W", "S", "A", "K"];
  const seriesLetters = ["A", "B", "C", "D"];

  for (let i = 1; i <= 36; i++) {
    const scheme = schemes[i % schemes.length];
    const series = `${scheme}${seriesLetters[i % seriesLetters.length]}`;
    // Unique 6 digits
    const digits = String(200000 + i * 19283).slice(0, 6);
    const ticketStr = `${series} ${digits}`;
    const daysAgo = 3 + Math.floor(i * 2.2);
    const drawDate = getRelativeDate(daysAgo);
    const drawId = `${scheme}-${700 + i}`;

    addTicket(ticketStr, scheme, drawId, drawDate, daysAgo);
  }

  // Sort descending by checked date
  return tickets.sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime());
}
