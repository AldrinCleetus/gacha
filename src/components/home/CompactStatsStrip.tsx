"use client";

import React from "react";
import { UserStats } from "@/types/lottery";
import { formatINR } from "@/lib/checkTicket";
import { TrendingUp, TrendingDown, IndianRupee, Percent, Sparkles } from "lucide-react";

interface CompactStatsStripProps {
  stats: UserStats | null;
}

export function CompactStatsStrip({ stats }: CompactStatsStripProps) {
  if (!stats || stats.totalTickets === 0) {
    return (
      <div className="w-full max-w-xl mx-auto p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 text-center">
        <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          Welcome! Enter your 8-character Kerala ticket number above to test your luck.
        </p>
      </div>
    );
  }

  const isNetPositive = stats.netProfitLoss >= 0;

  return (
    <div className="w-full max-w-xl mx-auto select-none">
      <div className="grid grid-cols-4 gap-2 sm:gap-3 p-3 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 shadow-sm backdrop-blur-sm">
        {/* Spent */}
        <div className="text-center px-1">
          <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
            Spent
          </span>
          <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums">
            {formatINR(stats.totalSpent)}
          </span>
        </div>

        {/* Won */}
        <div className="text-center px-1 border-l border-slate-200/60 dark:border-slate-800">
          <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
            Won
          </span>
          <span className="text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums">
            {formatINR(stats.totalWon)}
          </span>
        </div>

        {/* Net P/L */}
        <div className="text-center px-1 border-l border-slate-200/60 dark:border-slate-800">
          <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
            Net P/L
          </span>
          <span
            className={`text-xs sm:text-sm font-bold tabular-nums flex items-center justify-center gap-0.5 ${
              isNetPositive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-slate-700 dark:text-slate-300"
            }`}
          >
            {isNetPositive ? "+" : ""}
            {formatINR(stats.netProfitLoss)}
          </span>
        </div>

        {/* Win Rate */}
        <div className="text-center px-1 border-l border-slate-200/60 dark:border-slate-800">
          <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
            Win Rate
          </span>
          <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 tabular-nums">
            {stats.winRate}%
          </span>
        </div>
      </div>
    </div>
  );
}
