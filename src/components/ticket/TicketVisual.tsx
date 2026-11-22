"use client";

import React, { useMemo } from "react";
import { getScheme } from "@/lib/schemes";
import { parseTicket } from "@/lib/parser";

export type TicketVisualState = "idle" | "scanning" | "won" | "lost";

export interface TicketVisualProps {
  ticketString: string;
  schemeCode?: string;
  drawDate?: string;
  drawNumber?: string | number;
  price?: number;
  state?: TicketVisualState;
  matchedIndices?: number[];
  activeJudgeIndex?: number; // During reveal: current character being inspected (0..7)
  size?: "sm" | "md" | "lg" | "responsive";
  className?: string;
}

export function TicketVisual({
  ticketString,
  schemeCode,
  drawDate = "23 NOV 2026",
  drawNumber = "W-790",
  price,
  state = "idle",
  matchedIndices = [],
  activeJudgeIndex = -1,
  size = "responsive",
  className = "",
}: TicketVisualProps) {
  const parsed = useMemo(() => parseTicket(ticketString), [ticketString]);
  const chars = parsed.characters;
  const effectiveSchemeCode = schemeCode || parsed.schemeCode || "W";
  const scheme = getScheme(effectiveSchemeCode);
  const ticketPrice = price || scheme.price;

  // Generate deterministic barcode from ticket characters
  const barcodeBars = useMemo(() => {
    const raw = parsed.fullTicketString.replace(/[^A-Z0-9]/g, "");
    const bars: Array<{ width: number; gap: number }> = [];
    for (let i = 0; i < raw.length; i++) {
      const code = raw.charCodeAt(i);
      bars.push({ width: (code % 3) + 1.2, gap: ((code * 3) % 4) + 1.2 });
      bars.push({ width: ((code * 7) % 3) + 1.0, gap: 1.5 });
      bars.push({ width: ((code * 13) % 2) + 1.5, gap: 2.0 });
    }
    return bars;
  }, [parsed.fullTicketString]);

  // Size classes
  const sizeStyles = {
    sm: "max-w-xs",
    md: "max-w-md",
    lg: "max-w-xl",
    responsive: "w-full max-w-xl",
  }[size];

  return (
    <div className={`relative select-none filter drop-shadow-xl ${sizeStyles} ${className}`}>
      <svg
        viewBox="0 0 520 250"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto overflow-visible rounded-3xl"
        role="img"
        aria-label={`Kerala State Lottery ticket ${parsed.fullTicketString}`}
      >
        <defs>
          {/* Subtle paper fiber texture */}
          <filter id="paperTexture" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" result="noise" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.95  0 0 0 0 0.95  0 0 0 0 0.95  0 0 0 0.05 0" />
            <feComposite in2="SourceGraphic" in="glitch" operator="in" />
          </filter>

          {/* Golden glow for wins */}
          <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#f59e0b" floodOpacity="0.8" />
          </filter>

          {/* Scheme glow */}
          <filter id="schemeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={scheme.theme.primary} floodOpacity="0.7" />
          </filter>

          {/* Subtle Guilloche wavy security pattern */}
          <pattern id="guilloche" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M0 20 Q 10 5, 20 20 T 40 20 M0 10 Q 10 25, 20 10 T 40 10"
              fill="none"
              stroke={scheme.theme.primary}
              strokeWidth="0.5"
              strokeOpacity="0.08"
            />
          </pattern>

          {/* Light sweep scan gradient */}
          <linearGradient id="scanBeam" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
            <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>

          {/* Gold gradient for jackpot card */}
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fffbeb" />
            <stop offset="50%" stopColor="#fef3c7" />
            <stop offset="100%" stopColor="#fde68a" />
          </linearGradient>
        </defs>

        {/* Outer Card Background with Rounded Corners */}
        <rect
          x="4"
          y="4"
          width="512"
          height="242"
          rx="22"
          fill={state === "won" && matchedIndices.length === 8 ? "url(#goldGradient)" : "#ffffff"}
          stroke={state === "won" ? "#f59e0b" : scheme.theme.borderLight}
          strokeWidth={state === "won" ? "3" : "2"}
          className="transition-colors duration-500"
        />

        {/* Guilloche security pattern overlay */}
        <rect x="4" y="4" width="512" height="242" rx="22" fill="url(#guilloche)" />

        {/* Top Header Ribbon in Scheme Colors */}
        <path
          d="M 4 26 C 4 14 14 4 26 4 L 494 4 C 506 4 516 14 516 26 L 516 52 L 4 52 Z"
          fill={scheme.theme.primary}
          className="transition-colors duration-500"
        />

        {/* Header Scheme Title & Subtitle */}
        <text
          x="30"
          y="28"
          fill="#ffffff"
          fontSize="14"
          fontWeight="900"
          letterSpacing="2"
          fontFamily="system-ui, sans-serif"
        >
          KERALA STATE LOTTERIES
        </text>
        <text
          x="30"
          y="43"
          fill="#ffffff"
          fontSize="10"
          fontWeight="600"
          opacity="0.9"
          letterSpacing="0.8"
          fontFamily="system-ui, sans-serif"
        >
          {scheme.name.toUpperCase()} • {scheme.weekday.toUpperCase()} DRAW
        </text>

        {/* Price Badge in Header */}
        <rect
          x="430"
          y="13"
          width="70"
          height="26"
          rx="8"
          fill="#ffffff"
          fillOpacity="0.22"
        />
        <text
          x="465"
          y="30"
          fill="#ffffff"
          fontSize="13"
          fontWeight="800"
          textAnchor="middle"
          fontFamily="system-ui, sans-serif"
        >
          ₹{ticketPrice}
        </text>

        {/* Perforation Line & Semicircular Notches */}
        <g stroke="#94a3b8" strokeWidth="1.2">
          {/* Top Notch */}
          <path d="M 125 4 A 9 9 0 0 1 125 22" fill="#f8fafc" stroke="#cbd5e1" />
          {/* Dashed line */}
          <line
            x1="125"
            y1="22"
            x2="125"
            y2="228"
            strokeDasharray="4 4"
            stroke="#cbd5e1"
            strokeWidth="1.5"
          />
          {/* Bottom Notch */}
          <path d="M 125 246 A 9 9 0 0 1 125 228" fill="#f8fafc" stroke="#cbd5e1" />
        </g>

        {/* Left Counterfoil Stub Section */}
        <g transform="translate(16, 68)">
          <text
            x="0"
            y="14"
            fill="#64748b"
            fontSize="9"
            fontWeight="700"
            letterSpacing="0.5"
            fontFamily="system-ui, sans-serif"
          >
            COUNTERFOIL
          </text>
          <text
            x="0"
            y="32"
            fill={scheme.theme.primary}
            fontSize="11"
            fontWeight="900"
            fontFamily="system-ui, sans-serif"
          >
            NO: {drawNumber}
          </text>
          <text
            x="0"
            y="48"
            fill="#64748b"
            fontSize="9"
            fontWeight="600"
            fontFamily="system-ui, sans-serif"
          >
            DATE: {drawDate}
          </text>

          {/* Vertical Barcode in Stub */}
          <g transform="translate(5, 62)">
            {barcodeBars.slice(0, 16).map((bar, idx) => {
              const xPos = idx * 5.2;
              return (
                <rect
                  key={idx}
                  x={xPos}
                  y="0"
                  width={bar.width}
                  height="45"
                  fill="#334155"
                  opacity="0.8"
                />
              );
            })}
            <text
              x="42"
              y="56"
              fill="#94a3b8"
              fontSize="7"
              fontWeight="600"
              textAnchor="middle"
              fontFamily="monospace"
            >
              {parsed.series}
            </text>
          </g>
        </g>

        {/* Right Main Ticket Body */}
        <g transform="translate(145, 68)">
          {/* Draw metadata row */}
          <text
            x="0"
            y="14"
            fill="#64748b"
            fontSize="9"
            fontWeight="700"
            letterSpacing="1"
            fontFamily="system-ui, sans-serif"
          >
            DRAW NUMBER
          </text>
          <text
            x="85"
            y="14"
            fill="#0f172a"
            fontSize="10"
            fontWeight="800"
            fontFamily="monospace"
          >
            {drawNumber}
          </text>

          <text
            x="190"
            y="14"
            fill="#64748b"
            fontSize="9"
            fontWeight="700"
            letterSpacing="1"
            fontFamily="system-ui, sans-serif"
          >
            DRAW DATE
          </text>
          <text
            x="260"
            y="14"
            fill="#0f172a"
            fontSize="10"
            fontWeight="800"
            fontFamily="monospace"
          >
            {drawDate}
          </text>

          {/* 8 Tabular Ticket Character Cells */}
          <g transform="translate(0, 30)">
            {chars.map((char, i) => {
              const isMatched = matchedIndices.includes(i);
              const isJudging = activeJudgeIndex === i;
              const isSeriesChar = i < 2;

              // Individual box X coordinate with spacing between series & numbers
              const xOffset = isSeriesChar ? i * 40 : 92 + (i - 2) * 40;

              let boxFill = "#f8fafc";
              let boxStroke = "#e2e8f0";
              let textFill = "#0f172a";
              let filter = undefined;

              if (state === "scanning") {
                if (isJudging) {
                  boxFill = "#e0f2fe";
                  boxStroke = "#0284c7";
                  textFill = "#0369a1";
                  filter = "url(#schemeGlow)";
                }
              } else if (state === "won") {
                if (isMatched) {
                  boxFill = "#fef3c7";
                  boxStroke = "#f59e0b";
                  textFill = "#b45309";
                  filter = "url(#goldGlow)";
                } else {
                  boxFill = "#f8fafc";
                  boxStroke = "#e2e8f0";
                  textFill = "#94a3b8"; // dimmed non-matches
                }
              } else if (state === "lost") {
                boxFill = "#f8fafc";
                boxStroke = "#e2e8f0";
                textFill = "#64748b"; // calm, non-punishing neutral
              }

              return (
                <g key={i} transform={`translate(${xOffset}, 0)`}>
                  <rect
                    x="0"
                    y="0"
                    width="35"
                    height="50"
                    rx="10"
                    fill={boxFill}
                    stroke={boxStroke}
                    strokeWidth={isMatched || isJudging ? "2.5" : "1.5"}
                    filter={filter}
                    className="transition-all duration-300"
                  />
                  <text
                    x="17.5"
                    y="34"
                    fill={textFill}
                    fontSize="24"
                    fontWeight="900"
                    textAnchor="middle"
                    fontFamily="monospace"
                    className="tabular-nums"
                  >
                    {char || "-"}
                  </text>
                  {/* Subtle index mark */}
                  <text
                    x="17.5"
                    y="46"
                    fill="#94a3b8"
                    fontSize="6.5"
                    fontWeight="700"
                    textAnchor="middle"
                    fontFamily="system-ui, sans-serif"
                    opacity="0.6"
                  >
                    {i < 2 ? (i === 0 ? "SCH" : "SER") : `#${i - 1}`}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Bottom Barcode and Security Verification String */}
          <g transform="translate(0, 95)">
            {/* Deterministic Full Barcode */}
            {barcodeBars.map((bar, idx) => {
              const xPos = idx * 6.5;
              return (
                <rect
                  key={idx}
                  x={xPos}
                  y="0"
                  width={bar.width}
                  height="22"
                  fill="#1e293b"
                  opacity="0.85"
                />
              );
            })}
            <text
              x="170"
              y="32"
              fill="#64748b"
              fontSize="8"
              fontWeight="700"
              letterSpacing="2"
              textAnchor="middle"
              fontFamily="monospace"
            >
              * {parsed.fullTicketString} * GOVT OF KERALA *
            </text>
          </g>
        </g>

        {/* Scanning Light Sweep Laser (when in state='scanning') */}
        {state === "scanning" && (
          <g>
            <rect
              x="0"
              y="0"
              width="40"
              height="250"
              fill="url(#scanBeam)"
              opacity="0.75"
              className="animate-scan"
            >
              <animate
                attributeName="x"
                from="0"
                to="520"
                dur="1.8s"
                repeatCount="indefinite"
              />
            </rect>
          </g>
        )}
      </svg>
    </div>
  );
}
