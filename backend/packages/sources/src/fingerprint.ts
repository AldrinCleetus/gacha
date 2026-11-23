import * as crypto from "node:crypto";
import { ParsedDraw } from "@gacha/shared";

/**
 * Computes a normalized fingerprint of a draw's prize data.
 * Tiers and entries are canonically ordered so that two independent sources
 * reporting the exact same winning tickets produce identical fingerprints.
 */
export function computeDrawFingerprint(draw: ParsedDraw): string {
  const canonicalTiers = draw.tiers
    .slice()
    .sort((a, b) => {
      const numA = parseInt(a.tier, 10);
      const numB = parseInt(b.tier, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.tier.localeCompare(b.tier);
    })
    .map((t) => ({
      tier: t.tier,
      amount: t.amount,
      matchType: t.matchType,
      entries: t.entries.slice().sort(),
    }));

  const canonicalPayload = JSON.stringify({
    schemeCode: draw.schemeCode.toUpperCase(),
    drawCode: draw.drawCode.toUpperCase(),
    drawDate: draw.drawDate,
    tiers: canonicalTiers,
  });

  return crypto.createHash("sha256").update(canonicalPayload).digest("hex");
}
