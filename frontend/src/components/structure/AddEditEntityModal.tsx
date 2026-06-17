"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { countriesApi, type Country } from "@/lib/api";

export interface EntityFormData {
  name: string;
  registration_number: string;
  email: string;
  phone_number: string;
  address_line_1?: string;
  address_line_2?: string;
  address_line_3?: string;
  country: string;
  parent_code: string;
}

interface ParentOption {
  code: string;
  name: string;
}

interface AddEditEntityModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: EntityFormData) => Promise<void>;
  entityLabel: string;
  parentLabel?: string;
  parentOptions?: ParentOption[];
  parentRequired?: boolean;
  editData?: Partial<EntityFormData> | null;
  orgRegistrationNumber?: string;
  orgCountry?: string;
}

export default function AddEditEntityModal({
  open,
  onClose,
  onSubmit,
  entityLabel,
  parentLabel,
  parentOptions,
  parentRequired = false,
  editData,
  orgRegistrationNumber,
  orgCountry,
}: AddEditEntityModalProps) {
  const [form, setForm] = useState<EntityFormData>({
    name: "",
    registration_number: "",
    email: "",
    phone_number: "",
    address_line_1: "",
    address_line_2: "",
    address_line_3: "",
    country: "",
    parent_code: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Countries
  const [countries, setCountries] = useState<Country[]>([]);
  const [countrySearch, setCountrySearch] = useState("");
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);

  const selectedCountry = countries.find((c) => c.country === form.country);
  const dialCode = selectedCountry?.international_dialing || "";

  const isEdit = !!editData;

  useEffect(() => {
    if (editData) {
      setForm({
        name: editData.name || "",
        registration_number: editData.registration_number || "",
        email: editData.email || "",
        phone_number: editData.phone_number || "",
        address_line_1: (editData as any).address_line_1 || "",
        address_line_2: (editData as any).address_line_2 || "",
        address_line_3: (editData as any).address_line_3 || "",
        country: editData.country || "",
        parent_code: editData.parent_code || "",
      });
    } else {
      setForm({
        name: "",
        registration_number: orgRegistrationNumber || "",
        email: "",
        phone_number: "",
        address_line_1: "",
        address_line_2: "",
        address_line_3: "",
        country: orgCountry || "",
        parent_code: "",
      });
    }
    setCountrySearch("");
    setShowCountryDropdown(false);
    setError("");
  }, [editData, open, orgRegistrationNumber]);

  useEffect(() => {
    if (!open || editData || !orgCountry) return;
    setForm((current) =>
      current.country ? current : { ...current, country: orgCountry }
    );
  }, [open, editData, orgCountry]);

  // Fetch countries on first open
  useEffect(() => {
    if (!open) return;
    if (countries.length > 0) return;
    countriesApi.getAll().then(setCountries);
  }, [open, countries.length]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!form.email.trim()) {
      setError("Email is required.");
      return;
    }
    if (parentRequired && !form.parent_code) {
      setError(`${parentLabel} is required.`);
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onSubmit(form);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-secondary-500/50 focus:ring-1 focus:ring-secondary-500/30 transition-all";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative glass rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">
            {isEdit ? `Edit ${entityLabel}` : `Add ${entityLabel}`}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Parent selector */}
          {parentLabel && parentOptions && parentOptions.length > 0 && (
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                {parentLabel}
                {parentRequired && <span className="text-red-400 ml-1">*</span>}
              </label>
              <select
                value={form.parent_code}
                onChange={(e) =>
                  setForm({ ...form, parent_code: e.target.value })
                }
                className={inputClass}
              >
                <option value="">
                  {parentRequired ? `Select ${parentLabel}` : `None (Direct)`}
                </option>
                {parentOptions.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.name} ({opt.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              Name <span className="text-red-400">*</span>
            </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={`Enter ${entityLabel.toLowerCase()} name`}
                className={inputClass}
                required
              />
          </div>



          {/* Registration Number & Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                Registration Number
              </label>
              <input
                type="text"
                value={form.registration_number}
                onChange={(e) =>
                  setForm({ ...form, registration_number: e.target.value })
                }
                placeholder="Organization reg number"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Enter email"
                className={inputClass}
                required
              />
            </div>

          </div>
          {/* Country & Phone row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <label className="block text-sm text-gray-400 mb-1.5">
                Country
              </label>
              <div
                className={`${inputClass} cursor-pointer flex items-center gap-2`}
                onClick={() => setShowCountryDropdown(!showCountryDropdown)}
              >
                {form.country ? (
                  <>
                    <span>{selectedCountry?.flag}</span>
                    <span className="truncate">{form.country}</span>
                    {dialCode && <span className="text-gray-500 ml-auto text-xs">{dialCode}</span>}
                  </>
                ) : (
                  <span className="text-gray-500">Optional</span>
                )}
              </div>
              {showCountryDropdown && (
                <div className="absolute z-50 mt-1 w-full bg-primary-900 border border-white/10 rounded-lg shadow-xl max-h-52 overflow-hidden">
                  <div className="p-2 border-b border-white/10">
                    <input
                      type="text"
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      placeholder="Search countries..."
                      className="w-full bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-white text-sm placeholder-gray-500 focus:outline-none"
                      autoFocus
                    />
                  </div>
                  <div className="overflow-y-auto max-h-40">
                    {countries
                      .filter((c) => c.country.toLowerCase().includes(countrySearch.toLowerCase()))
                      .map((c) => (
                        <div
                          key={c.id}
                          className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-white/10 ${form.country === c.country ? "bg-secondary-500/15 text-secondary-400" : "text-white"
                            }`}
                          onClick={() => {
                            setForm({ ...form, country: c.country });
                            setShowCountryDropdown(false);
                            setCountrySearch("");
                          }}
                        >
                          <span>{c.flag}</span>
                          <span className="truncate">{c.country}</span>
                          {c.international_dialing && (
                            <span className="text-gray-500 ml-auto text-xs">{c.international_dialing}</span>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                Phone
              </label>
              <div className="flex">
                {dialCode && (
                  <span className="inline-flex items-center px-2.5 bg-white/5 border border-white/10 border-r-0 rounded-l-lg text-gray-400 text-sm">
                    {dialCode}
                  </span>
                )}
                <input
                  type="text"
                  value={form.phone_number}
                  onChange={(e) =>
                    setForm({ ...form, phone_number: e.target.value })
                  }
                  placeholder="Optional"
                  className={`${inputClass} ${dialCode ? "rounded-l-none" : ""}`}
                />
              </div>
            </div>
          </div>

          {/* Address Lines */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Address Line 1</label>
              <input
                type="text"
                value={form.address_line_1}
                onChange={(e) => setForm({ ...form, address_line_1: e.target.value })}
                placeholder="Street address, P.O. box"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Address Line 2</label>
              <input
                type="text"
                value={form.address_line_2}
                onChange={(e) => setForm({ ...form, address_line_2: e.target.value })}
                placeholder="Apartment, suite, unit, building, floor, etc."
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Address Line 3</label>
              <input
                type="text"
                value={form.address_line_3}
                onChange={(e) => setForm({ ...form, address_line_3: e.target.value })}
                placeholder="City, State/Province, Region"
                className={inputClass}
              />
            </div>
          </div>



          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-lg text-sm font-medium bg-secondary-500 text-primary-950 hover:bg-secondary-400 disabled:opacity-50 transition-all"
            >
              {loading
                ? "Saving..."
                : isEdit
                  ? "Update"
                  : `Add ${entityLabel}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
