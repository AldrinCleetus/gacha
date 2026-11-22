import React, { useRef } from "react";
import { parseTicket } from "@/lib/parser";

interface SegmentedInputProps {
  value: string[]; // 8 characters
  onChange: (newValue: string[]) => void;
  onComplete?: (fullString: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
}

export function SegmentedInput({
  value,
  onChange,
  onComplete,
  onSubmit,
  disabled = false,
}: SegmentedInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === "Enter") {
      e.preventDefault();
      const full = value.join("");
      if (full.length === 8) {
        if (onSubmit) {
          onSubmit();
        } else if (onComplete) {
          onComplete(full);
        }
      }
      return;
    }

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
    }
  };

  const handleInput = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const raw = e.target.value.toUpperCase();
    if (!raw) {
      const next = [...value];
      next[index] = "";
      onChange(next);
      return;
    }

    const lastChar = raw.slice(-1);

    // Box 0 & 1: Letters only
    if (index < 2) {
      if (!/^[A-Z]$/.test(lastChar)) return;
    } else {
      // Box 2..7: Digits only
      if (!/^[0-9]$/.test(lastChar)) return;
    }

    const next = [...value];
    next[index] = lastChar;
    onChange(next);

    // Auto-advance
    if (index < 7) {
      inputRefs.current[index + 1]?.focus();
      inputRefs.current[index + 1]?.select();
    } else {
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

    let lastFilled = -1;
    for (let i = chars.length - 1; i >= 0; i--) {
      if (chars[i]) {
        lastFilled = i;
        break;
      }
    }
    const focusTarget = lastFilled >= 0 && lastFilled < 7 ? lastFilled + 1 : 7;
    inputRefs.current[focusTarget]?.focus();

    if (parsed.isValid && onComplete) {
      onComplete(parsed.fullTicketString);
    }
  };

  return (
    <div className="w-full flex items-center justify-center select-none py-2">
      <div
        className="flex items-center justify-center gap-1.5 xs:gap-2 sm:gap-2.5 md:gap-3 lg:gap-3.5"
        role="group"
        aria-label="Lottery Number Input"
      >
        {/* Letters Section (Box 0 & 1) */}
        <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-2.5">
          {[0, 1].map((idx) => {
            const char = value[idx] || "";
            return (
              <input
                key={idx}
                ref={(el) => {
                  inputRefs.current[idx] = el;
                }}
                type="text"
                maxLength={1}
                value={char}
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
                aria-label={`Character ${idx + 1} of 8 (${idx === 0 ? "Scheme" : "Series"})`}
                className="w-9 h-14 xs:w-11 xs:h-16 sm:w-15 sm:h-20 md:w-18 md:h-24 lg:w-20 lg:h-26 text-center text-xl xs:text-2xl sm:text-3xl md:text-4xl font-extrabold rounded-xl sm:rounded-2xl border border-input-border/80 bg-input-box text-main focus:bg-surface focus:border-primary focus:ring-4 focus:ring-primary/15 outline-none transition-all duration-200 font-mono shadow-sm"
              />
            );
          })}
        </div>

        {/* Dot Separator */}
        <div className="flex items-center justify-center px-0.5 sm:px-1.5 text-muted">
          <span className="w-1.5 h-1.5 sm:w-2.5 sm:h-2.5 rounded-full bg-border/90" />
        </div>

        {/* 6 Digit Boxes (Box 2 to 7) */}
        <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-2.5">
          {[2, 3, 4, 5, 6, 7].map((idx) => {
            const char = value[idx] || "";
            return (
              <input
                key={idx}
                ref={(el) => {
                  inputRefs.current[idx] = el;
                }}
                type="text"
                maxLength={1}
                value={char}
                onChange={(e) => handleInput(idx, e)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                onPaste={handlePaste}
                onFocus={(e) => e.target.select()}
                disabled={disabled}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                aria-label={`Digit ${idx - 1} of 6`}
                className="w-9 h-14 xs:w-11 xs:h-16 sm:w-15 sm:h-20 md:w-18 md:h-24 lg:w-20 lg:h-26 text-center text-xl xs:text-2xl sm:text-3xl md:text-4xl font-extrabold rounded-xl sm:rounded-2xl border border-input-border/80 bg-input-box text-main focus:bg-surface focus:border-primary focus:ring-4 focus:ring-primary/15 outline-none transition-all duration-200 font-mono shadow-sm"
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
