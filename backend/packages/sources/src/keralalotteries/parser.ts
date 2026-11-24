import * as crypto from "node:crypto";
import * as cheerio from "cheerio";
import { DrawRef, ParsedDraw, ParsedDrawSchema, PrizeTier, WinnerAgency } from "@gacha/shared";
export function parseKeralalotteriesAmount(text: string): number {
  const crMatch = text.match(/([\d.]+)\s*(?:cr|crore|crores)/i);
  if (crMatch) {
    return Math.round(parseFloat(crMatch[1]) * 10000000);
  }
  const lakhMatch = text.match(/([\d.]+)\s*(?:lakh|lakhs|lac|lacs)/i);
  if (lakhMatch) {
    return Math.round(parseFloat(lakhMatch[1]) * 100000);
  }
  const rupeeMatch = text.match(/(?:₹|Rs\.?)\s*([\d,]+(?:\.\d+)?)/i);
  if (rupeeMatch) {
    const rawNum = rupeeMatch[1].replace(/,/g, "");
    return parseInt(rawNum, 10);
  }
  const slashDashMatch = text.match(/([\d,]+)\s*\/-/);
  if (slashDashMatch) {
    const rawNum = slashDashMatch[1].replace(/,/g, "");
    return parseInt(rawNum, 10);
  }
  return 0;
}

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
  br: { name: "Bumper", code: "BR" },
};

/**
 * Parses the keralalotteries.net listing / home page.
 * Discovers draw references sorted newest first.
 */
export function parseListing(html: string): DrawRef[] {
  const $ = cheerio.load(html);
  const regex =
    /\/([0-9]{4})\/([0-9]{2})\/([a-z0-9-]+)-kerala-lottery-result-([a-z]{2})-([0-9]+)-today-([0-9]{2})-([0-9]{2})-([0-9]{4})\.html/i;

  const refs: DrawRef[] = [];
  const seenDrawCodes = new Set<string>();

  $("a").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const match = href.match(regex);
    if (!match) return;

    const [, , , , rawSchemeCode, drawNum, d, m, y] = match;
    const schemeCode = rawSchemeCode.toUpperCase();
    const drawCode = `${schemeCode}-${drawNum}`;

    if (seenDrawCodes.has(drawCode)) return;
    seenDrawCodes.add(drawCode);

    const drawDate = `${y}-${m}-${d}`;
    refs.push({
      schemeCode,
      drawCode,
      drawDate,
      url: href,
    });
  });

  return refs;
}

interface TierDefinition {
  tierName: string;
  tierNumber: string;
  headerRegex: RegExp;
  matchType: "full" | "consolation" | "last4";
}

const TIER_DEFINITIONS: TierDefinition[] = [
  { tierName: "1st Prize", tierNumber: "1", headerRegex: /1st\s+Prize/i, matchType: "full" },
  { tierName: "Consolation Prize", tierNumber: "consolation", headerRegex: /Consolation\s+Prize/i, matchType: "consolation" },
  { tierName: "2nd Prize", tierNumber: "2", headerRegex: /2nd\s+Prize/i, matchType: "full" },
  { tierName: "3rd Prize", tierNumber: "3", headerRegex: /3rd\s+Prize/i, matchType: "full" },
  { tierName: "4th Prize", tierNumber: "4", headerRegex: /4th\s+Prize/i, matchType: "last4" },
  { tierName: "5th Prize", tierNumber: "5", headerRegex: /5th\s+Prize/i, matchType: "last4" },
  { tierName: "6th Prize", tierNumber: "6", headerRegex: /6th\s+Prize/i, matchType: "last4" },
  { tierName: "7th Prize", tierNumber: "7", headerRegex: /7th\s+Prize/i, matchType: "last4" },
  { tierName: "8th Prize", tierNumber: "8", headerRegex: /8th\s+Prize/i, matchType: "last4" },
  { tierName: "9th Prize", tierNumber: "9", headerRegex: /9th\s+Prize/i, matchType: "last4" },
  { tierName: "10th Prize", tierNumber: "10", headerRegex: /10th\s+Prize/i, matchType: "last4" },
];

/**
 * Parses an article page from keralalotteries.net into a ParsedDraw object.
 */
