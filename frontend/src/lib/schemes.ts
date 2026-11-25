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
