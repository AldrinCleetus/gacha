import { ParsedTicket } from "@/types/lottery";
import { getScheme } from "./schemes";

/**
 * Parses and validates a Kerala lottery ticket number.
 * Accepts formats:
 * - "AB123456"
 * - "AB 123456"
 * - "ab-123456"
 * - "w a 5 8 4 9 2 0"
 * Returns a structured ParsedTicket.
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

  // Strip all hyphens, spaces, and non-alphanumeric chars
  const sanitized = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const characters: string[] = ["", "", "", "", "", "", "", ""];
  for (let i = 0; i < 8; i++) {
    characters[i] = sanitized.charAt(i) || "";
  }

  const schemeCode = sanitized.charAt(0) || "";
  const seriesChar = sanitized.charAt(1) || "";
  const series = schemeCode + seriesChar;
  const digits = sanitized.slice(2, 8);

  const formattedTicket = schemeCode && seriesChar 
    ? `${series}${digits ? ` ${digits}` : ""}`
    : sanitized;

  // Validation checks
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
      error: `Incomplete ticket: ${8 - sanitized.length} character${8 - sanitized.length === 1 ? "" : "s"} missing`,
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

  // Validate letter 1 & 2
  const letterRegex = /^[A-Z]{2}/;
  if (!letterRegex.test(sanitized.slice(0, 2))) {
    return {
      rawInput: raw,
      schemeCode,
      seriesChar,
      series,
      digits,
      fullTicketString: formattedTicket,
      characters,
      isValid: false,
      error: "First two characters must be series letters (e.g. WA, SB, AK)",
    };
  }

  // Validate 6 digits
  const digitsRegex = /^[0-9]{6}$/;
  if (!digitsRegex.test(digits)) {
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
