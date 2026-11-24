import { ParsedDraw, ParsedDrawSchema, PrizeTier, WinnerAgency } from "@gacha/shared";
import { extractTextLinesFromPdf, computeBufferHash } from "./extractor.js";

export class OfficialParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfficialParseError";
  }
}

/**
 * Parses currency amount from official Kerala lottery result PDF text.
 * e.g. "Rs :1,00,00,000/-" -> 10000000
 * e.g. "Rs. 5,000/-" -> 5000
 * e.g. "Rs :25,00,000/- [25 Lakhs]" -> 2500000
 */
export function parseOfficialAmount(raw: string): number {
  const cleaned = raw.replace(/,/g, "");

  // Match 1 Crore or X Crores
  const crMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:cr|crore|crores)/i);
  if (crMatch) {
    return Math.round(parseFloat(crMatch[1]) * 10_000_000);
  }

  // Match X Lakhs
  const lakhMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lac|lacs)/i);
  if (lakhMatch) {
    return Math.round(parseFloat(lakhMatch[1]) * 100_000);
  }

  // Match raw number after Rs. / Rs : / Rs / ₹
  const numMatch = cleaned.match(/(?:Rs\.?|₹)\s*[:.-]?\s*(\d+)/i);
  if (numMatch) {
    const val = parseInt(numMatch[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }

  // Match number preceding /-
  const dashMatch = cleaned.match(/(\d+)\s*\/-/);
  if (dashMatch) {
    const val = parseInt(dashMatch[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }

  // Match any isolated integer >= 100
  const anyIntMatch = cleaned.match(/\b(\d{3,8})\b/);
  if (anyIntMatch) {
    const val = parseInt(anyIntMatch[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }

  throw new OfficialParseError(`Could not parse amount from: "${raw}"`);
}

/**
 * Normalizes date from DD/MM/YYYY or DD-MM-YYYY to YYYY-MM-DD.
 */
function normalizeDate(rawDate: string): string {
  const parts = rawDate.split(/[\/\.-]/);
  if (parts.length === 3) {
    const day = parts[0].padStart(2, "0");
    const month = parts[1].padStart(2, "0");
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  throw new OfficialParseError(`Invalid date format in official PDF: "${rawDate}"`);
}

/**
 * Parses official Kerala state lottery PDF into a strongly validated ParsedDraw object.
 */
export async function parseOfficialPdf(
  buffer: Buffer | Uint8Array,
  sourceUrl = "manual-upload"
): Promise<ParsedDraw> {
  const contentHash = computeBufferHash(buffer);
  const lines = await extractTextLinesFromPdf(buffer);

  if (lines.length === 0) {
    throw new OfficialParseError("Official PDF contains no extractable text lines");
  }

  // Check official header markers
  const fullText = lines.join("\n");
  const isOfficial = /KERALA\s+STATE\s+LOTTERIES/i.test(fullText) ||
    /DIRECTORATE\s+OF\s+STATE\s+LOTTERIES/i.test(fullText) ||
    /GORKY\s+BHAVAN/i.test(fullText);

  if (!isOfficial) {
    throw new OfficialParseError("PDF does not appear to be an official Kerala State Lottery result (missing departmental header)");
  }

  // Extract Scheme, Draw Code, Draw Date
  // e.g. "SAMRUDHI LOTTERY NO. SM-82nd DRAW held on 22/11/2026 AT GORKY BHAVAN"
  // e.g. "KARUNYA LOTTERY NO. KR-762nd DRAW held on 25/07/2026 AT GORKY BHAVAN"
  const headerRegex = /([A-Z\s]+?)\s+LOTTERY\s+NO\.?\s*([A-Z]{2})[- ]?(\d+)(?:st|nd|rd|th)?\s+DRAW\s+held\s+on\s+(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{4})/i;
  const headerMatch = fullText.match(headerRegex);

  if (!headerMatch) {
    throw new OfficialParseError("Could not find draw metadata header (Lottery Name, Draw Code, Draw Date) in official PDF");
  }

  const rawSchemeName = headerMatch[1].trim();
  const schemeCode = headerMatch[2].toUpperCase();
  const drawNum = headerMatch[3];
  const drawCode = `${schemeCode}-${drawNum}`;
  const drawDate = normalizeDate(headerMatch[4]);

  // Capitalize scheme name nicely: "SAMRUDHI" -> "Samrudhi"
  const schemeName = rawSchemeName.charAt(0).toUpperCase() + rawSchemeName.slice(1).toLowerCase();

  // Tier parsing
  const tiers: PrizeTier[] = [];
  const agents: WinnerAgency[] = [];

  // Identify section indices
  interface TierHeader {
    index: number;
    tierName: string;
    tierKey: string;
    headerLine: string;
  }

  const tierHeaderRegex = /^(1st|2nd|3rd|4th|5th|6th|7th|8th|9th|10th|Consolation)\s+Prize/i;
  const detectedHeaders: TierHeader[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(tierHeaderRegex);
    if (match) {
      const tierName = match[1];
      const tierKey = tierName.toLowerCase() === "consolation" ? "consolation" : tierName.replace(/\D/g, "");
      detectedHeaders.push({
        index: i,
        tierName,
        tierKey,
        headerLine: line,
      });
    }
  }

  if (detectedHeaders.length === 0) {
    throw new OfficialParseError("No prize tiers detected in official PDF");
  }

  // Parse each section
  for (let h = 0; h < detectedHeaders.length; h++) {
    const current = detectedHeaders[h];
    const nextIndex = h + 1 < detectedHeaders.length ? detectedHeaders[h + 1].index : lines.length;
    const sectionLines = lines.slice(current.index, nextIndex);
    const sectionText = sectionLines.join("\n");

    // Amount parse
    const amount = parseOfficialAmount(current.headerLine);

    if (current.tierKey === "1" || current.tierKey === "2" || current.tierKey === "3") {
      // Full ticket matches
      const ticketRegex = /([A-Z]{2})\s*(\d{6})/g;
      const tickets: string[] = [];
      let tMatch: RegExpExecArray | null;

      while ((tMatch = ticketRegex.exec(sectionText)) !== null) {
        tickets.push(`${tMatch[1]}${tMatch[2]}`);
      }

      if (tickets.length === 0) {
        throw new OfficialParseError(`No winning tickets found for Tier ${current.tierKey}`);
      }

      tiers.push({
        tier: current.tierKey,
        amount,
        matchType: "full",
        entries: tickets,
      });

      // Extract winner agent info if present
      // e.g. "Agent Name: SHINE D T"
      // e.g. "Agency No.: T 3795"
      // e.g. "KB 845108 (ATTINGAL)"
      const agentNameMatch = sectionText.match(/Agent\s*Name\s*:\s*([^,\n\r]+)/i);
      const agencyNoMatch = sectionText.match(/Agency\s*No\.?\s*:\s*([A-Z0-9\s-]+)/i);
      const placeMatch = sectionText.match(/\(([A-Z\s]+)\)/);

      if (agentNameMatch || agencyNoMatch || placeMatch) {
        agents.push({
          tier: current.tierKey,
          ticket: tickets[0],
          agencyName: agentNameMatch ? agentNameMatch[1].trim() : undefined,
          agencyCode: agencyNoMatch ? agencyNoMatch[1].trim() : undefined,
          place: placeMatch ? placeMatch[1].trim() : undefined,
        });
      }
    } else if (current.tierKey === "consolation") {
      // Consolation series tickets
      const ticketRegex = /([A-Z]{2})\s*(\d{6})/g;
      const tickets: string[] = [];
      let tMatch: RegExpExecArray | null;

      while ((tMatch = ticketRegex.exec(sectionText)) !== null) {
        tickets.push(`${tMatch[1]}${tMatch[2]}`);
      }

      tiers.push({
        tier: "consolation",
        amount,
        matchType: "consolation",
        entries: tickets,
      });
    } else {
      // 4th prize onwards: 4-digit numbers
      const numRegex = /\b(\d{4})\b/g;
      const nums: string[] = [];
      let nMatch: RegExpExecArray | null;

      // Extract from lines after the header
      const bodyLines = sectionLines.slice(1).join(" ");
      while ((nMatch = numRegex.exec(bodyLines)) !== null) {
        nums.push(nMatch[1]);
      }

      if (nums.length === 0) {
        throw new OfficialParseError(`No winning numbers found for Tier ${current.tierKey}`);
      }

      tiers.push({
        tier: current.tierKey,
        amount,
        matchType: "last4",
        entries: nums,
      });
    }
  }

  // Validate that Tier 1 is present
  if (!tiers.some((t) => t.tier === "1")) {
    throw new OfficialParseError("Official PDF is missing 1st Prize");
  }

  const parsedDraw: ParsedDraw = {
    source: "official",
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    schemeName,
    schemeCode,
    drawCode,
    drawDate,
    tiers,
    agents: agents.length > 0 ? agents : undefined,
    raw: {
      contentHash,
    },
  };

  return ParsedDrawSchema.parse(parsedDraw);
}
