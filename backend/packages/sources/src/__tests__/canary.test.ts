import { describe, it, expect, vi, beforeEach } from "vitest";
import { runCanaryCheck } from "../canary.js";
import { onmanoramaAdapter } from "../onmanorama/adapter.js";
import { keralalotteriesAdapter } from "../keralalotteries/adapter.js";
import { ParsedDraw } from "@gacha/shared";

describe("Source Canary Drift Check", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockParsedDraw: ParsedDraw = {
    source: "onmanorama",
    sourceUrl: "https://example.com/draw",
    fetchedAt: "2026-11-23T10:00:00Z",
    schemeName: "Bhagyathara",
    schemeCode: "BT",
    drawCode: "BT-80",
    drawDate: "2026-11-23",
    tiers: [
      { tier: "1", amount: 10000000, matchType: "full", entries: ["BT123456"] },
      { tier: "2", amount: 2500000, matchType: "full", entries: ["BT654321"] },
    ],
    raw: { contentHash: "hash1" },
  };

  it("returns ok: true when all sources discover and parse successfully", async () => {
    vi.spyOn(onmanoramaAdapter, "discover").mockResolvedValue([
      { schemeCode: "BT", drawCode: "BT-80", drawDate: "2026-11-23", url: "https://onmanorama/bt-80" },
    ]);
    vi.spyOn(onmanoramaAdapter, "fetchAndParse").mockResolvedValue(mockParsedDraw);

    vi.spyOn(keralalotteriesAdapter, "discover").mockResolvedValue([
      { schemeCode: "BT", drawCode: "BT-80", drawDate: "2026-11-23", url: "https://kl/bt-80" },
    ]);
    vi.spyOn(keralalotteriesAdapter, "fetchAndParse").mockResolvedValue({
      ...mockParsedDraw,
      source: "keralalotteries_net",
    });

    const report = await runCanaryCheck();

    expect(report.ok).toBe(true);
    expect(report.sources).toHaveLength(2);

    const onm = report.sources.find((s) => s.source === "onmanorama");
    expect(onm?.ok).toBe(true);
    expect(onm?.discoveredCount).toBe(1);
    expect(onm?.latestDrawCode).toBe("BT-80");
    expect(onm?.tierCount).toBe(2);
    expect(onm?.entryCount).toBe(2);
    expect(onm?.latencyMs).toBeGreaterThanOrEqual(0);

    const kl = report.sources.find((s) => s.source === "keralalotteries_net");
    expect(kl?.ok).toBe(true);
  });

  it("returns ok: false when a source parser fails or drift is detected", async () => {
    vi.spyOn(onmanoramaAdapter, "discover").mockResolvedValue([
      { schemeCode: "BT", drawCode: "BT-80", drawDate: "2026-11-23", url: "https://onmanorama/bt-80" },
    ]);
    vi.spyOn(onmanoramaAdapter, "fetchAndParse").mockRejectedValue(new Error("HTML structure changed: missing prize table"));

    vi.spyOn(keralalotteriesAdapter, "discover").mockResolvedValue([]);

    const report = await runCanaryCheck();

    expect(report.ok).toBe(false);
    expect(report.sources).toHaveLength(2);

    const onm = report.sources.find((s) => s.source === "onmanorama");
    expect(onm?.ok).toBe(false);
    expect(onm?.error).toContain("HTML structure changed");

    const kl = report.sources.find((s) => s.source === "keralalotteries_net");
    expect(kl?.ok).toBe(false);
    expect(kl?.error).toContain("0 draw links");
  });
});
