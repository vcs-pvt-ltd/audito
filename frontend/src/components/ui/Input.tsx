"use client";

import React from "react";

export const fieldClass =
  "w-full min-h-11 bg-black/10 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-secondary-400/60 focus:ring-4 focus:ring-secondary-500/10 focus:bg-white/[0.055] transition-all";

function Label({ label, required }: { label?: React.ReactNode; required?: boolean }) {
  if (!label) return null;
  return (
    <label className="block text-sm font-medium text-gray-300 mb-2">
      {label} {required && <span className="text-red-400">*</span>}
    </label>
  );
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  required?: boolean;
  error?: string;
  /** Prefix addon rendered inside the field group (e.g. phone dial code). */
  leftAddon?: React.ReactNode;
}

export function Input({ label, required, error, leftAddon, className = "", ...props }: InputProps) {
  return (
    <div>
      <Label label={label} required={required} />
      {leftAddon ? (
        <div className="flex">
          <span className="inline-flex items-center px-3 bg-white/[0.035] border border-white/10 border-r-0 rounded-l-xl text-gray-400 text-sm">
            {leftAddon}
          </span>
          <input className={`${fieldClass} rounded-l-none ${className}`} {...props} />
        </div>
      ) : (
        <input className={`${fieldClass} ${className}`} {...props} />
      )}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode;
  required?: boolean;
  error?: string;
}

export function Textarea({ label, required, error, className = "", ...props }: TextareaProps) {
  return (
    <div>
      <Label label={label} required={required} />
      <textarea className={`${fieldClass} ${className}`} {...props} />
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: React.ReactNode;
  required?: boolean;
  error?: string;
}

export function Select({ label, required, error, className = "", children, ...props }: SelectProps) {
  return (
    <div>
      <Label label={label} required={required} />
      <select className={`${fieldClass} ${className}`} {...props}>
        {children}
      </select>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}
