import { describe, it, expect } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseOfficialPdf,
  parseOfficialAmount,
  OfficialParseError,
  extractTextLinesFromPdf,
  officialAdapter,
} from "../index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, "../official/fixtures");

describe("Official PDF Extractor & Parser", () => {
  describe("parseOfficialAmount", () => {
    it("parses Rs :1,00,00,000/- [1 Crore] correctly to 10000000", () => {
      expect(parseOfficialAmount("1st Prize- Rs :1,00,00,000/-  MO 747323")).toBe(10_000_000);
      expect(parseOfficialAmount("1st Prize- Rs :1,00,00,000/- [1 Crore]")).toBe(10_000_000);
    });

    it("parses Rs. 5,000/- correctly to 5000", () => {
      expect(parseOfficialAmount("Consolation Prize- Rs. 5,000/-")).toBe(5_000);
      expect(parseOfficialAmount("4th Prize- Rs. 5,000/-")).toBe(5_000);
    });

    it("parses Rs :25,00,000/- [25 Lakhs] correctly to 2500000", () => {
      expect(parseOfficialAmount("2nd Prize- Rs :25,00,000/-  MS 263445")).toBe(2_500_000);
    });

    it("parses Rs :5,00,000/- correctly to 500000", () => {
      expect(parseOfficialAmount("3rd Prize- Rs :5,00,000/-  MR 317582")).toBe(500_000);
    });

    it("parses Rs. 100/- correctly to 100", () => {
      expect(parseOfficialAmount("9th Prize- Rs. 100/-")).toBe(100);
    });

    it("throws OfficialParseError on unparseable amount text", () => {
      expect(() => parseOfficialAmount("No prize amount here")).toThrow(OfficialParseError);
    });
  });

  describe("extractTextLinesFromPdf", () => {
    it("extracts non-empty visual lines from a valid official PDF", async () => {
      const pdfBytes = await fs.readFile(path.join(fixturesDir, "samrudhi-sm-82.pdf"));
      const lines = await extractTextLinesFromPdf(pdfBytes);

      expect(lines.length).toBeGreaterThan(10);
      expect(lines.some((l) => l.includes("KERALA STATE LOTTERIES"))).toBe(true);
      expect(lines.some((l) => l.includes("SM-82"))).toBe(true);
      expect(lines.some((l) => l.includes("1st Prize"))).toBe(true);
    });
  });

  describe("parseOfficialPdf - Samrudhi SM-82 Fixture", () => {
    it("parses all prize tiers, winning tickets, and winner agency details accurately", async () => {
      const pdfBytes = await fs.readFile(path.join(fixturesDir, "samrudhi-sm-82.pdf"));
      const draw = await parseOfficialPdf(pdfBytes, "fixtures/samrudhi-sm-82.pdf");

      expect(draw.source).toBe("official");
      expect(draw.schemeName).toBe("Samrudhi");
      expect(draw.schemeCode).toBe("SM");
      expect(draw.drawCode).toBe("SM-82");
      expect(draw.drawDate).toBe("2026-11-22");
      expect(draw.tiers.length).toBe(10); // 1st, Consolation, 2nd, 3rd, 4th..9th

      // 1st Prize
      const t1 = draw.tiers.find((t) => t.tier === "1")!;
      expect(t1).toBeDefined();
      expect(t1.amount).toBe(10_000_000);
      expect(t1.matchType).toBe("full");
      expect(t1.entries).toEqual(["MO747323"]);

      // Winner Agent for 1st Prize
      expect(draw.agents).toBeDefined();
      const a1 = draw.agents!.find((a) => a.tier === "1")!;
      expect(a1).toBeDefined();
      expect(a1.ticket).toBe("MO747323");
      expect(a1.agencyName).toBe("SHAHUL HAMEED");
      expect(a1.agencyCode).toBe("Q 5422");
      expect(a1.place).toBe("KOLLAM");

      // Consolation
      const tc = draw.tiers.find((t) => t.tier === "consolation")!;
      expect(tc).toBeDefined();
      expect(tc.amount).toBe(5_000);
      expect(tc.matchType).toBe("consolation");
      expect(tc.entries.length).toBe(11);
      expect(tc.entries).toContain("MN747323");
      expect(tc.entries).toContain("MZ747323");

      // 2nd Prize
      const t2 = draw.tiers.find((t) => t.tier === "2")!;
      expect(t2.amount).toBe(2_500_000);
      expect(t2.entries).toEqual(["MS263445"]);

      // 3rd Prize
      const t3 = draw.tiers.find((t) => t.tier === "3")!;
      expect(t3.amount).toBe(500_000);
      expect(t3.entries).toEqual(["MR317582"]);

      // 4th Prize (Last 4 digits)
      const t4 = draw.tiers.find((t) => t.tier === "4")!;
      expect(t4.amount).toBe(5_000);
      expect(t4.matchType).toBe("last4");
      expect(t4.entries.length).toBe(18);
      expect(t4.entries).toContain("2626");
      expect(t4.entries).toContain("9503");

      // Raw content hash
      expect(draw.raw.contentHash).toBeDefined();
      expect(draw.raw.contentHash.length).toBe(64);
    });
  });

  describe("parseOfficialPdf - Karunya KR-762 Fixture", () => {
    it("parses Saturday Karunya KR-762 official PDF with 12 3rd prize series entries", async () => {
      const pdfBytes = await fs.readFile(path.join(fixturesDir, "karunya-kr-762.pdf"));
      const draw = await parseOfficialPdf(pdfBytes, "fixtures/karunya-kr-762.pdf");

      expect(draw.source).toBe("official");
      expect(draw.schemeName).toBe("Karunya");
      expect(draw.schemeCode).toBe("KR");
      expect(draw.drawCode).toBe("KR-762");
      expect(draw.drawDate).toBe("2026-07-25");

      // 1st Prize
      const t1 = draw.tiers.find((t) => t.tier === "1")!;
      expect(t1.amount).toBe(10_000_000);
      expect(t1.entries).toEqual(["KB845108"]);

      const a1 = draw.agents!.find((a) => a.tier === "1")!;
      expect(a1.agencyName).toBe("SHINE D T");
      expect(a1.agencyCode).toBe("T 3795");
      expect(a1.place).toBe("ATTINGAL");

      // 3rd Prize (12 series tickets)
      const t3 = draw.tiers.find((t) => t.tier === "3")!;
      expect(t3.amount).toBe(100_000);
      expect(t3.entries.length).toBe(12);
      expect(t3.entries).toContain("KA402287");
      expect(t3.entries).toContain("KM804961");
    });
  });

  describe("Error Handling", () => {
    it("throws OfficialParseError when attempting to parse non-lottery PDF", async () => {
      const brokenBytes = await fs.readFile(path.join(fixturesDir, "broken-invalid.pdf"));
      await expect(parseOfficialPdf(brokenBytes)).rejects.toThrow(OfficialParseError);
    });
  });

  describe("OfficialSourceAdapter Contract", () => {
    it("satisfies the SourceAdapter contract with empty auto-discovery and buffer parsing", async () => {
      expect(officialAdapter.id).toBe("official");
      expect(officialAdapter.name).toBe("Official Kerala State Lotteries");

      const refs = await officialAdapter.discover();
      expect(refs).toEqual([]);

      const filePath = path.join(fixturesDir, "samrudhi-sm-82.pdf");
      const draw = await officialAdapter.fetchAndParse(filePath);
      expect(draw.drawCode).toBe("SM-82");
      expect(draw.source).toBe("official");
    });
  });
});
