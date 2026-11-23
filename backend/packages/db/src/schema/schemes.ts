import { pgTable, text, smallint, numeric, boolean, jsonb, primaryKey } from "drizzle-orm/pg-core";

export interface SchemeStructure {
  confirmed: boolean;
  needsConfirmation?: boolean;
  note?: string;
  dayName: string;
  firstPrizeRupees: number;
  expectedTiers?: string[];
}

export const schemes = pgTable("schemes", {
  code: text("code").primaryKey(), // 'BT', 'SS', 'DL', 'KN', 'SK', 'KR', 'SM'
  name: text("name").notNull(), // 'Bhagyathara', etc.
  weekday: smallint("weekday"), // 1 = Mon ... 7 = Sun (null for bumpers)
  ticketPrice: numeric("ticket_price", { precision: 8, scale: 2 }),
  isBumper: boolean("is_bumper").default(false).notNull(),
  structure: jsonb("structure").$type<SchemeStructure>(),
});

export const schemeSeries = pgTable(
  "scheme_series",
  {
    schemeCode: text("scheme_code")
      .notNull()
      .references(() => schemes.code, { onDelete: "cascade" }),
    series: text("series").notNull(), // 'WA', 'WB' ... derived from parsed draws
  },
  (table) => [
    primaryKey({ columns: [table.schemeCode, table.series] }),
  ]
);
