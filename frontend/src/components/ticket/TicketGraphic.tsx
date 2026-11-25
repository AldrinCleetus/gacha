import React, { useMemo } from "react";
import { parseTicket } from "@/lib/parser";
import { getScheme } from "@/lib/schemes";
import { Lock, Calendar, CheckCircle2, ShieldCheck, Clock } from "lucide-react";
import { motion } from "framer-motion";

export type TicketState = "idle" | "scanning" | "won" | "lost";

export interface TicketGraphicProps {
  ticketString: string;
  schemeCode?: string;
  drawDate?: string;
  drawId?: string;
  price?: number;
  state?: TicketState;
  matchedIndices?: number[];
  activeJudgeIndex?: number; // character currently being inspected (0..7)
  size?: "sm" | "md" | "lg" | "responsive";
  className?: string;
  tierLabel?: string;
  seriesLabel?: string;
}

export function TicketGraphic({
  ticketString,
  schemeCode,
  drawDate = "Mon, 23 Nov 2026",
  drawId = "W-790",
  price,
  state = "idle",
  matchedIndices = [],
  activeJudgeIndex = -1,
  size = "responsive",
  className = "",
  tierLabel,
  seriesLabel,
}: TicketGraphicProps) {
  const parsed = useMemo(() => parseTicket(ticketString), [ticketString]);
  const chars = parsed.characters;
  const effectiveSchemeCode = schemeCode || parsed.schemeCode || "W";
  const scheme = getScheme(effectiveSchemeCode);

  // Formatted date
  const displayDate = useMemo(() => {
    try {
      const d = new Date(drawDate);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-IN", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      }
    } catch {
      // ignore
    }
    return drawDate;
  }, [drawDate]);

  // Clean draw number string (e.g. #790 from W-790)
  const drawNum = useMemo(() => {
    const match = drawId.match(/\d+/);
    return match ? `#${match[0]}` : drawId;
  }, [drawId]);

  // Reference code KL-YY-DRAWID
  const refCode = useMemo(() => {
    return `KL-23-${drawId.replace(/[^A-Z0-9]/gi, "").toUpperCase()}`;
  }, [drawId]);

  // Deterministic vertical barcode lines
  const barcodeBars = useMemo(() => {
    const raw = parsed.fullTicketString.replace(/[^A-Z0-9]/g, "");
    const bars: Array<{ width: number; gap: number }> = [];
    for (let i = 0; i < 24; i++) {
      const code = raw.charCodeAt(i % raw.length) || 65;
      const width = (code % 3) + 1.2;
      const gap = ((code * 3) % 4) + 1.5;
      bars.push({ width, gap });
    }
    return bars;
  }, [parsed.fullTicketString]);

  const sizeClasses = {
    sm: "max-w-xs",
    md: "max-w-md",
    lg: "max-w-xl",
    responsive: "w-full max-w-2xl",
  }[size];

  // Dynamic status text
  const statusInfo = useMemo(() => {
    const matchCount = matchedIndices.length;
    const isScanning = state === "scanning" || activeJudgeIndex >= 0;

    let text = "No positions matched";
    let isPositive = false;

    if (tierLabel === "Results Pending") {
      text = "Results awaiting official publication";
      isPositive = false;
    } else if (matchCount === 8) {
      text = "All 8 positions matched";
      isPositive = true;
    } else if (matchCount > 0) {
      text = `${matchCount} position${matchCount > 1 ? "s" : ""} matched`;
      isPositive = true;
    } else if (isScanning && activeJudgeIndex >= 0) {
      text = `Checking position ${activeJudgeIndex + 1} of 8…`;
      isPositive = false;
    }

    return { text, isPositive };
  }, [matchedIndices.length, state, activeJudgeIndex]);

  // Dynamic tier label
  const effectiveTier = useMemo(() => {
    if (tierLabel) return tierLabel;
    if (matchedIndices.length === 8) return "Prize Tier 01";
    if (matchedIndices.length >= 4) return "Prize Tier 05";
    if (matchedIndices.length > 0) return "Prize Tier 07";
    return state === "won" ? "Prize Winner" : "No Prize Tier";
  }, [tierLabel, matchedIndices.length, state]);

  // Series label
  const effectiveSeries = seriesLabel || `${scheme.name} series ${parsed.series || "W"}`;

  return (
    <div
      className={`relative bg-surface rounded-2xl sm:rounded-3xl border border-border shadow-soft select-text transition-colors duration-200 overflow-hidden w-full ${sizeClasses} ${className}`}
    >
      <div className="flex w-full min-h-[190px] sm:min-h-[230px]">
        {/* 1. Left Counterfoil Stub (~28-30% width) */}
        <div className="w-[30%] min-w-[125px] sm:min-w-[165px] p-3 sm:p-5 flex flex-col justify-between border-r-2 border-dashed border-border/80 relative bg-surface">
          {/* Top Row: WEEKLY DRAW & #790 */}
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] sm:text-xs font-bold text-muted tracking-wider uppercase font-sans truncate">
              WEEKLY DRAW
            </span>
            <span className="text-[11px] sm:text-sm font-bold text-slate-700 dark:text-slate-300 font-mono shrink-0">
              {drawNum}
            </span>
          </div>

          {/* Scheme Name & Calendar Date */}
          <div className="space-y-0.5 my-1">
            <h2 className="text-base sm:text-xl md:text-2xl font-black text-main tracking-tight uppercase font-sans truncate">
              {scheme.name}
            </h2>
            <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted font-medium font-sans">
              <Calendar className="w-3 h-3 text-muted shrink-0" />
              <span className="truncate">{displayDate}</span>
            </div>
          </div>

          {/* Ticket Reference Header & Code */}
          <div className="space-y-0.5">
            <span className="text-[8px] sm:text-[10px] font-bold text-subtle tracking-wider uppercase block font-sans">
              TICKET REFERENCE
            </span>
            <span className="font-mono text-[11px] sm:text-sm font-black text-main block tracking-wide truncate">
              {refCode}
            </span>
          </div>

          {/* Barcode & Subtle Watermark Motif */}
          <div className="relative pt-1">
            <div className="flex items-end h-6 sm:h-7 gap-[1.5px] overflow-hidden w-full opacity-85">
              {barcodeBars.map((bar, idx) => (
                <div
                  key={idx}
                  className="bg-slate-800 dark:bg-slate-200 h-full rounded-[0.5px]"
                  style={{ width: `${bar.width * 1.5}px` }}
                />
              ))}
            </div>

            {/* Subtle organic watermark leaf in bottom-right corner of stub */}
            <svg
              className="absolute right-0 bottom-0 w-10 h-10 sm:w-12 sm:h-12 text-slate-300 dark:text-slate-700 pointer-events-none opacity-40 -mr-2 -mb-2"
              viewBox="0 0 60 60"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M 10 50 C 20 20, 50 10, 50 50 Z" />
              <path d="M 10 50 C 30 30, 40 40, 50 50" />
            </svg>
          </div>

          {/* Perforation Circular Notches at Top & Bottom */}
          <div
            className="absolute top-0 -mt-2 -right-2 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-page border border-border z-10"
            aria-hidden="true"
          />
          <div
            className="absolute bottom-0 -mb-2 -right-2 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-page border border-border z-10"
            aria-hidden="true"
          />
        </div>

        {/* 2. Right Main Ticket Body (~70% width) */}
        <div className="flex-1 min-w-0 p-3 sm:p-5 flex flex-col justify-between gap-2 sm:gap-3.5 relative bg-surface">
          {/* Top Header: REGISTERED SERIAL NUMBER & Confirmed Pill */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] sm:text-xs font-bold text-muted tracking-wider uppercase font-sans truncate">
              REGISTERED SERIAL NUMBER
            </span>

            {/* Confirmed Pill Badge: Crisp Lucide Lock + Confirmed Text with generous gap */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 text-[10px] sm:text-[11px] font-bold shadow-2xs shrink-0">
              <Lock className="w-3 h-3 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <span>Confirmed</span>
            </div>
          </div>

          {/* 8 Squircle Character Boxes */}
          <div className="grid grid-cols-8 gap-1 sm:gap-2 w-full my-auto">
            {chars.map((char, i) => {
              const isMatched = matchedIndices.includes(i);
              const isJudging = activeJudgeIndex === i;

              let boxClasses = "bg-input-box border-input-border/70 text-main";

              if (isMatched) {
                // Warm Amber Gold match styling
                boxClasses =
                  "bg-[#FEF3C7] dark:bg-amber-950/60 border-[#FCD34D] dark:border-amber-600 text-[#92400E] dark:text-amber-300 shadow-sm ring-1 ring-amber-300/40";
              } else if (isJudging) {
                // Active scanning glow
                boxClasses =
                  "bg-primary/10 border-primary text-primary ring-2 ring-primary/25 scale-105";
              } else if (state === "lost") {
                boxClasses = "bg-input-box/70 border-border text-subtle";
              }

              return (
                <div
                  key={i}
                  className={`aspect-[4/5] rounded-lg sm:rounded-xl border flex items-center justify-center font-mono font-extrabold text-sm sm:text-xl md:text-2xl transition-all duration-150 min-w-0 ${boxClasses}`}
                >
                  <span className="truncate">{char || "-"}</span>
                </div>
              );
            })}
          </div>

          {/* Status Row under Character Boxes: Positions Matched & Series */}
          <div className="flex items-center justify-between gap-2 pt-0.5 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              {tierLabel === "Results Pending" ? (
                <Clock className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              ) : (
                <CheckCircle2
                  className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                    statusInfo.isPositive
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted"
                  }`}
                />
              )}
              <span
                className={`text-[11px] sm:text-xs font-bold truncate transition-colors ${
                  tierLabel === "Results Pending"
                    ? "text-amber-700 dark:text-amber-400"
                    : statusInfo.isPositive
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-muted"
                }`}
              >
                {statusInfo.text}
              </span>
            </div>

            <span className="font-mono text-[11px] sm:text-xs font-bold text-muted shrink-0 text-right">
              {effectiveSeries}
            </span>
          </div>

          {/* Security Row: Cryptographically matched sequence & Prize Tier */}
          <div className="flex items-center justify-between gap-2 text-[10px] sm:text-[11px] min-w-0">
            <div className="flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-400 min-w-0 truncate">
              {tierLabel === "Results Pending" ? (
                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              )}
              <span className="truncate">
                {tierLabel === "Results Pending"
                  ? "Scheduled for Kerala Std Time 15:00"
                  : statusInfo.isPositive
                  ? "Cryptographically matched sequence"
                  : "Sequence verified against draw"}
              </span>
            </div>

            <span
              className={`font-mono font-bold shrink-0 text-right ${
                tierLabel === "Results Pending"
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              {effectiveTier}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Laser Sweep Scan Overlay (During scanning state) */}
      {state === "scanning" && (
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: "250%" }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
          className="absolute inset-y-0 w-32 bg-gradient-to-r from-transparent via-primary/25 to-transparent pointer-events-none"
        />
      )}
    </div>
  );
}
