import { onmanoramaAdapter } from "./onmanorama/adapter.js";
import { keralalotteriesAdapter } from "./keralalotteries/adapter.js";
import { SourceAdapter } from "./types.js";

export interface CanarySourceResult {
  source: string;
  ok: boolean;
  discoveredCount: number;
  latestDrawCode?: string;
  latestDrawDate?: string;
  tierCount?: number;
  entryCount?: number;
  latencyMs: number;
  error?: string;
}

export interface CanaryReport {
  ok: boolean;
  timestamp: string;
  sources: CanarySourceResult[];
}

export async function runCanaryCheck(): Promise<CanaryReport> {
  const adapters: SourceAdapter[] = [onmanoramaAdapter, keralalotteriesAdapter];
  const sourceResults: CanarySourceResult[] = [];
  let allOk = true;

  for (const adapter of adapters) {
    const start = Date.now();
    try {
      // 1. Check discovery
      const refs = await adapter.discover();
      if (refs.length === 0) {
        throw new Error("Canary discovery found 0 draw links on listing page");
      }

      // 2. Fetch and parse latest draw article
      // Try up to first 3 links to account for pre-draw announcement placeholders on draw days
      let parsed = null;
      let lastErr: unknown = null;
      for (const ref of refs.slice(0, 3)) {
        try {
          parsed = await adapter.fetchAndParse(ref);
          break;
        } catch (err: unknown) {
          lastErr = err;
        }
      }

      if (!parsed) {
        throw lastErr || new Error("Failed to parse any recent draw articles");
      }

      const latencyMs = Date.now() - start;
      const entryCount = parsed.tiers.reduce((acc, t) => acc + t.entries.length, 0);

      sourceResults.push({
        source: adapter.id,
        ok: true,
        discoveredCount: refs.length,
        latestDrawCode: parsed.drawCode,
        latestDrawDate: parsed.drawDate,
        tierCount: parsed.tiers.length,
        entryCount,
        latencyMs,
      });
    } catch (err: unknown) {
      allOk = false;
      const latencyMs = Date.now() - start;
      const msg = err instanceof Error ? err.message : String(err);
      sourceResults.push({
        source: adapter.id,
        ok: false,
        discoveredCount: 0,
        latencyMs,
        error: msg,
      });
    }
  }

  return {
    ok: allOk,
    timestamp: new Date().toISOString(),
    sources: sourceResults,
  };
}
