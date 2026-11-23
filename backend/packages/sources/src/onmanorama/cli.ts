import * as fs from "node:fs";
import * as path from "node:path";
import { onmanoramaAdapter } from "./adapter.js";
import { parseArticle } from "./parser.js";

async function main() {
  const args = process.argv.slice(2);
  let url: string | undefined;
  let fixturePath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url" && args[i + 1]) {
      url = args[i + 1];
      i++;
    } else if (args[i] === "--fixture" && args[i + 1]) {
      fixturePath = args[i + 1];
      i++;
    }
  }

  if (!url && !fixturePath) {
    console.error("Usage: pnpm ingest:onmanorama --url <url> | --fixture <path>");
    process.exit(1);
  }

  try {
    if (fixturePath) {
      const resolved = path.resolve(process.cwd(), fixturePath);
      const html = fs.readFileSync(resolved, "utf8");
      const parsed = parseArticle(html);
      console.log(JSON.stringify(parsed, null, 2));
    } else if (url) {
      const parsed = await onmanoramaAdapter.fetchAndParse(url);
      console.log(JSON.stringify(parsed, null, 2));
    }
  } catch (err: unknown) {
    console.error("Error ingesting Onmanorama draw:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
