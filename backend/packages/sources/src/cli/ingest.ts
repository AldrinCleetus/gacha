import { ingestObservation } from "../ingest.js";
import { closePool } from "@gacha/db";

async function main() {
  const args = process.argv.slice(2);
  let url: string | undefined;
  let fixturePath: string | undefined;
  let source: "onmanorama" | "keralalotteries_net" | "official" = "onmanorama";
  let autoPublish: boolean | undefined = undefined;

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
    } else if (args[i] === "--no-publish") {
      autoPublish = false;
    }
  }

  if (!url && !fixturePath) {
    console.error("Usage: pnpm ingest --url <url> | --fixture <path> [--source <source>] [--no-publish]");
    process.exit(1);
  }

  try {
    const result = await ingestObservation({
      source,
      url,
      fixturePath,
      autoPublish,
    });

    console.log(
      JSON.stringify(
        {
          observationId: result.observationId,
          drawId: result.drawId,
          drawStatus: result.drawStatus,
          published: result.published,
          alreadyPublished: result.alreadyPublished,
          conflict: result.conflict,
          source: result.source,
          sourceUrl: result.sourceUrl,
          rawObjectKey: result.rawObjectKey,
          contentHash: result.contentHash,
          fingerprint: result.fingerprint,
          tierCount: result.tierCount,
          entryCount: result.entryCount,
          validation: result.validation,
        },
        null,
        2
      )
    );
  } catch (err: unknown) {
    console.error("Ingest failed:", err);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();
