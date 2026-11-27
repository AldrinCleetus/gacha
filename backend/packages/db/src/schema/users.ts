import {
  pgTable,
  text,
  integer,
  date,
  timestamp,
  jsonb,
  unique,
  index,
} from "drizzle-orm/pg-core";

export interface SavedMatchResult {
  kind: "jackpot" | "mid" | "small" | "none";
  tier: string;
  amount: number;
  formattedAmount: string;
  matchedIndices: number[];
  closestMatch?: string;
  summary: string;
}

export const users = pgTable("users", {
  clerkId: text("clerk_id").primaryKey(),
  email: text("email"),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userTickets = pgTable(
  "user_tickets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.clerkId, { onDelete: "cascade" }),
    ticketString: text("ticket_string").notNull(),
    normalizedTicket: text("normalized_ticket").notNull(),
    schemeCode: text("scheme_code").notNull(),
    series: text("series").notNull(),
    digits: text("digits").notNull(),
    drawCode: text("draw_code").notNull(),
    drawDate: date("draw_date").notNull(),
    checkedAt: timestamp("checked_at", { withTimezone: true }).defaultNow().notNull(),
    cost: integer("cost").default(40).notNull(),
    wonAmount: integer("won_amount").default(0).notNull(),
    result: jsonb("result").$type<SavedMatchResult>().notNull(),
  },
  (table) => [
    unique("user_tickets_user_ticket_draw_unique").on(
      table.userId,
      table.normalizedTicket,
      table.drawCode
    ),
    index("user_tickets_user_checked_at_idx").on(
      table.userId,
      table.checkedAt.desc()
    ),
  ]
);
