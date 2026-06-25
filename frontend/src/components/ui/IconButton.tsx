"use client";

import React from "react";

type Tone = "default" | "secondary" | "danger" | "info" | "warning";

const TONE_CLASSES: Record<Tone, string> = {
  default: "text-gray-400 hover:text-white hover:bg-white/5",
  secondary: "text-gray-400 hover:text-secondary-400 hover:bg-secondary-500/10",
  danger: "text-gray-400 hover:text-red-400 hover:bg-red-500/10",
  info: "text-gray-400 hover:text-blue-400 hover:bg-blue-500/10",
  warning: "text-gray-500 hover:text-amber-400 hover:bg-amber-500/10",
};

const SIZE_CLASSES = {
  sm: "p-1.5",
  md: "p-2",
  lg: "p-2.5",
};

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  /** padding size — `sm` = p-1.5 (table rows), `md` = p-2 (mobile cards), `lg` = p-2.5 (header refresh) */
  size?: "sm" | "md" | "lg";
  /** adds a subtle border (used for header/refresh-style icon buttons) */
  bordered?: boolean;
}

/**
 * Small icon-only action button (table row actions, modal close, refresh, etc.).
 * Pass the lucide icon as children.
 */
export default function IconButton({
  tone = "default",
  size = "sm",
  bordered = false,
  className = "",
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      className={`${SIZE_CLASSES[size]} rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed ${TONE_CLASSES[tone]} ${bordered ? "border border-white/10 hover:border-white/20" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
