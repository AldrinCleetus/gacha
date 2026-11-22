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
  const firstChar = upper.charAt(0);
  if (SCHEMES[firstChar]) return SCHEMES[firstChar];
  if (SCHEMES[upper]) return SCHEMES[upper];
  return SCHEMES["W"] || Object.values(SCHEMES)[0];
}

export function getAllSchemes(): Scheme[] {
  return Object.values(SCHEMES);
}

export function getSchemeThemeStyle(codeOrChar?: string): React.CSSProperties {
  const scheme = getScheme(codeOrChar);
  return {
    "--scheme-bg": scheme.theme.bg,
    "--scheme-border": scheme.theme.border,
    "--scheme-text": scheme.theme.text,
  } as React.CSSProperties;
}
