import { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getDb } from "@gacha/db";

const SchemeItemSchema = z.object({
  code: z.string(),
  name: z.string(),
  weekday: z.number().nullable(),
  ticketPrice: z.number(),
  isBumper: z.boolean(),
  series: z.array(z.string()),
  structure: z.any().nullable(),
});

const SchemesResponseSchema = z.object({
  schemes: z.array(SchemeItemSchema),
});

export const schemesRoutes: FastifyPluginAsync = async (app) => {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/schemes",
    {
      schema: {
        tags: ["schemes"],
        summary: "List all lottery schemes with weekday, ticket price, and known series",
        response: {
          200: SchemesResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const db = getDb();
      const allSchemes = await db.query.schemes.findMany({
        with: {
          series: true,
        },
        orderBy: (schemesTable, { asc }) => [asc(schemesTable.weekday)],
      });

      const formatted = allSchemes.map((s) => ({
        code: s.code,
        name: s.name,
        weekday: s.weekday,
        ticketPrice: Number(s.ticketPrice),
        isBumper: s.isBumper ?? false,
        series: s.series.map((item) => item.series).sort(),
        structure: s.structure,
      }));

      reply.header("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
      return reply.send({ schemes: formatted });
    }
  );
};
