import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it, expect } from "vitest";
import {
  parseArticle,
  parseListing,
  ParseError,
  KeralalotteriesNetAdapter,
  keralalotteriesAdapter,
} from "../keralalotteries/index.js";
import { validateParsedDraw } from "../validation.js";

const FIXTURES_DIR = path.resolve(__dirname, "../keralalotteries/fixtures");
const karunyaHtml = fs.readFileSync(path.join(FIXTURES_DIR, "karunya-kr-762.html"), "utf8");
const samrudhiHtml = fs.readFileSync(path.join(FIXTURES_DIR, "samrudhi-sm-82.html"), "utf8");
const listingHtml = fs.readFileSync(path.join(FIXTURES_DIR, "listing.html"), "utf8");
const brokenHtml = fs.readFileSync(path.join(FIXTURES_DIR, "broken-invalid-draw.html"), "utf8");

describe("KeralalotteriesNet Adapter & Parser", () => {
  describe("parseListing", () => {
    it("discovers draw references from listing page", () => {
      const refs = parseListing(listingHtml);
      expect(refs.length).toBeGreaterThan(10);

      const first = refs[0];
      expect(first).toHaveProperty("schemeCode");
      expect(first).toHaveProperty("drawCode");
      expect(first).toHaveProperty("drawDate");
      expect(first).toHaveProperty("url");
      expect(first.drawDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(first.url).toMatch(/^https:\/\/www\.keralalotteries\.net\//);

      // Verify known draws in listing
      const krDraw = refs.find((r) => r.drawCode === "KR-777");
      expect(krDraw).toBeDefined();
      expect(krDraw?.drawDate).toBe("2026-11-21");
      expect(krDraw?.schemeCode).toBe("KR");

      const smDraw = refs.find((r) => r.drawCode === "SM-82");
      expect(smDraw).toBeDefined();
      expect(smDraw?.drawDate).toBe("2026-11-22");
      expect(smDraw?.schemeCode).toBe("SM");
    });
  });

  describe("parseArticle on Karunya KR-762", () => {
    const url = "https://www.keralalotteries.net/2026/07/karunya-kerala-lottery-result-kr-762-today-25-07-2026.html";
    const draw = parseArticle(karunyaHtml, url);

    it("parses scheme, code, and date accurately", () => {
      expect(draw.source).toBe("keralalotteries_net");
      expect(draw.sourceUrl).toBe(url);
      expect(draw.schemeName).toBe("Karunya");
      expect(draw.schemeCode).toBe("KR");
      expect(draw.drawCode).toBe("KR-762");
      expect(draw.drawDate).toBe("2026-07-25");
      expect(draw.raw.contentHash).toBeDefined();
    });

    it("parses all prize tiers with correct amounts and match types", () => {
      expect(draw.tiers.length).toBe(10);

      const [p1, cons, p2, p3, p4, p5, p6, p7, p8, p9] = draw.tiers;

      // 1st Prize
      expect(p1.tier).toBe("1");
      expect(p1.amount).toBe(10000000); // 1 Crore
      expect(p1.matchType).toBe("full");
      expect(p1.entries).toEqual(["KB845108"]);

      // Consolation
      expect(cons.tier).toBe("consolation");
      expect(cons.amount).toBe(5000);
      expect(cons.matchType).toBe("consolation");
      expect(cons.entries.length).toBe(11);
      expect(cons.entries).toContain("KA845108");
      expect(cons.entries).toContain("KM845108");

      // 2nd Prize
      expect(p2.tier).toBe("2");
      expect(p2.amount).toBe(2500000); // 25 Lakhs
      expect(p2.matchType).toBe("full");
      expect(p2.entries).toEqual(["KJ772827"]);

      // 3rd Prize
      expect(p3.tier).toBe("3");
      expect(p3.amount).toBe(1000000); // 10 Lakhs
      expect(p3.matchType).toBe("full");
      expect(p3.entries).toEqual(["KD560761"]);

      // 4th Prize (Last 4)
      expect(p4.tier).toBe("4");
      expect(p4.amount).toBe(5000);
      expect(p4.matchType).toBe("last4");
      expect(p4.entries.length).toBe(19);
      expect(p4.entries[0]).toBe("1179");

      // 5th Prize
      expect(p5.tier).toBe("5");
      expect(p5.amount).toBe(2000);
      expect(p5.matchType).toBe("last4");
      expect(p5.entries.length).toBe(6);
      expect(p5.entries).toEqual(["1212", "3958", "4223", "5157", "8491", "8931"]);

      // 6th Prize
      expect(p6.tier).toBe("6");
      expect(p6.amount).toBe(1000);
      expect(p6.entries.length).toBe(25);

      // 7th Prize
      expect(p7.tier).toBe("7");
      expect(p7.amount).toBe(500);
      expect(p7.entries.length).toBe(76);

      // 8th Prize
      expect(p8.tier).toBe("8");
      expect(p8.amount).toBe(200);
      expect(p8.entries.length).toBe(92);

      // 9th Prize
      expect(p9.tier).toBe("9");
      expect(p9.amount).toBe(100);
      expect(p9.entries.length).toBe(144);

      const totalEntries = draw.tiers.reduce((sum, t) => sum + t.entries.length, 0);
      expect(totalEntries).toBe(376);
    });

    it("extracts winner agency details for 1st, 2nd, and 3rd prizes", () => {
      expect(draw.agents).toBeDefined();
      expect(draw.agents?.length).toBe(3);

      const agent1 = draw.agents?.find((a) => a.tier === "1");
      expect(agent1).toEqual({
        tier: "1",
        ticket: "KB845108",
        agencyName: "SHINE D T",
        agencyCode: "T 3795",
        place: "ATTINGAL",
      });

      const agent2 = draw.agents?.find((a) => a.tier === "2");
      expect(agent2).toEqual({
        tier: "2",
        ticket: "KJ772827",
        agencyName: "SREEJITH T",
        agencyCode: "W 2242",
        place: "MANANTHAVADY",
      });

      const agent3 = draw.agents?.find((a) => a.tier === "3");
      expect(agent3).toEqual({
        tier: "3",
        ticket: "KD560761",
        agencyName: "XAVIER VT",
        agencyCode: "E 2679",
        place: "ERNAKULAM",
      });
    });

    it("passes validation rules engine", () => {
      const validation = validateParsedDraw(draw);
      expect(validation.ok).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe("parseArticle on Samrudhi SM-82", () => {
    const url = "https://www.keralalotteries.net/2026/11/samrudhi-kerala-lottery-result-sm-82-today-22-11-2026.html";
    const draw = parseArticle(samrudhiHtml, url);

    it("parses scheme, code, and date accurately", () => {
      expect(draw.schemeCode).toBe("SM");
      expect(draw.drawCode).toBe("SM-82");
      expect(draw.drawDate).toBe("2026-11-22");
    });

    it("captures 1st prize jackpot ticket and agency details", () => {
      const p1 = draw.tiers.find((t) => t.tier === "1");
      expect(p1?.entries).toEqual(["MO747323"]);
      expect(p1?.amount).toBe(10000000);

      const agent1 = draw.agents?.find((a) => a.tier === "1");
      expect(agent1).toEqual({
        tier: "1",
        ticket: "MO747323",
        agencyName: "MOHAMMED SHAHEER",
        agencyCode: "Q 2218",
        place: "KOLLAM",
      });
    });

    it("passes validation rules engine", () => {
      const validation = validateParsedDraw(draw);
      expect(validation.ok).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe("Error handling", () => {
    it("throws ParseError on invalid HTML", () => {
      expect(() => parseArticle(brokenHtml)).toThrow(ParseError);
    });
  });

  describe("Adapter class", () => {
    it("has correct id and name", () => {
      const adapter = new KeralalotteriesNetAdapter();
      expect(adapter.id).toBe("keralalotteries_net");
      expect(adapter.name).toBe("Kerala Lotteries Net");
      expect(keralalotteriesAdapter.id).toBe("keralalotteries_net");
      expect(keralalotteriesAdapter.name).toBe("Kerala Lotteries Net");
    });
  });
});
