import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseArticle,
  parseListing,
  parseAmount,
  ParseError,
} from "../onmanorama/parser.js";
import { PoliteHttpClient } from "../http.js";

const FIXTURES_DIR = path.resolve(__dirname, "../onmanorama/fixtures");
const listingHtml = fs.readFileSync(path.join(FIXTURES_DIR, "listing.html"), "utf8");
const samrudhiHtml = fs.readFileSync(path.join(FIXTURES_DIR, "samrudhi-sm-82.html"), "utf8");

describe("parseAmount helper", () => {
  it("parses crore amounts", () => {
    expect(parseAmount("₹1 cr")).toBe(10000000);
    expect(parseAmount("₹1 crore")).toBe(10000000);
    expect(parseAmount("1.5 cr")).toBe(15000000);
  });

  it("parses lakh amounts", () => {
    expect(parseAmount("₹25 lakh")).toBe(2500000);
    expect(parseAmount("₹5 lakh")).toBe(500000);
    expect(parseAmount("10 lakhs")).toBe(1000000);
  });

  it("parses thousand amounts and plain numbers", () => {
    expect(parseAmount("₹5,000")).toBe(5000);
    expect(parseAmount("₹5000")).toBe(5000);
    expect(parseAmount("₹500")).toBe(500);
    expect(parseAmount("₹100")).toBe(100);
  });
});

describe("Onmanorama Listing Parser", () => {
  it("extracts draw references from listing page fixture", () => {
    const refs = parseListing(listingHtml);
    expect(refs.length).toBeGreaterThanOrEqual(10);

    const first = refs[0];
    expect(first.schemeCode).toBe("SM");
    expect(first.drawCode).toBe("SM-82");
    expect(first.drawDate).toBe("2026-11-22");
    expect(first.url).toBe(
      "https://www.onmanorama.com/news/kerala/2026/11/22/samrudhi-sm-82-lottery-results-kerala-1-crore-first-prize-list-winners-live.html"
    );

    // Verify weekly scheme codes are properly detected
    const codes = refs.map((r) => r.schemeCode);
    expect(codes).toContain("SM");
    expect(codes).toContain("KR");
    expect(codes).toContain("SK");
    expect(codes).toContain("KN");
    expect(codes).toContain("DL");
    expect(codes).toContain("SS");
    expect(codes).toContain("BT");
  });

  it("returns empty array for HTML without lottery links", () => {
    expect(parseListing("<html><body>No lottery links here</body></html>")).toEqual([]);
  });
});

