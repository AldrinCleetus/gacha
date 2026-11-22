"use client";

import React from "react";
import { getScheme } from "@/lib/schemes";
import { Calendar, Tag, Trophy } from "lucide-react";
import { motion } from "framer-motion";

interface SchemeChipProps {
  firstChar: string;
}

export function SchemeChip({ firstChar }: SchemeChipProps) {
  if (!firstChar) return null;

  const scheme = getScheme(firstChar);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="inline-flex items-center gap-2 sm:gap-3 px-3.5 py-1.5 rounded-2xl border shadow-sm transition-all text-xs select-none"
      style={{
        backgroundColor: scheme.theme.bgLight,
        borderColor: scheme.theme.borderLight,
        color: scheme.theme.primary,
      }}
    >
      <div
        className="w-5 h-5 rounded-lg flex items-center justify-center font-black text-white text-[11px] shadow-sm shrink-0"
        style={{ backgroundColor: scheme.theme.primary }}
      >
        {scheme.code}
      </div>

      <div className="flex items-center gap-2 font-semibold">
        <span className="font-bold text-slate-900 dark:text-slate-100">{scheme.name}</span>
        <span className="text-slate-400">•</span>
        <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
          <Tag className="w-3 h-3 opacity-70" />
          ₹{scheme.price}
        </span>
        <span className="text-slate-400 hidden sm:inline">•</span>
        <span className="hidden sm:flex items-center gap-1 text-slate-500 dark:text-slate-400">
          <Calendar className="w-3 h-3 opacity-70" />
          {scheme.weekday}
        </span>
        <span className="text-slate-400 hidden sm:inline">•</span>
        <span className="hidden sm:flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
          <Trophy className="w-3 h-3 opacity-80" />
          {scheme.firstPrize}
        </span>
      </div>
    </motion.div>
  );
}
