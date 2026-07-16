"use client";

import React from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-gradient-to-b from-secondary-400 to-secondary-500 text-primary-950 hover:from-secondary-300 hover:to-secondary-400 shadow-lg shadow-secondary-950/25",
  secondary: "bg-white/[0.035] text-gray-300 border border-white/10 hover:bg-white/[0.07] hover:border-white/20 hover:text-white",
  danger: "bg-red-500/90 text-white hover:bg-red-500 shadow-lg shadow-red-950/20",
  ghost: "text-gray-400 hover:text-white hover:bg-white/[0.07]",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-3 py-2 text-xs",
  md: "px-4 py-2.5 text-sm",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

/**
 * Shared button. Standardizes the repeated Tailwind button styles across the app.
 * Pass `className` to extend/override for the rare edge case.
 */
export default function Button({
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  loading = false,
  fullWidth = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex min-h-10 max-w-full items-center justify-center gap-2 rounded-xl text-center font-semibold transition-all duration-200 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {loading ? <Loader2 size={size === "sm" ? 14 : 16} className="animate-spin" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}
