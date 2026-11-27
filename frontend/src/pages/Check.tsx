import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation, useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { SegmentedInput } from "@/components/check/SegmentedInput";
import { SchemeChip } from "@/components/check/SchemeChip";
import { TicketGraphic } from "@/components/ticket/TicketGraphic";
import { KeralaBackground } from "@/components/layout/KeralaBackground";
import { CountUp } from "@/components/reveal/CountUp";
import { parseTicket } from "@/lib/parser";
import { checkTicket, formatINR } from "@/lib/checkTicket";
import { sound } from "@/lib/sound";
import { lotteryApi } from "@/lib/apiClient";
import { Draw, MatchResult } from "@/types";
import { useCheckStore } from "@/store/useCheckStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useDemoStore } from "@/store/useDemoStore";
import { getScheme, getUpcomingDraws } from "@/lib/schemes";
import { usePageMeta } from "@/lib/usePageMeta";
import {
  ChevronDown,
  ArrowDown,
  ArrowRight,
  Calendar,
  ChevronRight,
  Trophy,
  Award,
  Sparkles,
  RotateCcw,
  Share2,
  Clock,
  RefreshCw,
} from "lucide-react";

function formatCompactPrize(input: number | string): string {
  const num =
    typeof input === "number"
      ? input
      : parseInt(String(input).replace(/[^0-9]/g, ""), 10) || 0;
  if (num >= 10000000) {
    const cr = num / 10000000;
    return `₹${Number.isInteger(cr) ? cr : cr.toFixed(1)} Cr`;
  }
  if (num >= 100000) {
    const lakhs = num / 100000;
    return `₹${Number.isInteger(lakhs) ? lakhs : lakhs.toFixed(0)} Lakhs`;
  }
  return formatINR(num);
}

type RevealPhase = "MORPH" | "SCAN" | "JUDGEMENT" | "PAUSE" | "VERDICT";

interface CheckProps {
  initialChecking?: boolean;
}

