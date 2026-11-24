import { PgBoss } from "pg-boss";
import { DbClient, getDb } from "@gacha/db";
import { Clock, SystemClock } from "@gacha/shared";
import { ensureExpectedDraw, EnsureExpectedDrawResult } from "./expectedDraw.js";
import { pollSourceForDraw, PollDrawOptions, PollDrawResult } from "./poller.js";
import { runNightlyReconcile } from "./reconcile.js";
import { getPollingWindowInfo, PollingWindowInfo } from "./pollingWindow.js";
import { logger } from "./index.js";

export const QUEUES = {
  DAILY_EXPECTED_DRAW: "daily-expected-draw",
  POLL_CYCLE: "poll-cycle",
  POLL_SOURCE_DRAW: "poll-source-draw",
  NUDGE_POLL: "nudge-poll",
  NIGHTLY_RECONCILE: "nightly-reconcile",
} as const;

export interface SchedulerOptions {
  connectionString?: string;
  db?: DbClient;
  boss?: PgBoss;
  clock?: Clock;
}

export class Scheduler {
  private boss: PgBoss;
  private db: DbClient;
  private clock: Clock;
  private started = false;

  constructor(options: SchedulerOptions = {}) {
    this.db = options.db || getDb();
    this.clock = options.clock || new SystemClock();

    if (options.boss) {
      this.boss = options.boss;
    } else {
      const conn =
        options.connectionString ||
        process.env.DATABASE_URL ||
        "postgresql://postgres:postgres@localhost:5433/gacha";
      this.boss = new PgBoss(conn);
    }
  }

  getClock(): Clock {
    return this.clock;
  }

  setClock(clock: Clock): void {
    this.clock = clock;
  }

  getBoss(): PgBoss {
    return this.boss;
  }

  async start(): Promise<void> {
    if (this.started) return;

    logger.info("Starting pg-boss scheduler...");
    await this.boss.start();
    this.started = true;

    // Create all queues if not existing
    for (const queue of Object.values(QUEUES)) {
      await this.boss.createQueue(queue);
    }

    // Register workers for all queues
    await this.registerWorkers();

    // Register cron schedules in IST (Asia/Kolkata)
    await this.registerSchedules();

    logger.info("Scheduler started successfully with IST schedules registered.");
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    logger.info("Stopping pg-boss scheduler...");
    await this.boss.stop({ graceful: true, timeout: 5000 });
    this.started = false;
    logger.info("Scheduler stopped cleanly.");
  }

  private async registerWorkers(): Promise<void> {
    // 1. Daily expected draw worker
    await this.boss.work(QUEUES.DAILY_EXPECTED_DRAW, async () => {
      logger.info("Running daily expected draw job...");
      const result = await ensureExpectedDraw(this.db, undefined, this.clock);
      logger.info({ result }, "Expected draw creation check completed.");
      return result;
    });

    // 2. Main polling cycle worker
    await this.boss.work(QUEUES.POLL_CYCLE, async () => {
      return await this.runPollCycleOnce();
    });

    // 3. Single-flight per (source, draw) worker
    await this.boss.work<PollDrawOptions>(
      QUEUES.POLL_SOURCE_DRAW,
      async (jobs) => {
        for (const job of jobs) {
          logger.info({ data: job.data }, "Processing single-flight poll job...");
          await pollSourceForDraw(job.data, this.db);
        }
      }
    );

    // 4. Nudge poll worker (results not out yet trigger from API)
    await this.boss.work<{ drawCode: string; source?: string }>(
      QUEUES.NUDGE_POLL,
      async (jobs) => {
        for (const job of jobs) {
          logger.info({ drawCode: job.data.drawCode }, "Processing nudge poll request...");
          await this.triggerPoll({
            drawCode: job.data.drawCode,
            source:
              (job.data.source as "onmanorama" | "keralalotteries_net" | "official") ||
              "onmanorama",
          });
        }
      }
    );

    // 5. Nightly reconcile worker
    await this.boss.work(QUEUES.NIGHTLY_RECONCILE, async () => {
      logger.info("Processing nightly reconcile job...");
      return await runNightlyReconcile(this.db, this.clock);
    });
  }

