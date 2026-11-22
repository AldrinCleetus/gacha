import React, { useMemo } from "react";
import { parseTicket } from "@/lib/parser";
import { getScheme } from "@/lib/schemes";

export type TicketState = "idle" | "scanning" | "won" | "lost";

export interface TicketGraphicProps {
  ticketString: string;
  schemeCode?: string;
  drawDate?: string;
  drawId?: string;
  price?: number;
  state?: TicketState;
  matchedIndices?: number[];
  activeJudgeIndex?: number; // character currently being compared (0..7)
  size?: "sm" | "md" | "lg" | "responsive";
  className?: string;
}

export function TicketGraphic({
  ticketString,
  schemeCode,
  drawDate = "23 NOV 2026",
  drawId = "W-790",
  price,
  state = "idle",
  matchedIndices = [],
  activeJudgeIndex = -1,
  size = "responsive",
  className = "",
}: TicketGraphicProps) {
  const parsed = useMemo(() => parseTicket(ticketString), [ticketString]);
  const chars = parsed.characters;
  const effectiveSchemeCode = schemeCode || parsed.schemeCode || "W";
  const scheme = getScheme(effectiveSchemeCode);
  const ticketPrice = price || scheme.price;

  // Deterministic decorative barcode bars based on ticket string
  const barcodeBars = useMemo(() => {
    const raw = parsed.fullTicketString.replace(/[^A-Z0-9]/g, "");
    const bars: Array<{ width: number; gap: number }> = [];
    for (let i = 0; i < raw.length; i++) {
      const code = raw.charCodeAt(i);
      bars.push({ width: (code % 3) + 1.2, gap: ((code * 3) % 4) + 1.2 });
      bars.push({ width: ((code * 7) % 3) + 1.0, gap: 1.5 });
      bars.push({ width: ((code * 11) % 2) + 1.6, gap: 2.0 });
    }
    return bars;
  }, [parsed.fullTicketString]);

  const sizeClasses = {
    sm: "max-w-xs",
    md: "max-w-md",
    lg: "max-w-xl",
    responsive: "w-full max-w-xl",
  }[size];

  return (
    <div className={`relative select-none ${sizeClasses} ${className}`}>
      <svg
        viewBox="0 0 500 230"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto overflow-visible rounded-3xl drop-shadow-md"
        role="img"
        aria-label={`Ticket ${parsed.fullTicketString}`}
      >
        <defs>
          {/* Subtle paper noise texture */}
          <filter id="ticketPaperTexture" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.9  0 0 0 0 0.9  0 0 0 0 0.9  0 0 0 0.04 0" />
            <feComposite in2="SourceGraphic" in="glitch" operator="in" />
          </filter>

          {/* Golden glow for wins */}
          <filter id="winGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#E3B957" floodOpacity="0.7" />
          </filter>

          {/* Cyan scan beam */}
          <linearGradient id="scanBeamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#5CC4AB" stopOpacity="0" />
            <stop offset="50%" stopColor="#5CC4AB" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#5CC4AB" stopOpacity="0" />
          </linearGradient>

          {/* Guilloche security pattern */}
          <pattern id="ticketGuilloche" width="30" height="30" patternUnits="userSpaceOnUse">
            <path
              d="M0 15 Q 7.5 5, 15 15 T 30 15 M0 7.5 Q 7.5 17.5, 15 7.5 T 30 7.5"
              fill="none"
              stroke={scheme.theme.primary}
              strokeWidth="0.4"
              strokeOpacity="0.07"
            />
          </pattern>
        </defs>

        {/* Outer Card Background */}
        <rect
          x="3"
          y="3"
          width="494"
          height="224"
          rx="22"
          fill="var(--color-surface, #ffffff)"
          stroke={state === "won" ? "var(--color-gold-border, #F7D78A)" : "var(--color-border, #D8EFE4)"}
          strokeWidth={state === "won" ? "2" : "1.5"}
          className="transition-colors duration-300"
        />

        {/* Guilloche watermark */}
        <rect x="3" y="3" width="494" height="224" rx="22" fill="url(#ticketGuilloche)" />

        {/* Top Header Ribbon in Scheme Tint */}
        <path
          d="M 3 24 C 3 12 12 3 24 3 L 476 3 C 488 3 497 12 497 24 L 497 48 L 3 48 Z"
          fill={scheme.theme.bg}
          className="transition-colors duration-300"
        />

        {/* Scheme Wordmark on ribbon */}
        <text
          x="24"
          y="28"
          fill={scheme.theme.text}
          fontSize="13"
          fontWeight="700"
          letterSpacing="1"
          fontFamily="Manrope, system-ui, sans-serif"
        >
          {scheme.name.toUpperCase()}
        </text>

        <text
          x="24"
          y="41"
          fill={scheme.theme.text}
          fontSize="9"
          fontWeight="500"
          opacity="0.8"
          fontFamily="Manrope, system-ui, sans-serif"
        >
          {scheme.weekday.toUpperCase()} DRAW · {drawId}
        </text>

        {/* Price Badge */}
        <rect
          x="424"
          y="12"
          width="54"
          height="24"
          rx="12"
          fill="var(--color-surface, #ffffff)"
          stroke={scheme.theme.border}
          strokeWidth="1"
        />
        <text
          x="451"
          y="28"
          fill={scheme.theme.text}
          fontSize="11"
          fontWeight="700"
          textAnchor="middle"
          fontFamily="Manrope, system-ui, sans-serif"
        >
          ₹{ticketPrice}
        </text>

        {/* Perforation Line & Notches */}
        <g stroke="var(--color-border, #D8EFE4)">
          {/* Top Notch */}
          <path d="M 115 3 A 8 8 0 0 1 115 19" fill="var(--color-page-bg, #EBF9F3)" strokeWidth="1.2" />
          {/* Dashed line */}
          <line
            x1="115"
            y1="19"
            x2="115"
            y2="211"
            strokeDasharray="4 4"
            strokeWidth="1.5"
            strokeOpacity="0.8"
          />
          {/* Bottom Notch */}
          <path d="M 115 227 A 8 8 0 0 1 115 211" fill="var(--color-page-bg, #EBF9F3)" strokeWidth="1.2" />
        </g>

        {/* Left Counterfoil Stub */}
        <g transform="translate(18, 62)">
          <text
            x="0"
            y="12"
            fill="var(--color-muted, #5B6F68)"
            fontSize="9"
            fontWeight="600"
            letterSpacing="0.5"
            fontFamily="Manrope, system-ui, sans-serif"
          >
            STUB
          </text>
          <text
            x="0"
            y="28"
            fill="var(--color-text, #0F1F1A)"
            fontSize="11"
            fontWeight="700"
            fontFamily="DM Mono, monospace"
          >
            {parsed.series || "--"}
          </text>
          <text
            x="0"
            y="44"
            fill="var(--color-subtle, #89A098)"
            fontSize="9"
            fontWeight="500"
            fontFamily="Manrope, system-ui, sans-serif"
          >
            {drawDate}
          </text>

          {/* Barcode on stub */}
          <g transform="translate(0, 56)">
            {barcodeBars.slice(0, 14).map((bar, idx) => (
              <rect
                key={idx}
                x={idx * 5.2}
                y="0"
                width={bar.width}
                height="40"
                fill="var(--color-muted, #5B6F68)"
                opacity="0.4"
              />
            ))}
          </g>
        </g>

        {/* Right Main Ticket Body */}
        <g transform="translate(138, 62)">
          {/* Draw metadata row */}
          <text
            x="0"
            y="12"
            fill="var(--color-muted, #5B6F68)"
            fontSize="9"
            fontWeight="600"
            fontFamily="Manrope, system-ui, sans-serif"
          >
            DRAW NUMBER
          </text>
          <text
            x="76"
            y="12"
            fill="var(--color-text, #0F1F1A)"
            fontSize="10"
            fontWeight="700"
            fontFamily="DM Mono, monospace"
          >
            {drawId}
          </text>

          <text
            x="180"
            y="12"
            fill="var(--color-muted, #5B6F68)"
            fontSize="9"
            fontWeight="600"
            fontFamily="Manrope, system-ui, sans-serif"
          >
            DATE
          </text>
          <text
            x="215"
            y="12"
            fill="var(--color-text, #0F1F1A)"
            fontSize="10"
            fontWeight="700"
            fontFamily="DM Mono, monospace"
          >
            {drawDate}
          </text>

          {/* 8 Tabular Mono Number Elements */}
          <g transform="translate(0, 26)">
            {chars.map((char, i) => {
              const isMatched = matchedIndices.includes(i);
              const isJudging = activeJudgeIndex === i;
              const isSeries = i < 2;

              // Gap between 2 series letters and 6 digits
              const xPos = isSeries ? i * 38 : 88 + (i - 2) * 38;

              let fill = "var(--color-input-box, #E3F4EC)";
              let stroke = "var(--color-input-border, #CFE9DD)";
              let textFill = "var(--color-text, #0F1F1A)";
              let filter = undefined;

              if (state === "scanning" && isJudging) {
                fill = "var(--color-primary-subtle, rgba(5,105,90,0.15))";
                stroke = "var(--color-primary, #05695A)";
                textFill = "var(--color-primary, #05695A)";
              } else if (state === "won") {
                if (isMatched) {
                  fill = "var(--color-gold-bg, #FDE7B0)";
                  stroke = "var(--color-gold-border, #F7D78A)";
                  textFill = "var(--color-gold-text, #8A5A00)";
                  filter = "url(#winGlow)";
                } else {
                  fill = "var(--color-input-box, #E3F4EC)";
                  stroke = "var(--color-input-border, #CFE9DD)";
                  textFill = "var(--color-subtle, #89A098)"; // softly dim non-matched
                }
              } else if (state === "lost") {
                fill = "var(--color-input-box, #E3F4EC)";
                stroke = "var(--color-input-border, #CFE9DD)";
                textFill = "var(--color-muted, #5B6F68)";
              }

              return (
                <g key={i} transform={`translate(${xPos}, 0)`}>
                  <rect
                    x="0"
                    y="0"
                    width="33"
                    height="48"
                    rx="10"
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isMatched || isJudging ? "2" : "1"}
                    filter={filter}
                    className="transition-all duration-200"
                  />
                  <text
                    x="16.5"
                    y="32"
                    fill={textFill}
                    fontSize="22"
                    fontWeight="700"
                    textAnchor="middle"
                    fontFamily="DM Mono, monospace"
                    className="tabular-nums"
                  >
                    {char || "-"}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Deterministic Full Barcode */}
          <g transform="translate(0, 90)">
            {barcodeBars.map((bar, idx) => (
              <rect
                key={idx}
                x={idx * 6.2}
                y="0"
                width={bar.width}
                height="20"
                fill="var(--color-muted, #5B6F68)"
                opacity="0.6"
              />
            ))}
            <text
              x="165"
              y="30"
              fill="var(--color-subtle, #89A098)"
              fontSize="8"
              fontWeight="500"
              letterSpacing="2"
              textAnchor="middle"
              fontFamily="DM Mono, monospace"
            >
              {parsed.fullTicketString}
            </text>
          </g>
        </g>

        {/* Sweep Scan Laser (when state='scanning') */}
        {state === "scanning" && (
          <rect
            x="0"
            y="0"
            width="35"
            height="230"
            fill="url(#scanBeamGrad)"
            opacity="0.8"
          >
            <animate attributeName="x" from="0" to="500" dur="1.6s" repeatCount="indefinite" />
          </rect>
        )}
      </svg>
    </div>
  );
}
