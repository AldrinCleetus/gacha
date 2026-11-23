import { relations } from "drizzle-orm";
import { schemes, schemeSeries } from "./schemes.js";
import { draws } from "./draws.js";
import { prizeTiers, prizeEntries } from "./prizes.js";
import { sourceObservations } from "./observations.js";
import { winnerAgencies } from "./agencies.js";
import { ingestEvents } from "./events.js";

export const schemesRelations = relations(schemes, ({ many }) => ({
  series: many(schemeSeries),
  draws: many(draws),
}));

export const schemeSeriesRelations = relations(schemeSeries, ({ one }) => ({
  scheme: one(schemes, {
    fields: [schemeSeries.schemeCode],
    references: [schemes.code],
  }),
}));

export const drawsRelations = relations(draws, ({ one, many }) => ({
  scheme: one(schemes, {
    fields: [draws.schemeCode],
    references: [schemes.code],
  }),
  tiers: many(prizeTiers),
  entries: many(prizeEntries),
  observations: many(sourceObservations),
  agencies: many(winnerAgencies),
  events: many(ingestEvents),
}));

export const prizeTiersRelations = relations(prizeTiers, ({ one }) => ({
  draw: one(draws, {
    fields: [prizeTiers.drawId],
    references: [draws.id],
  }),
}));

export const prizeEntriesRelations = relations(prizeEntries, ({ one }) => ({
  draw: one(draws, {
    fields: [prizeEntries.drawId],
    references: [draws.id],
  }),
}));

export const sourceObservationsRelations = relations(sourceObservations, ({ one }) => ({
  draw: one(draws, {
    fields: [sourceObservations.drawId],
    references: [draws.id],
  }),
}));

export const winnerAgenciesRelations = relations(winnerAgencies, ({ one }) => ({
  draw: one(draws, {
    fields: [winnerAgencies.drawId],
    references: [draws.id],
  }),
}));

export const ingestEventsRelations = relations(ingestEvents, ({ one }) => ({
  draw: one(draws, {
    fields: [ingestEvents.drawId],
    references: [draws.id],
  }),
}));
