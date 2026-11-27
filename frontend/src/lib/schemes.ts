import schemesData from "@/schemes.json";
import { Scheme, SchemesFileSchema } from "@/types";

const validated = SchemesFileSchema.parse(schemesData);
export const SCHEMES = validated.schemes;
export const SCHEME_CODES = Object.keys(SCHEMES);

export function getScheme(codeOrChar?: string): Scheme {
  if (!codeOrChar) {
    return SCHEMES["W"] || Object.values(SCHEMES)[0];
  }
  const upper = codeOrChar.toUpperCase();
  // 1. Exact match (e.g. "BT", "SS", "AK", "KN", "NR", "KR", "SM")
  if (SCHEMES[upper]) return SCHEMES[upper];
  // 2. First character match (e.g. "B" -> BT, "W" -> W, "N" -> NR)
  const firstChar = upper.charAt(0);
  if (SCHEMES[firstChar]) return SCHEMES[firstChar];
  // 3. Fallback
  return SCHEMES["W"] || Object.values(SCHEMES)[0];
}

export function getAllSchemes(): Scheme[] {
  return Object.values(SCHEMES);
}

/**
 * Returns deduplicated list of lottery schemes keyed by canonical scheme code.
 */
export function getUniqueSchemes(): Scheme[] {
  const seen = new Map<string, Scheme>();
  for (const s of Object.values(SCHEMES)) {
    if (!seen.has(s.code)) {
      seen.set(s.code, s);
    }
  }
  return Array.from(seen.values());
}

export function getSchemeThemeStyle(codeOrChar?: string): React.CSSProperties {
  const scheme = getScheme(codeOrChar);
  return {
    "--scheme-bg": scheme.theme.bg,
    "--scheme-border": scheme.theme.border,
    "--scheme-text": scheme.theme.text,
  } as React.CSSProperties;
}

export interface UpcomingDrawItem {
  dateStr: string;
  dayLabel: string;
  isToday: boolean;
  isTomorrow: boolean;
  scheme: Scheme;
}

const WEEKLY_SCHEDULE_BY_JS_DAY: Record<number, string> = {
  0: "SM", // Sunday - Samrudhi
  1: "BT", // Monday - Bhagyathara
  2: "SS", // Tuesday - Sthree Sakthi
  3: "DL", // Wednesday - Dhanalekshmi
  4: "KN", // Thursday - Karunya Plus
  5: "SK", // Friday - Suvarna Keralam
  6: "KR", // Saturday - Karunya
};

/**
 * Computes the next scheduled Kerala State Lottery draws starting from today (IST).
 * Skips today if today's draw has already been published.
 */
export function getUpcomingDraws(
  count = 4,
  publishedDates: string[] = []
): UpcomingDrawItem[] {
  const publishedSet = new Set(publishedDates);

  // Determine today's calendar date in Asia/Kolkata (YYYY-MM-DD)
  const istParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const [y, m, d] = istParts.split("-").map(Number);
  const baseDateUtc = new Date(Date.UTC(y, m - 1, d));

  const upcoming: UpcomingDrawItem[] = [];
  for (let offset = 0; offset < 14 && upcoming.length < count; offset++) {
    const dt = new Date(baseDateUtc.getTime() + offset * 86400_000);
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;

    // If today's draw is already published, start listing upcoming from tomorrow
    if (offset === 0 && publishedSet.has(dateStr)) {
      continue;
    }

    const jsDay = dt.getUTCDay();
    const schemeCode = WEEKLY_SCHEDULE_BY_JS_DAY[jsDay] || "BT";
    const scheme = getScheme(schemeCode);

    const formatted = dt.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });

    upcoming.push({
      dateStr,
      dayLabel: offset === 0 ? `Today · ${formatted}` : offset === 1 ? `Tomorrow · ${formatted}` : formatted,
      isToday: offset === 0,
      isTomorrow: offset === 1,
      scheme,
    });
  }

  return upcoming;
}
