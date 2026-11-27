import { FastifyPluginAsync } from "fastify";
import { schemesRoutes } from "./schemes.js";
import { drawsRoutes } from "./draws.js";
import { meRoutes } from "./me.js";

export const v1Routes: FastifyPluginAsync = async (app) => {
  await app.register(schemesRoutes);
  await app.register(drawsRoutes);
  await app.register(meRoutes);
};
