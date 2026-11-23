import { pgTable, bigserial, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { draws } from "./draws.js";

export const ingestEvents = pgTable("ingest_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  drawId: uuid("draw_id").references(() => draws.id, { onDelete: "set null" }),
  kind: text("kind").notNull(), // 'publish' | 'override' | 'conflict' | 'validation_failed' | 'fetch_failed'
  detail: jsonb("detail"),
  at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
});
