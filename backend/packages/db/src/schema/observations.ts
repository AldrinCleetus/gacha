import { pgTable, uuid, text, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { draws } from "./draws.js";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export const sourceObservations = pgTable(
  "source_observations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    drawId: uuid("draw_id").references(() => draws.id, { onDelete: "set null" }),
    source: text("source").notNull(), // 'onmanorama' | 'keralalotteries_net' | 'official'
    sourceUrl: text("source_url"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
    rawObjectKey: text("raw_object_key"),
    contentHash: text("content_hash"),
    parsed: jsonb("parsed"), // ParsedDraw JSON structure
    fingerprint: text("fingerprint"),
    validation: jsonb("validation").$type<ValidationResult>(),
  },
  (table) => [
    unique("source_observations_draw_source_hash_unique").on(
      table.drawId,
      table.source,
      table.contentHash
    ),
  ]
);
