import * as fs from "node:fs/promises";
import { DrawRef, ParsedDraw } from "@gacha/shared";
import { SourceAdapter } from "../types.js";
import { parseOfficialPdf } from "./parser.js";

export class OfficialSourceAdapter implements SourceAdapter {
  readonly id = "official";
  readonly name = "Official Kerala State Lotteries";

  /**
   * Official results are primarily provided via manual PDF upload or direct upload.
   * Discovery returns empty by default to prevent unauthorized scraping of the official site.
   */
  async discover(): Promise<DrawRef[]> {
    return [];
  }

  /**
   * Parses an official PDF from a local filepath, URL, or DrawRef.
   */
  async fetchAndParse(refOrUrl: string | DrawRef): Promise<ParsedDraw> {
    const target = typeof refOrUrl === "string" ? refOrUrl : refOrUrl.url;

    if (target.startsWith("http://") || target.startsWith("https://")) {
      const response = await fetch(target);
      if (!response.ok) {
        throw new Error(`Failed to fetch official PDF from URL: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return await parseOfficialPdf(Buffer.from(arrayBuffer), target);
    }

    // Treat as local file path
    const fileBytes = await fs.readFile(target);
    return await parseOfficialPdf(fileBytes, target);
  }

  /**
   * Parses an official PDF directly from a Buffer.
   */
  async parseBuffer(buffer: Buffer, sourceUrl = "manual-upload"): Promise<ParsedDraw> {
    return await parseOfficialPdf(buffer, sourceUrl);
  }
}

export const officialAdapter = new OfficialSourceAdapter();
