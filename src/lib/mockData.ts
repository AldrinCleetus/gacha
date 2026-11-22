import { Draw, SavedTicket, UserSession, UserStats } from "@/types/lottery";
import { checkTicket } from "./checkTicket";

export const SEED_DRAWS: Draw[] = [
  {
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
          numbers: ["3391", "6724", "1104", "8823"],
          amount: 1000,
        },
        {
          tier: "9th Prize",
          numbers: ["1294", "9482", "5512", "7381"],
          amount: 500,
        },
        {
          tier: "10th Prize",
          numbers: ["0481", "5623", "9012", "4156", "7782"],
          amount: 100,
        },
      ],
    },
  },
  {
    id: "SS-450",
    schemeCode: "S",
    drawNumber: 450,
    drawDate: "2026-11-17",
    allSeries: ["SA", "SB", "SC", "SD", "SE", "SF", "SG", "SH", "SJ", "SK", "SL", "SM"],
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
    drawDate: "2026-11-18",
    allSeries: ["AA", "AB", "AC", "AD", "AE", "AF", "AG", "AH", "AJ", "AK", "AL", "AM"],
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
    drawDate: "2026-11-19",
    allSeries: ["KA", "KB", "KC", "KD", "KE", "KF", "KG", "KH", "KJ", "KK", "KL", "KM"],
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
];

export const MOCK_USER: UserSession = {
  user: {
    id: "usr_kerala_994",
    name: "Rahul Nair",
    email: "rahul.nair@example.com",
    avatarUrl: "",
  },
  isAuthenticated: true,
};

// Generate ~40 seeded realistic tickets for demonstration
export function generateSeedTickets(): SavedTicket[] {
  const schemes = ["W", "S", "A", "K"];
  const seriesMap: Record<string, string[]> = {
    W: ["WA", "WB", "WC", "WD"],
    S: ["SA", "SB", "SC", "SF"],
    A: ["AA", "AB", "AC", "AE"],
    K: ["KA", "KB", "KC", "KD"],
  };

  const dates = [
    "2026-06-08", "2026-06-15", "2026-06-22", "2026-06-29",
    "2026-07-06", "2026-07-13", "2026-07-20", "2026-07-27",
    "2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31",
    "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28",
    "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26",
    "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-20",
  ];

  const tickets: SavedTicket[] = [];

  // Seed 4 specific wins for realistic excitement:
  // 1. A ₹5,000 last-4 win
  tickets.push({
    id: "tkt_seed_01",
    ticketString: "WA 294920",
    schemeCode: "W",
    series: "WA",
    digits: "294920",
    drawId: "W-790",
    drawDate: "2026-11-23",
    checkedAt: "2026-11-23T14:30:00.000Z",
    cost: 40,
    wonAmount: 5000,
    result: {
      kind: "mid",
      ruleHit: "last_4",
      tierName: "7th Prize (Last 4 Digits)",
      amount: 5000,
      formattedAmount: "₹5,000",
      matchedIndices: [4, 5, 6, 7],
      summary: "Prize Winner! ₹5,000",
      detailedExplanation: "Last 4 digits matched winning number 4920.",
    },
  });

  // 2. An ₹8,000 Consolation Prize
  tickets.push({
    id: "tkt_seed_02",
    ticketString: "WB 584920",
    schemeCode: "W",
    series: "WB",
    digits: "584920",
    drawId: "W-790",
    drawDate: "2026-11-23",
    checkedAt: "2026-11-23T15:10:00.000Z",
    cost: 40,
    wonAmount: 8000,
    result: {
      kind: "mid",
      ruleHit: "consolation",
      tierName: "Consolation Prize",
      amount: 8000,
      formattedAmount: "₹8,000",
      matchedIndices: [2, 3, 4, 5, 6, 7],
      summary: "Consolation Prize Winner!",
      detailedExplanation: "Same 6 digits matched 1st prize winning number in different series.",
    },
  });

  // 3. A ₹1,000 small win
  tickets.push({
    id: "tkt_seed_03",
    ticketString: "SA 847721",
    schemeCode: "S",
    series: "SA",
    digits: "847721",
    drawId: "SS-450",
    drawDate: "2026-11-17",
    checkedAt: "2026-11-17T16:00:00.000Z",
    cost: 40,
    wonAmount: 1000,
    result: {
      kind: "small",
      ruleHit: "last_4",
      tierName: "7th Prize (Last 4)",
      amount: 1000,
      formattedAmount: "₹1,000",
      matchedIndices: [4, 5, 6, 7],
      summary: "Prize Winner! ₹1,000",
      detailedExplanation: "Matched drawn last 4 digits (7721).",
    },
  });

  // 4. A ₹500 small win
  tickets.push({
    id: "tkt_seed_04",
    ticketString: "AK 319482",
    schemeCode: "A",
    series: "AK",
    digits: "319482",
    drawId: "AK-680",
    drawDate: "2026-11-18",
    checkedAt: "2026-11-18T16:30:00.000Z",
    cost: 40,
    wonAmount: 500,
    result: {
      kind: "small",
      ruleHit: "last_4",
      tierName: "8th Prize",
      amount: 500,
      formattedAmount: "₹500",
      matchedIndices: [4, 5, 6, 7],
      summary: "Prize Winner! ₹500",
      detailedExplanation: "Matched drawn numbers 9482.",
    },
  });

  // 36 non-winning tickets spanning the timeline
  let counter = 5;
  for (const date of dates) {
    const scheme = schemes[counter % schemes.length];
    const series = seriesMap[scheme][counter % 4];
    const digits = String(100000 + (counter * 23891) % 899999);
    tickets.push({
      id: `tkt_seed_${counter.toString().padStart(2, "0")}`,
      ticketString: `${series} ${digits}`,
      schemeCode: scheme,
      series,
      digits,
      drawId: `${scheme}-${700 + counter}`,
      drawDate: date,
      checkedAt: `${date}T15:30:00.000Z`,
      cost: 40,
      wonAmount: 0,
      result: {
        kind: "none",
        ruleHit: "none",
        tierName: "No Prize",
        amount: 0,
        formattedAmount: "₹0",
        matchedIndices: [],
        summary: "No Winning Match",
        detailedExplanation: "Not drawn in this official draw result.",
      },
    });
    counter++;
    if (counter > 40) break;
  }

  // Sort descending by checked date
  return tickets.sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime());
}