  private async registerSchedules(): Promise<void> {
    // Schedule 1: Ensure today's expected draw exists at 08:00 IST every day
    await this.boss.schedule(QUEUES.DAILY_EXPECTED_DRAW, "0 8 * * *", {}, {
      tz: "Asia/Kolkata",
    });

    // Schedule 2: Active peak polling window: 15:00 - 17:30 IST (every 2 minutes)
    await this.boss.schedule(QUEUES.POLL_CYCLE, "*/2 15-17 * * *", {}, {
      tz: "Asia/Kolkata",
    });

    // Schedule 3: Active evening polling window: 17:30 - 21:00 IST (every 10 minutes)
    await this.boss.schedule(QUEUES.POLL_CYCLE, "*/10 18-20 * * *", {}, {
      tz: "Asia/Kolkata",
    });

    // Schedule 4: Nightly reconciliation at 02:00 IST every night
    await this.boss.schedule(QUEUES.NIGHTLY_RECONCILE, "0 2 * * *", {}, {
      tz: "Asia/Kolkata",
    });
  }

  /**
   * Evaluates the current IST polling window and triggers single-flight poll jobs
   * for active sources and today's expected draw.
   */
  async runPollCycleOnce(): Promise<{
    window: PollingWindowInfo;
    expectedDraw: EnsureExpectedDrawResult | null;
    dispatched: boolean;
    jobId?: string | null;
  }> {
    const now = this.clock.now();
    const window = getPollingWindowInfo(now);

    logger.info(
      {
        phase: window.phase,
        timeIST: window.istTimeStr,
        interval: window.intervalMinutes,
      },
      "Evaluating polling cycle..."
    );

    // Ensure expected draw exists for today
    const expected = await ensureExpectedDraw(this.db, window.istDateStr, this.clock);

    // If outside polling window and not in active phase, skip dispatch
    if (window.phase === "before_window") {
      logger.info("Current time is before 15:00 IST. Polling cycle is idle.");
      return { window, expectedDraw: expected, dispatched: false };
    }

    if (window.shouldAlert && expected && expected.status === "expected") {
      logger.warn(
        { drawCode: expected.drawCode, timeIST: window.istTimeStr },
        "ALERT: Draw results not published past 6:30 PM IST threshold!"
      );
    }

    // Single-flight dispatch per (source, drawCode) for active sources
    const activeSources: Array<"onmanorama" | "keralalotteries_net"> = [
      "onmanorama",
      "keralalotteries_net",
    ];
    const drawCode = expected?.drawCode || "TODAY";
    let lastJobId: string | null = null;

    for (const source of activeSources) {
      const singletonKey = `${source}:${drawCode}`;
      const jobId = await this.boss.send(
        QUEUES.POLL_SOURCE_DRAW,
        {
          source,
          drawCode: expected?.drawCode,
          drawId: expected?.drawId,
        },
        {
          singletonKey,
        }
      );
      if (jobId) lastJobId = jobId;
      logger.info({ source, singletonKey, jobId }, "Dispatched single-flight poll job.");
    }

    return {
      window,
      expectedDraw: expected,
      dispatched: true,
      jobId: lastJobId,
    };
  }

  /**
   * Manually triggers a poll or schedules a single-flight job.
   */
  async triggerPoll(options: PollDrawOptions = {}): Promise<PollDrawResult> {
    logger.info({ options }, "Manually triggering poll execution...");
    return await pollSourceForDraw(options, this.db);
  }

  /**
   * Nudges the worker to poll for an unpublished draw (results not out yet).
   * Debounced via singletonKey so multiple rapid user checks generate at most one job.
   */
  async nudge(drawCode: string): Promise<string | null> {
    const singletonKey = `nudge:${drawCode}`;
    return await this.boss.send(
      QUEUES.NUDGE_POLL,
      { drawCode },
      {
        singletonKey,
      }
    );
  }
}
