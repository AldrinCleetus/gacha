import { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  getDb,
  draws,
  schemes,
  eq,
  and,
  lt,
  sql,
} from "@gacha/db";
import {
  checkTicket,
  CheckTicketDrawInput,
  MatchResultSchema,
  getTodayIST,
  getWeekdayFromDate,
} from "@gacha/shared";

const DrawListItemSchema = z.object({
  id: z.string(),
  schemeCode: z.string(),
  schemeName: z.string(),
  drawCode: z.string(),
  drawDate: z.string(),
  status: z.string(),
  publishedAt: z.string().nullable(),
  fingerprint: z.string().nullable(),
});

const DrawsListResponseSchema = z.object({
  draws: z.array(DrawListItemSchema),
  limit: z.number(),
  hasMore: z.boolean(),
});

const PrizeTierOutputSchema = z.object({
  tier: z.string(),
  amount: z.number(),
  matchType: z.enum(["full", "consolation", "last4"]),
  entries: z.array(z.string()),
});

const WinnerAgencyOutputSchema = z.object({
  tier: z.string(),
  ticket: z.string(),
  agencyName: z.string().nullable(),
  agencyCode: z.string().nullable(),
  place: z.string().nullable(),
  source: z.string(),
});

const FullDrawResponseSchema = z.object({
  id: z.string(),
  schemeCode: z.string(),
  schemeName: z.string(),
  drawCode: z.string(),
  drawDate: z.string(),
  status: z.string(),
  publishedAt: z.string().nullable(),
  fingerprint: z.string().nullable(),
  tiers: z.array(PrizeTierOutputSchema),
  agencies: z.array(WinnerAgencyOutputSchema),
});

const DrawStatusResponseSchema = z.object({
  date: z.string(),
  weekday: z.number(),
  scheduledScheme: z
    .object({
      code: z.string(),
      name: z.string(),
      weekday: z.number().nullable(),
    })
    .nullable(),
  status: z.string(),
  isOut: z.boolean(),
  scheduledTime: z.string(),
  draw: z
    .object({
      id: z.string(),
      drawCode: z.string(),
      schemeCode: z.string(),
      schemeName: z.string(),
      drawDate: z.string(),
      status: z.string(),
      publishedAt: z.string().nullable(),
    })
    .nullable(),
});

