import "dotenv/config";
import pino from "pino";
import { checkDbHealth, closePool } from "@gacha/db";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  name: "gacha-worker",
  level: process.env.LOG_LEVEL || (isDev ? "info" : "warn"),
  transport: isDev
    ? {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard" },
      }
    : undefined,
});

export async function bootWorker(): Promise<{ ready: boolean; dbConnected: boolean }> {
  logger.info("Booting gacha ingestion worker...");
  logger.info(`Node Environment: ${process.env.NODE_ENV || "development"}`);
  logger.info(`Timezone: ${process.env.TZ || "UTC"}`);

  const dbHealth = await checkDbHealth();
  if (!dbHealth.ok) {
    logger.warn({ error: dbHealth.error }, "Worker started with database warning");
    return { ready: true, dbConnected: false };
  }

  logger.info(
    { dbLatencyMs: dbHealth.latencyMs },
    "Database connection verified. Worker is running and idle (scheduler starts in F7)."
  );

  return { ready: true, dbConnected: true };
}

let keepAliveInterval: NodeJS.Timeout | null = null;

async function start() {
  await bootWorker();

  // Keep worker process alive
  keepAliveInterval = setInterval(() => {
    logger.debug("Worker heartbeat (idle, awaiting F7 scheduler)");
  }, 60000);
}

async function shutdown(signal: string) {
  logger.info({ signal }, "Worker shutdown initiated");
  if (keepAliveInterval) clearInterval(keepAliveInterval);
  try {
    await closePool();
    logger.info("Worker stopped cleanly");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Error during worker shutdown");
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  start();
}
