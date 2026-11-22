"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { TicketVisual } from "@/components/ticket/TicketVisual";
import { CountUp } from "@/components/reveal/CountUp";
import { useActiveCheckStore, useAppSettingsStore, useDemoStore } from "@/store/useAppStore";
import { mockLotteryApi } from "@/lib/mockApi";
import { checkTicket, formatINR } from "@/lib/checkTicket";
import { soundFx } from "@/lib/sound";
import { Draw, MatchResult } from "@/types/lottery";
import { FastForward, ArrowRight, RotateCcw, Trophy, Sparkles, Award, CheckCircle2, ShieldCheck } from "lucide-react";

type RevealPhase = "SLIDE_IN" | "SWEEP_SCAN" | "JUDGING" | "VERDICT";

export default function RevealPage() {
  const router = useRouter();
  const { ticketInput, parsedTicket, selectedDrawId, lastCheckedResult, setLastCheckedResult } =
    useActiveCheckStore();
  const { soundEnabled, hapticsEnabled, reducedMotion } = useAppSettingsStore();
  const { forcedOutcome } = useDemoStore();

  const [phase, setPhase] = useState<RevealPhase>("SLIDE_IN");
  const [activeJudgeIndex, setActiveJudgeIndex] = useState<number>(-1);
  const [lockedIndices, setLockedIndices] = useState<number[]>([]);
  const [activeDraw, setActiveDraw] = useState<Draw | null>(null);
  const [effectiveResult, setEffectiveResult] = useState<MatchResult | null>(lastCheckedResult);
  const [hasSaved, setHasSaved] = useState(false);
  const [isJackpotDimmed, setIsJackpotDimmed] = useState(false);

  // Fallback default sample ticket if user directly browsed to /reveal
  const effectiveTicketString = ticketInput || "WA 584920";

  // Check if system prefers reduced motion
  const prefersReduced =
    reducedMotion ||
    (typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  // Trigger haptics safely
  const triggerHaptic = useCallback((pattern: number | number[]) => {
    if (hapticsEnabled && typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // ignore
      }
    }
  }, [hapticsEnabled]);

  // Load Draw and evaluate result
  useEffect(() => {
    mockLotteryApi.getDraws().then((drawList) => {
      const draw =
        drawList.find((d) => d.id === selectedDrawId) ||
        drawList.find((d) => d.schemeCode === effectiveTicketString.charAt(0)) ||
        drawList[0];
      setActiveDraw(draw);

      const res = checkTicket(effectiveTicketString, draw, forcedOutcome);
      setEffectiveResult(res);
      setLastCheckedResult(res);
    });
  }, [effectiveTicketString, selectedDrawId, forcedOutcome, setLastCheckedResult]);

  // Save ticket to history once result is ready
  useEffect(() => {
    if (effectiveResult && activeDraw && !hasSaved) {
      setHasSaved(true);
      mockLotteryApi.saveTicket({
        id: `tkt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ticketString: effectiveTicketString,
        schemeCode: effectiveTicketString.charAt(0).toUpperCase(),
        series: effectiveTicketString.slice(0, 2).toUpperCase(),
        digits: effectiveTicketString.replace(/[^0-9]/g, "").slice(0, 6),
        drawId: activeDraw.id,
        drawDate: activeDraw.drawDate,
        checkedAt: new Date().toISOString(),
        cost: 40,
        wonAmount: effectiveResult.amount,
        result: effectiveResult,
      });
    }
  }, [effectiveResult, activeDraw, hasSaved, effectiveTicketString]);

  // Execute Verdict Visuals (Confetti, Haptics, Audio)
  const triggerVerdictCelebration = useCallback((result: MatchResult) => {
    if (soundEnabled) {
      if (result.kind === "jackpot") soundFx.playWinChime("jackpot");
      else if (result.kind === "mid") soundFx.playWinChime("mid");
      else if (result.kind === "small") soundFx.playWinChime("small");
    }

    if (result.kind === "small") {
      triggerHaptic([60, 40, 80]);
      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.65 },
        colors: ["#10b981", "#34d399", "#f59e0b"],
      });
    } else if (result.kind === "mid") {
      triggerHaptic([100, 50, 100, 50, 150]);
      confetti({
        particleCount: 90,
        spread: 90,
        origin: { x: 0.2, y: 0.6 },
        colors: ["#8b5cf6", "#a78bfa", "#f59e0b", "#10b981"],
      });
      setTimeout(() => {
        confetti({
          particleCount: 90,
          spread: 90,
          origin: { x: 0.8, y: 0.6 },
          colors: ["#8b5cf6", "#a78bfa", "#f59e0b", "#10b981"],
        });
      }, 250);
    } else if (result.kind === "jackpot") {
      // 1) Dim screen & silence
      setIsJackpotDimmed(true);
      triggerHaptic([150, 80, 200, 100, 400]);

      setTimeout(() => {
        // Multi-stage fireworks confetti
        const end = Date.now() + 2500;
        const colors = ["#fbbf24", "#f59e0b", "#d97706", "#10b981", "#ffffff"];

        (function frame() {
          confetti({
            particleCount: 7,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: colors,
          });
          confetti({
            particleCount: 7,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: colors,
          });

          if (Date.now() < end) {
            requestAnimationFrame(frame);
          }
        })();
      }, 500);
    }

    // Announce to ARIA live region
    const live = document.getElementById("a11y-live-region");
    if (live) {
      live.textContent = `Reveal verdict: ${result.tierName}. Won ${result.formattedAmount}. ${result.summary}`;
    }
  }, [soundEnabled, triggerHaptic]);

  // Main Reveal Sequence
  useEffect(() => {
    if (!effectiveResult) return;

    // Reduced motion shortcut: immediate verdict fade
    if (prefersReduced) {
      setPhase("VERDICT");
      setLockedIndices(effectiveResult.matchedIndices);
      triggerVerdictCelebration(effectiveResult);
      return;
    }

    let isMounted = true;
    const timeouts: NodeJS.Timeout[] = [];

    // Phase 1: SLIDE_IN (0ms -> 1200ms)
    setPhase("SLIDE_IN");

    // Phase 2: SWEEP_SCAN (1200ms -> 2500ms)
    timeouts.push(
      setTimeout(() => {
        if (!isMounted) return;
        setPhase("SWEEP_SCAN");
        if (soundEnabled) soundFx.playScanSweep();
      }, 1200)
    );

    // Phase 3: JUDGING CHARACTERS 0..7 (2500ms onwards)
    timeouts.push(
      setTimeout(() => {
        if (!isMounted) return;
        setPhase("JUDGING");

        let currentIdx = 0;
        const targetMatches = effectiveResult.matchedIndices;

        const judgeNext = () => {
          if (!isMounted) return;
          if (currentIdx > 7) {
            // Done judging, move to Verdict!
            setActiveJudgeIndex(-1);
            setPhase("VERDICT");
            triggerVerdictCelebration(effectiveResult);
            return;
          }

          setActiveJudgeIndex(currentIdx);
          const isMatch = targetMatches.includes(currentIdx);

          if (isMatch) {
            setLockedIndices((prev) => [...prev, currentIdx]);
            triggerHaptic(40);
            if (soundEnabled) soundFx.playLockTick(true);
          } else {
            if (soundEnabled) soundFx.playLockTick(false);
          }

          // Suspense timing: pacing slows down as more characters match
          const consecutiveMatches = targetMatches.filter((i) => i <= currentIdx).length;
          const delay = 320 + consecutiveMatches * 80;

          currentIdx++;
          timeouts.push(setTimeout(judgeNext, delay));
        };

        judgeNext();
      }, 2500)
    );

    return () => {
      isMounted = false;
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [effectiveResult, prefersReduced, soundEnabled, triggerHaptic, triggerVerdictCelebration]);

  // Skip handler: immediately skip to completed verdict
  const handleSkip = () => {
    if (!effectiveResult) return;
    setPhase("VERDICT");
    setActiveJudgeIndex(-1);
    setLockedIndices(effectiveResult.matchedIndices);
    triggerVerdictCelebration(effectiveResult);
  };

  const handleGoToResult = () => {
    router.push("/result");
  };

  const handleCheckAnother = () => {
    router.push("/");
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-between py-2 sm:py-6 relative min-h-[580px]">
      {/* Jackpot Golden Dim Overlay */}
      <AnimatePresence>
        {isJackpotDimmed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.85 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-20 bg-slate-950 pointer-events-none transition-opacity duration-700"
          />
        )}
      </AnimatePresence>

      {/* Top Header Bar with Skip Button */}
      <div className="w-full flex items-center justify-between px-2 mb-4 relative z-30">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {phase === "SLIDE_IN" && "1. Aligning Ticket..."}
            {phase === "SWEEP_SCAN" && "2. Scanning Security Bars..."}
            {phase === "JUDGING" && "3. Judging Numbers Against Draw..."}
            {phase === "VERDICT" && "Official Verdict"}
          </span>
        </div>

        {phase !== "VERDICT" && (
          <button
            onClick={handleSkip}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shadow-sm"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>Skip Reveal</span>
          </button>
        )}
      </div>

      {/* Centerpiece: Ticket 3D Animation & Visual */}
      <div className="w-full flex-1 flex flex-col items-center justify-center relative z-30 my-4 sm:my-8 px-2">
        <motion.div
          initial={
            prefersReduced
              ? { opacity: 0 }
              : { opacity: 0, y: 50, rotateX: 18, rotateY: -8, scale: 0.92 }
          }
          animate={
            phase === "SLIDE_IN"
              ? { opacity: 1, y: 0, rotateX: 10, rotateY: -4, scale: 0.98 }
              : phase === "SWEEP_SCAN" || phase === "JUDGING"
              ? { opacity: 1, y: 0, rotateX: 0, rotateY: 0, scale: 1 }
              : effectiveResult?.kind === "jackpot"
              ? { scale: [1, 1.05, 1.02], y: -8, transition: { duration: 0.8 } }
              : effectiveResult?.kind === "mid"
              ? { y: -6, scale: 1.02 }
              : { opacity: 1, y: 0, scale: 1 }
          }
          transition={{
            type: prefersReduced ? "tween" : "spring",
            stiffness: 220,
            damping: 24,
            duration: prefersReduced ? 0.4 : undefined,
          }}
          className={`w-full max-w-xl transition-all duration-500 ${
            effectiveResult?.kind === "jackpot" && phase === "VERDICT"
              ? "drop-shadow-[0_0_45px_rgba(245,158,11,0.65)]"
              : effectiveResult?.kind === "mid" && phase === "VERDICT"
              ? "drop-shadow-[0_0_35px_rgba(139,92,246,0.45)]"
              : effectiveResult?.kind === "small" && phase === "VERDICT"
              ? "drop-shadow-[0_0_30px_rgba(16,185,129,0.4)]"
              : ""
          }`}
          style={{ perspective: 1000 }}
        >
          <TicketVisual
            ticketString={effectiveTicketString}
            schemeCode={effectiveTicketString.charAt(0)}
            drawNumber={activeDraw?.id || "W-790"}
            drawDate={activeDraw?.drawDate || "23 NOV 2026"}
            state={
              phase === "SWEEP_SCAN"
                ? "scanning"
                : phase === "VERDICT"
                ? effectiveResult?.kind === "none"
                  ? "lost"
                  : "won"
                : "idle"
            }
            matchedIndices={lockedIndices}
            activeJudgeIndex={activeJudgeIndex}
            size="responsive"
          />
        </motion.div>
      </div>

      {/* Phase 4 Verdict Banner & Counter Roll */}
      <div className="w-full max-w-lg mx-auto relative z-30">
        <AnimatePresence>
          {phase === "VERDICT" && effectiveResult && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className={`rounded-3xl p-5 sm:p-6 text-center border shadow-2xl ${
                effectiveResult.kind === "jackpot"
                  ? "bg-gradient-to-b from-amber-500/20 to-amber-950/40 border-amber-500/60 text-white backdrop-blur-md"
                  : effectiveResult.kind === "mid"
                  ? "bg-gradient-to-b from-purple-500/20 to-purple-950/30 border-purple-500/50 backdrop-blur-md"
                  : effectiveResult.kind === "small"
                  ? "bg-gradient-to-b from-emerald-500/20 to-emerald-950/30 border-emerald-500/50 backdrop-blur-md"
                  : "bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 backdrop-blur-md"
              }`}
            >
              {/* Verdict Header Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-3 shadow-sm">
                {effectiveResult.kind === "jackpot" && (
                  <span className="bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Trophy className="w-3.5 h-3.5" /> Bumper 1st Prize Winner
                  </span>
                )}
                {effectiveResult.kind === "mid" && (
                  <span className="bg-purple-600 text-white px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Award className="w-3.5 h-3.5" /> Consolation / Major Prize
                  </span>
                )}
                {effectiveResult.kind === "small" && (
                  <span className="bg-emerald-600 text-white px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Last 4 Digits Prize Winner
                  </span>
                )}
                {effectiveResult.kind === "none" && (
                  <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full">
                    No Winning Match
                  </span>
                )}
              </div>

              {/* Big Animated Count-Up */}
              {effectiveResult.amount > 0 ? (
                <div className="my-2">
                  <div className="text-3xl sm:text-5xl font-black text-amber-500 dark:text-amber-400 tracking-tight">
                    <CountUp
                      end={effectiveResult.amount}
                      duration={effectiveResult.kind === "jackpot" ? 3000 : 1800}
                    />
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium mt-1">
                    {effectiveResult.tierName} • Drawn in {activeDraw?.id}
                  </p>
                </div>
              ) : (
                <div className="my-2">
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">
                    Better Luck Next Time
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                    {effectiveResult.detailedExplanation}
                  </p>
                </div>
              )}

              {/* CTA Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 mt-5">
                <button
                  onClick={handleGoToResult}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all"
                >
                  <span>View Full Prize Breakdown</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={handleCheckAnother}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-sm flex items-center justify-center gap-1.5 transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Check Another</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