export const drawsRoutes: FastifyPluginAsync = async (app) => {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // 1. GET /draws (list view)
  typed.get(
    "/draws",
    {
      schema: {
        tags: ["draws"],
        summary: "List recent published lottery draws with optional scheme and before filters",
        querystring: z.object({
          limit: z.coerce.number().int().min(1).max(100).default(20),
          scheme: z.string().optional(),
          before: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
            .optional(),
        }),
        response: {
          200: DrawsListResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { limit, scheme, before } = request.query;
      const db = getDb();

      const conditions = [eq(draws.status, "published")];
      if (scheme) {
        conditions.push(eq(draws.schemeCode, scheme.toUpperCase()));
      }
      if (before) {
        conditions.push(lt(draws.drawDate, before));
      }

      const rows = await db.query.draws.findMany({
        where: and(...conditions),
        with: {
          scheme: true,
        },
        orderBy: (drawsTable, { desc }) => [
          desc(drawsTable.drawDate),
          desc(drawsTable.publishedAt),
        ],
        limit: limit + 1,
      });

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;

      const formatted = items.map((d) => ({
        id: d.id,
        schemeCode: d.schemeCode,
        schemeName: d.scheme?.name || d.schemeCode,
        drawCode: d.drawCode,
        drawDate: d.drawDate,
        status: d.status,
        publishedAt: d.publishedAt ? d.publishedAt.toISOString() : null,
        fingerprint: d.fingerprint,
      }));

      reply.header("Cache-Control", "public, max-age=60, s-maxage=60");
      return reply.send({
        draws: formatted,
        limit,
        hasMore,
      });
    }
  );

  // 2. GET /draws/latest
  typed.get(
    "/draws/latest",
    {
      schema: {
        tags: ["draws"],
        summary: "Get the latest published lottery draw (optionally filtered by scheme)",
        querystring: z.object({
          scheme: z.string().optional(),
        }),
        response: {
          200: FullDrawResponseSchema,
          404: z.object({
            statusCode: z.number(),
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { scheme } = request.query;
      const db = getDb();

      const conditions = [eq(draws.status, "published")];
      if (scheme) {
        conditions.push(eq(draws.schemeCode, scheme.toUpperCase()));
      }

      const latest = await db.query.draws.findFirst({
        where: and(...conditions),
        with: {
          scheme: true,
          tiers: {
            orderBy: (tiersTable, { asc }) => [asc(tiersTable.tier)],
          },
          entries: true,
          agencies: true,
        },
        orderBy: (drawsTable, { desc }) => [
          desc(drawsTable.drawDate),
          desc(drawsTable.publishedAt),
        ],
      });

      if (!latest) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: scheme
            ? `No published draw found for scheme '${scheme}'`
            : "No published draws found",
        });
      }

      // Group entries by tier
      const entriesByTier = new Map<string, string[]>();
      for (const e of latest.entries) {
        const list = entriesByTier.get(e.tier) || [];
        list.push(e.entry);
        entriesByTier.set(e.tier, list);
      }

      const tiers = latest.tiers.map((t) => ({
        tier: t.tier,
        amount: Number(t.amount),
        matchType: t.matchType as "full" | "consolation" | "last4",
        entries: (entriesByTier.get(t.tier) || []).sort(),
      }));

      reply.header("Cache-Control", "public, max-age=60, s-maxage=60");
      return reply.send({
        id: latest.id,
        schemeCode: latest.schemeCode,
        schemeName: latest.scheme?.name || latest.schemeCode,
        drawCode: latest.drawCode,
        drawDate: latest.drawDate,
        status: latest.status,
        publishedAt: latest.publishedAt ? latest.publishedAt.toISOString() : null,
        fingerprint: latest.fingerprint,
        tiers,
        agencies: latest.agencies.map((a) => ({
          tier: a.tier,
          ticket: a.ticket,
          agencyName: a.agencyName,
          agencyCode: a.agencyCode,
          place: a.place,
          source: a.source,
        })),
      });
    }
  );

  // 3. GET /draws/status
  typed.get(
    "/draws/status",
    {
      schema: {
        tags: ["draws"],
        summary: "Check expected vs published draw state for a calendar date in IST",
        querystring: z.object({
          date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
            .optional(),
        }),
        response: {
          200: DrawStatusResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const targetDate = request.query.date || getTodayIST();
      const weekday = getWeekdayFromDate(targetDate);
      const db = getDb();

      // Find scheduled scheme for this weekday
      const scheduledScheme = await db.query.schemes.findFirst({
        where: eq(schemes.weekday, weekday),
      });

      // Check if a draw exists for this date
      const existingDraw = await db.query.draws.findFirst({
        where: eq(draws.drawDate, targetDate),
        with: {
          scheme: true,
        },
      });

      let status = "expected";
      let isOut = false;

      if (existingDraw) {
        status = existingDraw.status;
        isOut = existingDraw.status === "published";
      }

      reply.header("Cache-Control", "public, max-age=15, stale-while-revalidate=15");
      return reply.send({
        date: targetDate,
        weekday,
        scheduledScheme: scheduledScheme
          ? {
              code: scheduledScheme.code,
              name: scheduledScheme.name,
              weekday: scheduledScheme.weekday,
            }
          : null,
        status,
        isOut,
        scheduledTime: "15:00 IST",
        draw: existingDraw
          ? {
              id: existingDraw.id,
              drawCode: existingDraw.drawCode,
              schemeCode: existingDraw.schemeCode,
              schemeName: existingDraw.scheme?.name || existingDraw.schemeCode,
              drawDate: existingDraw.drawDate,
              status: existingDraw.status,
              publishedAt: existingDraw.publishedAt
                ? existingDraw.publishedAt.toISOString()
                : null,
            }
          : null,
      });
    }
  );

  // 4. GET /draws/:id (full draw details with immutable cache)
  typed.get(
    "/draws/:id",
    {
      schema: {
        tags: ["draws"],
        summary: "Get full details of a published draw (tiers and winning entries)",
        params: z.object({
          id: z.string().min(1),
        }),
        response: {
          200: FullDrawResponseSchema,
          404: z.object({
            statusCode: z.number(),
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const db = getDb();

      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

      const drawRecord = await db.query.draws.findFirst({
        where: isUuid
          ? eq(draws.id, id)
          : sql`lower(${draws.drawCode}) = lower(${id})`,
        with: {
          scheme: true,
          tiers: {
            orderBy: (tiersTable, { asc }) => [asc(tiersTable.tier)],
          },
          entries: true,
          agencies: true,
        },
      });

      if (!drawRecord || drawRecord.status !== "published") {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Draw '${id}' not found or not yet published`,
        });
      }

      // Group entries by tier
      const entriesByTier = new Map<string, string[]>();
      for (const e of drawRecord.entries) {
        const list = entriesByTier.get(e.tier) || [];
        list.push(e.entry);
        entriesByTier.set(e.tier, list);
      }

      const tiers = drawRecord.tiers.map((t) => ({
        tier: t.tier,
        amount: Number(t.amount),
        matchType: t.matchType as "full" | "consolation" | "last4",
        entries: (entriesByTier.get(t.tier) || []).sort(),
      }));

      // Immutable caching per design section 8.2
      reply.header("Cache-Control", "public, max-age=31536000, immutable");
      return reply.send({
        id: drawRecord.id,
        schemeCode: drawRecord.schemeCode,
        schemeName: drawRecord.scheme?.name || drawRecord.schemeCode,
        drawCode: drawRecord.drawCode,
        drawDate: drawRecord.drawDate,
        status: drawRecord.status,
        publishedAt: drawRecord.publishedAt
          ? drawRecord.publishedAt.toISOString()
          : null,
        fingerprint: drawRecord.fingerprint,
        tiers,
        agencies: drawRecord.agencies.map((a) => ({
          tier: a.tier,
          ticket: a.ticket,
          agencyName: a.agencyName,
          agencyCode: a.agencyCode,
          place: a.place,
          source: a.source,
        })),
      });
    }
  );

  // 5. POST /draws/:id/check (ticket verification against draw)
  typed.post(
    "/draws/:id/check",
    {
      schema: {
        tags: ["tickets"],
        summary: "Verify a lottery ticket number against a specific draw",
        params: z.object({
          id: z.string().min(1),
        }),
        body: z.object({
          ticket: z.string().min(1, "Ticket number is required"),
        }),
        response: {
          200: MatchResultSchema,
          404: z.object({
            statusCode: z.number(),
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { ticket } = request.body;
      const db = getDb();

      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

      const drawRecord = await db.query.draws.findFirst({
        where: isUuid
          ? eq(draws.id, id)
          : sql`lower(${draws.drawCode}) = lower(${id})`,
        with: {
          scheme: true,
          tiers: true,
          entries: true,
        },
      });

      if (!drawRecord) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Draw '${id}' not found`,
        });
      }

      // Group entries by tier
      const entriesByTier = new Map<string, string[]>();
      for (const e of drawRecord.entries) {
        const list = entriesByTier.get(e.tier) || [];
        list.push(e.entry);
        entriesByTier.set(e.tier, list);
      }

      const drawInput: CheckTicketDrawInput = {
        isPublished: drawRecord.status === "published",
        tiers: drawRecord.tiers.map((t) => ({
          tier: t.tier,
          amount: Number(t.amount),
          matchType: t.matchType as "full" | "consolation" | "last4",
          entries: entriesByTier.get(t.tier) || [],
        })),
      };

      const result = checkTicket(ticket, drawInput);
      reply.header("Cache-Control", "private, no-cache");
      return reply.send(result);
    }
  );
};
