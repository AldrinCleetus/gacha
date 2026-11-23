import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { checkDbHealth } from "@gacha/db";

export function buildServer(): FastifyInstance {
  const isDev = process.env.NODE_ENV !== "production";

  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || (isDev ? "info" : "warn"),
      transport: isDev
        ? {
            target: "pino-pretty",
            options: { colorize: true, translateTime: "SYS:standard" },
          }
        : undefined,
    },
    trustProxy: true,
  });

  app.register(cors, {
    origin: true,
  });

  // Health check endpoint (checks DB connectivity)
  app.get("/health", async (request, reply) => {
    const dbHealth = await checkDbHealth();

    if (!dbHealth.ok) {
      app.log.error({ error: dbHealth.error }, "Health check failed: DB unhealthy");
      return reply.status(503).send({
        status: "degraded",
        db: "disconnected",
        error: dbHealth.error,
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
      });
    }

    return reply.status(200).send({
      status: "ok",
      db: "connected",
      dbLatencyMs: dbHealth.latencyMs,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  return app;
}
