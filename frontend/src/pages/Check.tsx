import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { SegmentedInput } from "@/components/check/SegmentedInput";
import { SchemeChip } from "@/components/check/SchemeChip";
import { parseTicket } from "@/lib/parser";
import { checkTicket, formatINR } from "@/lib/checkTicket";
import { mockLotteryApi } from "@/lib/mockApi";
import { Draw, SavedTicket } from "@/types";
import { useCheckStore } from "@/store/useCheckStore";
import { useDemoStore } from "@/store/useDemoStore";
import { getScheme } from "@/lib/schemes";
import { ChevronDown, ArrowDown, Sparkles, ArrowRight, Ticket as TicketIcon } from "lucide-react";
import { motion } from "framer-motion";

export function Check() {
  const navigate = useNavigate();
  const {
    characters,
    setCharacters,
    selectedDrawId,
    setSelectedDrawId,
    setLastResult,
  } = useCheckStore();
  const { forcedOutcome } = useDemoStore();

  const [draws, setDraws] = useState<Draw[]>([]);
  const [recentTickets, setRecentTickets] = useState<SavedTicket[]>([]);

  useEffect(() => {
    mockLotteryApi.getDraws().then((d) => {
      setDraws(d);
      if (!selectedDrawId && d.length > 0) {
        // Default to latest published draw
        const latestPublished = d.find((draw) => draw.isPublished) || d[0];
        setSelectedDrawId(latestPublished.id);
      }
    });

    mockLotteryApi.getHistory().then((history) => {
      setRecentTickets(history.slice(0, 5));
    });
  }, [selectedDrawId, setSelectedDrawId]);

  const firstLetter = characters[0] || "";
  const parsed = parseTicket(characters.join(""));
  const isComplete = parsed.isValid;

  // Auto-switch draw when first letter changes if matching draw exists
  useEffect(() => {
    if (firstLetter && draws.length > 0) {
      const match = draws.find(
        (d) => d.isPublished && d.schemeCode.toUpperCase() === firstLetter.toUpperCase()
      );
      if (match) {
        setSelectedDrawId(match.id);
      }
    }
  }, [firstLetter, draws, setSelectedDrawId]);

  const activeDraw = draws.find((d) => d.id === selectedDrawId) || draws[0];

  const handleCheck = () => {
    if (!isComplete || !activeDraw) return;

    const result = checkTicket(parsed, activeDraw, forcedOutcome);
    setLastResult(result, false);

    // Save ticket uniquely to mock history
    mockLotteryApi.saveTicket({
      id: `tkt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ticketString: parsed.fullTicketString,
      schemeCode: parsed.schemeCode,
      series: parsed.series,
      digits: parsed.digits,
      drawId: activeDraw.id,
      drawDate: activeDraw.drawDate,
      checkedAt: new Date().toISOString(),
      cost: 40,
      wonAmount: result.amount,
      result,
    });

    // Screen reader announcement
    const live = document.getElementById("a11y-live-region");
    if (live) {
      live.textContent = `Checking ticket ${parsed.fullTicketString} against draw ${activeDraw.id}`;
    }

    navigate("/check/reveal");
  };

  const handleFillSample = (sample: string) => {
    const p = parseTicket(sample);
    setCharacters([...p.characters]);
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
      return `${formattedDate} draw (${draw.id})`;
    } catch {
      return `${draw.id} draw`;
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between">
      {/* ABOVE THE FOLD: Hero Check Input */}
      <section className="min-h-[calc(100vh-140px)] flex flex-col items-center justify-center text-center py-8 relative">
        <div className="w-full max-w-xl mx-auto space-y-4">
          {/* Header */}
          <div className="space-y-1.5">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-main">
              Check your ticket
            </h1>
            <p className="text-sm sm:text-base text-muted font-normal">
              Enter your 8-character Kerala ticket number to check results.
            </p>
          </div>

          {/* Scheme Chip placeholder (slides in after first letter is typed) */}
          <div className="h-8 flex items-center justify-center">
            {firstLetter && <SchemeChip firstLetter={firstLetter} />}
          </div>

          {/* Giant Segmented Input */}
          <div className="w-full my-4">
            <SegmentedInput
              value={characters}
              onChange={setCharacters}
              onComplete={() => {}}
            />
          </div>

          {/* Draw Selector Pill & Check Button */}
          <div className="w-full max-w-md mx-auto space-y-3 pt-2">
            {/* Draw Pill */}
            <div className="relative inline-block w-full">
              <select
                value={selectedDrawId}
                onChange={(e) => setSelectedDrawId(e.target.value)}
                className="w-full appearance-none bg-surface border border-border rounded-full py-2.5 pl-5 pr-10 text-xs sm:text-sm font-semibold text-main shadow-soft focus:outline-none focus:ring-2 focus:ring-primary/20 text-center cursor-pointer"
                aria-label="Select Draw"
              >
                {draws.map((d) => (
                  <option key={d.id} value={d.id}>
                    {formatDrawLabel(d)} {d.isDrawnToday ? "· Drawn today" : ""} {!d.isPublished ? "(Pending)" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            </div>

            {/* Check Button */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleCheck}
              disabled={!isComplete}
              className={`w-full py-3.5 sm:py-4 px-6 rounded-2xl font-bold text-base shadow-soft transition-all duration-200 flex items-center justify-center gap-2 ${
                isComplete
                  ? "bg-primary hover:bg-primary-hover text-white shadow-card cursor-pointer"
                  : "bg-surface border border-border text-subtle cursor-not-allowed opacity-60"
              }`}
            >
              <span>Check ticket</span>
              {isComplete && <ArrowRight className="w-4 h-4" />}
            </motion.button>

            {/* Quick Demo Fill Chips (Subtle helper) */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-1.5 text-xs">
              <span className="text-subtle text-[11px]">Quick test:</span>
              <button
                type="button"
                onClick={() => handleFillSample("WA 584920")}
                className="px-2 py-0.5 rounded-lg bg-surface border border-border hover:bg-input-box text-muted font-mono"
              >
                Jackpot
              </button>
              <button
                type="button"
                onClick={() => handleFillSample("WB 584920")}
                className="px-2 py-0.5 rounded-lg bg-surface border border-border hover:bg-input-box text-muted font-mono"
              >
                Consolation
              </button>
              <button
                type="button"
                onClick={() => handleFillSample("WA 114920")}
                className="px-2 py-0.5 rounded-lg bg-surface border border-border hover:bg-input-box text-muted font-mono"
              >
                Last-4
              </button>
              <button
                type="button"
                onClick={() => handleFillSample("WA 999999")}
                className="px-2 py-0.5 rounded-lg bg-surface border border-border hover:bg-input-box text-muted font-mono"
              >
                No win
              </button>
            </div>
          </div>
        </div>

        {/* Scroll cue at the bottom of first viewport */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-xs text-subtle animate-bounce">
          <span>Scroll for recent results</span>
          <ArrowDown className="w-3.5 h-3.5" />
        </div>
      </section>

      {/* BELOW THE FOLD: Recent results & Your recent tickets */}
      <section className="pt-12 pb-8 border-t border-border/60">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent results */}
          <div className="bg-surface rounded-3xl p-5 sm:p-6 border border-border shadow-soft space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-main">Recent results</h2>
              <Link to="/results" className="text-xs font-semibold text-primary hover:underline">
                View all
              </Link>
            </div>

            <div className="space-y-2.5">
              {draws.slice(0, 4).map((draw) => {
                const scheme = getScheme(draw.schemeCode);
                return (
                  <Link
                    key={draw.id}
                    to={`/results/${draw.id}`}
                    className="flex items-center justify-between p-3 rounded-2xl hover:bg-input-box/70 border border-border/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs"
                        style={{
                          backgroundColor: scheme.theme.bg,
                          color: scheme.theme.text,
                        }}
                      >
                        {scheme.code}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-main flex items-center gap-1.5">
                          <span>{scheme.name}</span>
                          <span className="text-xs text-subtle font-normal font-mono">
                            {draw.id}
                          </span>
                          {draw.isDrawnToday && (
                            <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-primary/10 text-primary">
                              Drawn today
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted">
                          {new Date(draw.drawDate).toLocaleDateString("en-IN", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      {draw.isPublished && draw.prizes ? (
                        <>
                          <div className="text-xs font-bold text-main font-mono">
                            {draw.prizes.firstPrize.series} {draw.prizes.firstPrize.number}
                          </div>
                          <div className="text-[11px] text-muted">
                            1st: {draw.prizes.firstPrize.amount >= 10000000 ? `${draw.prizes.firstPrize.amount / 10000000} Cr` : `${draw.prizes.firstPrize.amount / 100000} Lakhs`}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-muted italic">Pending</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Your recent tickets */}
          <div className="bg-surface rounded-3xl p-5 sm:p-6 border border-border shadow-soft space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-main">Your recent tickets</h2>
              <Link to="/tickets" className="text-xs font-semibold text-primary hover:underline">
                View all
              </Link>
            </div>

            {recentTickets.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <TicketIcon className="w-8 h-8 text-subtle mx-auto" />
                <p className="text-xs text-muted">
                  No tickets checked yet. Enter your ticket above to see your history.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentTickets.map((tkt) => {
                  const isWin = (tkt.wonAmount || 0) > 0;
                  return (
                    <div
                      key={tkt.id}
                      className="flex items-center justify-between p-3 rounded-2xl border border-border/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-bold text-main">
                          {tkt.ticketString}
                        </span>
                        <span className="text-xs text-muted font-mono">{tkt.drawId}</span>
                      </div>

                      <div>
                        {isWin ? (
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gold-bg text-gold-text border border-gold-border font-mono">
                            +{formatINR(tkt.wonAmount)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted font-medium px-2 py-0.5 rounded-full bg-input-box">
                            No prize
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer declaration */}
        <footer className="mt-12 text-center text-xs text-subtle max-w-lg mx-auto">
          gacha is an independent result checker, not affiliated with Kerala State Lotteries. Always confirm prizes with the official results.
        </footer>
      </section>
    </div>
  );
}
