import React, { useEffect, useState } from "react";

interface CountUpProps {
  end: number;
  duration?: number;
  prefix?: string;
  className?: string;
}

export function CountUp({ end, duration = 1800, prefix = "₹", className = "" }: CountUpProps) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (end === 0) {
      setCurrent(0);
      return;
    }

    let startTime: number | null = null;
    let animId: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out exponential
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const val = Math.floor(easeProgress * end);
      setCurrent(val);

      if (progress < 1) {
        animId = requestAnimationFrame(animate);
      }
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [end, duration]);

  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(current);

  return (
    <span className={`tabular-nums font-sans font-extrabold ${className}`}>
      {prefix}{formatted}
    </span>
  );
}
