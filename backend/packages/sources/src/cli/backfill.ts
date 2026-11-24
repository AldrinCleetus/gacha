import { runBackfill, BackfillOptions } from "../backfill.js";

async function main() {
  const args = process.argv.slice(2);
  const options: BackfillOptions = {
    source: "all",
    limit: 20,
    delayMs: 2000,
    force: false,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--source" || args[i] === "-s") {
      const src = args[++i];
      if (src === "onmanorama" || src === "keralalotteries_net" || src === "all") {
        options.source = src;
      } else {
        console.error(`Invalid source: ${src}. Must be 'onmanorama', 'keralalotteries_net', or 'all'.`);
        process.exit(1);
      }
    } else if (args[i] === "--limit" || args[i] === "-n") {
      options.limit = parseInt(args[++i], 10);
    } else if (args[i] === "--delay") {
      options.delayMs = parseInt(args[++i], 10);
    } else if (args[i] === "--force") {
      options.force = true;
    } else if (args[i] === "--dry-run") {
      options.dryRun = true;
    }
  }

  console.log("=======================================================");
  console.log(" GACHA HISTORICAL DRAW BACKFILL");
  console.log("=======================================================");
  console.log(`Source:  ${options.source}`);
  console.log(`Limit:   ${options.limit} draws per source`);
  console.log(`Delay:   ${options.delayMs}ms between network requests`);
  console.log(`Force:   ${options.force}`);
  console.log(`DryRun:  ${options.dryRun}`);
  console.log("-------------------------------------------------------");

  const startTime = Date.now();
  const summaries = await runBackfill(options);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n=======================================================");
  console.log(` BACKFILL SUMMARY (completed in ${elapsed}s)`);
  console.log("=======================================================");

  for (const s of summaries) {
    console.log(`Source [${s.source}]:`);
    console.log(`  Discovered: ${s.discovered}`);
    console.log(`  Processed:  ${s.processed}`);
    console.log(`  Ingested:   ${s.ingested}`);
    console.log(`  Skipped:    ${s.skipped}`);
    console.log(`  Failed:     ${s.failed}`);

    for (const item of s.items) {
      const statusIcon =
        item.status === "ingested"
          ? "✓"
          : item.status === "skipped_existing"
          ? "—"
          : item.status === "dry_run"
          ? "?"
          : "✗";
      console.log(`    ${statusIcon} [${item.drawCode}] (${item.drawDate}) -> ${item.status}${item.error ? `: ${item.error}` : ""}`);
    }
    console.log("");
  }
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
