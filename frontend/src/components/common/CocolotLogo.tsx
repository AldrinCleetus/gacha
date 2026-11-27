import React, { useId } from "react";

interface CocolotMarkProps {
  className?: string;
}

/** Brand emblem: emerald Kerala ticket squircle cradling a tender coconut and golden prize sphere. */
export function CocolotMark({ className = "w-7 h-7" }: CocolotMarkProps) {
  const uid = useId().replace(/:/g, "");
  const bgId = `cocolot-bg-${uid}`;
  const goldId = `cocolot-gold-${uid}`;
  const maskId = `cocolot-mask-${uid}`;

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={bgId} x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#077E6D" />
          <stop offset="100%" stopColor="#045247" />
        </linearGradient>
        <linearGradient id={goldId} x1="28" y1="12" x2="46" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE7B0" />
          <stop offset="100%" stopColor="#E3A93B" />
        </linearGradient>
        <mask id={maskId}>
          <rect x="4" y="4" width="56" height="56" rx="16" fill="#FFFFFF" />
          <circle cx="4" cy="32" r="4" fill="#000000" />
          <circle cx="60" cy="32" r="4" fill="#000000" />
        </mask>
      </defs>

      <g mask={`url(#${maskId})`}>
        <rect x="4" y="4" width="56" height="56" rx="16" fill={`url(#${bgId})`} />
        <rect
          x="6.5"
          y="6.5"
          width="51"
          height="51"
          rx="13.5"
          stroke="#5CC4AB"
          strokeOpacity="0.28"
          strokeWidth="1.5"
        />
      </g>

      {/* Warm gold lucky prize orb */}
      <circle cx="37" cy="22" r="8.5" fill={`url(#${goldId})`} />

      {/* Stylized cream-white tender coconut cut */}
      <path
        d="M15 30.5C15 29.2 16.3 28.4 17.5 28.9L47.2 41.2C48.3 41.7 48.8 43 48.2 44.1C44.9 50.2 38.4 54 31 54C20.5 54 15 45.8 15 34.5V30.5Z"
        fill="#FFFFFF"
      />
      <path
        d="M17.5 29.2L46.5 41.2"
        stroke="#A7E3D2"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface CocolotLogoProps {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  showWordmark?: boolean;
}

export function CocolotLogo({
  className = "",
  markClassName = "w-7 h-7",
  textClassName = "text-xl sm:text-2xl font-extrabold tracking-tight text-main",
  showWordmark = true,
}: CocolotLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <CocolotMark className={markClassName} />
      {showWordmark && <span className={textClassName}>cocolot</span>}
    </span>
  );
}
