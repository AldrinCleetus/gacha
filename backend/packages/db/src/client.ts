import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

const { Pool } = pg;

export function getDatabaseUrl(): string {
  return (
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/gacha"
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

export function getDb(pool?: pg.Pool) {
  const p = pool || getPool();
  return drizzle(p);
}

export async function closePool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}
