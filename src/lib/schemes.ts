import schemesData from "@/data/schemes.json";
import { Scheme, SchemesFileSchema } from "@/types/lottery";

// Validate schemes on import
const validated = SchemesFileSchema.parse(schemesData);
export const SCHEMES = validated.schemes;

export const SCHEME_CODES = Object.keys(SCHEMES);

export function getScheme(codeOrChar?: string): Scheme {
  if (!codeOrChar) {
    return SCHEMES["W"] || Object.values(SCHEMES)[0];
  }
  const upper = codeOrChar.toUpperCase();
  const firstChar = upper.charAt(0);
  
  if (SCHEMES[firstChar]) {
    return SCHEMES[firstChar];
  }
  if (SCHEMES[upper]) {
    return SCHEMES[upper];
  }
  // Fallback to first scheme
  return SCHEMES["W"] || Object.values(SCHEMES)[0];
}

export function getAllSchemes(): Scheme[] {
  return Object.values(SCHEMES);
}

export function getSchemeThemeStyle(codeOrChar?: string): React.CSSProperties {
  const scheme = getScheme(codeOrChar);
  const theme = scheme.theme;
  
  return {
    "--scheme-primary": theme.primary,
    "--scheme-secondary": theme.secondary,
    "--scheme-accent": theme.accent,
    "--scheme-bg": theme.bgLight,
    "--scheme-surface": theme.surfaceLight,
    "--scheme-border": theme.borderLight,
    "--scheme-glow": theme.glow,
  } as React.CSSProperties;
}
