import * as fs from "node:fs";
import * as path from "node:path";
import { ingestObservation } from "../ingest.js";
import { parseOfficialPdf } from "./parser.js";

async function main() {
  const args = process.argv.slice(2);
  let pdfPath: string | undefined;
  let autoPublish = true;
  let printOnly = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--pdf" || args[i] === "-p") {
      pdfPath = args[++i];
    } else if (args[i] === "--no-publish") {
      autoPublish = false;
    } else if (args[i] === "--print-only") {
      printOnly = true;
    }
  }

  if (!pdfPath) {
    console.error("Usage: pnpm ingest:official --pdf <path-to-pdf> [--no-publish] [--print-only]");
    process.exit(1);
  }

  const resolved = path.resolve(process.cwd(), pdfPath);
  if (!fs.existsSync(resolved)) {
    console.error(`Error: File not found: ${resolved}`);
    process.exit(1);
  }

  const pdfBuffer = fs.readFileSync(resolved);

  if (printOnly) {
    console.log(`Parsing official PDF: ${resolved}`);
    const parsed = await parseOfficialPdf(pdfBuffer, resolved);
    console.log(JSON.stringify(parsed, null, 2));
    return;
  }

  console.log(`Ingesting official PDF: ${resolved}`);
  const result = await ingestObservation({
    source: "official",
    fixturePath: resolved,
    pdfBuffer,
    autoPublish,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("Official ingest failed:", err);
  process.exit(1);
});
