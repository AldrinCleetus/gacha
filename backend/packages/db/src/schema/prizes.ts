import { pgTable, uuid, text, bigint, primaryKey, index } from "drizzle-orm/pg-core";
import { draws } from "./draws.js";

export type MatchType = "full" | "consolation" | "last4";

export const prizeTiers = pgTable(
  "prize_tiers",
  {
    drawId: uuid("draw_id")
      .notNull()
      .references(() => draws.id, { onDelete: "cascade" }),
    tier: text("tier").notNull(), // '1', '2', '3', 'consolation', '4'..'9'
    amount: bigint("amount", { mode: "number" }).notNull(), // prize amount in rupees
    matchType: text("match_type").$type<MatchType>().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.drawId, table.tier] }),
  ]
);

export const prizeEntries = pgTable(
  "prize_entries",
  {
    drawId: uuid("draw_id")
      .notNull()
      .references(() => draws.id, { onDelete: "cascade" }),
    tier: text("tier").notNull(),
    entry: text("entry").notNull(), // 'WA584920' or '4821'
  },
  (table) => [
    primaryKey({ columns: [table.drawId, table.tier, table.entry] }),
    index("prize_entries_draw_id_entry_idx").on(table.drawId, table.entry),
  ]
);