describe("Onmanorama Article Parser", () => {
  it("correctly parses samrudhi-sm-82.html fixture into exact ParsedDraw", () => {
    const draw = parseArticle(samrudhiHtml);

    expect(draw.source).toBe("onmanorama");
    expect(draw.schemeName).toBe("Samrudhi");
    expect(draw.schemeCode).toBe("SM");
    expect(draw.drawCode).toBe("SM-82");
    expect(draw.drawDate).toBe("2026-11-22");
    expect(draw.sourceUrl).toBe(
      "https://www.onmanorama.com/news/kerala/2026/11/22/samrudhi-sm-82-lottery-results-kerala-1-crore-first-prize-list-winners-live.html"
    );

    // 10 tiers: 1st, consolation, 2nd, 3rd, 4th, 5th, 6th, 7th, 8th, 9th
    expect(draw.tiers).toHaveLength(10);

    // 1st Prize
    const t1 = draw.tiers.find((t) => t.tier === "1");
    expect(t1).toBeDefined();
    expect(t1?.amount).toBe(10000000);
    expect(t1?.matchType).toBe("full");
    expect(t1?.entries).toEqual(["MO747323"]);

    // Consolation Prize
    const tCons = draw.tiers.find((t) => t.tier === "consolation");
    expect(tCons).toBeDefined();
    expect(tCons?.amount).toBe(5000);
    expect(tCons?.matchType).toBe("consolation");
    expect(tCons?.entries).toEqual([]);

    // 2nd Prize
    const t2 = draw.tiers.find((t) => t.tier === "2");
    expect(t2).toBeDefined();
    expect(t2?.amount).toBe(2500000);
    expect(t2?.matchType).toBe("full");
    expect(t2?.entries).toEqual(["MN147266"]);

    // 3rd Prize
    const t3 = draw.tiers.find((t) => t.tier === "3");
    expect(t3).toBeDefined();
    expect(t3?.amount).toBe(500000);
    expect(t3?.matchType).toBe("full");
    expect(t3?.entries).toEqual(["MZ766542"]);

    // 4th Prize (Last 4)
    const t4 = draw.tiers.find((t) => t.tier === "4");
    expect(t4).toBeDefined();
    expect(t4?.amount).toBe(5000);
    expect(t4?.matchType).toBe("last4");
    expect(t4?.entries).toHaveLength(19);
    expect(t4?.entries[0]).toBe("0606");
    expect(t4?.entries[18]).toBe("9840");

    // 5th Prize
    const t5 = draw.tiers.find((t) => t.tier === "5");
    expect(t5?.amount).toBe(2000);
    expect(t5?.matchType).toBe("last4");
    expect(t5?.entries).toHaveLength(6);
    expect(t5?.entries).toEqual(["5323", "5867", "6706", "7671", "8383", "8543"]);

    // 6th Prize
    const t6 = draw.tiers.find((t) => t.tier === "6");
    expect(t6?.amount).toBe(1000);
    expect(t6?.matchType).toBe("last4");
    expect(t6?.entries).toHaveLength(25);

    // 7th Prize
    const t7 = draw.tiers.find((t) => t.tier === "7");
    expect(t7?.amount).toBe(500);
    expect(t7?.matchType).toBe("last4");
    expect(t7?.entries).toHaveLength(76);

    // 8th Prize
    const t8 = draw.tiers.find((t) => t.tier === "8");
    expect(t8?.amount).toBe(200);
    expect(t8?.matchType).toBe("last4");
    expect(t8?.entries).toHaveLength(92);

    // 9th Prize
    const t9 = draw.tiers.find((t) => t.tier === "9");
    expect(t9?.amount).toBe(100);
    expect(t9?.matchType).toBe("last4");
    expect(t9?.entries).toHaveLength(150);

    // Content hash
    expect(draw.raw.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("fails loudly when 1st prize is missing", () => {
    const incompleteHtml = `
      <html>
        <head>
          <title>Kerala Lottery Karunya KR-999 Result 20/11/2026</title>
        </head>
        <body>
          <p>Results will be declared at 3 PM.</p>
        </body>
      </html>
    `;
    expect(() => parseArticle(incompleteHtml)).toThrow(ParseError);
    expect(() => parseArticle(incompleteHtml)).toThrow(/1st prize is missing/i);
  });

  it("fails loudly when ticket numbers are missing for a tier", () => {
    const brokenHtml = `
      <html>
        <head>
          <link rel="canonical" href="https://www.onmanorama.com/news/kerala/2026/11/22/samrudhi-sm-82-lottery-results.html" />
        </head>
        <body>
          <p>First prize: ₹1 cr – MO 747323</p>
          <p>Second prize: ₹25 lakh - </p>
          <p>Third prize: ₹5 lakh - MZ 766542</p>
        </body>
      </html>
    `;
    expect(() => parseArticle(brokenHtml)).toThrow(ParseError);
    expect(() => parseArticle(brokenHtml)).toThrow(/no ticket entries could be parsed/i);
  });

  it("fails when draw metadata cannot be resolved", () => {
    const noMetaHtml = `
      <html><body><p>Random page content with no lottery info</p></body></html>
    `;
    expect(() => parseArticle(noMetaHtml)).toThrow(ParseError);
    expect(() => parseArticle(noMetaHtml)).toThrow(/Failed to extract draw metadata/i);
  });
});

describe("PoliteHttpClient", () => {
  it("instantiates with default headers and rate limit configuration", () => {
    const client = new PoliteHttpClient({ minIntervalMs: 50 });
    expect(client).toBeDefined();
  });
});
