"use client";

import { useEffect, useRef, useState } from "react";
import type { Country } from "@/lib/api";

/**
 * The registration country picker: a searchable list with flags and dialing
 * codes. Shared by Company registration, review requests and quote registration.
 */
export default function CountryField({ countries, value, onChange, label = "Country", required = true }: {
  countries: Country[];
  value: string;
  onChange: (country: Country) => void;
  label?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const box = useRef<HTMLDivElement | null>(null);
  const selected = countries.find(country => country.country === value);
  // Close when the user clicks elsewhere or presses Escape.
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  return <div className="relative" ref={box}>
    <label className="mb-2 block text-sm font-medium text-gray-300">{label} {required && <span className="text-red-400">*</span>}</label>
    <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)}
      className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-left text-sm text-white hover:border-white/20">
      <span>{selected?.flag}</span><span className={`truncate ${value ? "" : "text-gray-500"}`}>{value || "Select country"}</span>
      {selected?.international_dialing && <span className="ml-auto text-xs text-gray-500">{selected.international_dialing}</span>}
    </button>
    {open && <div className="absolute z-50 mt-2 max-h-60 w-full overflow-hidden rounded-2xl border border-white/15 bg-[#0b2118]/95 shadow-2xl backdrop-blur-xl">
      <div className="border-b border-white/10 p-2">
        <input type="text" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search countries..." aria-label="Search countries" autoFocus
          className="w-full rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-secondary-400/60 focus:outline-none" />
      </div>
      <div className="max-h-40 overflow-y-auto" role="listbox" aria-label={label}>
        {countries.filter(country => country.country.toLowerCase().includes(search.toLowerCase())).map(country =>
          <button key={country.id} type="button" role="option" aria-selected={value === country.country}
            onClick={() => { onChange(country); setOpen(false); setSearch(""); }}
            className={"flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/10 " + (value === country.country ? "bg-secondary-500/15 text-secondary-400" : "text-white")}>
            <span>{country.flag}</span><span className="truncate">{country.country}</span><span className="ml-auto text-xs text-gray-500">{country.international_dialing}</span>
          </button>)}
        {!countries.length && <p className="px-3 py-2 text-sm text-gray-500">Loading countries…</p>}
      </div>
    </div>}
  </div>;
}
