import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getAuth } from "@clerk/fastify";
import { getDb, users, userTickets, eq, desc, asc } from "@gacha/db";
import { MatchResultSchema } from "@gacha/shared";

const SavedTicketPayloadSchema = z.object({
  id: z.string().min(1),
  ticketString: z.string().min(1),
  schemeCode: z.string().min(1),
  series: z.string().min(1),
  digits: z.string().min(1),
  drawId: z.string().min(1),
  drawDate: z.string().min(1),
  checkedAt: z.string().min(1),
  cost: z.number().int().nonnegative(),
  wonAmount: z.number().int().nonnegative(),
  result: MatchResultSchema,
});

const UserProfileSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

const UserStatsResponseSchema = z.object({
  totalTickets: z.number(),
  totalSpent: z.number(),
  totalWon: z.number(),
  netProfitLoss: z.number(),
  winRate: z.number(),
  bestWin: z.number(),
  longestDrySpell: z.number(),
  mostCheckedScheme: z.string(),
  schemeBreakdown: z.record(
    z.object({
      count: z.number(),
      spent: z.number(),
      won: z.number(),
      wins: z.number(),
    })
  ),
  monthlyBreakdown: z.array(
    z.object({
      month: z.string(),
      spent: z.number(),
      won: z.number(),
      net: z.number(),
      sortKey: z.string(),
    })
  ),
  historyTimeline: z.array(
    z.object({
      date: z.string(),
      cumulativeNet: z.number(),
      cost: z.number(),
      prize: z.number(),
      ticket: z.string(),
    })
  ),
});

const SCHEME_NAMES: Record<string, string> = {
  W: "Win-Win",
  S: "Sthree Sakthi",
  SS: "Sthree Sakthi",
  A: "Akshaya",
  AK: "Akshaya",
  K: "Karunya Plus",
  KN: "Karunya Plus",
  N: "Nirmal",
  NR: "Nirmal",
  KR: "Karunya",
  SM: "Samrudhi",
  B: "Bhagyathara",
  BT: "Bhagyathara",
  DL: "Dhanalekshmi",
  SK: "Suvarna Keralam",
};

function requireClerkUserId(
  request: FastifyRequest,
  reply: FastifyReply
): string | null {
  try {
    const auth = getAuth(request);
    if (auth?.userId) {
      return auth.userId;
    }
  } catch {
    // Fall through to 401 when clerkPlugin is unconfigured or unauthenticated
  }
  reply.status(401).send({
    statusCode: 401,
    error: "Unauthorized",
    message: "Google sign-in required",
  });
  return null;
}

async function ensureUserRecord(
  userId: string,
  profile?: {
    email?: string | null;
    name?: string | null;
    avatarUrl?: string | null;
  }
) {
  const db = getDb();
  if (
    profile &&
    (profile.email !== undefined ||
      profile.name !== undefined ||
      profile.avatarUrl !== undefined)
  ) {
    await db
      .insert(users)
      .values({
        clerkId: userId,
        email: profile.email ?? null,
        name: profile.name ?? null,
        avatarUrl: profile.avatarUrl ?? null,
      })
      .onConflictDoUpdate({
        target: users.clerkId,
        set: {
          ...(profile.email !== undefined ? { email: profile.email } : {}),
          ...(profile.name !== undefined ? { name: profile.name } : {}),
          ...(profile.avatarUrl !== undefined
            ? { avatarUrl: profile.avatarUrl }
            : {}),
          updatedAt: new Date(),
        },
      });
  } else {
    await db
      .insert(users)
      .values({ clerkId: userId })
      .onConflictDoNothing({ target: users.clerkId });
  }
}

