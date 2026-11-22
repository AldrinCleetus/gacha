"use client";

import React from "react";
import { Draw } from "@/types/lottery";
import { Calendar, ChevronDown, CheckCircle2 } from "lucide-react";

interface DrawSelectorProps {
  draws: Draw[];
  selectedDrawId: string;
  onSelectDraw: (drawId: string) => void;
  disabled?: boolean;
}

export function DrawSelector({
  draws,
  selectedDrawId,
  onSelectDraw,
  disabled = false,
}: DrawSelectorProps) {
  const selectedDraw = draws.find((d) => d.id === selectedDrawId) || draws[0];

  if (!selectedDraw) return null;

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 px-1">
        <span>Target Draw</span>
        <span className="text-[11px] font-normal text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Latest Official
        </span>
      </div>

      <div className="relative">
        <select
          value={selectedDrawId}
          onChange={(e) => onSelectDraw(e.target.value)}
          disabled={disabled}
          aria-label="Select Lottery Draw"
          className="w-full appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl py-2.5 pl-3.5 pr-10 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 cursor-pointer disabled:opacity-50"
        >
          {draws.map((d) => (
            <option key={d.id} value={d.id}>
              {d.id} • {formatDate(d.drawDate)} (1st: ₹{d.prizes.firstPrize.amount >= 10000000 ? `${d.prizes.firstPrize.amount / 10000000} Cr` : `${d.prizes.firstPrize.amount / 100000} Lakhs`})
            </option>
          ))}
        </select>
        <ChevronDown className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
}
