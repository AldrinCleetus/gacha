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
import { ChevronDown, ArrowDown, ArrowRight, Ticket as TicketIcon, Calendar, ChevronRight } from "lucide-react";
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
      return `${formattedDate} draw`;
    } catch {
      return `${draw.id} draw`;
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between">
      {/* ABOVE THE FOLD: Hero Check Input */}
      <section className="min-h-[calc(100vh-140px)] flex flex-col items-center justify-center text-center py-6 sm:py-8 relative">
        <div className="w-full max-w-xl mx-auto space-y-4">
          {/* Scheme Chip Pill (slides in above heading when letter typed) */}
          <div className="h-7 flex items-center justify-center">
            {firstLetter && <SchemeChip firstLetter={firstLetter} />}
          </div>

          {/* Heading & Subtitle exactly matching screenshot */}
          <div className="space-y-1.5">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-main">
              Check your ticket
            </h1>
            <p className="text-xs sm:text-sm text-muted font-normal max-w-md mx-auto">
              Enter your 8-character ticket series and number to see today&apos;s result.
            </p>
          </div>

          {/* Giant Card matching the screenshot */}
          <div className="w-full bg-surface rounded-3xl sm:rounded-4xl p-5 sm:p-8 border border-border shadow-soft space-y-5 my-2">
            {/* Segmented 8-char Input */}
            <div className="w-full">
              <SegmentedInput
                value={characters}
                onChange={setCharacters}
                onComplete={() => {}}
              />
            </div>

            {/* Scheduled Draw row */}
            <div className="flex items-center justify-between text-xs text-muted pt-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-main">Scheduled Draw:</span>
                <div className="relative inline-block">
                  <select
                    value={selectedDrawId}
                    onChange={(e) => setSelectedDrawId(e.target.value)}
                    className="appearance-none bg-input-box border border-input-border rounded-full py-1.5 pl-7 pr-8 text-xs font-semibold text-main focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                    aria-label="Select Draw"
                  >
                    {draws.map((d) => (
                      <option key={d.id} value={d.id}>
                        {formatDrawLabel(d)} {d.isDrawnToday ? "· Drawn today" : ""} {!d.isPublished ? "(Pending)" : ""}
                      </option>
                    ))}
                  </select>
                  <Calendar className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Full-width Green Button */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleCheck}
              disabled={!isComplete}
              className={`w-full py-4 px-6 rounded-2xl font-bold text-sm sm:text-base shadow-soft transition-all duration-200 flex items-center justify-center gap-2 ${
                isComplete
                  ? "bg-primary hover:bg-primary-hover text-white shadow-card cursor-pointer"
                  : "bg-surface border border-border text-subtle cursor-not-allowed opacity-60"
              }`}
            >
              <span>Check ticket</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </div>

          {/* Quick Demo Fill Chips */}
          <div className="pt-1 flex flex-wrap items-center justify-center gap-1.5 text-xs">
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

        {/* Scroll cue matching screenshot */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-[11px] text-subtle">
          <span>Scroll for recent results &amp; tracker</span>
          <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
        </div>
      </section>

      {/* BELOW THE FOLD: Side-by-side Recent results & Your recent tickets */}
      <section className="pt-12 pb-8 border-t border-border/60 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent results */}
          <div className="bg-surface rounded-3xl p-5 sm:p-6 border border-border shadow-soft space-y-3">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-sm font-bold text-main">Recent results</h2>
              <span className="text-xs text-subtle font-medium">Last 4 draws</span>
            </div>

            <div className="space-y-2">
              {draws.slice(0, 4).map((draw) => {
                const scheme = getScheme(draw.schemeCode);
                return (
                  <Link
                    key={draw.id}
                    to={`/results/${draw.id}`}
                    className="flex items-center justify-between p-3 rounded-2xl hover:bg-input-box/60 border border-border/60 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs"
                        style={{
                          backgroundColor: scheme.theme.bg,
                          color: scheme.theme.text,
                        }}
                      >
                        {scheme.code}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-main flex items-center gap-1.5">
                          <span>{scheme.name} {draw.id}</span>
                          {draw.isDrawnToday && (
                            <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-primary/10 text-primary">
                              Drawn today
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted">
                          {new Date(draw.drawDate).toLocaleDateString("en-IN", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })} · 1st: {draw.prizes ? formatINR(draw.prizes.firstPrize.amount) : "Pending"}
                        </div>
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-subtle" />
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Your recent tickets */}
          <div className="bg-surface rounded-3xl p-5 sm:p-6 border border-border shadow-soft space-y-3">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-sm font-bold text-main">Your recent tickets</h2>
              <Link to="/tickets" className="text-xs text-subtle font-medium hover:text-main">
                {recentTickets.length} recorded
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
              <div className="space-y-2">
                {recentTickets.map((tkt) => {
                  const isWin = (tkt.wonAmount || 0) > 0;
                  const scheme = getScheme(tkt.schemeCode);
                  return (
                    <div
                      key={tkt.id}
                      className="flex items-center justify-between p-3 rounded-2xl border border-border/60"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-main">
                            {tkt.ticketString}
                          </span>
                          <span className="text-[11px] text-subtle">
                            · {scheme.name} {tkt.drawId}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted mt-0.5">
                          {tkt.result?.tier || (isWin ? "Prize match" : "No winning matches")}
                        </div>
                      </div>

                      <div>
                        {isWin ? (
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gold-bg text-gold-text border border-gold-border font-mono">
                            {formatINR(tkt.wonAmount)}
                          </span>
                        ) : (
                          <span className="text-xs text-subtle font-medium px-2 py-0.5 rounded-full bg-input-box">
                            Not drawn
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
