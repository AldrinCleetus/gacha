import { describe, it, expect } from "vitest";
import { SEED_SCHEMES } from "../seed.js";
import { resolveMigrationsFolder } from "../migrate.js";
import { existsSync, readdirSync } from "fs";
import {
  schemes,
  schemeSeries,
  draws,
  prizeTiers,
  prizeEntries,
  sourceObservations,
  winnerAgencies,
  ingestEvents,
} from "../schema/index.js";

describe("Database Schema & Seed Configuration", () => {
  it("should have all 8 required tables defined in schema", () => {
    expect(schemes).toBeDefined();
    expect(schemeSeries).toBeDefined();
    expect(draws).toBeDefined();
    expect(prizeTiers).toBeDefined();
    expect(prizeEntries).toBeDefined();
    expect(sourceObservations).toBeDefined();
    expect(winnerAgencies).toBeDefined();
    expect(ingestEvents).toBeDefined();
  });

  it("should seed exactly 7 weekly schemes covering all days of the week", () => {
    expect(SEED_SCHEMES.length).toBe(7);

    const weekdays = SEED_SCHEMES.map((s) => s.weekday).sort((a, b) => a - b);
    expect(weekdays).toEqual([1, 2, 3, 4, 5, 6, 7]);

    const codes = SEED_SCHEMES.map((s) => s.code);
    expect(codes).toContain("BT"); // Mon
    expect(codes).toContain("SS"); // Tue
    expect(codes).toContain("DL"); // Wed
    expect(codes).toContain("KN"); // Thu
    expect(codes).toContain("SK"); // Fri
    expect(codes).toContain("KR"); // Sat
    expect(codes).toContain("SM"); // Sun
  });

  it("should flag Suvarna Keralam (SK) as needing confirmation from data", () => {
    const sk = SEED_SCHEMES.find((s) => s.code === "SK");
    expect(sk).toBeDefined();
    expect(sk?.name).toBe("Suvarna Keralam");
    expect(sk?.weekday).toBe(5);
    expect(sk?.structure.confirmed).toBe(false);
    expect(sk?.structure.needsConfirmation).toBe(true);
    expect(sk?.structure.note).toContain("needs confirmation");

    // All other schemes should be confirmed
    const others = SEED_SCHEMES.filter((s) => s.code !== "SK");
    for (const scheme of others) {
      expect(scheme.structure.confirmed).toBe(true);
    }
  });

  it("should locate the drizzle migrations folder containing SQL migration files", () => {
    const folder = resolveMigrationsFolder();
    expect(existsSync(folder)).toBe(true);

    const files = readdirSync(folder);
    const sqlFiles = files.filter((f) => f.endsWith(".sql"));
    expect(sqlFiles.length).toBeGreaterThan(0);
  });
});
