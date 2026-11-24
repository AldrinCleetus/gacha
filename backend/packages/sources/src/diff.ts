import { ParsedDraw, PrizeTier } from "@gacha/shared";
import { computeDrawFingerprint } from "./fingerprint.js";

export type DiffIssueType =
  | "missing_in_a"
  | "missing_in_b"
  | "amount_mismatch"
  | "match_type_mismatch"
  | "entry_count_mismatch"
  | "entries_mismatch";

export interface TierDiff {
  tier: string;
  issue: DiffIssueType;
  detail: string;
  amountA?: number;
  amountB?: number;
  countA?: number;
  countB?: number;
  onlyInA?: string[];
  onlyInB?: string[];
}

export interface AgencyDiff {
  tier: string;
  ticket: string;
  detail: string;
}

export interface DrawDiff {
  drawCode: string;
  hasDiff: boolean;
  sourceA: { source: string; fingerprint: string };
  sourceB: { source: string; fingerprint: string };
  metaDifferences: string[];
  tierDifferences: TierDiff[];
  agencyDifferences: AgencyDiff[];
  summary: string;
}

/**
 * Compares two ParsedDraw objects and returns a structured DrawDiff.
 */
export function compareDraws(drawA: ParsedDraw, drawB: ParsedDraw): DrawDiff {
  const fpA = computeDrawFingerprint(drawA);
  const fpB = computeDrawFingerprint(drawB);

  const metaDifferences: string[] = [];
  if (drawA.drawCode.toUpperCase() !== drawB.drawCode.toUpperCase()) {
    metaDifferences.push(`Draw code mismatch: "${drawA.drawCode}" vs "${drawB.drawCode}"`);
  }
  if (drawA.schemeCode.toUpperCase() !== drawB.schemeCode.toUpperCase()) {
    metaDifferences.push(`Scheme code mismatch: "${drawA.schemeCode}" vs "${drawB.schemeCode}"`);
  }
  if (drawA.drawDate !== drawB.drawDate) {
    metaDifferences.push(`Draw date mismatch: "${drawA.drawDate}" vs "${drawB.drawDate}"`);
  }

  const tierMapA = new Map<string, PrizeTier>(drawA.tiers.map((t) => [t.tier, t]));
  const tierMapB = new Map<string, PrizeTier>(drawB.tiers.map((t) => [t.tier, t]));

  const allTiers = Array.from(new Set([...tierMapA.keys(), ...tierMapB.keys()])).sort(
    (a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    }
  );

  const tierDifferences: TierDiff[] = [];

  for (const tier of allTiers) {
    const tA = tierMapA.get(tier);
    const tB = tierMapB.get(tier);

    if (!tA && tB) {
      tierDifferences.push({
        tier,
        issue: "missing_in_a",
        detail: `Tier "${tier}" is missing in source "${drawA.source}" but present in "${drawB.source}"`,
        countB: tB.entries.length,
        amountB: tB.amount,
      });
      continue;
    }

    if (tA && !tB) {
      tierDifferences.push({
        tier,
        issue: "missing_in_b",
        detail: `Tier "${tier}" is present in source "${drawA.source}" but missing in "${drawB.source}"`,
        countA: tA.entries.length,
        amountA: tA.amount,
      });
      continue;
    }

    if (tA && tB) {
      if (tA.amount !== tB.amount) {
        tierDifferences.push({
          tier,
          issue: "amount_mismatch",
          detail: `Amount mismatch for tier "${tier}": ${drawA.source}=₹${tA.amount.toLocaleString("en-IN")}, ${drawB.source}=₹${tB.amount.toLocaleString("en-IN")}`,
          amountA: tA.amount,
          amountB: tB.amount,
        });
      }

      if (tA.matchType !== tB.matchType) {
        tierDifferences.push({
          tier,
          issue: "match_type_mismatch",
          detail: `Match type mismatch for tier "${tier}": ${drawA.source}=${tA.matchType}, ${drawB.source}=${tB.matchType}`,
        });
      }

      const setA = new Set(tA.entries);
      const setB = new Set(tB.entries);

      const onlyInA = tA.entries.filter((e) => !setB.has(e));
      const onlyInB = tB.entries.filter((e) => !setA.has(e));

      if (onlyInA.length > 0 || onlyInB.length > 0) {
        tierDifferences.push({
          tier,
          issue: "entries_mismatch",
          detail: `Entries differ for tier "${tier}": ${onlyInA.length} only in ${drawA.source}, ${onlyInB.length} only in ${drawB.source}`,
          countA: tA.entries.length,
          countB: tB.entries.length,
          onlyInA: onlyInA.slice(0, 10),
          onlyInB: onlyInB.slice(0, 10),
        });
      }
    }
  }

  // Agency differences
  const agencyDifferences: AgencyDiff[] = [];
  const agentsA = drawA.agents || [];
  const agentsB = drawB.agents || [];

  if (agentsA.length !== agentsB.length) {
    agencyDifferences.push({
      tier: "all",
      ticket: "all",
      detail: `Agent counts differ: ${drawA.source} reported ${agentsA.length} agents, ${drawB.source} reported ${agentsB.length}`,
    });
  }

  const hasDiff =
    fpA !== fpB ||
    metaDifferences.length > 0 ||
    tierDifferences.length > 0;

  const summary = hasDiff
    ? `Disagreement detected between ${drawA.source} and ${drawB.source}: ${metaDifferences.length} metadata differences, ${tierDifferences.length} tier differences.`
    : `Complete agreement between ${drawA.source} and ${drawB.source} (Fingerprint: ${fpA.slice(0, 12)}...)`;

  return {
    drawCode: drawA.drawCode || drawB.drawCode,
    hasDiff,
    sourceA: { source: drawA.source, fingerprint: fpA },
    sourceB: { source: drawB.source, fingerprint: fpB },
    metaDifferences,
    tierDifferences,
    agencyDifferences,
    summary,
  };
}

