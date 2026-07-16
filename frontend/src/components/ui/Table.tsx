"use client";

import React from "react";

type Align = "left" | "center" | "right";
const ALIGN: Record<Align, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/** Glass table shell: rounded card + horizontal scroll + base table. */
export function Table({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl overflow-hidden border-white/[0.08]">
      <div className="overflow-x-auto">
        <table className={`w-full text-sm ${className}`}>{children}</table>
      </div>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-white/10 bg-white/[0.035]">{children}</tr>
    </thead>
  );
}

export function Th({
  align = "left",
  className = "",
  children,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { align?: Align }) {
  return (
    <th className={`px-5 py-4 text-[11px] uppercase tracking-wider text-gray-400 font-semibold whitespace-nowrap ${ALIGN[align]} ${className}`} {...props}>
      {children}
    </th>
  );
}

export function TBody({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <tbody className={`divide-y divide-white/[0.06] ${className}`}>{children}</tbody>;
}

export function Tr({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={`hover:bg-white/[0.035] transition-colors duration-200 ${className}`} {...props}>
      {children}
    </tr>
  );
}

export function Td({
  align = "left",
  className = "",
  children,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { align?: Align }) {
  return (
    <td className={`px-5 py-4 ${ALIGN[align]} ${className}`} {...props}>
      {children}
    </td>
  );
}
