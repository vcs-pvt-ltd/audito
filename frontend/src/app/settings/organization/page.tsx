"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Loader2, Save, Building2, MapPin, Mail, Shield, Phone, Globe, Fingerprint, ArrowLeft, Search, ChevronDown, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { authApi, countriesApi, type Country } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Button, IconButton } from "@/components/ui";

interface Organization {
  id?: number;
  name: string;
  registration_number?: string | null;
  email?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  address_line_3?: string | null;
  country?: string | null;
  phone_number?: string | null;
}

export default function OrganizationSettingsPage() {
  const { admin, accessToken, refreshMe } = useAuth();
  const { toast } = useUiFeedback();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [countryMenuPosition, setCountryMenuPosition] = useState({ top: 0, left: 0, width: 0 });
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const countryMenuRef = useRef<HTMLDivElement>(null);
  const [org, setOrg] = useState<Organization>({
    name: "",
    registration_number: "",
    email: "",
    address_line_1: "",
    address_line_2: "",
    address_line_3: "",
    country: "",
    phone_number: "",
  });

  useEffect(() => {
    if (accessToken) {
      authApi.getMe(accessToken)
        .then(res => {
          if (res.success && res.data) {
            const data = res.data as { organization: Organization | null };
            if (data.organization) {
              setOrg({
                name: data.organization.name || "",
                registration_number: data.organization.registration_number || "",
                email: data.organization.email || "",
                address_line_1: data.organization.address_line_1 || "",
                address_line_2: data.organization.address_line_2 || "",
                address_line_3: data.organization.address_line_3 || "",
                country: data.organization.country || "",
                phone_number: data.organization.phone_number || "",
              });
            }
          }
        })
        .catch(() => {
          toast("Failed to fetch organization details.", "error");
        })
        .finally(() => setLoading(false));
    }
  }, [accessToken]);

  useEffect(() => {
    countriesApi.getAll().then(setCountries).catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      const clickedTrigger = countryDropdownRef.current?.contains(event.target as Node);
      const clickedMenu = countryMenuRef.current?.contains(event.target as Node);
      if (!clickedTrigger && !clickedMenu) {
        setCountryDropdownOpen(false);
        setCountrySearch("");
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (!countryDropdownOpen) return;
    const updatePosition = () => {
      const rect = countryDropdownRef.current?.getBoundingClientRect();
      if (rect) setCountryMenuPosition({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    document.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      document.removeEventListener("scroll", updatePosition, true);
    };
  }, [countryDropdownOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    if (!org.name.trim()) {
      toast("Organization name is required.", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await authApi.updateOrganization(accessToken, {
        name: org.name.trim(),
        registration_number: org.registration_number?.trim() || undefined,
        email: org.email?.trim() || undefined,
        address_line_1: org.address_line_1?.trim() || undefined,
        address_line_2: org.address_line_2?.trim() || undefined,
        address_line_3: org.address_line_3?.trim() || undefined,
        country: org.country?.trim() || undefined,
        phone_number: org.phone_number?.trim() || undefined,
      });

      if (res.success) {
        toast("Organization profile updated successfully.", "success");
        await refreshMe();
      } else {
        toast(res.message || "Failed to save changes.", "error");
      }
    } catch {
      toast("Network error. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!admin) return null;

  if (admin.role !== "admin") {
    return (
      <div className="p-8 max-w-7xl w-full mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="glass rounded-2xl p-10 border border-white/10 text-center max-w-md w-full shadow-2xl">
          <div className="w-14 h-14 rounded-xl bg-red-500/10 flex items-center justify-center mx-auto mb-5 border border-red-500/20">
            <Shield className="text-red-400" size={28} />
          </div>
          <h2 className="text-lg font-bold text-white">Access Restricted</h2>
          <p className="text-sm text-gray-400 mt-2">Only administrators can modify organization settings.</p>
        </div>
      </div>
    );
  }

  const inputCls =
    "min-h-11 w-full rounded-lg border border-white/10 bg-black/[0.12] px-3.5 py-2.5 text-sm text-white placeholder-gray-500 transition-all focus:border-secondary-500/50 focus:outline-none focus:ring-1 focus:ring-secondary-500/20";
  const selectedCountry = countries.find((country) => country.country === org.country);
  const filteredCountries = countries.filter((country) =>
    country.country.toLowerCase().includes(countrySearch.trim().toLowerCase())
  );

  return (
    <div className="min-h-full bg-transparent flex flex-col">
      <main className="flex-1 p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8 max-w-3xl w-full mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <IconButton bordered size="md" onClick={() => router.back()} title="Back" className="shrink-0">
              <ArrowLeft size={18} />
            </IconButton>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Building2 size={20} className="text-secondary-400" />
                Organization Settings
              </h1>
              <p className="hidden sm:block text-sm text-gray-400 mt-0.5">
                Manage your organization's profile and contact information.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="glass border border-white/10 rounded-xl p-16 text-center flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-secondary-400" size={32} strokeWidth={2} />
            <p className="text-sm text-gray-500">Loading organization details...</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">

            {/* Identity */}
            <div className="glass border border-white/[0.08] rounded-xl p-5 sm:p-6 space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b border-white/[0.06]">
                <div className="w-9 h-9 rounded-lg bg-secondary-500/10 border border-secondary-500/20 flex items-center justify-center shrink-0">
                  <Fingerprint className="text-secondary-400" size={16} />
                </div>
                <div className="sm:col-span-2">
                  <h2 className="text-sm font-semibold text-white">Identity</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Legal name and registration details</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Organization Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className={inputCls}
                    value={org.name}
                    onChange={(e) => setOrg(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Full legal name"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Registration Number</label>
                  <input
                    type="text"
                    className={inputCls}
                    value={org.registration_number || ""}
                    onChange={(e) => setOrg(prev => ({ ...prev, registration_number: e.target.value }))}
                    placeholder="e.g. PV-12345"
                  />
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="glass border border-white/[0.08] rounded-xl p-5 sm:p-6 space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b border-white/[0.06]">
                <div className="w-9 h-9 rounded-lg bg-secondary-500/10 border border-secondary-500/20 flex items-center justify-center shrink-0">
                  <Mail className="text-secondary-400" size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">Contact</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Email, phone, and location</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                    <input
                      type="email"
                      className={`${inputCls} pl-10`}
                      value={org.email || ""}
                      onChange={(e) => setOrg(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="org@example.com"
                    />
                  </div>
                </div>

                <div className="sm:order-2">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                    <input
                      type="tel"
                      className={`${inputCls} pl-10`}
                      value={org.phone_number || ""}
                      onChange={(e) => setOrg(prev => ({ ...prev, phone_number: e.target.value }))}
                      placeholder="+1 234 567 890"
                    />
                  </div>
                </div>

                <div className="sm:order-1">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Country</label>
                  <div className="relative" ref={countryDropdownRef}>
                    <button
                      type="button"
                      onClick={() => { setCountryDropdownOpen((open) => !open); setCountrySearch(""); }}
                      aria-haspopup="listbox"
                      aria-expanded={countryDropdownOpen}
                      className={`${inputCls} flex items-center gap-2 text-left hover:border-white/20`}
                    >
                      {selectedCountry?.flag ? <span className="text-base">{selectedCountry.flag}</span> : <Globe className="h-4 w-4 shrink-0 text-gray-500" />}
                      <span className={`min-w-0 flex-1 truncate ${selectedCountry ? "text-white" : "text-gray-500"}`}>
                        {selectedCountry?.country || "Select country"}
                      </span>
                      {selectedCountry?.international_dialing && <span className="text-xs text-gray-500">{selectedCountry.international_dialing}</span>}
                      <ChevronDown size={15} className={`shrink-0 text-gray-500 transition-transform ${countryDropdownOpen ? "rotate-180" : ""}`} />
                    </button>
                    {countryDropdownOpen && typeof document !== "undefined" && createPortal(
                      <div
                        ref={countryMenuRef}
                        style={{ top: countryMenuPosition.top, left: countryMenuPosition.left, width: countryMenuPosition.width }}
                        className="fixed z-[100] overflow-hidden rounded-xl border border-white/15 bg-[#0b2118]/95 shadow-2xl backdrop-blur-xl"
                      >
                        <div className="flex items-center gap-2 border-b border-white/10 p-2.5">
                          <Search size={14} className="ml-1 shrink-0 text-gray-500" />
                          <input
                            autoFocus
                            value={countrySearch}
                            onChange={(event) => setCountrySearch(event.target.value)}
                            placeholder="Search countries..."
                            className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
                          />
                          {countrySearch && <button type="button" onClick={() => setCountrySearch("")} className="shrink-0 text-gray-500 hover:text-white"><X size={14} /></button>}
                        </div>
                        <div role="listbox" className="max-h-56 overflow-y-auto overscroll-contain p-1.5">
                          {filteredCountries.length === 0 ? (
                            <p className="px-3 py-5 text-center text-sm text-gray-500">No countries found</p>
                          ) : filteredCountries.map((country) => (
                            <button
                              key={country.id}
                              type="button"
                              role="option"
                              aria-selected={org.country === country.country}
                              onClick={() => {
                                setOrg((previous) => ({ ...previous, country: country.country }));
                                setCountryDropdownOpen(false);
                                setCountrySearch("");
                              }}
                              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${org.country === country.country ? "bg-secondary-500/15 text-secondary-300" : "text-white hover:bg-white/[0.06]"}`}
                            >
                              <span>{country.flag}</span>
                              <span className="min-w-0 flex-1 truncate">{country.country}</span>
                              <span className="text-xs text-gray-500">{country.international_dialing}</span>
                            </button>
                          ))}
                        </div>
                      </div>,
                      document.body
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="glass border border-white/[0.08] rounded-xl p-5 sm:p-6 space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b border-white/[0.06]">
                <div className="w-9 h-9 rounded-lg bg-secondary-500/10 border border-secondary-500/20 flex items-center justify-center shrink-0">
                  <MapPin className="text-secondary-400" size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">Address</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Physical location of your organization</p>
                </div>
              </div>

              <div className="space-y-3">
                {(["address_line_1", "address_line_2", "address_line_3"] as const).map((field, i) => (
                  <div key={field} className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                    <input
                      className={`${inputCls} pl-10`}
                      value={org[field] || ""}
                      onChange={(e) => setOrg(prev => ({ ...prev, [field]: e.target.value }))}
                      placeholder={`Address Line ${i + 1}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Save */}
            <div className="flex justify-end pb-8">
              <Button type="submit" loading={saving} leftIcon={<Save size={16} />}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>

          </form>
        )}
      </main>
    </div>
  );
}
