import { z } from "zod";

export const DrawRefSchema = z.object({
  schemeCode: z.string(),
  drawCode: z.string(),
  drawDate: z.string(), // YYYY-MM-DD
  url: z.string(),
});
export type DrawRef = z.infer<typeof DrawRefSchema>;

export const PrizeTierEntrySchema = z.object({
  tier: z.string(),
  amount: z.number(),
  matchType: z.enum(["full", "consolation", "last4"]),
  entries: z.array(z.string()),
});
export type PrizeTierEntry = z.infer<typeof PrizeTierEntrySchema>;

export const ParsedDrawSchema = z.object({
  source: z.enum(["onmanorama", "keralalotteries_net", "official"]),
  sourceUrl: z.string(),
  fetchedAt: z.string(),
  schemeName: z.string(),
  schemeCode: z.string(),
  drawCode: z.string(),
  drawDate: z.string(),
  tiers: z.array(PrizeTierEntrySchema),
  agents: z
    .array(
      z.object({
        tier: z.string(),
        ticket: z.string(),
        agencyName: z.string().optional(),
        agencyCode: z.string().optional(),
        place: z.string().optional(),
      })
    )
    .optional(),
  raw: z.object({
    contentHash: z.string(),
  }),
});
export type ParsedDraw = z.infer<typeof ParsedDrawSchema>;

export interface SourceAdapter {
  id: "onmanorama" | "keralalotteries_net" | "official";
  discover(): Promise<DrawRef[]>;
  fetchAndParse(ref: DrawRef): Promise<ParsedDraw>;
}
