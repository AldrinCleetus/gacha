import "dotenv/config";
import { buildServer } from "./server.js";
import { closePool } from "@gacha/db";

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || "0.0.0.0";

const server = buildServer();

async function start() {
  try {
    await server.listen({ port: PORT, host: HOST });
    server.log.info(`gacha API server listening at http://${HOST}:${PORT}`);
  } catch (err) {
    server.log.error({ err }, "Failed to start server");
    process.exit(1);
  }
}

async function shutdown(signal: string) {
  server.log.info({ signal }, "Graceful shutdown initiated");
  try {
    await server.close();
    await closePool();
    server.log.info("Server and DB pool closed successfully");
    process.exit(0);
  } catch (err) {
    server.log.error({ err }, "Error during shutdown");
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start();