export function parseArticle(html: string, sourceUrl?: string): ParsedDraw {
  const contentHash = crypto.createHash("sha256").update(html).digest("hex");
  const $ = cheerio.load(html);

  // Strip non-content tags
  $("script, style, ins, iframe, .adsbygoogle, noscript").remove();

  const postBody = $(".post-body, .entry-content, article").first();
  if (!postBody.length) {
    throw new ParseError("Could not locate post body in article HTML", { sourceUrl });
  }

  const postText = postBody.text();

  // 1. Resolve Scheme, Draw Code and Draw Date
  let schemeName = "";
  let schemeCode = "";
  let drawCode = "";
  let drawDate = "";

  // Try URL pattern first if provided
  if (sourceUrl) {
    const urlMatch = sourceUrl.match(
      /\/([0-9]{4})\/([0-9]{2})\/([a-z0-9-]+)-kerala-lottery-result-([a-z]{2})-([0-9]+)-today-([0-9]{2})-([0-9]{2})-([0-9]{4})\.html/i
    );
    if (urlMatch) {
      const [, , , rawSchemeSlug, rawCode, drawNum, d, m, y] = urlMatch;
      schemeCode = rawCode.toUpperCase();
      drawCode = `${schemeCode}-${drawNum}`;
      drawDate = `${y}-${m}-${d}`;
      const schemeInfo = KNOWN_SCHEMES[rawSchemeSlug.toLowerCase()] || KNOWN_SCHEMES[schemeCode.toLowerCase()];
      if (schemeInfo) schemeName = schemeInfo.name;
    }
  }

  // Fallback to text matching
  if (!drawCode || !drawDate || !schemeCode) {
    // Search for code like "KR-762", "KR.762", "KR 762", "SM-82"
    const codeMatch = postText.match(/\b([A-Z]{2})[\s.-]+(\d{2,4})\b/);
    if (codeMatch) {
      schemeCode = codeMatch[1].toUpperCase();
      drawCode = `${schemeCode}-${codeMatch[2]}`;
    }

    // Search for date like "25/07/2026", "25-07-2026", "25.07.2026"
    const dateMatch = postText.match(/(?:Date\s+of\s+Draw|Announced\s+on|Result)[\s:]*(\d{2})[./-](\d{2})[./-](\d{4})/i);
    if (dateMatch) {
      drawDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
    }

    // Scheme name
    for (const [, val] of Object.entries(KNOWN_SCHEMES)) {
      const reg = new RegExp(`\\b${val.name}\\b`, "i");
      if (reg.test(postText)) {
        schemeName = val.name;
        if (!schemeCode) schemeCode = val.code;
        break;
      }
    }
  }

  if (!schemeCode || !drawCode || !drawDate) {
    throw new ParseError("Could not extract schemeCode, drawCode, or drawDate from article", {
      schemeCode,
      drawCode,
      drawDate,
      sourceUrl,
    });
  }

  if (!schemeName) {
    schemeName = KNOWN_SCHEMES[schemeCode.toLowerCase()]?.name || schemeCode;
  }

  // 2. Locate Results Section
  const startMatch = postText.match(/Winners\s+Numbers/i);
  if (!startMatch || startMatch.index === undefined) {
    throw new ParseError("Could not find start of results ('Winners Numbers') in page", { sourceUrl });
  }

  const endMatch = postText.slice(startMatch.index).match(
    /(?:[A-Z]{2}[\s.-]*\d{2,4}\s+Result|The\s+prize\s+winners\s+are\s+advised|Repeated\s+Draw\s+Numbers|Next\s+Upcoming\s+Bumper)/i
  );

  const resultsSection = endMatch && endMatch.index !== undefined
    ? postText.slice(startMatch.index, startMatch.index + endMatch.index)
    : postText.slice(startMatch.index);

  // 3. Find positions of each prize tier header
  interface FoundTier {
    def: TierDefinition;
    index: number;
    headerText: string;
  }

  const foundTiers: FoundTier[] = [];
  for (const def of TIER_DEFINITIONS) {
    const match = resultsSection.match(def.headerRegex);
    if (match && match.index !== undefined) {
      foundTiers.push({
        def,
        index: match.index,
        headerText: match[0],
      });
    }
  }

  if (foundTiers.length === 0) {
    throw new ParseError("No prize tiers identified in article", { sourceUrl });
  }

  // Sort by index ascending
  foundTiers.sort((a, b) => a.index - b.index);

  // 4. Extract blocks for each tier
  const tiers: PrizeTier[] = [];
  const agents: WinnerAgency[] = [];

  for (let i = 0; i < foundTiers.length; i++) {
    const current = foundTiers[i];
    const startIndex = current.index;
    const endIndex = i + 1 < foundTiers.length ? foundTiers[i + 1].index : resultsSection.length;
    const tierBlock = resultsSection.slice(startIndex, endIndex);

    // Extract amount strictly following "Prize" to avoid ordinal number confusion (e.g. "4th", "5th")
    let amount = 0;
    const prizeIdx = tierBlock.search(/Prize/i);
    if (prizeIdx !== -1) {
      const afterPrize = tierBlock.slice(prizeIdx + 5, prizeIdx + 80);
      amount = parseKeralalotteriesAmount(afterPrize);
    } else {
      amount = parseKeralalotteriesAmount(tierBlock.slice(0, 100));
    }

    if (current.def.matchType === "full") {
      // Look for ticket format [A-Z]{2}\s*\d{6}
      // e.g. KB 845108 (ATTINGAL)
      // Agent Name: SHINE D T
      // Agency No.: T 3795
      const ticketMatch = tierBlock.match(/([A-Z]{2})\s*(\d{6})/);
      if (!ticketMatch) {
        throw new ParseError(`Could not extract winning ticket for full match tier ${current.def.tierName}`, {
          tier: current.def.tierNumber,
          tierBlock: tierBlock.slice(0, 150),
        });
      }

      const ticket = `${ticketMatch[1]}${ticketMatch[2]}`;
      const entries = [ticket];

      // Extract place, agent name, agency code
      const placeMatch = tierBlock.match(/\(([A-Z\s]+)\)/);
      const place = placeMatch ? placeMatch[1].trim() : undefined;

      const agentNameMatch = tierBlock.match(/Agent\s*Name:\s*([^A-Z0-9\n\r]*[A-Z0-9\s.]+?)(?=\s*Agency\s*No|\s*---|$|\n|\r)/i);
      const agencyName = agentNameMatch ? agentNameMatch[1].replace(/--+$/, "").trim() : undefined;

      const agencyCodeMatch = tierBlock.match(/Agency\s*No\.?:\s*([A-Z0-9\s]+?)(?=\s*---|$|\n|\r|\()/i);
      const agencyCode = agencyCodeMatch ? agencyCodeMatch[1].replace(/--+$/, "").trim() : undefined;

      if (agencyName || agencyCode || place) {
        agents.push({
          tier: current.def.tierNumber,
          ticket,
          agencyName,
          agencyCode,
          place,
        });
      }

      tiers.push({
        tier: current.def.tierNumber,
        amount,
        matchType: "full",
        entries,
      });
    } else if (current.def.matchType === "consolation") {
      // Match tickets even if not separated by whitespace
      const matches = [...tierBlock.matchAll(/([A-Z]{2})\s*(\d{6})/g)];
      const entries = matches.map((m) => `${m[1]}${m[2]}`);

      tiers.push({
        tier: current.def.tierNumber,
        amount,
        matchType: "consolation",
        entries,
      });
    } else if (current.def.matchType === "last4") {
      // Check if declared draw count exists: "drawn (\d+) times"
      const timesMatch = tierBlock.match(/drawn\s+(\d+)\s+times/i);
      const expectedCount = timesMatch ? parseInt(timesMatch[1], 10) : undefined;

      // Header ends after "times)" or "/-"
      const headerEnd = tierBlock.search(/(?:times\)|times|\/-)/i);
      const contentPart = headerEnd !== -1 ? tierBlock.slice(headerEnd) : tierBlock;

      let entries = [...contentPart.matchAll(/\b(\d{4})\b/g)].map((m) => m[1]);
      if (expectedCount && entries.length > expectedCount) {
        entries = entries.slice(0, expectedCount);
      }

      tiers.push({
        tier: current.def.tierNumber,
        amount,
        matchType: "last4",
        entries,
      });
    }
  }

  const parsedDraw: ParsedDraw = {
    source: "keralalotteries_net",
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
