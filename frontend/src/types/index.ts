import { z } from "zod";

// Scheme Theme
export const SchemeThemeSchema = z.object({
  primary: z.string(),
  bg: z.string(),
  border: z.string(),
  text: z.string(),
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
  theme: SchemeThemeSchema,
});
export type Scheme = z.infer<typeof SchemeSchema>;

export const SchemesFileSchema = z.object({
  schemes: z.record(SchemeSchema),
});
export type SchemesFile = z.infer<typeof SchemesFileSchema>;

// Ticket Structure
export const ParsedTicketSchema = z.object({
  rawInput: z.string(),
  schemeCode: z.string(),
  seriesChar: z.string(),
  series: z.string(),
  digits: z.string(),
  fullTicketString: z.string(),
  characters: z.array(z.string()).length(8),
  isValid: z.boolean(),
  error: z.string().optional(),
});
export type ParsedTicket = z.infer<typeof ParsedTicketSchema>;

// Match Result
export type WinCelebrationTier = "jackpot" | "mid" | "small" | "none";

export const MatchResultSchema = z.object({
  kind: z.enum(["jackpot", "mid", "small", "none"]),
  tier: z.string(),
  amount: z.number(),
  formattedAmount: z.string(),
  matchedIndices: z.array(z.number()), // 0..7
  closestMatch: z.string().optional(), // Truthful near-miss text if any
  summary: z.string(),
});
export type MatchResult = z.infer<typeof MatchResultSchema>;

// Winner Agency Structure
export const WinnerAgencySchema = z.object({
  tier: z.string(),
  ticket: z.string(),
  agencyName: z.string().nullable().optional(),
  agencyCode: z.string().nullable().optional(),
  place: z.string().nullable().optional(),
  source: z.string().optional(),
});
export type WinnerAgency = z.infer<typeof WinnerAgencySchema>;

// Draw Structure
export const DrawSchema = z.object({
  id: z.string(),
  schemeCode: z.string(),
  drawNumber: z.number(),
  drawDate: z.string(), // YYYY-MM-DD
  isDrawnToday: z.boolean().optional(),
  isPublished: z.boolean(), // true = results available, false = results not published yet
  prizes: z
    .object({
      firstPrize: z.object({
        series: z.string(),
        number: z.string(),
        amount: z.number(),
      }),
      consolationPrize: z.object({
        amount: z.number(),
      }),
      secondPrize: z
        .object({
          number: z.string(),
          amount: z.number(),
        })
        .optional(),
      thirdPrize: z
        .object({
          numbers: z.array(z.string()),
          amount: z.number(),
        })
        .optional(),
      last4Prizes: z.array(
        z.object({
          tier: z.string(),
          numbers: z.array(z.string()),
          amount: z.number(),
        })
      ),
    })
    .optional(),
  agencies: z.array(WinnerAgencySchema).optional(),
});
export type Draw = z.infer<typeof DrawSchema>;

// Saved Ticket History
export const SavedTicketSchema = z.object({
  id: z.string(),
  ticketString: z.string(),
  schemeCode: z.string(),
  series: z.string(),
  digits: z.string(),
  drawId: z.string(),
  drawDate: z.string(),
  checkedAt: z.string(),
  cost: z.number(),
  wonAmount: z.number(),
  result: MatchResultSchema,
});
export type SavedTicket = z.infer<typeof SavedTicketSchema>;

// User Session
export const UserSessionSchema = z.object({
  user: z
    .object({
      id: z.string(),
      email: z.string(),
      name: z.string(),
      avatarUrl: z.string().optional(),
    })
    .nullable(),
  isAuthenticated: z.boolean(),
});
export type UserSession = z.infer<typeof UserSessionSchema>;

// User Analytics & Statistics
export interface UserStats {
  totalTickets: number;
  totalSpent: number;
  totalWon: number;
  netProfitLoss: number;
  winRate: number;
  bestWin: number;
  longestDrySpell: number; // in consecutive draws without a win
  mostCheckedScheme: string;
  schemeBreakdown: Record<string, { count: number; spent: number; won: number; wins: number }>;
  monthlyBreakdown: Array<{ month: string; spent: number; won: number; net: number; sortKey: string }>;
  historyTimeline: Array<{ date: string; cumulativeNet: number; cost: number; prize: number; ticket: string }>;
}

// LotteryApi interface
export interface LotteryApi {
  getSession(): Promise<UserSession>;
  signInWithGoogle(): Promise<UserSession>;
  signOut(): Promise<void>;
  getLatestDraw(schemeCode?: string): Promise<Draw>;
  getDraws(): Promise<Draw[]>;
  getDrawById(id: string): Promise<Draw | null>;
  saveTicket(ticket: SavedTicket): Promise<boolean>;
  getHistory(): Promise<SavedTicket[]>;
  getStats(): Promise<UserStats>;
  resetHistory(seedTickets?: SavedTicket[]): Promise<void>;
}
