import { pgTable, uuid, text, primaryKey } from "drizzle-orm/pg-core";
import { draws } from "./draws.js";

export const winnerAgencies = pgTable(
  "winner_agencies",
  {
    drawId: uuid("draw_id")
      .notNull()
      .references(() => draws.id, { onDelete: "cascade" }),
    tier: text("tier").notNull(),
    ticket: text("ticket").notNull(),
    agencyName: text("agency_name"),
    agencyCode: text("agency_code"),
    place: text("place"),
    source: text("source").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.drawId, table.tier, table.ticket, table.source] }),
  ]
);
