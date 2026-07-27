"use client";

import { useEffect, useState } from "react";
import { countriesApi, type Country } from "@/lib/api";

let countriesPromise: Promise<Country[]> | null = null;

function loadCountries() {
  if (!countriesPromise) {
    countriesPromise = countriesApi.getAll().catch(() => []);
  }
  return countriesPromise;
}

export function formatPhoneWithCountryCode(
  phone: string | null | undefined,
  country: string | null | undefined,
  countries: Pick<Country, "country" | "international_dialing">[] = []
) {
  const rawPhone = String(phone || "").trim();
  if (!rawPhone) return "";
  if (rawPhone.startsWith("+")) return rawPhone;

  const normalizedCountry = String(country || "").trim().toLowerCase();
  const dialingCode = normalizedCountry.startsWith("+")
    ? country
    : countries.find((item) => item.country.trim().toLowerCase() === normalizedCountry)?.international_dialing;
  const normalizedDialingCode = String(dialingCode || "").trim();

  if (!normalizedDialingCode || rawPhone.startsWith(normalizedDialingCode)) return rawPhone;
  const localPhone = rawPhone.replace(/^0+/, "");
  return `${normalizedDialingCode} ${localPhone || rawPhone}`.trim();
}

interface PhoneNumberProps {
  phone: string | null | undefined;
  country?: string | null;
  className?: string;
  emptyValue?: string;
}

/** Displays a telephone number in international form without changing stored data. */
export default function PhoneNumber({
  phone,
  country,
  className,
  emptyValue = "—",
}: PhoneNumberProps) {
  const [countries, setCountries] = useState<Country[]>([]);
  const rawPhone = String(phone || "").trim();
  const needsDialingCode = Boolean(rawPhone && !rawPhone.startsWith("+") && country);

  useEffect(() => {
    let active = true;
    if (!needsDialingCode) return () => { active = false; };
    void loadCountries().then((items) => {
      if (active) setCountries(items);
    });
    return () => { active = false; };
  }, [needsDialingCode, country]);

  const value = rawPhone ? formatPhoneWithCountryCode(rawPhone, country, countries) : emptyValue;
  return <span className={className}>{value || emptyValue}</span>;
}
