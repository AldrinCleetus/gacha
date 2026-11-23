import pino from "pino";
import { checkDbHealth } from "./health.js";
import { closePool, getPool } from "./client.js";

const logger = pino({ name: "db-migrate" });

export async function runMigrations(): Promise<void> {
  logger.info("Connecting to database for migrations...");
  const pool = getPool();
  const health = await checkDbHealth(pool);

  if (!health.ok) {
    logger.error({ error: health.error }, "Database connection failed during migration check");
    throw new Error(`Database connection failed: ${health.error}`);
  }

  logger.info({ latencyMs: health.latencyMs }, "Database connected. Initializing schema...");
  // For F0, verify database is connected and ready.
  // Full Drizzle schema migrations are implemented in F1 per feature schedule.
  logger.info("Feature 0 bootstrap migration complete.");
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
