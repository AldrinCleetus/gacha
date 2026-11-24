import React from "react";
import { Scheme } from "@/types";

interface KeralaBackgroundProps {
  scheme?: Scheme;
}

export function KeralaBackground({ scheme }: KeralaBackgroundProps) {
  const themePrimary = scheme?.theme.primary || "var(--color-primary)";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none z-0"
    >
      {/* 1. Dynamic Scheme Radial Ambient Glow */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] sm:w-[900px] h-[500px] sm:h-[650px] rounded-full blur-3xl opacity-25 dark:opacity-20 transition-all duration-700 ease-out"
        style={{
          background: `radial-gradient(circle, ${themePrimary} 0%, rgba(254, 231, 176, 0.15) 45%, transparent 70%)`,
        }}
      />

      {/* 2. Top-Right: Stylized Kerala Coconut Palm Fronds */}
      <svg
        className="absolute -top-12 -right-12 sm:-top-8 sm:-right-8 w-72 sm:w-96 md:w-[480px] h-72 sm:h-96 md:h-[480px] text-primary/10 dark:text-primary/10 transition-colors duration-500"
        viewBox="0 0 400 400"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      >
        {/* Palm Stems */}
        <path d="M 420 -20 C 350 80, 240 160, 100 240" strokeWidth="2.5" opacity="0.8" />
        <path d="M 420 50 C 330 130, 260 220, 180 320" strokeWidth="2" opacity="0.6" />
        <path d="M 380 -40 C 300 40, 200 110, 80 160" strokeWidth="1.8" opacity="0.7" />

        {/* Leaves along primary stem */}
        <path d="M 320 100 C 300 60, 280 40, 250 30" />
        <path d="M 300 115 C 275 80, 250 65, 215 60" />
        <path d="M 280 130 C 250 100, 220 90, 185 85" />
        <path d="M 260 145 C 225 120, 190 110, 155 110" />
        <path d="M 240 160 C 200 140, 160 135, 125 135" />
        <path d="M 210 180 C 170 165, 130 160, 95 165" />
        <path d="M 180 200 C 145 190, 105 190, 70 200" />
        <path d="M 150 218 C 120 215, 85 220, 50 235" />

        {/* Drooping opposing leaves */}
        <path d="M 340 90 C 330 130, 310 160, 280 180" />
        <path d="M 310 110 C 295 150, 270 180, 235 200" />
        <path d="M 280 130 C 260 170, 230 200, 195 220" />
        <path d="M 250 150 C 225 190, 190 220, 155 240" />
        <path d="M 220 172 C 190 210, 150 238, 110 255" />
      </svg>

      {/* 3. Bottom-Left: Elegant Kerala Vallam Kali (Snake Boat) & Backwaters Curve */}
      <svg
        className="absolute -bottom-8 -left-8 sm:-bottom-4 sm:-left-4 w-80 sm:w-[450px] md:w-[560px] h-60 sm:h-80 md:h-96 text-primary/10 dark:text-primary/10 transition-colors duration-500"
        viewBox="0 0 600 360"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      >
        {/* Iconic high sweeping prow of Kerala Chundan Vallam */}
        <path
          d="M -40 280 C 120 280, 240 270, 360 220 C 420 195, 460 150, 480 90 C 490 60, 492 30, 488 10 C 485 -5, 475 -5, 472 8 C 468 25, 465 55, 448 95 C 430 135, 395 175, 340 200 C 230 250, 110 258, -40 260"
          strokeWidth="2"
          opacity="0.85"
        />

        {/* Traditional Ornamental Prow Spirals & Crest */}
        <circle cx="480" cy="18" r="7" strokeWidth="1.5" />
        <circle cx="480" cy="18" r="2.5" fill="currentColor" opacity="0.6" />
        <path d="M 460 70 C 475 75, 485 85, 490 100" strokeWidth="1" strokeDasharray="2 3" />
        <path d="M 435 120 C 455 125, 470 140, 475 160" strokeWidth="1" strokeDasharray="2 3" />

        {/* Gentle Ripple Lines of the Vembanad Backwaters */}
        <path d="M -60 305 C 40 295, 140 315, 240 305 C 340 295, 440 315, 540 305" opacity="0.7" />
        <path d="M -20 325 C 80 320, 180 335, 280 325 C 380 315, 480 330, 580 320" opacity="0.5" />
        <path d="M 30 345 C 130 340, 230 350, 330 342 C 430 335, 530 345, 630 338" opacity="0.35" />
      </svg>

      {/* 4. Kasavu Gold Zari Geometric Border Accent (Top & Bottom Center Subtle Motifs) */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-3 opacity-25 dark:opacity-20">
        <div className="h-[1px] w-12 sm:w-24 bg-gradient-to-r from-transparent via-[#E3B957] to-transparent" />
        <svg className="w-4 h-4 text-[#E3B957]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polygon points="12,2 22,12 12,22 2,12" />
          <polygon points="12,6 18,12 12,18 6,12" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </svg>
        <div className="h-[1px] w-12 sm:w-24 bg-gradient-to-r from-transparent via-[#E3B957] to-transparent" />
      </div>

      {/* 5. Traditional Temple Gable Arch Motif in Background Center */}
      <svg
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[850px] h-[500px] text-primary/[0.04] dark:text-primary/[0.05] pointer-events-none"
        viewBox="0 0 800 600"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        {/* Kerala Gable Apex Contours */}
        <path d="M 400 80 L 150 280 L 200 280 L 400 130 L 600 280 L 650 280 Z" />
        <path d="M 400 130 L 250 260 L 280 260 L 400 170 L 520 260 L 550 260 Z" />
        <circle cx="400" cy="70" r="12" />
        <path d="M 400 50 L 400 70" strokeWidth="2.5" />
      </svg>
    </div>
  );
}
