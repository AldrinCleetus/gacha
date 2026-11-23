import * as crypto from "node:crypto";
import * as cheerio from "cheerio";
import { DrawRef, ParsedDraw, ParsedDrawSchema, PrizeTier } from "@gacha/shared";

export class ParseError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = "ParseError";
  }
}

/**
 * Maps scheme names or slugs to known Kerala lottery scheme codes.
 */
const KNOWN_SCHEMES: Record<string, { name: string; code: string }> = {
  bt: { name: "Bhagyathara", code: "BT" },
  bhagyathara: { name: "Bhagyathara", code: "BT" },
  ss: { name: "Sthree Sakthi", code: "SS" },
  "sthree-sakthi": { name: "Sthree Sakthi", code: "SS" },
  dl: { name: "Dhanalekshmi", code: "DL" },
  dhanalekshmi: { name: "Dhanalekshmi", code: "DL" },
  kn: { name: "Karunya Plus", code: "KN" },
  "karunya-plus": { name: "Karunya Plus", code: "KN" },
  sk: { name: "Suvarna Keralam", code: "SK" },
  "suvarna-keralam": { name: "Suvarna Keralam", code: "SK" },
  kr: { name: "Karunya", code: "KR" },
  karunya: { name: "Karunya", code: "KR" },
  sm: { name: "Samrudhi", code: "SM" },
  samrudhi: { name: "Samrudhi", code: "SM" },
  w: { name: "Win-Win", code: "W" },
  "win-win": { name: "Win-Win", code: "W" },
  ff: { name: "Fifty Fifty", code: "FF" },
  "fifty-fifty": { name: "Fifty Fifty", code: "FF" },
  ak: { name: "Akshaya", code: "AK" },
  akshaya: { name: "Akshaya", code: "AK" },
  nr: { name: "Nirmal", code: "NR" },
  nirmal: { name: "Nirmal", code: "NR" },
};

export function parseAmount(text: string): number {
  const clean = text.replace(/₹/g, "").replace(/,/g, "").trim().toLowerCase();
  const crMatch = clean.match(/([\d.]+)\s*(?:cr|crore|crores)/);
  if (crMatch) {
    return Math.round(parseFloat(crMatch[1]) * 10000000);
  }
  const lakhMatch = clean.match(/([\d.]+)\s*(?:lakh|lakhs|lac|lacs)/);
  if (lakhMatch) {
    return Math.round(parseFloat(lakhMatch[1]) * 100000);
  }
  const kMatch = clean.match(/([\d.]+)\s*k/);
  if (kMatch) {
    return Math.round(parseFloat(kMatch[1]) * 1000);
  }
  const numMatch = clean.match(/(\d+)/);
  if (numMatch) {
    return parseInt(numMatch[1], 10);
  }
  return 0;
}

const TIER_WORD_TO_NUM: Record<string, string> = {
  first: "1",
  "1st": "1",
  second: "2",
  "2nd": "2",
  third: "3",
  "3rd": "3",
  fourth: "4",
  "4th": "4",
  fifth: "5",
  "5th": "5",
  sixth: "6",
  "6th": "6",
  seventh: "7",
  "7th": "7",
  eighth: "8",
  "8th": "8",
  ninth: "9",
  "9th": "9",
  tenth: "10",
  "10th": "10",
  consolation: "consolation",
};

/**
 * Parses the Onmanorama lottery topic listing page.
 * Returns discovered DrawRef items sorted newest first.
 */
export function parseListing(html: string): DrawRef[] {
  const $ = cheerio.load(html);
  const regex =
    /\/news\/kerala\/(\d{4})\/(\d{2})\/(\d{2})\/([a-z0-9-]+)-([a-z]{2})-(\d+)-lottery-results.*\.html/i;

  const refs: DrawRef[] = [];
  const seenDrawCodes = new Set<string>();

  $("a").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const match = href.match(regex);
    if (!match) return;

    const [, year, month, day, , code, num] = match;
    const drawDate = `${year}-${month}-${day}`;
    const schemeCode = code.toUpperCase();
    const drawCode = `${schemeCode}-${num}`;

    if (seenDrawCodes.has(drawCode)) return;
    seenDrawCodes.add(drawCode);

    const fullUrl = href.startsWith("http")
      ? href
      : `https://www.onmanorama.com${href}`;

    refs.push({
      schemeCode,
      drawCode,
      drawDate,
      url: fullUrl,
    });
  });

  return refs;
}

/**
 * Parses an Onmanorama lottery results article into a validated ParsedDraw.
 */
