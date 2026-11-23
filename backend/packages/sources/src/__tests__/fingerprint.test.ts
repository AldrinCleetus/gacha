import { describe, expect, it } from "vitest";
import { computeDrawFingerprint } from "../fingerprint.js";
import { ParsedDraw } from "@gacha/shared";

describe("Draw Fingerprint Generator", () => {
  const baseDraw: ParsedDraw = {
    source: "onmanorama",
    sourceUrl: "https://example.com/draw",
    fetchedAt: "2026-11-22T10:00:00.000Z",
    schemeName: "Samrudhi",
    schemeCode: "SM",
    drawCode: "SM-82",
    drawDate: "2026-11-22",
    tiers: [
      { tier: "1", amount: 10000000, matchType: "full", entries: ["MO747323"] },
      { tier: "4", amount: 5000, matchType: "last4", entries: ["0606", "1547", "1813"] },
      { tier: "2", amount: 2500000, matchType: "full", entries: ["MN147266"] },
    ],
    raw: { contentHash: "1111222233334444" },
  };

  it("produces identical fingerprints regardless of tier or entry order", () => {
    // Draw with shuffled tiers and shuffled entries in tier 4
    const shuffledDraw: ParsedDraw = {
      ...baseDraw,
      source: "keralalotteries_net", // different source
      fetchedAt: "2026-11-22T12:00:00.000Z", // different timestamp
      tiers: [
        { tier: "2", amount: 2500000, matchType: "full", entries: ["MN147266"] },
        { tier: "4", amount: 5000, matchType: "last4", entries: ["1813", "0606", "1547"] },
        { tier: "1", amount: 10000000, matchType: "full", entries: ["MO747323"] },
      ],
      raw: { contentHash: "9999888877776666" },
    };

    const fp1 = computeDrawFingerprint(baseDraw);
    const fp2 = computeDrawFingerprint(shuffledDraw);

    expect(fp1).toBe(fp2);
    expect(fp1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces different fingerprints if winning ticket changes", () => {
    const alteredDraw: ParsedDraw = {
      ...baseDraw,
      tiers: [
        { tier: "1", amount: 10000000, matchType: "full", entries: ["MO999999"] },
        { tier: "4", amount: 5000, matchType: "last4", entries: ["0606", "1547", "1813"] },
        { tier: "2", amount: 2500000, matchType: "full", entries: ["MN147266"] },
      ],
    };

    expect(computeDrawFingerprint(baseDraw)).not.toBe(computeDrawFingerprint(alteredDraw));
  });
});
