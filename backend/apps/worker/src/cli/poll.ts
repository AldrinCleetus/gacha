import { closePool, getDb } from "@gacha/db";
import { FakeClock, SystemClock } from "@gacha/shared";
import { pollSourceForDraw } from "../poller.js";
import { getPollingWindowInfo } from "../pollingWindow.js";
import { ensureExpectedDraw } from "../expectedDraw.js";

async function main() {
  const args = process.argv.slice(2);
  let source: "onmanorama" | "keralalotteries_net" | "official" = "onmanorama";
  let date: string | undefined;
  let fixturePath: string | undefined;
  let fakeTime: string | undefined;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--source" && args[i + 1]) {
      source = args[i + 1] as "onmanorama" | "keralalotteries_net" | "official";
      i++;
    } else if (args[i] === "--date" && args[i + 1]) {
      date = args[i + 1];
      i++;
    } else if (args[i] === "--fixture" && args[i + 1]) {
      fixturePath = args[i + 1];
      i++;
    } else if (args[i] === "--fake-time" && args[i + 1]) {
      fakeTime = args[i + 1];
      i++;
    } else if (args[i] === "--force") {
      force = true;
    }
  }

  const clock = fakeTime ? new FakeClock(fakeTime) : new SystemClock();
  const db = getDb();

  console.log("=== gacha Manual Poll Trigger ===");
  console.log(`Current Clock Time: ${clock.now().toISOString()}`);

  const window = getPollingWindowInfo(clock.now());
  console.log(`IST Time: ${window.istTimeStr} (${window.istDateStr})`);
  console.log(`Window Phase: ${window.phase} (interval: ${window.intervalMinutes ?? "none"} mins)`);
  console.log(`Alert Threshold Triggered: ${window.shouldAlert}`);

  // 1. Ensure expected draw
  const expected = await ensureExpectedDraw(db, date || window.istDateStr, clock);
  if (expected) {
    console.log(
      `Expected Draw: ${expected.drawCode} (${expected.schemeName}) - Status: ${expected.status} (Created: ${expected.created})`
    );
  } else {
    console.log("No weekly scheme scheduled for this date.");
  }

  // 2. Poll source
  console.log(`\nPolling source '${source}'...`);
  const result = await pollSourceForDraw(
    {
      source,
      drawCode: expected?.drawCode,
      drawId: expected?.drawId,
      fixturePath,
      force,
    },
    db
  );

  console.log("\n=== Poll Result ===");
  console.log(JSON.stringify(result, null, 2));

  await closePool();
}

main().catch(async (err) => {
  console.error("Poll execution failed:", err);
  await closePool();
  process.exit(1);
});
