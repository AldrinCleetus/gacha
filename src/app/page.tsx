"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SegmentedInput } from "@/components/home/SegmentedInput";
import { SchemeChip } from "@/components/home/SchemeChip";
import { DrawSelector } from "@/components/home/DrawSelector";
import { CompactStatsStrip } from "@/components/home/CompactStatsStrip";
import { parseTicket } from "@/lib/parser";
import { getScheme, getSchemeThemeStyle } from "@/lib/schemes";
import { mockLotteryApi } from "@/lib/mockApi";
import { checkTicket } from "@/lib/checkTicket";
import { Draw, UserStats } from "@/types/lottery";
import { useActiveCheckStore, useDemoStore } from "@/store/useAppStore";
import { Sparkles, ArrowRight, ShieldCheck, HelpCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function HomePage() {
  const router = useRouter();
  const { setTicketInput, setSelectedDrawId, setLastCheckedResult } = useActiveCheckStore();
  const { forcedOutcome } = useDemoStore();

  const [inputChars, setInputChars] = useState<string[]>(["", "", "", "", "", "", "", ""]);
  const [draws, setDraws] = useState<Draw[]>([]);
  const [selectedDraw, setSelectedDraw] = useState<string>("");
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    mockLotteryApi.getDraws().then((d) => {
      setDraws(d);
      if (d.length > 0) setSelectedDraw(d[0].id);
    });
    mockLotteryApi.getStats().then(setStats);
  }, []);

  const firstLetter = inputChars[0] || "";
  const scheme = getScheme(firstLetter);
  const fullRaw = inputChars.join("");
  const parsed = parseTicket(fullRaw);
  const isComplete = parsed.isValid;

  // Auto-switch draw scheme when first letter changes if matching draw exists
  useEffect(() => {
    if (firstLetter && draws.length > 0) {
      const matchingDraw = draws.find(
        (d) => d.schemeCode.toUpperCase() === firstLetter.toUpperCase()
      );
      if (matchingDraw) {
        setSelectedDraw(matchingDraw.id);
      }
    }
  }, [firstLetter, draws]);

  const handleFillSample = (sample: string) => {
    const p = parseTicket(sample);
    setInputChars([...p.characters]);
  };

  const handleCheckTicket = async () => {
    if (!isComplete) return;

    setIsLoading(true);
    const activeDraw = draws.find((d) => d.id === selectedDraw) || draws[0];
    const result = checkTicket(parsed, activeDraw, forcedOutcome);

    setTicketInput(parsed.fullTicketString, parsed);
    setSelectedDrawId(activeDraw.id);
    setLastCheckedResult(result);

    // Announce to screen reader
    const liveRegion = document.getElementById("a11y-live-region");
    if (liveRegion) {
      liveRegion.textContent = `Checking ticket ${parsed.fullTicketString} for draw ${activeDraw.id}`;
    }

    // Navigate to signature Reveal screen
    router.push("/reveal");
  };

  return (
    <div
      className="flex-1 flex flex-col items-center justify-between py-2 sm:py-6 max-w-3xl mx-auto w-full transition-all"
      style={getSchemeThemeStyle(firstLetter)}
    >
      {/* Top Banner / Heading */}
      <div className="w-full text-center space-y-2 mb-4 sm:mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-300/40">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Official Kerala State Lottery Formats</span>
        </div>

        <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Enter Your <span style={{ color: scheme.theme.primary }}>Lottery Ticket</span>
        </h1>

        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Fast, private Kerala ticket validation with celebratory real-time reveal.
        </p>

        {/* Dynamic Scheme Chip */}
        <div className="h-9 flex items-center justify-center mt-2">
          {firstLetter ? (
            <SchemeChip firstChar={firstLetter} />
          ) : (
            <div className="text-xs text-slate-400 dark:text-slate-500 italic">
              Type the first letter of your ticket (e.g. &apos;W&apos; for Win-Win)
            </div>
          )}
        </div>
      </div>

      {/* Main Card with Segmented Input */}
      <div className="w-full glass-panel rounded-3xl sm:rounded-4xl p-5 sm:p-8 shadow-xl border border-slate-200/90 dark:border-slate-800/90 flex flex-col items-center space-y-6">
        {/* Draw Selector */}
        {draws.length > 0 && (
          <DrawSelector
            draws={draws}
            selectedDrawId={selectedDraw}
            onSelectDraw={setSelectedDraw}
          />
        )}

        {/* Segmented 8-char OTP-style Input */}
        <div className="w-full my-2">
          <SegmentedInput
            value={inputChars}
            onChange={setInputChars}
            onComplete={() => {}}
            schemeColor={firstLetter ? scheme.theme.primary : undefined}
          />
        </div>

        {/* Action Button */}
        <div className="w-full max-w-md">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleCheckTicket}
            disabled={!isComplete || isLoading}
            className={`w-full py-4 px-6 rounded-2xl font-bold text-base sm:text-lg flex items-center justify-center gap-2.5 shadow-lg transition-all ${
              isComplete && !isLoading
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/25 cursor-pointer"
                : "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none"
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span>{isLoading ? "Preparing Reveal..." : "Check Ticket Result"}</span>
            <ArrowRight className="w-5 h-5 ml-1" />
          </motion.button>
        </div>

        {/* Quick Testing Samples Pill Bar */}
        <div className="w-full pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-col items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Quick Fill Demo Samples:
          </span>
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => handleFillSample("WA584920")}
              className="text-xs px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300/40 hover:bg-amber-100 font-mono font-medium transition-colors"
            >
              WA 584920 (Jackpot)
            </button>
            <button
              type="button"
              onClick={() => handleFillSample("WB584920")}
              className="text-xs px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-300/40 hover:bg-purple-100 font-mono font-medium transition-colors"
            >
              WB 584920 (Consolation)
            </button>
            <button
              type="button"
              onClick={() => handleFillSample("WA114920")}
              className="text-xs px-2.5 py-1 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-300/40 hover:bg-cyan-100 font-mono font-medium transition-colors"
            >
              WA 114920 (Last 4)
            </button>
            <button
              type="button"
              onClick={() => handleFillSample("WA839102")}
              className="text-xs px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 font-mono font-medium transition-colors"
            >
              WA 839102 (No Win)
            </button>
          </div>
        </div>
      </div>

      {/* Returning Users Compact Stats Strip */}
      <div className="w-full mt-6">
        <CompactStatsStrip stats={stats} />
      </div>
    </div>
  );
}
