import "dotenv/config";
import pino from "pino";
import { checkDbHealth, closePool } from "@gacha/db";
import { Scheduler } from "./scheduler.js";

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

let schedulerInstance: Scheduler | null = null;

export function getScheduler(): Scheduler | null {
  return schedulerInstance;
}

export async function bootWorker(
  scheduler?: Scheduler
): Promise<{ ready: boolean; dbConnected: boolean; schedulerStarted: boolean }> {
  logger.info("Booting gacha ingestion worker...");
  logger.info(`Node Environment: ${process.env.NODE_ENV || "development"}`);
  logger.info(`Timezone: ${process.env.TZ || "UTC"}`);

  const dbHealth = await checkDbHealth();
  if (!dbHealth.ok) {
    logger.warn({ error: dbHealth.error }, "Worker started with database warning");
    return { ready: true, dbConnected: false, schedulerStarted: false };
  }

  logger.info(
    { dbLatencyMs: dbHealth.latencyMs },
    "Database connection verified. Initializing scheduler..."
  );

  schedulerInstance = scheduler || new Scheduler();
  try {
    await schedulerInstance.start();
    logger.info("pg-boss scheduler started and polling jobs active.");
    return { ready: true, dbConnected: true, schedulerStarted: true };
  } catch (err) {
    logger.error({ err }, "Failed to start pg-boss scheduler");
    return { ready: true, dbConnected: true, schedulerStarted: false };
  }
}

async function start() {
  await bootWorker();
}

async function shutdown(signal: string) {
  logger.info({ signal }, "Worker shutdown initiated");
  try {
    if (schedulerInstance) {
      await schedulerInstance.stop();
    }
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
