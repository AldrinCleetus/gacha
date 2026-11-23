import { ingestObservation } from "../ingest.js";
import { closePool } from "@gacha/db";

async function main() {
  const args = process.argv.slice(2);
  let url: string | undefined;
  let fixturePath: string | undefined;
  let source: "onmanorama" | "keralalotteries_net" | "official" = "onmanorama";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url" && args[i + 1]) {
      url = args[i + 1];
      i++;
    } else if (args[i] === "--fixture" && args[i + 1]) {
      fixturePath = args[i + 1];
      i++;
    } else if (args[i] === "--source" && args[i + 1]) {
      source = args[i + 1] as "onmanorama" | "keralalotteries_net" | "official";
      i++;
    }
  }

  if (!url && !fixturePath) {
    console.error("Usage: pnpm ingest --url <url> | --fixture <path> [--source <source>]");
    process.exit(1);
  }

  try {
    const result = await ingestObservation({
      source,
      url,
      fixturePath,
    });

    console.log(
      JSON.stringify(
        {
          observationId: result.observationId,
          drawId: result.drawId,
          source: result.source,
          sourceUrl: result.sourceUrl,
          rawObjectKey: result.rawObjectKey,
          contentHash: result.contentHash,
          fingerprint: result.fingerprint,
          validation: result.validation,
        },
        null,
        2
      )
    );
  } catch (err: unknown) {
    console.error("Ingest failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();