export const meRoutes: FastifyPluginAsync = async (app) => {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // 1. GET /me — get current user profile from Postgres
  typed.get(
    "/me",
    {
      schema: {
        tags: ["me"],
        summary: "Get the authenticated user profile",
        response: {
          200: z.object({ user: UserProfileSchema }),
          401: z.object({
            statusCode: z.number(),
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = requireClerkUserId(request, reply);
      if (!userId) return;

      await ensureUserRecord(userId);
      const db = getDb();
      const row = await db.query.users.findFirst({
        where: eq(users.clerkId, userId),
      });

      reply.header("Cache-Control", "no-store");
      return reply.send({
        user: {
          id: userId,
          email: row?.email ?? null,
          name: row?.name ?? null,
          avatarUrl: row?.avatarUrl ?? null,
        },
      });
    }
  );

  // 2. PUT /me/profile — upsert authenticated user's profile metadata into Postgres
  typed.put(
    "/me/profile",
    {
      schema: {
        tags: ["me"],
        summary: "Sync authenticated user profile into Postgres",
        body: z.object({
          email: z.string().nullable().optional(),
          name: z.string().nullable().optional(),
          avatarUrl: z.string().nullable().optional(),
        }),
        response: {
          200: z.object({ user: UserProfileSchema }),
          401: z.object({
            statusCode: z.number(),
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = requireClerkUserId(request, reply);
      if (!userId) return;

      await ensureUserRecord(userId, request.body);
      const db = getDb();
      const row = await db.query.users.findFirst({
        where: eq(users.clerkId, userId),
      });

      return reply.send({
        user: {
          id: userId,
          email: row?.email ?? null,
          name: row?.name ?? null,
          avatarUrl: row?.avatarUrl ?? null,
        },
      });
    }
  );

  // 3. GET /me/tickets — fetch user's saved tickets from Postgres
  typed.get(
    "/me/tickets",
    {
      schema: {
        tags: ["me"],
        summary: "List all checked lottery tickets saved for the authenticated user",
        response: {
          200: z.object({ tickets: z.array(SavedTicketPayloadSchema) }),
          401: z.object({
            statusCode: z.number(),
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = requireClerkUserId(request, reply);
      if (!userId) return;

      const db = getDb();
      const rows = await db
        .select()
        .from(userTickets)
        .where(eq(userTickets.userId, userId))
        .orderBy(desc(userTickets.checkedAt));

      reply.header("Cache-Control", "no-store");
      return reply.send({
        tickets: rows.map((r) => ({
          id: r.id,
          ticketString: r.ticketString,
          schemeCode: r.schemeCode,
          series: r.series,
          digits: r.digits,
          drawId: r.drawCode,
          drawDate: r.drawDate,
          checkedAt: r.checkedAt.toISOString(),
          cost: r.cost,
          wonAmount: r.wonAmount,
          result: r.result,
        })),
      });
    }
  );

  // 4. POST /me/tickets — persist a checked ticket for the authenticated user
  typed.post(
    "/me/tickets",
    {
      schema: {
        tags: ["me"],
        summary: "Save a checked lottery ticket to Postgres",
        body: SavedTicketPayloadSchema,
        response: {
          200: z.object({ saved: z.boolean() }),
          401: z.object({
            statusCode: z.number(),
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = requireClerkUserId(request, reply);
      if (!userId) return;

      const t = request.body;
      await ensureUserRecord(userId);
      const db = getDb();
      const normalized = t.ticketString.replace(/\s+/g, "").toUpperCase();

      const inserted = await db
        .insert(userTickets)
        .values({
          id: t.id,
          userId,
          ticketString: t.ticketString,
          normalizedTicket: normalized,
          schemeCode: t.schemeCode,
          series: t.series,
          digits: t.digits,
          drawCode: t.drawId,
          drawDate: t.drawDate,
          checkedAt: new Date(t.checkedAt),
          cost: t.cost,
          wonAmount: t.wonAmount,
          result: t.result,
        })
        .onConflictDoNothing({
          target: [
            userTickets.userId,
            userTickets.normalizedTicket,
            userTickets.drawCode,
          ],
        })
        .returning({ id: userTickets.id });

      return reply.send({ saved: inserted.length > 0 });
    }
  );

  // 5. POST /me/tickets/sync — batch migrate guest localStorage tickets after Google sign-in
  typed.post(
    "/me/tickets/sync",
    {
      schema: {
        tags: ["me"],
        summary: "Batch sync locally checked tickets into Postgres upon sign-in",
        body: z.object({
          tickets: z.array(SavedTicketPayloadSchema).max(250),
        }),
        response: {
          200: z.object({ syncedCount: z.number() }),
          401: z.object({
            statusCode: z.number(),
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = requireClerkUserId(request, reply);
      if (!userId) return;

      const { tickets } = request.body;
      if (tickets.length === 0) {
        return reply.send({ syncedCount: 0 });
      }

      await ensureUserRecord(userId);
      const db = getDb();

      const values = tickets.map((t) => ({
        id: t.id,
        userId,
        ticketString: t.ticketString,
        normalizedTicket: t.ticketString.replace(/\s+/g, "").toUpperCase(),
        schemeCode: t.schemeCode,
        series: t.series,
        digits: t.digits,
        drawCode: t.drawId,
        drawDate: t.drawDate,
        checkedAt: new Date(t.checkedAt),
        cost: t.cost,
        wonAmount: t.wonAmount,
        result: t.result,
      }));

      const inserted = await db
        .insert(userTickets)
        .values(values)
        .onConflictDoNothing({
          target: [
            userTickets.userId,
            userTickets.normalizedTicket,
            userTickets.drawCode,
          ],
        })
        .returning({ id: userTickets.id });

      return reply.send({ syncedCount: inserted.length });
    }
  );

  // 6. DELETE /me/tickets — clear authenticated user's saved ticket history
  typed.delete(
    "/me/tickets",
    {
      schema: {
        tags: ["me"],
        summary: "Clear all saved lottery tickets for the authenticated user",
        response: {
          200: z.object({ deleted: z.boolean() }),
          401: z.object({
            statusCode: z.number(),
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = requireClerkUserId(request, reply);
      if (!userId) return;

      const db = getDb();
      await db.delete(userTickets).where(eq(userTickets.userId, userId));

      return reply.send({ deleted: true });
    }
  );

  // 7. GET /me/stats — compute user analytics directly from Postgres rows
  typed.get(
    "/me/stats",
    {
      schema: {
        tags: ["me"],
        summary: "Compute lifetime dashboard statistics from Postgres for the authenticated user",
        response: {
          200: UserStatsResponseSchema,
          401: z.object({
            statusCode: z.number(),
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = requireClerkUserId(request, reply);
      if (!userId) return;

      const db = getDb();
      const chronoTickets = await db
        .select()
        .from(userTickets)
        .where(eq(userTickets.userId, userId))
        .orderBy(asc(userTickets.checkedAt));

      const totalTickets = chronoTickets.length;
      let totalSpent = 0;
      let totalWon = 0;
      let bestWin = 0;
      let winCount = 0;
      let runningNet = 0;
      let longestDrySpell = 0;
      let currentDrySpell = 0;

      const schemeBreakdown: Record<
        string,
        { count: number; spent: number; won: number; wins: number }
      > = {};
      const monthlyMap: Record<
        string,
        { spent: number; won: number; sortKey: string }
      > = {};
      const historyTimeline: Array<{
        date: string;
        cumulativeNet: number;
        cost: number;
        prize: number;
        ticket: string;
      }> = [];

      for (const t of chronoTickets) {
        const cost = t.cost || 40;
        const prize = t.wonAmount || 0;
        totalSpent += cost;
        totalWon += prize;

        if (prize > bestWin) bestWin = prize;
        if (prize > 0) {
          winCount++;
          currentDrySpell = 0;
        } else {
          currentDrySpell++;
          if (currentDrySpell > longestDrySpell) {
            longestDrySpell = currentDrySpell;
          }
        }

        runningNet += prize - cost;
        const iso = t.checkedAt.toISOString();
        historyTimeline.push({
          date: iso.split("T")[0],
          cumulativeNet: runningNet,
          cost,
          prize,
          ticket: t.ticketString,
        });

        const sCode = t.schemeCode || "W";
        if (!schemeBreakdown[sCode]) {
          schemeBreakdown[sCode] = { count: 0, spent: 0, won: 0, wins: 0 };
        }
        schemeBreakdown[sCode].count++;
        schemeBreakdown[sCode].spent += cost;
        schemeBreakdown[sCode].won += prize;
        if (prize > 0) schemeBreakdown[sCode].wins++;

        const d = t.checkedAt;
        const monthKey = d.toLocaleString("en-US", {
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        });
        const sortKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = { spent: 0, won: 0, sortKey };
        }
        monthlyMap[monthKey].spent += cost;
        monthlyMap[monthKey].won += prize;
      }

      const monthlyBreakdown = Object.entries(monthlyMap)
        .map(([month, data]) => ({
          month,
          spent: data.spent,
          won: data.won,
          net: data.won - data.spent,
          sortKey: data.sortKey,
        }))
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

      let mostCheckedScheme = totalTickets === 0 ? "None" : "Win-Win";
      let maxCount = 0;
      for (const [code, item] of Object.entries(schemeBreakdown)) {
        if (item.count > maxCount) {
          maxCount = item.count;
          mostCheckedScheme = SCHEME_NAMES[code] || code;
        }
      }

      const netProfitLoss = totalWon - totalSpent;
      const winRate =
        totalTickets > 0
          ? Number(((winCount / totalTickets) * 100).toFixed(1))
          : 0;

      reply.header("Cache-Control", "no-store");
      return reply.send({
        totalTickets,
        totalSpent,
        totalWon,
        netProfitLoss,
        winRate,
        bestWin,
        longestDrySpell,
        mostCheckedScheme,
        schemeBreakdown,
        monthlyBreakdown,
        historyTimeline,
      });
    }
  );
};
