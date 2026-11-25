import React from "react";
import { Scheme } from "@/types";

interface KeralaBackgroundProps {
  scheme?: Scheme;
}

/**
 * Reusable minimalist coconut palm silhouette composed of a gracefully
 * curving tapered trunk and sleek drooping frond blades.
 */
function CoconutPalm({
  transform,
  opacity = 1,
}: {
  transform: string;
  opacity?: number;
}) {
  return (
    <g transform={transform} opacity={opacity}>
      {/* Tapered curved trunk */}
      <path d="M -5 0 C -4 -52, 8 -102, 28 -148 L 32 -147 C 14 -100, 4 -50, 4 0 Z" />

      {/* Palm crown fronds radiating organically */}
      <g transform="translate(30, -147)">
        {/* Upper-left sweeping frond */}
        <path d="M 0 0 C -18 -26, -48 -28, -74 -6 C -52 -16, -26 -14, -1 3 Z" />
        {/* Lower-left drooping frond */}
        <path d="M 0 1 C -26 -6, -54 8, -72 34 C -50 16, -25 6, 1 4 Z" />
        {/* High center-left frond */}
        <path d="M 0 0 C -6 -32, -28 -50, -54 -44 C -32 -38, -14 -24, 1 2 Z" />
        {/* High center-right frond */}
        <path d="M 1 0 C 12 -32, 38 -48, 62 -38 C 38 -36, 18 -22, 2 2 Z" />
        {/* Upper-right sweeping frond */}
        <path d="M 2 0 C 26 -20, 56 -16, 80 10 C 56 -4, 30 -6, 1 3 Z" />
        {/* Lower-right drooping frond */}
        <path d="M 2 2 C 26 -2, 52 14, 66 42 C 46 20, 24 8, 0 4 Z" />
        {/* Subtle center vertical sprout */}
        <path d="M 0 0 C 0 -22, 6 -40, 14 -54 C 9 -36, 4 -18, 2 1 Z" />
      </g>
    </g>
  );
}

export function KeralaBackground({ scheme }: KeralaBackgroundProps) {
  const themePrimary = scheme?.theme.primary || "var(--color-primary)";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden select-none z-0"
    >
      {/* 1. Whisper-quiet scheme-adaptive ambient glow */}
      <div
        className="absolute -top-24 left-1/2 -translate-x-1/2 w-[780px] sm:w-[1040px] h-[460px] sm:h-[560px] rounded-full blur-3xl opacity-[0.10] dark:opacity-[0.13] transition-all duration-700 ease-out"
        style={{
          background: `radial-gradient(ellipse at center, ${themePrimary} 0%, transparent 72%)`,
        }}
      />

      {/* 2. Calm Kerala backwater horizon anchored cleanly at the bottom edge */}
      <div
        className="absolute bottom-0 inset-x-0 h-[190px] sm:h-[250px] text-main opacity-[0.045] dark:opacity-[0.065] transition-opacity duration-500"
        style={{
          WebkitMaskImage:
            "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.75) 55%, rgba(0,0,0,0) 100%)",
          maskImage:
            "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.75) 55%, rgba(0,0,0,0) 100%)",
        }}
      >
        <svg
          className="w-full h-full"
          viewBox="0 0 1440 260"
          preserveAspectRatio="xMidYMax slice"
          fill="currentColor"
        >
          {/* Left bank cluster of leaning coconut palms */}
          <CoconutPalm transform="translate(88, 258) scale(1.05)" />
          <CoconutPalm
            transform="translate(170, 260) scale(-0.78, 0.82)"
            opacity={0.78}
          />
          <CoconutPalm
            transform="translate(26, 264) scale(0.72, 0.76)"
            opacity={0.65}
          />

          {/* Soft left shoreline landmass */}
          <path d="M 0 260 L 0 228 Q 115 218, 255 244 Q 320 256, 390 260 Z" />

          {/* Right bank distant coconut palms */}
          <CoconutPalm
            transform="translate(1335, 258) scale(-0.96, 1.0)"
            opacity={0.9}
          />
          <CoconutPalm
            transform="translate(1258, 262) scale(0.70, 0.74)"
            opacity={0.65}
          />

          {/* Soft right shoreline landmass */}
          <path d="M 1440 260 L 1440 232 Q 1340 224, 1215 248 Q 1155 258, 1095 260 Z" />

          {/* Minimalist Kettuvallam (Kerala houseboat) gliding gently on the backwater */}
          <g transform="translate(1035, 234)" opacity={0.85}>
            {/* Curved wooden hull with upturned prow */}
            <path d="M -52 -1 C -26 6, 24 6, 56 -5 C 49 6, 20 10, -2 10 C -26 10, -45 6, -52 -1 Z" />
            {/* Traditional woven bamboo canopy */}
            <path d="M -26 0 C -22 -18, 16 -18, 22 -1 Z" />
            {/* Subtle helm roof */}
            <path d="M 22 -1 L 34 -1 C 32 -8, 25 -9, 22 -1 Z" opacity={0.8} />
            {/* Soft water reflection line */}
            <ellipse cx="0" cy="14" rx="46" ry="1.4" opacity={0.35} />
          </g>

          {/* Subtle calm backwater horizon shimmer lines */}
          <rect x="440" y="246" width="180" height="1.2" rx="0.6" opacity={0.3} />
          <rect x="760" y="251" width="140" height="1.2" rx="0.6" opacity={0.25} />
          <rect x="520" y="255" width="95" height="1" rx="0.5" opacity={0.2} />
        </svg>
      </div>
    </div>
  );
}
