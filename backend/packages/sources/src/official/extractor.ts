import { createHash } from "node:crypto";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

export interface PositionedTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Extracts visual lines of text from a PDF buffer in reading order (top-to-bottom, left-to-right).
 * Uses coordinate clustering on y-positions to maintain table/column integrity.
 */
export async function extractTextLinesFromPdf(buffer: Buffer | Uint8Array): Promise<string[]> {
  // pdfjs-dist strictly requires a pure Uint8Array, not a Node.js Buffer
  const data = Buffer.isBuffer(buffer)
    ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    : buffer instanceof Uint8Array
    ? buffer
    : new Uint8Array(buffer);

  const loadingTask = pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
  });

  const doc = await loadingTask.promise;
  const numPages = doc.numPages;
  const allLines: string[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    const items: PositionedTextItem[] = [];
    for (const item of content.items) {
      if ("str" in item && typeof item.str === "string" && item.str.trim().length > 0) {
        items.push({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width || 0,
          height: item.height || 0,
        });
      }
    }

    // Group items into lines by y-coordinate (tolerance +/- 3 points)
    const linesByY: Array<{ y: number; items: PositionedTextItem[] }> = [];
    for (const item of items) {
      const match = linesByY.find((line) => Math.abs(line.y - item.y) <= 3.5);
      if (match) {
        match.items.push(item);
      } else {
        linesByY.push({ y: item.y, items: [item] });
      }
    }

    // Sort lines top to bottom (y descending)
    linesByY.sort((a, b) => b.y - a.y);

    for (const line of linesByY) {
      // Sort items on the same line from left to right (x ascending)
      line.items.sort((a, b) => a.x - b.x);

      let lineText = "";
      for (let i = 0; i < line.items.length; i++) {
        const curr = line.items[i];
        if (i === 0) {
          lineText += curr.str;
        } else {
          const prev = line.items[i - 1];
          const gap = curr.x - (prev.x + prev.width);
          if (gap > 2 || (!lineText.endsWith(" ") && !curr.str.startsWith(" "))) {
            lineText += " " + curr.str;
          } else {
            lineText += curr.str;
          }
        }
      }

      const trimmed = lineText.trim();
      if (trimmed.length > 0) {
        allLines.push(trimmed);
      }
    }
  }

  return allLines;
}

export function computeBufferHash(buffer: Buffer | Uint8Array): string {
  return createHash("sha256").update(buffer).digest("hex");
}
