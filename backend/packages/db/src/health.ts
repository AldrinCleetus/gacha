import type pg from "pg";
import { getPool } from "./client.js";

export interface DbHealthResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export async function checkDbHealth(pool?: pg.Pool): Promise<DbHealthResult> {
  const p = pool || getPool();
  const start = Date.now();
  try {
    const res = await p.query("SELECT 1 as alive");
    const latencyMs = Date.now() - start;
    if (res.rows?.[0]?.alive === 1) {
      return { ok: true, latencyMs };
    }
    return { ok: false, latencyMs, error: "Unexpected query result" };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, latencyMs, error: message };
  }
}
