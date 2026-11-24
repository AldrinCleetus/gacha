import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import etag from "@fastify/etag";
import multipart from "@fastify/multipart";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
} from "fastify-type-provider-zod";
import { checkDbHealth } from "@gacha/db";
import { v1Routes } from "./routes/v1/index.js";
import { adminRoutes } from "./routes/admin/index.js";

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

  // Zod type provider integration
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // CORS
  app.register(cors, {
    origin: true,
  });

  // Per-IP rate limiting (120 req/minute, localhost allowlisted)
  app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
    allowList: ["127.0.0.1", "::1"],
  });

  // Automatic ETag and 304 handling
  app.register(etag);

  // Multipart file upload support for admin PDF uploads
  app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB max PDF size
    },
  });

  // Content type parser for raw PDF binary uploads
  app.addContentTypeParser(
    ["application/pdf", "application/octet-stream"],
    { parseAs: "buffer" },
    (_req, body, done) => {
      done(null, body);
    }
  );

  // OpenAPI / Swagger documentation at /docs
  app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "gacha API",
        description: "Kerala lottery result checker API — fast, verified, public read API",
        version: "1.0.0",
      },
      servers: [
        {
          url: "http://localhost:3001",
          description: "Local development server",
        },
      ],
      tags: [
        { name: "schemes", description: "Lottery schemes and series information" },
        { name: "draws", description: "Lottery draws and prize tiers" },
        { name: "tickets", description: "Ticket checking and prize matching" },
      ],
    },
    transform: jsonSchemaTransform,
  });

  app.register(fastifySwaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
    staticCSP: true,
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

  // Public read API under /v1
  app.register(v1Routes, { prefix: "/v1" });

  // Admin routes under /admin (protected by token auth)
  app.register(adminRoutes, { prefix: "/admin" });

  return app;
}
