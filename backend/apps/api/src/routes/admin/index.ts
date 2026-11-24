import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { getDb, draws, sourceObservations, eq, inArray } from "@gacha/db";
import { ParsedDraw } from "@gacha/shared";
import { ingestObservation, forcePublishDraw, compareDraws, renderDiffText, checkSystemAlerts } from "@gacha/sources";

export const adminRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const server = app.withTypeProvider<ZodTypeProvider>();

  // Token-based authentication hook for all /admin routes
  server.addHook("onRequest", async (req, reply) => {
    const adminKey =
      (req.headers["x-admin-key"] as string | undefined) ||
      (typeof req.headers.authorization === "string" && req.headers.authorization.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : undefined);

    const expectedKey = process.env.ADMIN_API_KEY || "gacha-admin-secret-key";
    if (!adminKey || adminKey !== expectedKey) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Invalid or missing admin API key. Provide via 'X-Admin-Key' header or 'Authorization: Bearer <key>'.",
      });
    }
  });

  /**
   * POST /admin/ingest/pdf
   * Accepts official Kerala lottery result PDF via multipart/form-data or binary stream.
   */
  server.post(
    "/ingest/pdf",
    {
      schema: {
        description: "Upload and ingest official Kerala State Lottery PDF results (admin only)",
        tags: ["admin"],
      },
    },
    async (req, reply) => {
      let pdfBuffer: Buffer | null = null;
      let filename = "official-upload.pdf";

      const contentType = req.headers["content-type"] || "";

      if (contentType.includes("multipart/form-data")) {
        const fileData = await req.file();
        if (!fileData) {
          return reply.status(400).send({
            ok: false,
            error: "No file uploaded in multipart/form-data request. Provide file in 'file' or 'pdf' field.",
          });
        }
        filename = fileData.filename;
        pdfBuffer = await fileData.toBuffer();
      } else if (contentType.includes("application/pdf") || contentType.includes("application/octet-stream")) {
        // Raw binary stream upload
        pdfBuffer = await req.body as Buffer;
      } else {
        return reply.status(400).send({
          ok: false,
          error: "Unsupported Content-Type. Please use multipart/form-data or application/pdf.",
        });
      }

      if (!pdfBuffer || pdfBuffer.length === 0) {
        return reply.status(400).send({
          ok: false,
          error: "Empty PDF payload received.",
        });
      }

      try {
        const result = await ingestObservation({
          source: "official",
          pdfBuffer,
          autoPublish: true,
        });

        return reply.status(200).send({
          ok: true,
          message: "Official PDF ingested successfully",
          observationId: result.observationId,
          drawId: result.drawId,
          drawCode: result.parsed?.drawCode,
          drawStatus: result.drawStatus,
          published: result.published,
          fingerprint: result.fingerprint,
          validation: result.validation,
          tierCount: result.tierCount,
          entryCount: result.entryCount,
          parsed: result.parsed
            ? {
                schemeName: result.parsed.schemeName,
                schemeCode: result.parsed.schemeCode,
                drawCode: result.parsed.drawCode,
                drawDate: result.parsed.drawDate,
                tierCount: result.parsed.tiers.length,
                agentCount: result.parsed.agents?.length || 0,
              }
            : undefined,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        req.log.error({ error: msg, filename }, "Official PDF ingest failed");
        return reply.status(400).send({
          ok: false,
          error: `PDF parse/ingestion failed: ${msg}`,
        });
      }
    }
  );

  /**
   * GET /admin/review
   * Returns draws requiring review or awaiting consensus.
   */
  server.get(
    "/review",
    {
      schema: {
        description: "List draws requiring admin review or awaiting consensus (admin only)",
        tags: ["admin"],
      },
    },
    async (req, reply) => {
      const db = getDb();
      const pendingDraws = await db
        .select()
        .from(draws)
        .where(inArray(draws.status, ["needs_review", "observed"]))
        .orderBy(draws.drawDate);

      const reviewItems = [];

      for (const d of pendingDraws) {
        const obs = await db
          .select()
          .from(sourceObservations)
          .where(eq(sourceObservations.drawId, d.id));

        let diffSummary: string | undefined;
        const validObs = obs.filter((o) => o.parsed && (o.validation as { ok: boolean })?.ok);
        if (validObs.length >= 2) {
          const diff = compareDraws(validObs[0].parsed as ParsedDraw, validObs[1].parsed as ParsedDraw);
          diffSummary = renderDiffText(diff);
        }

        reviewItems.push({
          drawId: d.id,
          schemeCode: d.schemeCode,
          drawCode: d.drawCode,
          drawDate: d.drawDate,
          status: d.status,
          observationsCount: obs.length,
          observations: obs.map((o) => ({
            source: o.source,
            fingerprint: o.fingerprint,
            isValid: (o.validation as { ok: boolean })?.ok ?? false,
          })),
          diffSummary,
        });
      }

      return reply.send({
        count: reviewItems.length,
        draws: reviewItems,
      });
    }
  );

  /**
   * POST /admin/draws/:id/publish
   * Force publishes a draw using a specified source's observation.
   */
  server.post(
    "/draws/:id/publish",
    {
      schema: {
        description: "Force-publish a draw from a specific source with admin override logging",
        tags: ["admin"],
        params: z.object({
          id: z.string().describe("Draw UUID or draw code (e.g. SM-82)"),
        }),
        body: z.object({
          source: z.string().describe("Source name to publish from (e.g. official, keralalotteries_net)"),
          reason: z.string().optional().describe("Admin rationale for force-publishing"),
        }),
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const { source, reason } = req.body;
      const db = getDb();

      try {
        const result = await forcePublishDraw(db, id, source, reason);
        return reply.send({
          ok: true,
          message: `Successfully force-published draw ${id} using source ${source}`,
          ...result,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return reply.status(400).send({
          ok: false,
          error: msg,
        });
      }
    }
  );

  /**
   * GET /admin/alerts
   * Inspect active system alerts (unpublished past 6:30 PM, draws needing review, degraded sources)
   */
  server.get(
    "/alerts",
    {
      schema: {
        description: "Get active system alerts (admin only)",
        tags: ["admin"],
      },
    },
    async (_req, reply) => {
      const db = getDb();
      const result = await checkSystemAlerts({ db, recordEvents: true });
      return reply.send(result);
    }
  );
};
