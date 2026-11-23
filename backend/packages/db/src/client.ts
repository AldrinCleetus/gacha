import pg from "pg";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema/index.js";

const { Pool } = pg;

export type DbClient = NodePgDatabase<typeof schema>;

export function getDatabaseUrl(): string {
  return (
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5433/gacha"
  );
}

let poolInstance: pg.Pool | null = null;

export function getPool(connectionString?: string): pg.Pool {
  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString: connectionString || getDatabaseUrl(),
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return poolInstance;
}

export function getDb(pool?: pg.Pool): DbClient {
  const p = pool || getPool();
  return drizzle(p, { schema });
}

export async function closePool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}
