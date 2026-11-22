"use client";

import React, { useRef, useEffect } from "react";
import { parseTicket } from "@/lib/parser";

interface SegmentedInputProps {
  value: string[]; // 8 characters
  onChange: (newValue: string[]) => void;
  onComplete?: (fullString: string) => void;
  schemeColor?: string;
  disabled?: boolean;
}

export function SegmentedInput({
  value,
  onChange,
  onComplete,
  schemeColor,
  disabled = false,
}: SegmentedInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first empty or first input on mount
  useEffect(() => {
    const firstEmptyIndex = value.findIndex((char) => !char);
    const targetIndex = firstEmptyIndex === -1 ? 0 : firstEmptyIndex;
    if (inputRefs.current[targetIndex]) {
      // Don't autofocus aggressively on mobile to prevent unwanted keyboard popups
      if (window.innerWidth > 768) {
        inputRefs.current[targetIndex]?.focus();
      }
    }
  }, []);

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...value];
      if (next[index]) {
        next[index] = "";
        onChange(next);
      } else if (index > 0) {
        next[index - 1] = "";
        onChange(next);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        inputRefs.current[index - 1]?.select();
      }
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (index < 7) {
        inputRefs.current[index + 1]?.focus();
        inputRefs.current[index + 1]?.select();
      }
    } else if (e.key === "Delete") {
      e.preventDefault();
      const next = [...value];
      next[index] = "";
      onChange(next);
    }
  };

  const handleInput = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const rawChar = e.target.value.toUpperCase();
    if (!rawChar) {
      const next = [...value];
      next[index] = "";
      onChange(next);
      return;
    }

    const lastChar = rawChar.slice(-1);

    // Box 0 & 1: Letters only
    if (index < 2) {
      if (!/^[A-Z]$/.test(lastChar)) {
        return;
      }
    } else {
      // Box 2..7: Digits only
      if (!/^[0-9]$/.test(lastChar)) {
        return;
      }
    }

    const next = [...value];
    next[index] = lastChar;
    onChange(next);

    // Advance focus
    if (index < 7) {
      inputRefs.current[index + 1]?.focus();
      inputRefs.current[index + 1]?.select();
    } else {
      // Complete!
      const full = next.join("");
      if (full.length === 8 && onComplete) {
        onComplete(full);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (disabled) return;
    const pasted = e.clipboardData.getData("text");
    if (!pasted) return;

    const parsed = parseTicket(pasted);
    const chars = [...parsed.characters];
    onChange(chars);

    // Focus last character or submit
    const lastFilled = chars.findLastIndex((c) => c !== "");
    const focusTarget = lastFilled >= 0 && lastFilled < 7 ? lastFilled + 1 : 7;
    inputRefs.current[focusTarget]?.focus();

    if (parsed.isValid && onComplete) {
      onComplete(parsed.fullTicketString);
    }
  };

  return (
    <div className="w-full flex flex-col items-center select-none">
      <div
        className="flex items-center justify-center gap-1.5 sm:gap-2.5 w-full max-w-xl mx-auto py-2"
        role="group"
        aria-label="Kerala Lottery 8-Character Ticket Number Input"
      >
        {/* Letters Section (Box 0 & 1) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {[0, 1].map((idx) => {
            const isFilled = Boolean(value[idx]);
            const isSchemeBox = idx === 0;
            return (
              <input
                key={idx}
                ref={(el) => {
                  inputRefs.current[idx] = el;
                }}
                type="text"
                maxLength={1}
                value={value[idx] || ""}
                onChange={(e) => handleInput(idx, e)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                onPaste={handlePaste}
                onFocus={(e) => e.target.select()}
                disabled={disabled}
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                aria-label={`Character ${idx + 1} of 8 (${isSchemeBox ? "Scheme Letter" : "Series Letter"})`}
                className={`w-11 h-14 sm:w-14 sm:h-18 md:w-16 md:h-20 text-center text-xl sm:text-2xl md:text-3xl font-black rounded-2xl border-2 transition-all duration-200 outline-none tabular-nums font-mono ${
                  isFilled
                    ? "border-emerald-500/80 dark:border-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-emerald-500/20"
                    : "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-emerald-500/20"
                }`}
                style={
                  schemeColor && isFilled
                    ? { borderColor: schemeColor }
                    : undefined
                }
              />
            );
          })}
        </div>

        {/* Separator Divider */}
        <div className="flex flex-col items-center justify-center px-0.5 sm:px-1.5 text-slate-400 dark:text-slate-600 font-black">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mb-1" />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* 6 Digit Boxes (Box 2 to 7) */}
        <div className="flex items-center gap-1 sm:gap-2">
          {[2, 3, 4, 5, 6, 7].map((idx) => {
            const isFilled = Boolean(value[idx]);
            return (
              <input
                key={idx}
                ref={(el) => {
                  inputRefs.current[idx] = el;
                }}
                type="text"
                maxLength={1}
                value={value[idx] || ""}
                onChange={(e) => handleInput(idx, e)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                onPaste={handlePaste}
                onFocus={(e) => e.target.select()}
                disabled={disabled}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                aria-label={`Digit ${idx - 1} of 6`}
                className={`w-9 h-14 sm:w-12 sm:h-18 md:w-14 md:h-20 text-center text-xl sm:text-2xl md:text-3xl font-black rounded-2xl border-2 transition-all duration-200 outline-none tabular-nums font-mono ${
                  isFilled
                    ? "border-emerald-500/80 dark:border-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-emerald-500/20"
                    : "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-emerald-500/20"
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Helper caption */}
      <div className="flex items-center justify-between w-full max-w-xl px-2 mt-2 text-xs text-slate-400 dark:text-slate-500">
        <span className="flex items-center gap-1">
          <span className="font-semibold text-slate-600 dark:text-slate-300">Format:</span> 2 Letters (Series) + 6 Digits
        </span>
        {value.some(Boolean) && (
          <button
            type="button"
            onClick={() => onChange(["", "", "", "", "", "", "", ""])}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline underline-offset-2 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
