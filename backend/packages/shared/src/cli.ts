import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { checkTicket, CheckTicketDrawInput } from "./checkTicket.js";
import { parseTicket } from "./parser.js";

function main() {
  const args = process.argv.slice(2);
  const ticketArg = args[0];
  const fixturePathArg = args[1];

  if (!ticketArg || !fixturePathArg) {
    console.error("Usage: pnpm check-ticket <ticket> <fixture-path>");
    console.error("Example: pnpm check-ticket WA584920 packages/shared/fixtures/sample-draw.json");
    process.exit(1);
  }

  const resolvedPath = resolve(process.cwd(), fixturePathArg);
  if (!existsSync(resolvedPath)) {
    console.error(`Error: Fixture file not found: ${resolvedPath}`);
    process.exit(1);
  }

  let rawFixture: string;
  try {
    rawFixture = readFileSync(resolvedPath, "utf-8");
  } catch (err) {
    console.error(`Error reading fixture file: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  let drawData: CheckTicketDrawInput & {
    drawCode?: string;
    id?: string;
    drawDate?: string;
    schemeName?: string;
    schemeCode?: string;
  };
  try {
    drawData = JSON.parse(rawFixture);
  } catch (err) {
    console.error(`Error: Invalid JSON in fixture: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const parsedTicket = parseTicket(ticketArg);
  const matchResult = checkTicket(parsedTicket, drawData);

  console.log("==================================================");
  console.log(" gacha — Kerala Lottery Ticket Result Checker");
  console.log("==================================================");
  console.log(`Input Ticket   : ${ticketArg}`);
  console.log(`Parsed Serial  : ${parsedTicket.isValid ? parsedTicket.fullTicketString : "INVALID"}`);
  console.log(`Draw Code      : ${drawData.drawCode || drawData.id || "N/A"}`);
  console.log(`Draw Date      : ${drawData.drawDate || "N/A"}`);
  console.log(`Scheme         : ${drawData.schemeName || drawData.schemeCode || "N/A"}`);
  console.log("--------------------------------------------------");
  console.log(`Outcome Kind   : ${matchResult.kind.toUpperCase()}`);
  console.log(`Prize Tier     : ${matchResult.tier}`);
  console.log(`Prize Amount   : ${matchResult.formattedAmount}`);
  console.log(`Matched Digits : [${matchResult.matchedIndices.join(", ")}]`);
  if (matchResult.closestMatch) {
    console.log(`Near Miss Note : ${matchResult.closestMatch}`);
  }
  console.log(`Summary        : ${matchResult.summary}`);
  console.log("==================================================");
  console.log("\nJSON Output:\n" + JSON.stringify(matchResult, null, 2));
}

main();
