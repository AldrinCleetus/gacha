import { z } from "zod";

// Theme config for lottery schemes
export const SchemeThemeSchema = z.object({
  primary: z.string(),
  primaryLight: z.string(),
  secondary: z.string(),
  accent: z.string(),
  bgLight: z.string(),
  bgDark: z.string(),
  surfaceLight: z.string(),
  surfaceDark: z.string(),
  borderLight: z.string(),
  borderDark: z.string(),
  glow: z.string(),
});
export type SchemeTheme = z.infer<typeof SchemeThemeSchema>;

// Scheme Definition
export const SchemeSchema = z.object({
  code: z.string(),
  name: z.string(),
  drawPrefix: z.string(),
  price: z.number(),
  weekday: z.string(),
  firstPrize: z.string(),
  tagline: z.string(),
  theme: SchemeThemeSchema,
});
export type Scheme = z.infer<typeof SchemeSchema>;

export const SchemesFileSchema = z.object({
  schemes: z.record(SchemeSchema),
});
export type SchemesFile = z.infer<typeof SchemesFileSchema>;

// Ticket structure
export const ParsedTicketSchema = z.object({
  rawInput: z.string(),
  schemeCode: z.string(),
  seriesChar: z.string(),
  series: z.string(), // e.g. "WA"
  digits: z.string(), // 6 digits e.g. "123456"
  fullTicketString: z.string(), // "WA 123456"
  characters: z.array(z.string()).length(8), // ['W', 'A', '1', '2', '3', '4', '5', '6']
  isValid: z.boolean(),
  error: z.string().optional(),
});
export type ParsedTicket = z.infer<typeof ParsedTicketSchema>;

// Draw results structure
export const DrawPrizeItemSchema = z.object({
  series: z.string().optional(),
  number: z.string(),
  amount: z.number(),
});

export const DrawSchema = z.object({
  id: z.string(),
  schemeCode: z.string(),
  drawNumber: z.number(),
  drawDate: z.string(), // YYYY-MM-DD
  allSeries: z.array(z.string()),
  prizes: z.object({
    firstPrize: z.object({
      series: z.string(),
      number: z.string(),
      amount: z.number(),
    }),
    consolationPrize: z.object({
      amount: z.number(),
    }),
    secondPrize: z.object({
      number: z.string(),
      amount: z.number(),
    }).optional(),
    thirdPrize: z.object({
      numbers: z.array(z.string()),
      amount: z.number(),
    }).optional(),
    last4Prizes: z.array(
      z.object({
        tier: z.string(),
        numbers: z.array(z.string()),
        amount: z.number(),
      })
    ),
  }),
});
export type Draw = z.infer<typeof DrawSchema>;

// Match Result
export type WinCelebrationTier = "jackpot" | "mid" | "small" | "none";
export type MatchRuleKind = "full_match" | "consolation" | "last_4" | "none";

export const MatchResultSchema = z.object({
  kind: z.enum(["jackpot", "mid", "small", "none"]),
  ruleHit: z.enum(["full_match", "consolation", "last_4", "none"]),
  tierName: z.string(),
  amount: z.number(),
  formattedAmount: z.string(),
  matchedIndices: z.array(z.number()), // 0..7
  summary: z.string(),
  detailedExplanation: z.string(),
});
export type MatchResult = z.infer<typeof MatchResultSchema>;

// Saved Ticket History
export const SavedTicketSchema = z.object({
  id: z.string(),
  ticketString: z.string(),
  schemeCode: z.string(),
  series: z.string(),
  digits: z.string(),
  drawId: z.string(),
  drawDate: z.string(),
  checkedAt: z.string(), // ISO string
  cost: z.number(),
  wonAmount: z.number(),
  result: MatchResultSchema,
});
export type SavedTicket = z.infer<typeof SavedTicketSchema>;

// User Session
export const UserSessionSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    avatarUrl: z.string().optional(),
  }).nullable(),
  isAuthenticated: z.boolean(),
});
export type UserSession = z.infer<typeof UserSessionSchema>;

// Statistics
export interface UserStats {
  totalTickets: number;
  totalSpent: number;
  totalWon: number;
  netProfitLoss: number;
  winRate: number; // percentage
  bestWin: number;
  schemeBreakdown: Record<string, { count: number; spent: number; won: number; wins: number }>;
  monthlyBreakdown: Array<{ month: string; spent: number; won: number; net: number }>;
  historyTimeline: Array<{ date: string; cumulativeNet: number; cost: number; prize: number; ticket: string }>;
}

// LotteryApi contract interface
export interface LotteryApi {
  getSession(): Promise<UserSession>;
  signInWithGoogle(): Promise<UserSession>;
  signOut(): Promise<void>;
  getLatestDraw(schemeCode?: string): Promise<Draw>;
  getDraws(): Promise<Draw[]>;
  getDrawById(id: string): Promise<Draw | null>;
  saveTicket(ticket: SavedTicket): Promise<void>;
  getHistory(): Promise<SavedTicket[]>;
  getStats(): Promise<UserStats>;
  resetHistory(seedTickets?: SavedTicket[]): Promise<void>;
}
