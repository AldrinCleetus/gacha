import { ParsedTicket } from "./schemas.js";

/**
 * Parses raw lottery ticket input into standardized ParsedTicket.
 * Accepts formats:
 * - "AB 123456" (standard space separated)
 * - "AB123456" (compact)
 * - "ab-123456" (hyphenated lowercase)
 * - "  w a - 5 8 4 9 2 0 " (scattered spaces/hyphens)
 */
export function parseTicket(raw: string): ParsedTicket {
  if (!raw || typeof raw !== "string") {
    return {
      rawInput: "",
      schemeCode: "",
      seriesChar: "",
      series: "",
      digits: "",
      fullTicketString: "",
      characters: ["", "", "", "", "", "", "", ""],
      isValid: false,
      error: "Ticket number is empty",
    };
  }

  // Strip spaces, hyphens, and non-alphanumeric characters
  const sanitized = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const characters: string[] = ["", "", "", "", "", "", "", ""];
  for (let i = 0; i < 8; i++) {
    characters[i] = sanitized.charAt(i) || "";
  }

  const schemeCode = sanitized.charAt(0) || "";
  const seriesChar = sanitized.charAt(1) || "";
  const series = schemeCode + seriesChar;
  const digits = sanitized.slice(2, 8);

  const formattedTicket =
    schemeCode && seriesChar ? `${series}${digits ? ` ${digits}` : ""}` : sanitized;

  if (sanitized.length < 8) {
    return {
      rawInput: raw,
      schemeCode,
      seriesChar,
      series,
      digits,
      fullTicketString: formattedTicket,
      characters,
      isValid: false,
      error: `Incomplete ticket: ${8 - sanitized.length} characters missing`,
    };
  }

  if (sanitized.length > 8) {
    return {
      rawInput: raw,
      schemeCode,
      seriesChar,
      series,
      digits,
      fullTicketString: formattedTicket,
      characters,
      isValid: false,
      error: "Ticket number cannot exceed 8 characters (2 letters + 6 digits)",
    };
  }

  // First 2 characters must be letters
  if (!/^[A-Z]{2}$/.test(sanitized.slice(0, 2))) {
    return {
      rawInput: raw,
      schemeCode,
      seriesChar,
      series,
      digits,
      fullTicketString: formattedTicket,
      characters,
      isValid: false,
      error: "First two characters must be series letters (e.g. WA)",
    };
  }

  // Remaining 6 characters must be numeric
  if (!/^[0-9]{6}$/.test(digits)) {
    return {
      rawInput: raw,
      schemeCode,
      seriesChar,
      series,
      digits,
      fullTicketString: formattedTicket,
      characters,
      isValid: false,
      error: "Last 6 characters must be numeric digits",
    };
  }

  return {
    rawInput: raw,
    schemeCode,
    seriesChar,
    series,
    digits,
    fullTicketString: `${series} ${digits}`,
    characters,
    isValid: true,
  };
}
