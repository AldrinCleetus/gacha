import { z } from "zod";

export const MatchTypeSchema = z.enum(["full", "consolation", "last4"]);
export type MatchType = z.infer<typeof MatchTypeSchema>;

export const PrizeTierSchema = z.object({
  tier: z.string(), // "1", "2", "3", "consolation", "4".."9"
  amount: z.number().int().nonnegative(), // in rupees
  matchType: MatchTypeSchema,
  entries: z.array(z.string()), // e.g. ["WA584920"] or ["4821", "9012"]
});
export type PrizeTier = z.infer<typeof PrizeTierSchema>;

export const WinnerAgencySchema = z.object({
  tier: z.string(),
  ticket: z.string(),
  agencyName: z.string().optional(),
  agencyCode: z.string().optional(),
  place: z.string().optional(),
});
export type WinnerAgency = z.infer<typeof WinnerAgencySchema>;

export const DrawRefSchema = z.object({
  schemeCode: z.string(),
  drawCode: z.string(),
  drawDate: z.string(), // YYYY-MM-DD
  url: z.string(),
});
export type DrawRef = z.infer<typeof DrawRefSchema>;

export const ParsedDrawSchema = z.object({
  source: z.enum(["onmanorama", "keralalotteries_net", "official"]),
  sourceUrl: z.string().optional(),
  fetchedAt: z.string().datetime(), // ISO 8601 string
  schemeName: z.string().min(1),
  schemeCode: z.string().min(1), // e.g. 'BT', 'SS', 'DL', 'KN', 'SK', 'KR', 'SM'
  drawCode: z.string().min(1), // e.g. 'BT-80'
  drawDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD calendar date in IST
  tiers: z.array(PrizeTierSchema).min(1),
  agents: z.array(WinnerAgencySchema).optional(),
  raw: z.object({
    contentHash: z.string(),
  }),
});
export type ParsedDraw = z.infer<typeof ParsedDrawSchema>;

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

export const WinCelebrationTierSchema = z.enum(["jackpot", "mid", "small", "none"]);
export type WinCelebrationTier = z.infer<typeof WinCelebrationTierSchema>;

export const MatchResultSchema = z.object({
  kind: WinCelebrationTierSchema,
  tier: z.string(),
  amount: z.number().int().nonnegative(),
  formattedAmount: z.string(),
  matchedIndices: z.array(z.number()), // 0..7
  closestMatch: z.string().optional(),
  summary: z.string(),
});
export type MatchResult = z.infer<typeof MatchResultSchema>;
