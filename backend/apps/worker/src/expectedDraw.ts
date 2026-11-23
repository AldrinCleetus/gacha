import {
  DbClient,
  getDb,
  schemes,
  draws,
  ingestEvents,
  eq,
  and,
  desc,
} from "@gacha/db";
import { getWeekdayFromDate, Clock, SystemClock } from "@gacha/shared";
import { getISTDateParts } from "./pollingWindow.js";

export interface EnsureExpectedDrawResult {
  created: boolean;
  schemeCode: string;
  schemeName: string;
  drawCode: string;
  drawDate: string;
  drawId?: string;
  status: string;
}

/**
 * Ensures that a draw record in 'expected' status exists for today's scheduled scheme.
 * Follows Section 4.1 & 6 of the design doc:
 * - Identifies scheme scheduled for the IST calendar weekday.
 * - If no draw exists for that scheme and date, computes next sequential draw code
 *   and inserts with status 'expected'.
 * - Records audit event 'expected_created' in ingest_events.
 */
export async function ensureExpectedDraw(
  db: DbClient = getDb(),
  targetDate?: string,
  clock: Clock = new SystemClock()
): Promise<EnsureExpectedDrawResult | null> {
  const dateStr = targetDate || getISTDateParts(clock.now()).dateStr;
  const weekday = getWeekdayFromDate(dateStr);

  // 1. Find the scheduled weekly scheme for this weekday
  const scheme = await db.query.schemes.findFirst({
    where: and(eq(schemes.weekday, weekday), eq(schemes.isBumper, false)),
  });

  if (!scheme) {
    return null;
  }

  // 2. Check if a draw already exists for this scheme and date
  const existingDraw = await db.query.draws.findFirst({
    where: and(eq(draws.schemeCode, scheme.code), eq(draws.drawDate, dateStr)),
  });

  if (existingDraw) {
    return {
      created: false,
      schemeCode: scheme.code,
      schemeName: scheme.name,
      drawCode: existingDraw.drawCode,
      drawDate: dateStr,
      drawId: existingDraw.id,
      status: existingDraw.status,
    };
  }

  // 3. Compute next drawCode based on previous draws for this scheme
  const previousDraws = await db.query.draws.findMany({
    where: eq(draws.schemeCode, scheme.code),
    orderBy: [desc(draws.drawDate)],
    limit: 5,
  });

  let nextDrawCodeNumber: number | null = null;
  for (const prev of previousDraws) {
    const match = prev.drawCode.match(new RegExp(`^${scheme.code}[-_](\\d+)$`, "i"));
    if (match) {
      nextDrawCodeNumber = parseInt(match[1], 10) + 1;
      break;
    }
  }

  const drawCode = nextDrawCodeNumber
    ? `${scheme.code}-${nextDrawCodeNumber}`
    : `${scheme.code}-${dateStr.replace(/-/g, "")}`;

  // 4. Insert expected draw
  const [createdDraw] = await db
    .insert(draws)
    .values({
      schemeCode: scheme.code,
      drawCode,
      drawDate: dateStr,
      status: "expected",
    })
    .onConflictDoNothing()
    .returning({ id: draws.id, status: draws.status });

  if (createdDraw) {
    await db.insert(ingestEvents).values({
      drawId: createdDraw.id,
      kind: "expected_created",
      detail: {
        schemeCode: scheme.code,
        drawCode,
        drawDate: dateStr,
        weekday,
      },
    });

    return {
      created: true,
      schemeCode: scheme.code,
      schemeName: scheme.name,
      drawCode,
      drawDate: dateStr,
      drawId: createdDraw.id,
      status: "expected",
    };
  }

  return null;
}
