import React from "react";
import { getScheme } from "@/lib/schemes";
import { motion, AnimatePresence } from "framer-motion";

interface SchemeChipProps {
  firstLetter: string;
  drawId?: string;
}

export function SchemeChip({ firstLetter, drawId = "W-790" }: SchemeChipProps) {
  if (!firstLetter) return null;

  const scheme = getScheme(firstLetter);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.96 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold select-none bg-input-box border border-input-border text-main shadow-soft"
      >
        <span className="w-2 h-2 rounded-full bg-primary" />
        <span className="font-bold">{scheme.name} {drawId}</span>
        <span className="text-subtle">·</span>
        <span className="text-muted">₹{scheme.price} per ticket</span>
      </motion.div>
    </AnimatePresence>
  );
}
