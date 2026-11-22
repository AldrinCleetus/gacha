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
    const bars: Array<{ x: number; width: number }> = [];
    let curX = 28;
    const endX = 184;
    let i = 0;
    while (curX < endX) {
      const code = raw.charCodeAt(i % raw.length) || 65;
      const width = (code % 3) + 1.2;
      bars.push({ x: curX, width });
      curX += width + ((code * 3) % 4) + 1.5;
      i++;
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

    if (matchCount === 8) {
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
      className={`relative select-none ${sizeClasses} ${className}`}
      style={{ willChange: "transform" }}
    >
      <svg
        viewBox="0 0 680 250"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto overflow-visible rounded-2xl filter drop-shadow-md transition-shadow duration-300"
        role="img"
        aria-label={`Kerala Lottery Ticket ${parsed.fullTicketString}`}
      >
        <defs>
          {/* Laser scan beam */}
          <linearGradient id="laserBeamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#05695A" stopOpacity="0" />
            <stop offset="50%" stopColor="#5CC4AB" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#05695A" stopOpacity="0" />
          </linearGradient>

          {/* Golden glow */}
          <filter id="goldSquircleGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="3" floodColor="#F59E0B" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* 1. Outer Card Background */}
        <rect
          x="2"
          y="2"
          width="676"
          height="246"
          rx="18"
          fill="var(--color-surface, #ffffff)"
          stroke="var(--color-border, #E2E8F0)"
          strokeWidth="1.5"
          className="transition-colors duration-200"
        />

        {/* 2. Left Counterfoil Stub (x: 0 to 205) */}
        <g id="left-counterfoil">
          {/* Top Row: WEEKLY DRAW and #790 */}
          <text
            x="28"
            y="36"
            fill="var(--color-muted, #64748B)"
            fontSize="11"
            fontWeight="700"
            letterSpacing="1.2"
            fontFamily="Manrope, system-ui, sans-serif"
          >
            WEEKLY DRAW
          </text>
          <text
            x="184"
            y="36"
            fill="var(--color-muted, #475569)"
            fontSize="13"
            fontWeight="800"
            textAnchor="end"
            fontFamily="DM Mono, monospace"
          >
            {drawNum}
          </text>

          {/* Scheme Name */}
          <text
            x="28"
            y="72"
            fill="var(--color-text, #0F172A)"
            fontSize="26"
            fontWeight="900"
            letterSpacing="-0.5"
            fontFamily="Manrope, system-ui, sans-serif"
          >
            {scheme.name.toUpperCase()}
          </text>

          {/* Calendar date */}
          <g transform="translate(28, 86)">
            {/* Small Calendar icon */}
            <rect
              x="0"
              y="2"
              width="12"
              height="11"
              rx="2"
              fill="none"
              stroke="var(--color-muted, #64748B)"
              strokeWidth="1.2"
            />
            <line
              x1="0"
              y1="6"
              x2="12"
              y2="6"
              stroke="var(--color-muted, #64748B)"
              strokeWidth="1.2"
            />
            <circle cx="4" cy="9" r="0.8" fill="var(--color-muted, #64748B)" />
            <circle cx="8" cy="9" r="0.8" fill="var(--color-muted, #64748B)" />
            {/* Date text */}
            <text
              x="18"
              y="11"
              fill="var(--color-muted, #64748B)"
              fontSize="11"
              fontWeight="600"
              fontFamily="Manrope, system-ui, sans-serif"
            >
              {displayDate}
            </text>
          </g>

          {/* Ticket Reference header & code */}
          <text
            x="28"
            y="136"
            fill="var(--color-subtle, #94A3B8)"
            fontSize="10"
            fontWeight="700"
            letterSpacing="1"
            fontFamily="Manrope, system-ui, sans-serif"
          >
            TICKET REFERENCE
          </text>
          <text
            x="28"
            y="158"
            fill="var(--color-text, #1E293B)"
            fontSize="15"
            fontWeight="800"
            fontFamily="DM Mono, monospace"
          >
            {refCode}
          </text>

          {/* Barcode lines */}
          <g id="barcode" transform="translate(0, 172)">
            {barcodeBars.map((bar, idx) => (
              <rect
                key={idx}
                x={bar.x}
                y="0"
                width={bar.width}
                height="32"
                fill="var(--color-text, #1E293B)"
                opacity="0.85"
                rx="0.5"
              />
            ))}
          </g>

          {/* Watermark leaf motif in bottom right corner of stub */}
          <g
            transform="translate(175, 215) scale(0.7)"
            stroke="var(--color-border, #CBD5E1)"
            strokeWidth="2.5"
            fill="none"
            opacity="0.6"
          >
            <path d="M -30 0 C -10 -25, 20 -20, 30 10 C 15 25, -15 20, -30 0 Z" />
            <path d="M -30 0 C 0 5, 20 0, 30 10" />
            <circle cx="-5" cy="-2" r="16" strokeDasharray="3 3" opacity="0.4" />
          </g>
        </g>

        {/* 3. Perforation Separator Line & Notches at x = 205 */}
        <g id="perforation">
          {/* Top Notch Cutout */}
          <path
            d="M 195 2 A 10 10 0 0 0 215 2"
            fill="var(--color-page-bg, #EBF9F3)"
            stroke="var(--color-border, #E2E8F0)"
            strokeWidth="1.5"
          />
          {/* Vertical Dashed Perforation Line */}
          <line
            x1="205"
            y1="12"
            x2="205"
            y2="238"
            stroke="var(--color-border, #CBD5E1)"
            strokeDasharray="4 4"
            strokeWidth="1.3"
          />
          {/* Bottom Notch Cutout */}
          <path
            d="M 195 248 A 10 10 0 0 1 215 248"
            fill="var(--color-page-bg, #EBF9F3)"
            stroke="var(--color-border, #E2E8F0)"
            strokeWidth="1.5"
          />
        </g>

        {/* 4. Right Main Ticket Body (x: 205 to 680) */}
        <g id="right-ticket-body" transform="translate(230, 0)">
          {/* Top Header: REGISTERED SERIAL NUMBER & Confirmed Pill */}
          <text
            x="0"
            y="36"
            fill="var(--color-muted, #64748B)"
            fontSize="11"
            fontWeight="700"
            letterSpacing="1.2"
            fontFamily="Manrope, system-ui, sans-serif"
          >
            REGISTERED SERIAL NUMBER
          </text>

          {/* Confirmed Pill Badge */}
          <g transform="translate(330, 22)">
            <rect
              x="0"
              y="0"
              width="92"
              height="24"
              rx="12"
              fill="#DCFCE7"
              stroke="#86EFAC"
              strokeWidth="1"
            />
            {/* Lock icon */}
            <path
              d="M 16 11 L 16 9 C 16 6.8 17.8 5 20 5 C 22.2 5 24 6.8 24 9 L 24 11 M 13 11 L 27 11 C 28 11 28.5 11.5 28.5 12.5 L 28.5 18 C 28.5 19 28 19.5 27 19.5 L 13 19.5 C 12 19.5 11.5 19 11.5 18 L 11.5 12.5 C 11.5 11.5 12 11 13 11 Z"
              fill="none"
              stroke="#166534"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
            <text
              x="54"
              y="16"
              fill="#166534"
              fontSize="11"
              fontWeight="700"
              textAnchor="middle"
              fontFamily="Manrope, system-ui, sans-serif"
            >
              Confirmed
            </text>
          </g>

          {/* 8 Squircle Character Boxes */}
          <g id="character-boxes" transform="translate(0, 56)">
            {chars.map((char, i) => {
              const isMatched = matchedIndices.includes(i);
              const isJudging = activeJudgeIndex === i;

              // 8 boxes spaced evenly
              const boxW = 44;
              const boxH = 54;
              const gap = 10;
              const xPos = i * (boxW + gap);

              let fill = "var(--color-input-box, #F8FAFC)";
              let stroke = "var(--color-input-border, #E2E8F0)";
              let strokeWidth = "1";
              let textFill = "var(--color-text, #0F172A)";
              let filter = undefined;

              if (isMatched) {
                // Warm Amber Gold match styling from screenshot
                fill = "#FEF3C7";
                stroke = "#FCD34D";
                strokeWidth = "1.5";
                textFill = "#92400E";
                filter = "url(#goldSquircleGlow)";
              } else if (isJudging) {
                // Vibrant pulse while judging
                fill = "#E3F4EC";
                stroke = "#05695A";
                strokeWidth = "2.5";
                textFill = "#05695A";
              } else if (state === "lost") {
                fill = "var(--color-input-box, #F1F5F9)";
                stroke = "var(--color-border, #E2E8F0)";
                textFill = "var(--color-subtle, #94A3B8)";
              }

              return (
                <g key={i} transform={`translate(${xPos}, 0)`}>
                  <rect
                    x="0"
                    y="0"
                    width={boxW}
                    height={boxH}
                    rx="12"
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    filter={filter}
                    className="transition-all duration-200"
                  />
                  <text
                    x={boxW / 2}
                    y={36}
                    fill={textFill}
                    fontSize="24"
                    fontWeight="800"
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

          {/* Status Row under Character Boxes: Positions Matched & Series */}
          <g id="status-row" transform="translate(0, 142)">
            {/* Green Check circle */}
            <circle
              cx="8"
              cy="4"
              r="7.5"
              fill={statusInfo.isPositive ? "#059669" : "var(--color-border, #94A3B8)"}
              className="transition-colors duration-200"
            />
            <path
              d="M 5 4 L 7.2 6.5 L 11 2"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Position Match Text */}
            <text
              x="22"
              y="8"
              fill={statusInfo.isPositive ? "#059669" : "var(--color-muted, #64748B)"}
              fontSize="12"
              fontWeight="700"
              fontFamily="Manrope, system-ui, sans-serif"
              className="transition-colors duration-200"
            >
              {statusInfo.text}
            </text>

            {/* Series text on right */}
            <text
              x="422"
              y="8"
              fill="var(--color-muted, #64748B)"
              fontSize="12"
              fontWeight="600"
              textAnchor="end"
              fontFamily="DM Mono, monospace"
            >
              {effectiveSeries}
            </text>
          </g>

          {/* Security Row: Cryptographically matched sequence & Prize Tier */}
          <g id="security-row" transform="translate(0, 184)">
            {/* Security Shield Check Icon */}
            <path
              d="M 8 -2 L 14 0.5 C 14 5.5, 11 9, 8 10.5 C 5 9, 2 5.5, 2 0.5 Z"
              fill="none"
              stroke="#059669"
              strokeWidth="1.3"
            />
            <path
              d="M 5.5 4 L 7.2 5.8 L 10.5 2.5"
              fill="none"
              stroke="#059669"
              strokeWidth="1.3"
              strokeLinecap="round"
            />

            {/* Security match description */}
            <text
              x="22"
              y="8"
              fill="var(--color-muted, #475569)"
              fontSize="12"
              fontWeight="600"
              fontFamily="Manrope, system-ui, sans-serif"
            >
              {statusInfo.isPositive
                ? "Cryptographically matched sequence"
                : "Sequence verified against draw"}
            </text>

            {/* Prize Tier */}
            <text
              x="422"
              y="8"
              fill="var(--color-muted, #64748B)"
              fontSize="12"
              fontWeight="700"
              textAnchor="end"
              fontFamily="DM Mono, monospace"
            >
              {effectiveTier}
            </text>
          </g>
        </g>

        {/* 5. Laser Scan Beam Overlay */}
        {state === "scanning" && (
          <rect
            x="0"
            y="0"
            width="45"
            height="250"
            fill="url(#laserBeamGrad)"
            opacity="0.8"
          >
            <animate
              attributeName="x"
              from="0"
              to="680"
              dur="1.2s"
              repeatCount="indefinite"
            />
          </rect>
        )}
      </svg>
    </div>
  );
}