export function parseArticle(html: string, sourceUrl?: string): ParsedDraw {
  if (!html || typeof html !== "string") {
    throw new ParseError("HTML content is required");
  }

  const $ = cheerio.load(html);

  // 1. Resolve canonical/source URL
  const resolvedUrl =
    sourceUrl ||
    $('link[rel="canonical"]').attr("href") ||
    $('meta[property="og:url"]').attr("content") ||
    "";

  // 2. Extract Draw Metadata: schemeCode, drawCode, drawDate, schemeName
  let schemeCode = "";
  let drawCode = "";
  let drawDate = "";
  let schemeName = "";

  // Try URL pattern first: /news/kerala/YYYY/MM/DD/<slug>-<CODE>-<NUM>-...
  const urlMatch = resolvedUrl.match(
    /\/news\/kerala\/(\d{4})\/(\d{2})\/(\d{2})\/([a-z0-9-]+)-([a-z]{2})-(\d+)-lottery-results/i
  );

  if (urlMatch) {
    const [, year, month, day, slug, code, num] = urlMatch;
    drawDate = `${year}-${month}-${day}`;
    schemeCode = code.toUpperCase();
    drawCode = `${schemeCode}-${num}`;
    const mapped = KNOWN_SCHEMES[slug.toLowerCase()] || KNOWN_SCHEMES[code.toLowerCase()];
    schemeName = mapped ? mapped.name : slug.split("-").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
  }

  // Fallback to title/h1 if not found in URL
  const pageTitle = $("title").text().trim();
  const h1Text = $("h1").text().trim();
  const titleCombined = `${pageTitle} ${h1Text}`;

  if (!drawCode) {
    const codeMatch = titleCombined.match(/\b([A-Z]{2})\s*-\s*(\d+)\b/i);
    if (codeMatch) {
      schemeCode = codeMatch[1].toUpperCase();
      drawCode = `${schemeCode}-${codeMatch[2]}`;
    }
  }

  if (!drawDate) {
    // Try DD/MM/YYYY or DD.MM.YYYY
    const dateMatch = titleCombined.match(/\b(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})\b/);
    if (dateMatch) {
      const day = dateMatch[1].padStart(2, "0");
      const month = dateMatch[2].padStart(2, "0");
      const year = dateMatch[3];
      drawDate = `${year}-${month}-${day}`;
    }
  }

  if (!schemeName && schemeCode) {
    const mapped = KNOWN_SCHEMES[schemeCode.toLowerCase()];
    schemeName = mapped ? mapped.name : schemeCode;
  }

  if (!drawCode || !schemeCode || !drawDate) {
    throw new ParseError(
      `Failed to extract draw metadata from article (drawCode: ${drawCode}, schemeCode: ${schemeCode}, drawDate: ${drawDate})`
    );
  }

  // 3. Extract prize lines
  // Replace <br> with \n so that inline paragraphs preserve distinct prize lines
  $("br").replaceWith("\n");

  const lines: string[] = [];
  $("p").each((_, el) => {
    const text = $(el).text();
    text.split("\n").forEach((l) => {
      const trimmed = l.trim();
      if (trimmed) lines.push(trimmed);
    });
  });

  const tiers: PrizeTier[] = [];
  const seenTiers = new Set<string>();

  for (const line of lines) {
    const tierMatch = line.match(
      /^(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|sixth|6th|seventh|7th|eighth|8th|ninth|9th|tenth|10th|consolation)\s+prize\s*:\s*([^–\-\n]+)(?:[–\-]\s*(.*))?$/i
    );
    if (!tierMatch) continue;

    const rawTierWord = tierMatch[1].toLowerCase();
    const rawAmount = tierMatch[2].trim();
    const rest = (tierMatch[3] || "").trim();
    const tierKey = TIER_WORD_TO_NUM[rawTierWord] || rawTierWord;

    if (seenTiers.has(tierKey)) continue;
    seenTiers.add(tierKey);

    const amount = parseAmount(rawAmount);

    if (tierKey === "consolation") {
      tiers.push({
        tier: "consolation",
        amount,
        matchType: "consolation",
        entries: [],
      });
      continue;
    }

    // Extract entries from rest
    // Check for full tickets (2 letters + 6 digits)
    const fullTicketMatches = Array.from(rest.matchAll(/([A-Z]{2})\s*(\d{6})/gi)).map(
      (m) => `${m[1].toUpperCase()}${m[2]}`
    );

    // Check for 4-digit numbers
    const last4Matches = Array.from(rest.matchAll(/\b\d{4}\b/g)).map((m) => m[0]);

    if (fullTicketMatches.length > 0) {
      tiers.push({
        tier: tierKey,
        amount,
        matchType: "full",
        entries: fullTicketMatches,
      });
    } else if (last4Matches.length > 0) {
      tiers.push({
        tier: tierKey,
        amount,
        matchType: "last4",
        entries: last4Matches,
      });
    } else {
      // If tier exists in article but no numbers are listed yet (e.g. live ongoing draw)
      throw new ParseError(
        `Tier ${tierKey} (${rawTierWord} prize) has amount ₹${amount} but no ticket entries could be parsed: "${line}"`
      );
    }
  }

  // Verification: ensure 1st prize is present
  const firstPrize = tiers.find((t) => t.tier === "1");
  if (!firstPrize || firstPrize.entries.length === 0) {
    throw new ParseError(
      "Incomplete draw: 1st prize is missing or has no winning ticket announced yet"
    );
  }

  if (tiers.length < 3) {
    throw new ParseError(
      `Incomplete draw: parsed only ${tiers.length} prize tiers, expected at least 3`
    );
  }

  // Compute raw payload hash
  const contentHash = crypto.createHash("sha256").update(html).digest("hex");

  const parsedDraw: ParsedDraw = {
    source: "onmanorama",
    sourceUrl: resolvedUrl || undefined,
    fetchedAt: new Date().toISOString(),
    schemeName,
    schemeCode,
    drawCode,
    drawDate,
    tiers,
    raw: {
      contentHash,
    },
  };

  return ParsedDrawSchema.parse(parsedDraw);
}
