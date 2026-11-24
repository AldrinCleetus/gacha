import { getDb, closePool, sourceObservations, ingestEvents, eq } from "@gacha/db";
import { forcePublishDraw } from "../reconciliation.js";
import { compareDraws, renderDiffText } from "../diff.js";
import { ParsedDraw } from "@gacha/shared";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    process.exit(0);
  }

  const db = getDb();

  try {
    if (command === "review") {
      await handleReview(db);
    } else if (command === "diff") {
      const drawCode = getArg(args, "--draw");
      if (!drawCode) {
        console.error("Error: --draw <drawCode> is required for diff command.");
        process.exit(1);
      }
      await handleDiff(db, drawCode);
    } else if (command === "publish") {
      const drawCode = getArg(args, "--draw");
      const source = getArg(args, "--source");
      const reason = getArg(args, "--reason") || "Manual admin override";

      if (!drawCode || !source) {
        console.error("Error: --draw <drawCode> and --source <sourceName> are required for publish command.");
        process.exit(1);
      }
      await handlePublish(db, drawCode, source, reason);
    } else {
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
    }
  } catch (err: unknown) {
    console.error("Admin CLI error:", err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await closePool();
  }
}

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) {
    return args[idx + 1];
  }
  return undefined;
}

function printHelp() {
  console.log(`
gacha Admin CLI - Review and Reconcile Lottery Draws

Usage:
  pnpm admin review                             List draws requiring review or awaiting consensus
  pnpm admin diff --draw <drawCode>             Display side-by-side diff between source observations
  pnpm admin publish --draw <drawCode> --source <source> [--reason <text>]
                                                Force-publish a specific source version with audit logging
`);
}

async function handleReview(db: ReturnType<typeof getDb>) {
  const pendingDraws = await db.query.draws.findMany({
    where: (table, { or, eq }) =>
      or(eq(table.status, "needs_review"), eq(table.status, "observed")),
    orderBy: (table, { desc }) => [desc(table.drawDate)],
  });

  if (pendingDraws.length === 0) {
    console.log("\n✓ No draws currently requiring review or awaiting consensus.\n");
    return;
  }

  console.log(`\nFound ${pendingDraws.length} draw(s) needing attention:\n`);
  console.log(
    `| Draw Code | Date       | Status       | Sources Observed       | Reason / Note`
  );
  console.log(
    `|-----------|------------|--------------|------------------------|---------------------------`
  );

  for (const draw of pendingDraws) {
    const observations = await db
      .select({
        source: sourceObservations.source,
        fingerprint: sourceObservations.fingerprint,
        validation: sourceObservations.validation,
      })
      .from(sourceObservations)
      .where(eq(sourceObservations.drawId, draw.id));

    const sourcesSummary = observations
      .map((o) => `${o.source}${o.fingerprint ? ` (${o.fingerprint.slice(0, 6)})` : " [invalid]"}`)
      .join(", ") || "None";

    const [latestEvent] = await db
      .select()
      .from(ingestEvents)
      .where(eq(ingestEvents.drawId, draw.id))
      .orderBy(ingestEvents.id)
      .limit(1);

    const note =
      (latestEvent?.detail as { reason?: string; message?: string })?.reason ||
      (latestEvent?.detail as { reason?: string; message?: string })?.message ||
      draw.status;

    console.log(
      `| ${draw.drawCode.padEnd(9)} | ${draw.drawDate.padEnd(10)} | ${draw.status.padEnd(12)} | ${sourcesSummary.padEnd(22)} | ${note}`
    );
  }
  console.log("");
}

async function handleDiff(db: ReturnType<typeof getDb>, drawCode: string) {
  const draw = await db.query.draws.findFirst({
    where: (table, { eq }) => eq(table.drawCode, drawCode.toUpperCase()),
  });

  if (!draw) {
    console.error(`Draw "${drawCode}" not found.`);
    process.exit(1);
  }

  const observations = await db
    .select()
    .from(sourceObservations)
    .where(eq(sourceObservations.drawId, draw.id));

  const valid = observations.filter((o) => o.parsed !== null);

  if (valid.length < 2) {
    console.log(`\nDraw ${draw.drawCode} has only ${valid.length} parsed observation(s). Cannot generate two-source diff.`);
    if (valid.length === 1) {
      console.log(`Available observation: source="${valid[0].source}", fingerprint=${valid[0].fingerprint}`);
    }
    return;
  }

  const diff = compareDraws(valid[0].parsed as ParsedDraw, valid[1].parsed as ParsedDraw);
  console.log("\n" + renderDiffText(diff) + "\n");
}

async function handlePublish(
  db: ReturnType<typeof getDb>,
  drawCode: string,
  source: string,
  reason: string
) {
  console.log(`\nExecuting force-publish for draw "${drawCode}" using source "${source}"...`);
  console.log(`Reason: "${reason}"`);

  const result = await forcePublishDraw(db, drawCode, source, reason);

  console.log(`\n✓ Draw ${result.drawCode} successfully published!`);
  console.log(`  Draw ID:     ${result.drawId}`);
  console.log(`  Source:      ${result.sources?.join(", ")}`);
  console.log(`  Fingerprint: ${result.fingerprint}`);
  console.log(`  Status:      ${result.status}\n`);
}

main();