export function Check({ initialChecking = false }: CheckProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const {
    characters,
    setCharacters,
    selectedDrawId,
    setSelectedDrawId,
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

  const [draws, setDraws] = useState<Draw[]>([]);
  const [fullActiveDraw, setFullActiveDraw] = useState<Draw | null>(null);

  // Checking & Reveal state machine
  const isDirectRevealRoute = location.pathname === "/check/reveal" || initialChecking;
  const [isChecking, setIsChecking] = useState<boolean>(isDirectRevealRoute);
  const [revealPhase, setRevealPhase] = useState<RevealPhase>("MORPH");
  const [activeJudgeIndex, setActiveJudgeIndex] = useState<number>(-1);
  const [lockedIndices, setLockedIndices] = useState<number[]>([]);
  const [evalResult, setEvalResult] = useState<MatchResult | null>(null);
  const [showSkip, setShowSkip] = useState<boolean>(false);
  const [isJackpotDimmed, setIsJackpotDimmed] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const firstLetter = characters[0] || "";
  const parsed = parseTicket(characters.join(""));
  const isComplete = parsed.isValid;

  usePageMeta({
    title: "cocolot — Kerala Lottery Result Checker & Prize Ledger",
    description:
      "Check Kerala State Lottery results in seconds, explore upcoming 3:00 PM weekly draws, and track your personal prize ledger.",
    path: "/check",
  });

  // Haptics helper
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

  // Load draws & support shareable ?draw= / ?ticket= URL params
  useEffect(() => {
    const paramTicket = searchParams.get("ticket");
    if (paramTicket) {
      const p = parseTicket(paramTicket);
      if (p.characters.some(Boolean)) {
        setCharacters([...p.characters]);
      }
    }

    const paramDraw = searchParams.get("draw");
    lotteryApi.getDraws().then((d) => {
      setDraws(d);
      if (paramDraw) {
        const matched = d.find((item) => item.id.toUpperCase() === paramDraw.toUpperCase());
        if (matched) {
          setSelectedDrawId(matched.id);
          return;
        }
        setSelectedDrawId(paramDraw.toUpperCase());
        return;
      }
      if (d.length > 0 && !selectedDrawId) {
        const latestPublished = d.find((draw) => draw.isPublished) || d[0];
        setSelectedDrawId(latestPublished.id);
      }
    });
  }, [selectedDrawId, setSelectedDrawId, searchParams, setCharacters]);

  const upcomingDraws = useMemo(() => {
    const publishedDates = draws.filter((d) => d.isPublished).map((d) => d.drawDate);
    return getUpcomingDraws(4, publishedDates);
  }, [draws]);

  // Fetch full draw details (including prize tiers) whenever selectedDrawId changes
  useEffect(() => {
    if (!selectedDrawId) return;
    let cancelled = false;
    lotteryApi.getDrawById(selectedDrawId).then((full) => {
      if (!cancelled && full) {
        setFullActiveDraw(full);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedDrawId]);

  // Auto-switch draw when first letter changes if matching draw exists
  useEffect(() => {
    if (firstLetter && draws.length > 0 && !isChecking) {
      const upper = firstLetter.toUpperCase();
      const match = draws.find(
        (d) =>
          d.isPublished &&
          (d.schemeCode.toUpperCase() === upper ||
            d.schemeCode.toUpperCase().startsWith(upper) ||
            (upper === "B" && d.schemeCode.toUpperCase() === "BT"))
      );
      if (match) {
        setSelectedDrawId(match.id);
      }
    }
  }, [firstLetter, draws, setSelectedDrawId, isChecking]);

  const baseDraw =
    draws.find((d) => d.id === selectedDrawId) ||
    draws.find((d) => d.schemeCode === (characters[0] || "W")) ||
    draws[0];

  const activeDraw =
    fullActiveDraw && baseDraw && fullActiveDraw.id === baseDraw.id
      ? fullActiveDraw
      : baseDraw;

  // Return to input state when navigating to /check (e.g. clicking logo) or browser back
  useEffect(() => {
    if (location.pathname === "/check" && !initialChecking && isChecking) {
      setIsChecking(false);
      setRevealPhase("MORPH");
      setEvalResult(null);
    }
  }, [location.pathname, location.key, initialChecking]);

  useEffect(() => {
    const handlePopState = () => {
      if (location.pathname === "/check" && isChecking) {
        setIsChecking(false);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isChecking, location.pathname]);

  // Verdict celebration executor
  const executeVerdict = useCallback(
    (res: MatchResult) => {
      if (soundEnabled) {
        if (res.kind === "jackpot") sound.playVerdictChime("jackpot");
        else if (res.kind === "mid") sound.playVerdictChime("mid");
        else if (res.kind === "small") sound.playVerdictChime("small");
      }

      if (res.kind === "small") {
        triggerHaptic([40, 30, 60]);
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.65 },
          colors: ["#5CC4AB", "#05695A", "#FDE7B0"],
        });
      } else if (res.kind === "mid") {
        triggerHaptic([60, 40, 80, 40, 100]);
        confetti({
          particleCount: 75,
          spread: 80,
          origin: { x: 0.25, y: 0.6 },
          colors: ["#5B438A", "#FDE7B0", "#5CC4AB"],
        });
        setTimeout(() => {
          confetti({
            particleCount: 75,
            spread: 80,
            origin: { x: 0.75, y: 0.6 },
            colors: ["#5B438A", "#FDE7B0", "#5CC4AB"],
          });
        }, 200);
      } else if (res.kind === "jackpot") {
        setIsJackpotDimmed(true);
        triggerHaptic([120, 60, 150, 80, 300]);

        setTimeout(() => {
          const end = Date.now() + 2800;
          const colors = ["#E3B957", "#FDE7B0", "#05695A", "#FFFFFF"];
          (function frame() {
            confetti({
              particleCount: 10,
              angle: 60,
              spread: 55,
              origin: { x: 0 },
              colors,
            });
            confetti({
              particleCount: 10,
              angle: 120,
              spread: 55,
              origin: { x: 1 },
              colors,
            });
            if (Date.now() < end) requestAnimationFrame(frame);
          })();
        }, 400);
      }

      // Live region announcement
      const live = document.getElementById("a11y-live-region");
      if (live) {
        live.textContent = `Verdict: ${res.tier}. ${res.summary}. Won ${res.formattedAmount}.`;
      }

      // First check milestones
      if (!isReplay) {
        const { isFirstCheck, isFirstWin, isNewBestWin } = recordCheckFirsts(res.amount);
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
              description: `Congratulations on winning ${res.formattedAmount}.`,
            });
          } else if (isNewBestWin && res.amount > 0) {
            triggerToast({
              type: "new_best_win",
              title: "New best win record!",
              description: `${res.formattedAmount} is your highest prize yet.`,
            });
          } else if (isFirstCheck) {
            triggerToast({
              type: "first_check",
              title: "First lottery verified",
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

  // Start checking transition sequence
  const startCheckingSequence = useCallback(
    (currentResult: MatchResult) => {
      setEvalResult(currentResult);
      setIsChecking(true);
      setShowSkip(false);
      setLockedIndices([]);
      setActiveJudgeIndex(-1);

      if (typeof window !== "undefined" && window.location.pathname !== "/check/reveal") {
        window.history.pushState({ checking: true }, "", "/check/reveal");
      }

      // Reduced motion bypass
      if (
        reducedMotion ||
        (typeof window !== "undefined" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      ) {
        setRevealPhase("VERDICT");
        setLockedIndices(currentResult.matchedIndices);
        executeVerdict(currentResult);
        return;
      }

      // Show skip after 1.5s
      const skipTimer = setTimeout(() => setShowSkip(true), 1500);

      // Phase 1: Morph & Zoom Out (0 -> 600ms)
      setRevealPhase("MORPH");

      // Phase 2: Scan (600ms -> 1700ms)
      const scanTimer = setTimeout(() => {
        setRevealPhase("SCAN");
        if (soundEnabled) sound.playSweep();
      }, 600);

      // Phase 3: Judgement (1700ms onwards)
      const judgeTimer = setTimeout(() => {
        setRevealPhase("JUDGEMENT");
        let currentIdx = 0;
        const matches = currentResult.matchedIndices;

        const judgeNext = () => {
          if (currentIdx > 7) {
            // Pause beat
            setActiveJudgeIndex(-1);
            setRevealPhase("PAUSE");

            setTimeout(() => {
              setRevealPhase("VERDICT");
              executeVerdict(currentResult);
            }, 600);
            return;
          }

          // Snapshot index in a block-scoped const so React's state updater doesn't read the post-increment value.
          const idx = currentIdx;
          setActiveJudgeIndex(idx);
          const isMatch = matches.includes(idx);

          if (isMatch) {
            setLockedIndices((prev) => (prev.includes(idx) ? prev : [...prev, idx]));
            triggerHaptic(30);
            if (soundEnabled) sound.playCharLock(idx, true);
          } else {
            if (soundEnabled) sound.playCharLock(idx, false);
          }

          const consecutiveMatches = matches.filter((i) => i <= idx).length;
          let delay = 280 + consecutiveMatches * 55;
          if (idx === 6) delay += 180; // slight anticipation before last box

          currentIdx++;
          setTimeout(judgeNext, delay);
        };

        judgeNext();
      }, 1700);

      return () => {
        clearTimeout(skipTimer);
        clearTimeout(scanTimer);
        clearTimeout(judgeTimer);
      };
    },
    [reducedMotion, soundEnabled, triggerHaptic, executeVerdict]
  );

  // If initialChecking is passed (e.g. direct /check/reveal or replay)
  useEffect(() => {
    if (isDirectRevealRoute && activeDraw && !evalResult) {
      let cancelled = false;
      const runDirect = async () => {
        let target = activeDraw;
        if (!target.prizes) {
          const full = await lotteryApi.getDrawById(target.id);
          if (full && !cancelled) target = full;
        }
        let res: MatchResult;
        if (forcedOutcome) {
          res = checkTicket(parsed.isValid ? parsed : "WA 584920", target, forcedOutcome);
        } else if (lotteryApi.checkTicket) {
          res = await lotteryApi.checkTicket(
            parsed.isValid ? parsed.fullTicketString : "WA 584920",
            target.id
          );
        } else {
          res = checkTicket(parsed.isValid ? parsed : "WA 584920", target);
        }
        if (!cancelled) {
          setLastResult(res, isReplay);
          startCheckingSequence(res);
        }
      };
      runDirect();
      return () => {
        cancelled = true;
      };
    }
  }, [isDirectRevealRoute, activeDraw, evalResult, parsed, forcedOutcome, isReplay, setLastResult, startCheckingSequence]);

  const handleCheck = async () => {
    if (!isComplete || !activeDraw || isChecking) return;

    let targetDraw = activeDraw;
    if (!targetDraw.prizes) {
      const fetched = await lotteryApi.getDrawById(activeDraw.id);
      if (fetched) {
        targetDraw = fetched;
        setFullActiveDraw(fetched);
      }
    }

    let result: MatchResult;
    if (forcedOutcome) {
      result = checkTicket(parsed, targetDraw, forcedOutcome);
    } else if (lotteryApi.checkTicket) {
      result = await lotteryApi.checkTicket(parsed.fullTicketString, targetDraw.id);
    } else {
      result = checkTicket(parsed, targetDraw);
    }

    setLastResult(result, false);

    // Save ticket uniquely to Postgres (when signed in) or guest storage
    const schemePrice = getScheme(targetDraw.schemeCode || parsed.schemeCode).price || 40;
    await lotteryApi.saveTicket({
      id: `tkt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ticketString: parsed.fullTicketString,
      schemeCode: targetDraw.schemeCode || parsed.schemeCode,
      series: parsed.series,
      digits: parsed.digits,
      drawId: targetDraw.id,
      drawDate: targetDraw.drawDate,
      checkedAt: new Date().toISOString(),
      cost: schemePrice,
      wonAmount: result.amount,
      result,
    });

    // Trigger in-place zoom-out morph and reveal
    startCheckingSequence(result);
  };

  const handleSkip = () => {
    if (!evalResult) return;
    setRevealPhase("VERDICT");
    setActiveJudgeIndex(-1);
    setLockedIndices(evalResult.matchedIndices);
    executeVerdict(evalResult);
  };

  const handleCheckAnother = () => {
    setIsChecking(false);
    setRevealPhase("MORPH");
    setEvalResult(null);
    clearInput();
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/check");
    }
  };

  const handleReplayCurrent = () => {
    if (evalResult) {
      startCheckingSequence(evalResult);
    }
  };

  const handleFillSample = (sample: string) => {
    const p = parseTicket(sample);
    setCharacters([...p.characters]);
  };

  const handleShare = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 340;
    const ctx = canvas.getContext("2d");
    if (ctx && evalResult) {
      ctx.fillStyle = "#EBF9F3";
      ctx.fillRect(0, 0, 600, 340);
      ctx.fillStyle = "#05695A";
      ctx.font = "bold 28px Manrope, sans-serif";
      ctx.fillText("cocolot", 40, 50);

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(40, 80, 520, 200);

      ctx.fillStyle = "#0F1F1A";
      ctx.font = "bold 24px 'DM Mono', monospace";
      ctx.fillText(parsed.fullTicketString || "WA 584920", 60, 130);

      ctx.fillStyle = "#5B6F68";
      ctx.font = "16px Manrope, sans-serif";
      ctx.fillText(`Draw ${activeDraw?.id || "W-790"} · ${evalResult.tier}`, 60, 170);

      ctx.fillStyle = evalResult.amount > 0 ? "#8A5A00" : "#0F1F1A";
      ctx.font = "bold 32px Manrope, sans-serif";
      ctx.fillText(evalResult.formattedAmount, 60, 230);

      const a = document.createElement("a");
      a.download = `cocolot-${(parsed.fullTicketString || "lottery").replace(/\s+/g, "")}.png`;
      a.href = canvas.toDataURL();
      a.click();
    }
  };

  const handleRefreshDraw = async () => {
    if (!activeDraw) return;
    setIsRefreshing(true);
    try {
      const full = await lotteryApi.getDrawById(activeDraw.id);
      if (full) {
        setFullActiveDraw(full);
        if (full.isPublished && full.prizes && parsed.isValid) {
          let res: MatchResult;
          if (lotteryApi.checkTicket) {
            res = await lotteryApi.checkTicket(parsed.fullTicketString, full.id);
          } else {
            res = checkTicket(parsed, full);
          }
          setEvalResult(res);
          setLastResult(res, false);
        }
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatDrawLabel = (draw?: Draw) => {
    if (!draw) return "Select draw";
    try {
      const date = new Date(draw.drawDate);
      const formattedDate = date.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      const scheme = getScheme(draw.schemeCode);
      const statusIcon = draw.isPublished ? "●" : "⏳";
      const statusTag = draw.isPublished ? "Published" : "Pending";
      return `${statusIcon} ${scheme.name} ${draw.id} · ${formattedDate} (${statusTag})`;
    } catch {
      return `${draw.id} draw`;
    }
  };

  const isWin = (evalResult?.amount || 0) > 0;

  return (
    <div className="flex-1 flex flex-col justify-between relative">
      {/* Kerala Traditional Background & Scheme Glow */}
      <KeralaBackground scheme={getScheme(activeDraw?.schemeCode)} />
      {/* Dim overlay during checking sequence */}
      <AnimatePresence>
        {isChecking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className={`fixed inset-0 z-10 pointer-events-none backdrop-blur-[2px] transition-colors duration-500 ${
              isJackpotDimmed
                ? "bg-black/85"
                : "bg-[#09241E]/20 dark:bg-black/50"
            }`}
          />
        )}
      </AnimatePresence>

      {/* HERO SECTION */}
      <section className="min-h-[calc(100vh-140px)] flex flex-col items-center justify-center text-center py-6 sm:py-10 md:py-12 relative z-20">
        <div className="w-full max-w-4xl mx-auto space-y-4 sm:space-y-6">
          {/* Top Status & Controls Row: Centered Pill cleanly positioned directly above the card */}
          <div className="w-full max-w-2xl mx-auto flex items-center justify-center relative min-h-[36px] px-2">
            {isChecking ? (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface/95 border border-border shadow-soft text-xs font-semibold text-main backdrop-blur-sm"
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    revealPhase === "VERDICT" ? "bg-emerald-500" : "bg-primary animate-pulse"
                  }`}
                />
                <span>
                  {revealPhase === "MORPH" && `Preparing Draw ${activeDraw?.id}…`}
                  {revealPhase === "SCAN" && `Scanning ${parsed.fullTicketString}…`}
                  {revealPhase === "JUDGEMENT" &&
                    `Comparing numbers against Draw ${activeDraw?.id} (${lockedIndices.length} matched)`}
                  {revealPhase === "PAUSE" && "Resolving verdict…"}
                  {revealPhase === "VERDICT" && `Result verified against Draw ${activeDraw?.id}`}
                </span>
              </motion.div>
            ) : (
              <div className="h-8 flex items-center justify-center">
                {firstLetter && <SchemeChip firstLetter={firstLetter} drawId={activeDraw?.id} />}
              </div>
            )}

            {isChecking && revealPhase !== "VERDICT" && showSkip && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={handleSkip}
                className="absolute right-0 text-xs font-semibold text-muted hover:text-main px-3 py-1 rounded-full bg-surface border border-border shadow-soft transition-colors cursor-pointer"
              >
                Skip
              </motion.button>
            )}
          </div>

          {/* Heading (fades down into concise cue during checking) */}
          <AnimatePresence mode="wait">
            {!isChecking ? (
              <motion.div
                key="heading-input"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-2"
              >
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-main">
                  Check your lottery
                </h1>
                <p className="text-sm sm:text-base text-muted font-normal max-w-lg mx-auto">
                  Enter your 8-character lottery series and number to see today&apos;s result.
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* THE HERO CARD: Razor-sharp 2D elevation & morph between Input Card and Kerala Lottery Card */}
          <motion.div
            layout
            initial={false}
            animate={
              isChecking
                ? {
                    scale: 1,
                    y: revealPhase === "VERDICT" && isWin ? -8 : 0,
                  }
                : {
                    scale: 1,
                    y: 0,
                  }
            }
            transition={{
              duration: 0.45,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="w-full flex justify-center"
          >
            <AnimatePresence mode="wait">
              {!isChecking ? (
                /* 1. INPUT MODE: Giant Landing Card */
                <motion.div
                  key="input-card"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.35 }}
                  className="w-full bg-surface rounded-[32px] sm:rounded-[40px] p-6 sm:p-10 md:p-12 lg:p-14 border border-border shadow-elevated space-y-6 sm:space-y-8 my-2"
                >
                  {/* Segmented 8-char Input */}
                  <div className="w-full py-2">
                    <SegmentedInput
                      value={characters}
                      onChange={setCharacters}
                      onSubmit={handleCheck}
                      onComplete={() => {}}
                    />
                  </div>

                  {/* Scheduled Draw row */}
                  <div className="flex flex-col sm:flex-row items-center justify-between text-xs sm:text-sm text-muted pt-2 gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold text-muted">Scheduled Draw:</span>
                      <div className="relative inline-block">
                        <select
                          value={selectedDrawId}
                          onChange={(e) => setSelectedDrawId(e.target.value)}
                          className="appearance-none bg-input-box border border-input-border rounded-full py-2 pl-8 pr-9 text-xs sm:text-sm font-semibold text-main focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer shadow-sm"
                          aria-label="Select Draw"
                        >
                          {draws.map((d) => (
                            <option key={d.id} value={d.id}>
                              {formatDrawLabel(d)} {d.isDrawnToday ? "· Drawn today" : ""} {!d.isPublished ? "(Pending)" : ""}
                            </option>
                          ))}
                        </select>
                        <Calendar className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                        <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                      </div>
                    </div>

                    <div className="text-xs sm:text-sm text-subtle font-mono">
                      Kerala Std Time 15:00
                    </div>
                  </div>

                  {/* Pending Notice Banner when selected draw is awaiting results */}
                  {activeDraw && !activeDraw.isPublished && (
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5 text-left">
                      <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-0.5">
                        <span className="font-bold">Official Results Pending:</span>
                        <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80">
                          Winning numbers for Draw {activeDraw.id} ({activeDraw.drawDate}) have not been published yet. Kerala lotteries are announced at 3:00 PM IST. You can enter your ticket now to check its status.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Full-width Green Button */}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCheck}
                    disabled={!isComplete}
                    className={`w-full py-4 sm:py-5 px-8 rounded-2xl sm:rounded-3xl font-bold text-base sm:text-lg shadow-soft transition-all duration-200 flex items-center justify-center gap-2.5 ${
                      isComplete
                        ? "bg-primary hover:bg-primary-hover text-white shadow-card cursor-pointer"
                        : "bg-input-box border border-input-border text-subtle cursor-not-allowed opacity-60"
                    }`}
                  >
                    <span>Check lottery</span>
                    <ArrowRight className="w-5 h-5" />
                  </motion.button>
                </motion.div>
              ) : (
                /* 2. REVEAL MODE: Kerala Lottery Card with 3D Float & Scan */
                <motion.div
                  key="ticket-card"
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.4 }}
                  className="w-full flex justify-center py-2"
                >
                  <TicketGraphic
                    ticketString={parsed.fullTicketString || "WA 584920"}
                    schemeCode={activeDraw?.schemeCode || parsed.schemeCode || "W"}
                    drawId={activeDraw?.id || "W-790"}
                    drawDate={activeDraw?.drawDate || "23 NOV 2026"}
                    state={
                      revealPhase === "SCAN"
                        ? "scanning"
                        : revealPhase === "VERDICT"
                        ? isWin
                          ? "won"
                          : "lost"
                        : "idle"
                    }
                    matchedIndices={lockedIndices}
                    activeJudgeIndex={activeJudgeIndex}
                    tierLabel={revealPhase === "VERDICT" && evalResult ? evalResult.tier : undefined}
                    seriesLabel={`${getScheme(activeDraw?.schemeCode || parsed.schemeCode || "W").name} series ${parsed.series || "W"}`}
                    size="responsive"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Quick Demo Fill Chips (Only in input mode) */}
          {!isChecking && (
            <div className="pt-1 flex flex-wrap items-center justify-center gap-1.5 text-xs">
              <span className="text-subtle text-[11px]">Quick test:</span>
              <button
                type="button"
                onClick={() => handleFillSample("WA 584920")}
                className="px-2.5 py-1 rounded-xl bg-surface border border-border hover:bg-input-box text-muted font-mono transition-colors"
              >
                Jackpot
              </button>
              <button
                type="button"
                onClick={() => handleFillSample("WB 584920")}
                className="px-2.5 py-1 rounded-xl bg-surface border border-border hover:bg-input-box text-muted font-mono transition-colors"
              >
                Consolation
              </button>
              <button
                type="button"
                onClick={() => handleFillSample("WA 114920")}
                className="px-2.5 py-1 rounded-xl bg-surface border border-border hover:bg-input-box text-muted font-mono transition-colors"
              >
                Last-4
              </button>
              <button
                type="button"
                onClick={() => handleFillSample("WA 999999")}
                className="px-2.5 py-1 rounded-xl bg-surface border border-border hover:bg-input-box text-muted font-mono transition-colors"
              >
                No win
              </button>
            </div>
          )}

          {/* VERDICT CARD & ACTIONS (Slides up when verdict is reached) */}
          <AnimatePresence>
            {isChecking && revealPhase === "VERDICT" && evalResult && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 15 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-lg mx-auto bg-surface rounded-3xl p-6 sm:p-7 border border-border shadow-elevated text-center space-y-4"
              >
                {/* Badge Header */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold">
                  {evalResult.tier === "Results Pending" ? (
                    <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700/80 px-3.5 py-1 rounded-full flex items-center gap-1.5 font-bold shadow-2xs">
                      <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      Results Awaiting Publication
                    </span>
                  ) : evalResult.kind === "jackpot" ? (
                    <span className="bg-gold-bg text-gold-text border border-gold-border px-3.5 py-1 rounded-full flex items-center gap-1.5 font-bold shadow-sm">
                      <Trophy className="w-4 h-4 text-gold-text" /> Bumper 1st Prize Winner
                    </span>
                  ) : evalResult.kind === "mid" ? (
                    <span className="bg-primary/10 text-primary px-3.5 py-1 rounded-full flex items-center gap-1.5 font-bold">
                      <Award className="w-4 h-4" /> {evalResult.tier} Winner
                    </span>
                  ) : evalResult.kind === "small" ? (
                    <span className="bg-primary/10 text-primary px-3.5 py-1 rounded-full flex items-center gap-1.5 font-bold">
                      <Sparkles className="w-4 h-4" /> {evalResult.tier} Winner
                    </span>
                  ) : (
                    <span className="bg-input-box text-muted px-3.5 py-1 rounded-full">
                      No prize this time
                    </span>
                  )}
                </div>

                {/* Amount or Encouraging Headline */}
                <div className="space-y-1">
                  {evalResult.amount > 0 ? (
                    <div className="text-3xl sm:text-5xl font-black text-main font-mono tracking-tight">
                      <CountUp end={evalResult.amount} duration={1400} />
                    </div>
                  ) : evalResult.tier === "Results Pending" ? (
                    <div className="text-2xl sm:text-3xl font-bold text-main">
                      Results Not Published Yet
                    </div>
                  ) : (
                    <div className="text-2xl sm:text-3xl font-bold text-main">
                      Better luck on the next draw
                    </div>
                  )}

                  <p className="text-xs sm:text-sm text-muted max-w-sm mx-auto">
                    {evalResult.tier === "Results Pending"
                      ? `The Directorate of Kerala State Lotteries has not released the winning numbers for Draw ${activeDraw?.id} yet. Official results are announced at 3:00 PM IST.`
                      : evalResult.summary}
                  </p>
                </div>

                {/* Truthful Near-Miss Text */}
                {evalResult.closestMatch && evalResult.tier !== "Results Pending" && (
                  <div className="text-xs text-subtle py-1 px-3 rounded-xl bg-input-box inline-block">
                    {evalResult.closestMatch}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                  {evalResult.tier === "Results Pending" ? (
                    <>
                      <button
                        onClick={handleRefreshDraw}
                        disabled={isRefreshing}
                        className="flex-1 py-3 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-soft transition-colors cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                        <span>{isRefreshing ? "Checking for updates…" : "Refresh draw status"}</span>
                      </button>

                      <button
                        onClick={handleCheckAnother}
                        className="py-3 px-4 rounded-xl border border-border bg-surface hover:bg-input-box text-muted hover:text-main text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>Select another draw</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleCheckAnother}
                        className="flex-1 py-3 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-soft transition-colors cursor-pointer"
                      >
                        <span>Check another lottery</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={handleReplayCurrent}
                        title="Replay animation"
                        className="py-3 px-3.5 rounded-xl border border-border bg-surface hover:bg-input-box text-muted hover:text-main text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Replay</span>
                      </button>

                      <button
                        onClick={handleShare}
                        title="Export result"
                        className="py-3 px-3.5 rounded-xl border border-border bg-surface hover:bg-input-box text-muted hover:text-main text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Share</span>
                      </button>
                    </>
                  )}
                </div>

                {/* Official Results Breakdown Link */}
                <div className="pt-1">
                  <Link
                    to={`/results/${activeDraw?.id || "W-790"}`}
                    className="text-xs text-primary font-semibold hover:underline"
                  >
                    View Official Draw Breakdown →
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scroll Cue (Only in input mode) */}
          {!isChecking && (
            <div className="pt-2 flex flex-col items-center justify-center text-subtle text-xs gap-1 opacity-70">
              <span>Scroll for recent results &amp; upcoming schedule</span>
              <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
            </div>
          )}
        </div>
      </section>

      {/* BELOW THE FOLD (Visible when not checking) */}
      <AnimatePresence>
        {!isChecking && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-4xl mx-auto py-8 sm:py-10 border-t border-border mt-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* Recent Results */}
              <div className="bg-surface rounded-3xl p-5 sm:p-6 border border-border shadow-soft space-y-3">
                <div className="flex items-center justify-between pb-1">
                  <h2 className="text-sm font-bold text-main">Recent results</h2>
                  <Link
                    to="/results"
                    className="text-xs text-primary font-semibold hover:underline"
                  >
                    All results →
                  </Link>
                </div>

                <div className="space-y-2">
                  {draws.slice(0, 4).map((draw) => {
                    const scheme = getScheme(draw.schemeCode);
                    const firstPrize = draw.headlinePrize || draw.prizes?.firstPrize;
                    const formattedTicket = firstPrize
                      ? `${firstPrize.series ? `${firstPrize.series} ` : ""}${firstPrize.number}`
                      : null;

                    return (
                      <Link
                        key={draw.id}
                        to={`/results/${draw.id}`}
                        className="flex items-center justify-between p-3 rounded-2xl hover:bg-input-box/60 border border-border/60 transition-colors gap-3"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="text-xs font-bold text-main flex items-center gap-2">
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-md font-mono uppercase shrink-0"
                              style={{
                                backgroundColor: scheme.theme.bg,
                                color: scheme.theme.text,
                              }}
                            >
                              {draw.id}
                            </span>
                            <span className="truncate">{scheme.name}</span>
                            {draw.isDrawnToday && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                                Today
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted">
                            {new Date(draw.drawDate).toLocaleDateString("en-IN", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          {draw.isPublished && formattedTicket ? (
                            <div className="text-right space-y-0.5">
                              <div className="font-mono font-medium text-xs tracking-wider text-main bg-input-box border border-input-border px-2 py-0.5 rounded-lg">
                                {formattedTicket}
                              </div>
                              <div className="text-[11px] font-sans font-medium text-muted tabular-nums">
                                1st · {formatCompactPrize(firstPrize!.amount)}
                              </div>
                            </div>
                          ) : draw.isPublished ? (
                            <span className="text-[11px] text-primary font-semibold">
                              Published
                            </span>
                          ) : (
                            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                              Pending
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4 text-subtle shrink-0" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Upcoming Lotteries */}
              <div className="bg-surface rounded-3xl p-5 sm:p-6 border border-border shadow-soft space-y-3">
                <div className="flex items-center justify-between pb-1">
                  <h2 className="text-sm font-bold text-main">Upcoming lotteries</h2>
                  <span className="text-xs text-subtle font-sans font-medium tabular-nums">
                    Daily · 3:00 PM IST
                  </span>
                </div>

                <div className="space-y-2">
                  {upcomingDraws.map((item) => {
                    const { scheme } = item;
                    return (
                      <div
                        key={item.dateStr}
                        className="flex items-center justify-between p-3 rounded-2xl border border-border/60 gap-3"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="text-xs font-bold text-main flex items-center gap-2 flex-wrap">
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-md font-mono uppercase shrink-0"
                              style={{
                                backgroundColor: scheme.theme.bg,
                                color: scheme.theme.text,
                              }}
                            >
                              {scheme.code}
                            </span>
                            <span className="truncate">{scheme.name}</span>
                            {item.isToday && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 shrink-0">
                                Today · 3 PM
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 shrink-0" />
                            <span>{item.dayLabel}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0 space-y-0.5">
                          <div className="font-sans text-xs font-bold text-main tabular-nums">
                            {formatCompactPrize(scheme.firstPrize)}
                          </div>
                          <div className="text-[11px] font-sans text-muted tabular-nums">
                            ₹{scheme.price} ticket
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
