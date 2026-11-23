import { ParsedDraw, getTodayIST, getWeekdayFromDate, WEEKDAY_NAMES } from "@gacha/shared";
export { getTodayIST, getWeekdayFromDate, WEEKDAY_NAMES };

export interface SchemeValidationConfig {
  code: string;
  name: string;
  weekday?: number | null; // 1 = Mon ... 7 = Sun (null for bumpers)
  isBumper?: boolean;
  structure?: {
    firstPrizeRupees?: number;
    expectedTiers?: string[];
    expectedTierCounts?: Record<string, number>;
  } | null;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/**
 * Validates a ParsedDraw against lottery rules and scheme configuration.
 * Strictly follows Section 4.3 of the design doc.
 */
export function validateParsedDraw(
  draw: ParsedDraw,
  schemeConfig?: SchemeValidationConfig | null,
  knownSeries?: string[]
): ValidationResult {
  const errors: string[] = [];

  // 1. Draw date validity and past/current check
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draw.drawDate)) {
    errors.push(`Invalid draw date format '${draw.drawDate}' (expected YYYY-MM-DD)`);
  } else {
    const today = getTodayIST();
    if (draw.drawDate > today) {
      errors.push(`Draw date ${draw.drawDate} is in the future (current IST date is ${today})`);
    }

    // 2. Weekday check against scheme
    if (schemeConfig && typeof schemeConfig.weekday === "number" && !schemeConfig.isBumper) {
      const actualWeekday = getWeekdayFromDate(draw.drawDate);
      if (actualWeekday !== schemeConfig.weekday) {
        const expectedDayName = WEEKDAY_NAMES[schemeConfig.weekday] || String(schemeConfig.weekday);
        const actualDayName = WEEKDAY_NAMES[actualWeekday] || String(actualWeekday);
        errors.push(
          `Weekday mismatch: ${draw.drawDate} is ${actualDayName} (weekday ${actualWeekday}), but scheme '${schemeConfig.code}' is scheduled for ${expectedDayName} (weekday ${schemeConfig.weekday})`
        );
      }
    }
  }

  // 3. Expected tiers presence
  const expectedTiers =
    schemeConfig?.structure?.expectedTiers || [
      "1",
      "consolation",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
    ];

  const presentTierKeys = new Set(draw.tiers.map((t) => t.tier));
  for (const exp of expectedTiers) {
    if (!presentTierKeys.has(exp)) {
      errors.push(`Missing expected prize tier '${exp}'`);
    }
  }

  // 4. Ticket format validation
  for (const t of draw.tiers) {
    if (t.matchType === "full") {
      for (const entry of t.entries) {
        if (!/^[A-Z]{2}\d{6}$/.test(entry)) {
          errors.push(
            `Tier '${t.tier}' entry '${entry}' is not a valid 8-character ticket (expected 2 uppercase letters + 6 digits)`
          );
        }
      }
    } else if (t.matchType === "last4") {
      for (const entry of t.entries) {
        if (!/^\d{4}$/.test(entry)) {
          errors.push(
            `Tier '${t.tier}' entry '${entry}' is not a valid 4-digit number`
          );
        }
      }
    }
  }

  // 5. Positive and descending amount checks
  for (const t of draw.tiers) {
    if (t.amount <= 0) {
      errors.push(`Tier '${t.tier}' amount must be positive, got ₹${t.amount}`);
    }
  }

  // Check descending amounts across standard numbered tiers: 1, 2, 3, 4, 5...
  const numberedTiers = draw.tiers
    .filter((t) => /^\d+$/.test(t.tier))
    .map((t) => ({ tierNum: parseInt(t.tier, 10), amount: t.amount, tierKey: t.tier }))
    .sort((a, b) => a.tierNum - b.tierNum);

  for (let i = 0; i < numberedTiers.length - 1; i++) {
    const current = numberedTiers[i];
    const next = numberedTiers[i + 1];

    // Tier 1 > Tier 2 > Tier 3 > Tier 4. Tiers 4+ can have equal amounts or strictly descending.
    if (current.tierNum <= 3) {
      if (next.amount >= current.amount) {
        errors.push(
          `Descending amount violation: Tier ${next.tierKey} amount (₹${next.amount}) must be strictly less than Tier ${current.tierKey} amount (₹${current.amount})`
        );
      }
    } else {
      if (next.amount > current.amount) {
        errors.push(
          `Descending amount violation: Tier ${next.tierKey} amount (₹${next.amount}) cannot exceed Tier ${current.tierKey} amount (₹${current.amount})`
        );
      }
    }
  }

  // 6. 1st prize series check
  const firstPrize = draw.tiers.find((t) => t.tier === "1");
  if (firstPrize && firstPrize.entries.length > 0) {
    const firstTicket = firstPrize.entries[0];
    const series = firstTicket.slice(0, 2);
    if (!/^[A-Z]{2}$/.test(series)) {
      errors.push(`1st prize series '${series}' must be 2 uppercase letters`);
    } else if (knownSeries && knownSeries.length > 0) {
      if (!knownSeries.includes(series)) {
        errors.push(
          `1st prize ticket series '${series}' does not belong to known series [${knownSeries.join(", ")}]`
        );
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
