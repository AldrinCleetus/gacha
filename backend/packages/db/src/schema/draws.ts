import { pgTable, uuid, text, date, timestamp, unique, index } from "drizzle-orm/pg-core";
import { schemes } from "./schemes.js";

export type DrawStatus = "expected" | "observed" | "published" | "needs_review";

export const draws = pgTable(
  "draws",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schemeCode: text("scheme_code")
      .notNull()
      .references(() => schemes.code),
    drawCode: text("draw_code").notNull(), // 'BT-80'
    drawDate: date("draw_date").notNull(), // YYYY-MM-DD
    status: text("status").$type<DrawStatus>().notNull(), // expected | observed | published | needs_review
    publishedAt: timestamp("published_at", { withTimezone: true }),
    fingerprint: text("fingerprint"), // SHA-256 hash of normalized prize tiers/entries
  },
  (table) => [
    unique("draws_scheme_draw_code_unique").on(table.schemeCode, table.drawCode),
    index("draws_draw_date_desc_idx").on(table.drawDate.desc()),
  ]
);