/**
 * Formats a DrawDiff as a clean, human-readable report for terminal or logs.
 */
export function renderDiffText(diff: DrawDiff): string {
  const lines: string[] = [];
  lines.push(`=======================================================`);
  lines.push(` RECONCILIATION DIFF FOR DRAW ${diff.drawCode}`);
  lines.push(`=======================================================`);
  lines.push(`Source A: [${diff.sourceA.source}] Fingerprint: ${diff.sourceA.fingerprint}`);
  lines.push(`Source B: [${diff.sourceB.source}] Fingerprint: ${diff.sourceB.fingerprint}`);
  lines.push(`Status:   ${diff.hasDiff ? "DISAGREEMENT (Needs Review)" : "MATCH (Consensus)"}`);
  lines.push(`-------------------------------------------------------`);

  if (!diff.hasDiff) {
    lines.push(`✓ All prize tiers, amounts, and entries are completely identical.`);
    return lines.join("\n");
  }

  if (diff.metaDifferences.length > 0) {
    lines.push(`Metadata Differences:`);
    for (const m of diff.metaDifferences) {
      lines.push(`  ! ${m}`);
    }
    lines.push(`-------------------------------------------------------`);
  }

  if (diff.tierDifferences.length > 0) {
    lines.push(`Prize Tier Differences (${diff.tierDifferences.length}):`);
    for (const td of diff.tierDifferences) {
      lines.push(`  [Tier: ${td.tier}] ${td.issue.toUpperCase()}`);
      lines.push(`    ${td.detail}`);
      if (td.onlyInA && td.onlyInA.length > 0) {
        lines.push(`    - In ${diff.sourceA.source} only: ${td.onlyInA.join(", ")}`);
      }
      if (td.onlyInB && td.onlyInB.length > 0) {
        lines.push(`    + In ${diff.sourceB.source} only: ${td.onlyInB.join(", ")}`);
      }
    }
    lines.push(`-------------------------------------------------------`);
  }

  if (diff.agencyDifferences.length > 0) {
    lines.push(`Winner Agency Differences:`);
    for (const ad of diff.agencyDifferences) {
      lines.push(`  * ${ad.detail}`);
    }
    lines.push(`-------------------------------------------------------`);
  }

  lines.push(`Summary: ${diff.summary}`);
  lines.push(`=======================================================`);
  return lines.join("\n");
}
