import { z } from "zod";

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

export interface MatchResult {
  kind: "jackpot" | "mid" | "small" | "none";
  tier: string;
  amount: number;
  formattedAmount: string;
  matchedIndices: number[];
  closestMatch?: string;
  summary: string;
}
