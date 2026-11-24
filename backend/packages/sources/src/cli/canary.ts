import { runCanaryCheck } from "../canary.js";

async function main() {
  console.log("=======================================================");
  console.log(" GACHA SOURCE CANARY DRIFT CHECK");
  console.log("=======================================================");
  console.log("Verifying discovery and latest draw parsing for active sources...\n");

  const startTime = Date.now();
  const report = await runCanaryCheck();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`Canary completed in ${elapsed}s at ${report.timestamp}\n`);

  for (const s of report.sources) {
    const statusIcon = s.ok ? "✓ [OK]" : "✗ [FAILED]";
    console.log(`${statusIcon} Source: ${s.source}`);
    console.log(`  Discovered links: ${s.discoveredCount}`);
    if (s.ok) {
      console.log(`  Latest draw code: ${s.latestDrawCode} (${s.latestDrawDate})`);
      console.log(`  Tiers parsed:     ${s.tierCount}`);
      console.log(`  Entries parsed:   ${s.entryCount}`);
      console.log(`  Latency:          ${s.latencyMs}ms`);
    } else {
      console.log(`  Error:            ${s.error}`);
      console.log(`  Latency:          ${s.latencyMs}ms`);
    }
    console.log("-------------------------------------------------------");
  }

  if (!report.ok) {
    console.error("\n[!] Canary check failed: one or more sources showed parser or discovery drift!");
    process.exit(1);
  } else {
    console.log("\n[✓] All source canaries passed successfully. Parsers and discovery are healthy.");
  }
}

main().catch((err) => {
  console.error("Fatal error running canary check:", err);
  process.exit(1);
});
