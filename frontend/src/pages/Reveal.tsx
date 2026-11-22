import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { TicketGraphic } from "@/components/ticket/TicketGraphic";
import { CountUp } from "@/components/reveal/CountUp";
import { useCheckStore } from "@/store/useCheckStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useDemoStore } from "@/store/useDemoStore";
import { mockLotteryApi } from "@/lib/mockApi";
import { checkTicket, formatINR } from "@/lib/checkTicket";
import { sound } from "@/lib/sound";
import { Draw, MatchResult } from "@/types";
import { ArrowRight, RotateCcw, Share2, Sparkles, Trophy, Award } from "lucide-react";

type RevealPhase = "ANTICIPATION" | "SCAN" | "JUDGEMENT" | "PAUSE" | "VERDICT";

export function Reveal() {
  const navigate = useNavigate();
  const {
    ticketString,
    selectedDrawId,
    lastResult,
    setLastResult,
    clearInput,
    isReplay,
  } = useCheckStore();
  const {
    soundEnabled,
    hapticsEnabled,
    reducedMotion,
    hasSeenSoundToast,
    markSoundToastSeen,
    recordCheckFirsts,
  } = useSettingsStore();
  const { forcedOutcome } = useDemoStore();

  const [phase, setPhase] = useState<RevealPhase>("ANTICIPATION");
  const [activeJudgeIndex, setActiveJudgeIndex] = useState<number>(-1);
  const [lockedIndices, setLockedIndices] = useState<number[]>([]);
  const [draw, setDraw] = useState<Draw | null>(null);
  const [result, setResult] = useState<MatchResult | null>(lastResult);
  const [showSkip, setShowSkip] = useState(false);
  const [isJackpotDimmed, setIsJackpotDimmed] = useState(false);

  const effectiveTicket = ticketString || "WA 584920";

  // System prefers-reduced-motion check
  const prefersReduced =
    reducedMotion ||
    (typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  const triggerHaptic = useCallback(
    (pattern: number | number[]) => {
      if (hapticsEnabled && typeof window !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(pattern);
        } catch {
          // ignore
        }
      }
    },
    [hapticsEnabled]
  );

  // Load Draw and MatchResult
  useEffect(() => {
    mockLotteryApi.getDraws().then((drawList) => {
      const active =
        drawList.find((d) => d.id === selectedDrawId) ||
        drawList.find((d) => d.schemeCode === effectiveTicket.charAt(0)) ||
        drawList[0];
      setDraw(active);

      const evaluated = checkTicket(effectiveTicket, active, forcedOutcome);
      setResult(evaluated);
      setLastResult(evaluated, isReplay);
    });
  }, [effectiveTicket, selectedDrawId, forcedOutcome, isReplay, setLastResult]);

  // Subtle skip button appears after 1.5s
  useEffect(() => {
    const timer = setTimeout(() => setShowSkip(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Verdict celebration executor
  const executeVerdict = useCallback(
    (evalResult: MatchResult) => {
      if (soundEnabled) {
        if (evalResult.kind === "jackpot") sound.playVerdictChime("jackpot");
        else if (evalResult.kind === "mid") sound.playVerdictChime("mid");
        else if (evalResult.kind === "small") sound.playVerdictChime("small");
      }

      if (evalResult.kind === "small") {
        triggerHaptic([40, 30, 60]);
        confetti({
          particleCount: 35,
          spread: 60,
          origin: { y: 0.65 },
          colors: ["#5CC4AB", "#05695A", "#FDE7B0"],
        });
      } else if (evalResult.kind === "mid") {
        triggerHaptic([60, 40, 80, 40, 100]);
        confetti({
          particleCount: 65,
          spread: 80,
          origin: { x: 0.25, y: 0.6 },
          colors: ["#5B438A", "#FDE7B0", "#5CC4AB"],
        });
        setTimeout(() => {
          confetti({
            particleCount: 65,
            spread: 80,
            origin: { x: 0.75, y: 0.6 },
            colors: ["#5B438A", "#FDE7B0", "#5CC4AB"],
          });
        }, 200);
      } else if (evalResult.kind === "jackpot") {
        setIsJackpotDimmed(true);
        triggerHaptic([120, 60, 150, 80, 300]);

        setTimeout(() => {
          const end = Date.now() + 2800;
          const colors = ["#E3B957", "#FDE7B0", "#05695A", "#FFFFFF"];
          (function frame() {
            confetti({
              particleCount: 8,
              angle: 60,
              spread: 55,
              origin: { x: 0 },
              colors,
            });
            confetti({
              particleCount: 8,
              angle: 120,
              spread: 55,
              origin: { x: 1 },
              colors,
            });
            if (Date.now() < end) requestAnimationFrame(frame);
          })();
        }, 500);
      }

      // Live region announcement
      const live = document.getElementById("a11y-live-region");
      if (live) {
        live.textContent = `Verdict: ${evalResult.tier}. ${evalResult.summary}. Won ${evalResult.formattedAmount}.`;
      }

      // Check firsts toasts (if not replay)
      if (!isReplay) {
        const { isFirstCheck, isFirstWin, isNewBestWin } = recordCheckFirsts(evalResult.amount);
        const triggerToast = (window as any).__triggerGachaToast;
        if (triggerToast) {
          if (!hasSeenSoundToast) {
            markSoundToastSeen();
            setTimeout(() => {
              triggerToast({
                type: "sound_prompt",
                title: "Turn on sound and haptics for the full effect",
                actionLink: { to: "/settings", text: "Settings" },
              });
            }, 2500);
          } else if (isFirstWin) {
            triggerToast({
              type: "first_win",
              title: "Personal First: First win!",
              description: `Congratulations on winning ${evalResult.formattedAmount}.`,
            });
          } else if (isNewBestWin && evalResult.amount > 0) {
            triggerToast({
              type: "new_best_win",
              title: "New best win record!",
              description: `${evalResult.formattedAmount} is your highest prize yet.`,
            });
          } else if (isFirstCheck) {
            triggerToast({
              type: "first_check",
              title: "First ticket verified",
              description: "Your results are now being logged in your history.",
            });
          }
        }
      }
    },
    [
      soundEnabled,
      triggerHaptic,
      isReplay,
      recordCheckFirsts,
      hasSeenSoundToast,
      markSoundToastSeen,
    ]
  );

  // Main Smooth Timeline
  useEffect(() => {
    if (!result) return;

    // Reduced motion shortcut
    if (prefersReduced) {
      setPhase("VERDICT");
      setLockedIndices(result.matchedIndices);
      executeVerdict(result);
      return;
    }

    let isMounted = true;
    const timeouts: NodeJS.Timeout[] = [];

    // Phase 1: Anticipation (0 -> 1200ms)
    setPhase("ANTICIPATION");

    // Phase 2: Scan (1200 -> 2400ms)
    timeouts.push(
      setTimeout(() => {
        if (!isMounted) return;
        setPhase("SCAN");
        if (soundEnabled) sound.playSweep();
      }, 1200)
    );

    // Phase 3: Judgement (2400ms -> ~5800ms)
    timeouts.push(
      setTimeout(() => {
        if (!isMounted) return;
        setPhase("JUDGEMENT");

        let currentIdx = 0;
        const matches = result.matchedIndices;

        const judgeNext = () => {
          if (!isMounted) return;
          if (currentIdx > 7) {
            // Done judging, beat of silence (600-800ms)
            setActiveJudgeIndex(-1);
            setPhase("PAUSE");

            timeouts.push(
              setTimeout(() => {
                if (!isMounted) return;
                setPhase("VERDICT");
                executeVerdict(result);
              }, 700)
            );
            return;
          }

          setActiveJudgeIndex(currentIdx);
          const isMatch = matches.includes(currentIdx);

          if (isMatch) {
            setLockedIndices((prev) => [...prev, currentIdx]);
            triggerHaptic(30);
            if (soundEnabled) sound.playCharLock(currentIdx, true);
          } else {
            if (soundEnabled) sound.playCharLock(currentIdx, false);
          }

          const consecutiveMatches = matches.filter((i) => i <= currentIdx).length;
          let delay = 300 + consecutiveMatches * 60;
          if (currentIdx === 6) {
            delay += 200; // gentle anticipation before the 8th character
          }

          currentIdx++;
          timeouts.push(setTimeout(judgeNext, delay));
        };

        judgeNext();
      }, 2400)
    );

    return () => {
      isMounted = false;
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [result, prefersReduced, soundEnabled, triggerHaptic, executeVerdict]);

  const handleSkip = () => {
    if (!result) return;
    setPhase("VERDICT");
    setActiveJudgeIndex(-1);
    setLockedIndices(result.matchedIndices);
    executeVerdict(result);
  };

  const handleCheckAnother = () => {
    clearInput();
    navigate("/check");
  };

  const handleShare = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 340;
    const ctx = canvas.getContext("2d");
    if (ctx && result) {
      ctx.fillStyle = "#EBF9F3";
      ctx.fillRect(0, 0, 600, 340);
      ctx.fillStyle = "#05695A";
      ctx.font = "bold 28px Manrope, sans-serif";
      ctx.fillText("gacha", 40, 50);

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(40, 80, 520, 200);

      ctx.fillStyle = "#0F1F1A";
      ctx.font = "bold 24px 'DM Mono', monospace";
      ctx.fillText(effectiveTicket, 60, 130);

      ctx.fillStyle = "#5B6F68";
      ctx.font = "16px Manrope, sans-serif";
      ctx.fillText(`Draw ${draw?.id || "W-790"} · ${result.tier}`, 60, 170);

      ctx.fillStyle = result.amount > 0 ? "#8A5A00" : "#0F1F1A";
      ctx.font = "bold 32px Manrope, sans-serif";
      ctx.fillText(result.formattedAmount, 60, 230);

      const a = document.createElement("a");
      a.download = `gacha-${effectiveTicket.replace(/\s+/g, "")}.png`;
      a.href = canvas.toDataURL();
      a.click();
    }
  };

  const isWin = (result?.amount || 0) > 0;

  return (
    <div className="flex-1 flex flex-col items-center justify-between py-4 sm:py-8 relative min-h-[560px]">
      {/* Background Dim for Jackpot */}
      <AnimatePresence>
        {isJackpotDimmed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-10 bg-[#0F1A1E] pointer-events-none transition-opacity duration-700"
          />
        )}
      </AnimatePresence>

      {/* Top Header Bar with Subtle Skip Button */}
      <div className="w-full flex items-center justify-between px-2 mb-2 z-20">
        <div className="text-xs font-semibold text-muted">
          {phase === "ANTICIPATION" && `Checking draw ${draw?.id || "W-790"}…`}
          {phase === "SCAN" && "Scanning ticket…"}
          {phase === "JUDGEMENT" && `Comparing numbers (${lockedIndices.length} of 8 matched)`}
          {phase === "PAUSE" && "Resolving verdict…"}
          {phase === "VERDICT" && "Official Result"}
        </div>

        {phase !== "VERDICT" && showSkip && (
          <button
            onClick={handleSkip}
            className="text-xs font-semibold text-muted hover:text-main px-3 py-1 rounded-full bg-surface border border-border shadow-soft transition-colors"
          >
            Skip
          </button>
        )}
      </div>

      {/* Center Ticket Visual with Smooth 60fps GPU easing */}
      <div className="w-full flex-1 flex flex-col items-center justify-center my-4 sm:my-6 z-20 px-2">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{
            opacity: 1,
            y: phase === "VERDICT" && result?.kind === "jackpot" ? -8 : 0,
            scale: phase === "VERDICT" && result?.kind === "jackpot" ? 1.02 : 1,
          }}
          transition={{
            duration: 0.6,
            ease: [0.16, 1, 0.3, 1],
          }}
          className={`w-full max-w-xl transition-all duration-300 ${
            result?.kind === "jackpot" && phase === "VERDICT"
              ? "drop-shadow-[0_0_36px_rgba(227,185,87,0.45)]"
              : result?.kind === "mid" && phase === "VERDICT"
              ? "drop-shadow-[0_0_24px_rgba(91,67,138,0.25)]"
              : result?.kind === "small" && phase === "VERDICT"
              ? "drop-shadow-[0_0_20px_rgba(92,196,171,0.25)]"
              : ""
          }`}
          style={{ willChange: "transform, opacity" }}
        >
          <TicketGraphic
            ticketString={effectiveTicket}
            schemeCode={effectiveTicket.charAt(0)}
            drawId={draw?.id || "W-790"}
            drawDate={draw?.drawDate || "23 NOV 2026"}
            state={
              phase === "SCAN"
                ? "scanning"
                : phase === "VERDICT"
                ? isWin
                  ? "won"
                  : "lost"
                : "idle"
            }
            matchedIndices={lockedIndices}
            activeJudgeIndex={activeJudgeIndex}
            size="responsive"
          />
        </motion.div>

        {/* Progress Cue under ticket */}
        {phase === "JUDGEMENT" && (
          <div className="text-xs text-muted font-medium mt-3">
            {lockedIndices.length} of 8 characters matched
          </div>
        )}
      </div>

      {/* Phase 5: Verdict Card & Controls */}
      <div className="w-full max-w-md mx-auto z-20">
        <AnimatePresence>
          {phase === "VERDICT" && result && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="bg-surface rounded-3xl p-6 border border-border shadow-elevated text-center space-y-4"
            >
              {/* Verdict Header Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold">
                {result.kind === "jackpot" && (
                  <span className="bg-gold-bg text-gold-text border border-gold-border px-3 py-0.5 rounded-full flex items-center gap-1 font-bold">
                    <Trophy className="w-3.5 h-3.5" /> Bumper 1st Prize Winner
                  </span>
                )}
                {result.kind === "mid" && (
                  <span className="bg-primary/10 text-primary px-3 py-0.5 rounded-full flex items-center gap-1 font-bold">
                    <Award className="w-3.5 h-3.5" /> {result.tier} Winner
                  </span>
                )}
                {result.kind === "small" && (
                  <span className="bg-primary/10 text-primary px-3 py-0.5 rounded-full flex items-center gap-1 font-bold">
                    <Sparkles className="w-3.5 h-3.5" /> {result.tier} Winner
                  </span>
                )}
                {result.kind === "none" && (
                  <span className="bg-input-box text-muted px-3 py-0.5 rounded-full">
                    No prize this time
                  </span>
                )}
              </div>

              {/* Amount Count-Up or Gentle Explanation */}
              {result.amount > 0 ? (
                <div>
                  <div className="text-4xl sm:text-5xl font-black text-main">
                    <CountUp end={result.amount} duration={result.kind === "jackpot" ? 2400 : 1400} />
                  </div>
                  <p className="text-xs text-muted mt-1">{result.tier} · Draw {draw?.id}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-main">No prize this time</h3>
                  {result.closestMatch ? (
                    <p className="text-xs text-muted max-w-xs mx-auto">{result.closestMatch}</p>
                  ) : (
                    <p className="text-xs text-muted">Draw {draw?.id}. Better luck in future draws.</p>
                  )}
                </div>
              )}

              {/* Primary Action Button */}
              <button
                onClick={handleCheckAnother}
                className="w-full py-3.5 px-6 rounded-2xl bg-primary hover:bg-primary-hover text-white font-bold text-sm shadow-soft transition-all flex items-center justify-center gap-2"
              >
                <span>Check another ticket</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Quiet Links */}
              <div className="flex items-center justify-center gap-4 pt-1 text-xs text-muted">
                <button
                  onClick={() => navigate(`/results/${draw?.id || "W-790"}`)}
                  className="hover:text-main hover:underline"
                >
                  View prize breakdown
                </button>
                <span>·</span>
                <button onClick={handleShare} className="hover:text-main hover:underline flex items-center gap-1">
                  <Share2 className="w-3 h-3" />
                  <span>Share</span>
                </button>
                {isWin && (
                  <>
                    <span>·</span>
                    <button
                      onClick={() => {
                        setLockedIndices([]);
                        setPhase("ANTICIPATION");
                      }}
                      className="hover:text-main hover:underline flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Replay reveal</span>
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
