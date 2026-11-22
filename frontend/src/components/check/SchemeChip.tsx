import React from "react";
import { getScheme } from "@/lib/schemes";
import { motion, AnimatePresence } from "framer-motion";

interface SchemeChipProps {
  firstLetter: string;
}

export function SchemeChip({ firstLetter }: SchemeChipProps) {
  if (!firstLetter) return null;

  const scheme = getScheme(firstLetter);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 450, damping: 25 }}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold select-none shadow-soft"
        style={{
          backgroundColor: scheme.theme.bg,
          color: scheme.theme.text,
          border: `1px solid ${scheme.theme.border}`,
        }}
      >
        <span className="font-bold">{scheme.name}</span>
        <span className="opacity-40">·</span>
        <span>₹{scheme.price} per ticket</span>
        <span className="opacity-40">·</span>
        <span className="opacity-80">{scheme.weekday} draw</span>
      </motion.div>
    </AnimatePresence>
  );
}
