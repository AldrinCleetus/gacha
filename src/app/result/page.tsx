"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActiveCheckStore } from "@/store/useAppStore";
import { mockLotteryApi } from "@/lib/mockApi";
import { checkTicket, formatINR } from "@/lib/checkTicket";
import { TicketVisual } from "@/components/ticket/TicketVisual";
import { Draw, MatchResult } from "@/types/lottery";
import {
  Trophy,
  Award,
  Sparkles,
  RotateCcw,
  History,
  CheckCircle2,
  Calendar,
  Layers,
  Info,
  ArrowRight,
} from "lucide-react";
import { motion } from "framer-motion";

export default function ResultPage() {
  const router = useRouter();
  const { ticketInput, selectedDrawId, lastCheckedResult, setTicketInput, setLastCheckedResult } =
    useActiveCheckStore();

  const [draw, setDraw] = useState<Draw | null>(null);
  const [result, setResult] = useState<MatchResult | null>(lastCheckedResult);

  const effectiveTicket = ticketInput || "WA 584920";

  useEffect(() => {
    mockLotteryApi.getDraws().then((drawList) => {
      const active =
        drawList.find((d) => d.id === selectedDrawId) ||
        drawList.find((d) => d.schemeCode === effectiveTicket.charAt(0)) ||
        drawList[0];
      setDraw(active);

      if (!result) {
        const calculated = checkTicket(effectiveTicket, active);
        setResult(calculated);
        setLastCheckedResult(calculated);
      }
    });
  }, [effectiveTicket, selectedDrawId, result, setLastCheckedResult]);

  const handleReplay = () => {
    router.push("/reveal");
  };

  const isWin = (result?.amount || 0) > 0;

  return (
    <div className="flex-1 flex flex-col items-center max-w-3xl mx-auto w-full py-4 sm:py-8 space-y-6">
      {/* Top Title & Header */}
      <div className="text-center space-y-1">
        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          Verification Summary
        </span>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          Ticket <span className="text-emerald-600 dark:text-emerald-400">Result</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Official evaluation for Draw {draw?.id} held on {draw?.drawDate}
        </p>
      </div>

      {/* Ticket Visual */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full flex justify-center"
      >
        <TicketVisual
          ticketString={effectiveTicket}
          schemeCode={effectiveTicket.charAt(0)}
          drawNumber={draw?.id || "W-790"}
          drawDate={draw?.drawDate || "23 NOV 2026"}
          state={isWin ? "won" : "lost"}
          matchedIndices={result?.matchedIndices || []}
          size="responsive"
        />
      </motion.div>

      {/* Outcome Verdict Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`w-full rounded-3xl p-6 border shadow-lg ${
          result?.kind === "jackpot"
            ? "bg-amber-500/10 border-amber-500/40 text-slate-900 dark:text-white"
            : result?.kind === "mid"
            ? "bg-purple-500/10 border-purple-500/40 text-slate-900 dark:text-white"
            : result?.kind === "small"
            ? "bg-emerald-500/10 border-emerald-500/40 text-slate-900 dark:text-white"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/60 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-2xl ${
                result?.kind === "jackpot"
                  ? "bg-amber-500 text-white"
                  : result?.kind === "mid"
                  ? "bg-purple-600 text-white"
                  : result?.kind === "small"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}
            >
              {result?.kind === "jackpot" && <Trophy className="w-6 h-6" />}
              {result?.kind === "mid" && <Award className="w-6 h-6" />}
              {result?.kind === "small" && <Sparkles className="w-6 h-6" />}
              {result?.kind === "none" && <Info className="w-6 h-6" />}
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Prize Category
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {result?.tierName || "No Prize"}
              </h2>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Prize Amount
            </span>
            <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {result?.formattedAmount || "₹0"}
            </div>
          </div>
        </div>

        {/* Rule hit explanation */}
        <div className="pt-4 space-y-2 text-xs sm:text-sm">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                Rule Evaluation:{" "}
              </span>
              <span className="text-slate-600 dark:text-slate-400">
                {result?.detailedExplanation}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 pt-1">
            <Layers className="w-4 h-4 shrink-0" />
            <span>
              Matched Character Indices:{" "}
              <code className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {result?.matchedIndices.length
                  ? `[${result.matchedIndices.join(", ")}]`
                  : "None"}
              </code>
            </span>
          </div>
        </div>
      </motion.div>

      {/* Official Draw Winning Numbers Reference Table */}
      {draw && (
        <div className="w-full rounded-3xl p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              Draw {draw.id} Winning Numbers Sheet
            </h3>
            <span className="text-xs text-slate-400">Official Government Gazette</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <span className="text-slate-400 font-semibold uppercase tracking-wider block">
                1st Prize (₹{draw.prizes.firstPrize.amount / 100000} Lakhs)
              </span>
              <div className="font-mono text-base font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {draw.prizes.firstPrize.series} {draw.prizes.firstPrize.number}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <span className="text-slate-400 font-semibold uppercase tracking-wider block">
                Consolation Prize (₹{draw.prizes.consolationPrize.amount})
              </span>
              <div className="font-mono text-sm font-bold text-purple-600 dark:text-purple-400 mt-1">
                Remaining series matching {draw.prizes.firstPrize.number}
              </div>
            </div>

            {draw.prizes.last4Prizes.map((p, idx) => (
              <div
                key={idx}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 sm:col-span-2"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider">
                    {p.tier} ({formatINR(p.amount)}) - Last 4 Digits
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.numbers.map((num) => (
                    <span
                      key={num}
                      className={`font-mono text-xs font-bold px-2 py-0.5 rounded-lg border ${
                        effectiveTicket.endsWith(num)
                          ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-400"
                          : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      {num} {effectiveTicket.endsWith(num) ? "✓ Your Match" : ""}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Action Bar */}
      <div className="flex flex-wrap items-center justify-center gap-3 w-full pt-2">
        <button
          onClick={handleReplay}
          className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Replay Reveal Animation</span>
        </button>

        <Link
          href="/history"
          className="px-5 py-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-100 font-bold text-xs sm:text-sm shadow-sm flex items-center gap-2 transition-all"
        >
          <History className="w-4 h-4 text-slate-500" />
          <span>View Ticket History</span>
        </Link>

        <Link
          href="/"
          className="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-bold text-xs sm:text-sm shadow-sm flex items-center gap-2 transition-all"
        >
          <span>Check Another Ticket</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
