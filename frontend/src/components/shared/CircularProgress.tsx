"use client";

import React from "react";

interface CircularProgressProps {
  percent: number;
  size?: number;
  label?: string;
}

export function CircularProgress({ percent, size = 56, label }: CircularProgressProps) {
  const sw = 5;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  
  let color = "#ef4444"; // red for 0%
  if (percent >= 100) color = "#34d399"; // emerald for 100%
  else if (percent > 0) color = "#38bdf8"; // cyan for partial

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={sw}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-bold text-white">{percent}%</span>
        {label && <span className="text-[8px] text-gray-400">{label}</span>}
      </div>
    </div>
  );
}
