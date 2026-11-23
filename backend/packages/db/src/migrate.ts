import pino from "pino";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { checkDbHealth } from "./health.js";
import { closePool, getDb, getPool } from "./client.js";
import { seedSchemes } from "./seed.js";

const logger = pino({ name: "db-migrate" });

export function resolveMigrationsFolder(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const candidate1 = join(currentDir, "../drizzle");
  if (existsSync(candidate1)) return candidate1;
  const candidate2 = join(currentDir, "../../drizzle");
  if (existsSync(candidate2)) return candidate2;
  const candidate3 = join(process.cwd(), "packages/db/drizzle");
  if (existsSync(candidate3)) return candidate3;
  const candidate4 = join(process.cwd(), "drizzle");
  if (existsSync(candidate4)) return candidate4;
  throw new Error(
    `Migrations folder not found. Searched: ${candidate1}, ${candidate2}, ${candidate3}, ${candidate4}`
  );
}

export async function runMigrations(): Promise<void> {
  logger.info("Connecting to database for migrations...");
  const pool = getPool();
  const health = await checkDbHealth(pool);

  if (!health.ok) {
    logger.error({ error: health.error }, "Database connection failed during migration check");
    throw new Error(`Database connection failed: ${health.error}`);
  }

  logger.info({ latencyMs: health.latencyMs }, "Database connected. Running schema migrations...");
  const db = getDb(pool);
  const migrationsFolder = resolveMigrationsFolder();
  logger.info({ migrationsFolder }, "Applying Drizzle migrations from folder");

  await migrate(db, { migrationsFolder });
  logger.info("Schema migrations applied successfully.");

  logger.info("Executing database seed...");
  const seededCount = await seedSchemes(db);
  logger.info({ seededCount }, "Database seeding completed successfully.");

  await closePool();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      logger.info("Migration runner completed successfully.");
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, "Migration failed");
      process.exit(1);
    });
}
