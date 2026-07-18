"use client";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Loader2, Save, Clock, Search, Check, ChevronDown, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { settingsApi, timezonesApi, type TimezoneOption } from "@/lib/api";
import { Button } from "@/components/ui";

export default function TimeZoneSettingsPage() {
  const { admin, accessToken } = useAuth();
  const { confirm, toast } = useUiFeedback();
  const [timezones, setTimezones] = useState<TimezoneOption[]>([]);
  const [selectedTz, setSelectedTz] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [entityTzError, setEntityTzError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchTimezones = async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const data = await timezonesApi.getAll();
      // The shared timezone source can contain records with a missing label or
      // offset. Normalize them before rendering so one incomplete record does
      // not break the searchable dropdown.
      const normalized = data
        .filter((tz) => Boolean(tz?.timezone_value))
        .map((tz) => ({
          ...tz,
          timezone_value: String(tz.timezone_value),
          timezone_label: String(tz.timezone_label || tz.timezone_value),
          timezone_offset: String(tz.timezone_offset || ""),
        }));
      setTimezones(normalized);
      if (normalized.length === 0) setFetchError(true);
    } catch {
      setTimezones([]);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimezones();

    if (accessToken) {
      settingsApi.getTimezone(accessToken)
        .then(res => {
          if (res.success && res.data?.timezone) {
            setSelectedTz(res.data.timezone);
            setEntityTzError(null);
          }
        })
        .catch((err) => {
          console.error("Failed to fetch entity timezone:", err);
          setEntityTzError("Could not load your organization's current timezone. The timezone column may be missing from the database.");
        });
    }
  }, [accessToken]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const clickedTrigger = dropdownRef.current?.contains(e.target as Node);
      const clickedMenu = menuRef.current?.contains(e.target as Node);
      if (!clickedTrigger && !clickedMenu) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus search when dropdown opens
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  // The settings shell scrolls independently from the browser window. Render
  // the menu in a portal and keep it aligned with its trigger so it can never
  // be clipped when the page has been scrolled.
  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = dropdownRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPosition({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    document.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      document.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const handleSave = async () => {
    if (!accessToken || !selectedTz) return;

    const ok = await confirm({
      title: "Update Organization Timezone",
      message: `From this point on, all new records will be saved using ${selected?.timezone_label ?? selectedTz}${selected?.timezone_offset ? ` (${selected.timezone_offset})` : ""}. Existing timestamps will not be changed.`,
      confirmText: "Confirm Change",
      cancelText: "Cancel",
      variant: "warning",
    });
    if (!ok) return;

    setSaving(true);
    try {
      const res = await settingsApi.setTimezone(accessToken, selectedTz);
      if (res.success) {
        toast("Timezone updated successfully for your organization.", "success");
      } else {
        toast(res.message || "Failed to update timezone.", "error");
      }
    } catch {
      toast("An error occurred.", "error");
    } finally {
      setSaving(false);
    }
  };

  const selected = timezones.find(tz => tz.timezone_value === selectedTz);

  const filtered = timezones.filter(tz =>
    tz.timezone_label.toLowerCase().includes(search.trim().toLowerCase()) ||
    tz.timezone_value.toLowerCase().includes(search.trim().toLowerCase()) ||
    tz.timezone_offset.toLowerCase().includes(search.trim().toLowerCase())
  );

  if (!admin) return null;

  return (
    <div className="flex-1 p-6 lg:p-8 pt-20 lg:pt-8 overflow-y-auto max-w-6xl w-full mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
          <Clock size={20} className="text-secondary-400" />
          Timezone Settings
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">Configure the official timezone for your organization operations.</p>
      </div>

      {/* Card */}
      <div className="glass border border-white/[0.08] rounded-xl p-5 sm:p-6 space-y-5">

        {/* Section label */}
        <div className="flex items-center gap-3 pb-4 border-b border-white/[0.06]">
          <div className="w-9 h-9 rounded-lg bg-secondary-500/10 border border-secondary-500/20 flex items-center justify-center shrink-0">
            <Clock size={16} className="text-secondary-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Organization Timezone</p>
            <p className="text-xs text-gray-500 mt-0.5">All audit schedules and reports will use this timezone</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 py-2">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Loading timezones...</span>
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-start gap-3 py-2">
            <p className="text-sm text-red-400">Failed to load timezones. Please check your connection and try again.</p>
            <Button variant="secondary" size="sm" onClick={fetchTimezones}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">

            {/* Searchable dropdown */}
            <div className="flex-1 w-full relative" ref={dropdownRef}>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
                Select Timezone
              </label>

              {/* Trigger */}
              <button
                type="button"
                onClick={() => { setOpen(v => !v); setSearch(""); }}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls="timezone-options"
                className="w-full flex items-center gap-3 px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-secondary-500/50 focus:ring-1 focus:ring-secondary-500/20 transition-all hover:border-white/20"
              >
                {selected ? (
                  <>
                    <span className="flex-1 text-left truncate">
                      {selected.timezone_label}
                    </span>
                    <span className="text-gray-500 text-xs shrink-0 font-mono">{selected.timezone_offset}</span>
                    <span className="text-xs text-gray-600 shrink-0 hidden sm:block">{selected.timezone_value}</span>
                  </>
                ) : (
                  <span className="flex-1 text-left text-gray-500">Select a timezone...</span>
                )}
                <ChevronDown size={15} className={`text-gray-500 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
              </button>

              {/* Dropdown */}
              {open && typeof document !== "undefined" && createPortal(
                <div
                  ref={menuRef}
                  style={{ top: menuPosition.top, left: menuPosition.left, width: menuPosition.width }}
                  className="fixed z-[70] overflow-hidden rounded-xl border border-white/10 bg-primary-900 shadow-2xl"
                >
                  {/* Search input */}
                  <div className="p-2.5 border-b border-white/[0.06] flex items-center gap-2">
                    <Search size={14} className="text-gray-500 shrink-0 ml-1" />
                    <input
                      ref={searchRef}
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search by name, region or offset..."
                      className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
                    />
                    {search && (
                      <button onClick={() => setSearch("")} className="text-gray-500 hover:text-white transition-colors shrink-0">
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Results */}
                  <div id="timezone-options" role="listbox" className="max-h-60 overflow-y-auto overscroll-contain">
                    {filtered.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-gray-500">No timezones found</div>
                    ) : (
                      filtered.map(tz => {
                        const active = tz.timezone_value === selectedTz;
                        return (
                          <button
                            type="button"
                            role="option"
                            aria-selected={active}
                            key={tz.timezone_value}
                            onClick={() => { setSelectedTz(tz.timezone_value); setOpen(false); setSearch(""); }}
                            className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${
                              active ? "bg-secondary-500/15 text-secondary-400" : "text-white hover:bg-white/[0.05]"
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{tz.timezone_label}</p>
                              <p className="text-[11px] text-gray-500 truncate mt-0.5">{tz.timezone_value}</p>
                            </div>
                            <span className={`text-xs font-mono shrink-0 ${active ? "text-secondary-400" : "text-gray-500"}`}>
                              {tz.timezone_offset}
                            </span>
                            {active && <Check size={14} className="text-secondary-400 shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Footer count */}
                  <div className="px-3.5 py-2 border-t border-white/[0.06] text-[11px] text-gray-600">
                    {filtered.length} of {timezones.length} timezones
                  </div>
                </div>,
                document.body
              )}
            </div>

            {/* Save button */}
            <Button
              onClick={handleSave}
              disabled={!selectedTz}
              loading={saving}
              leftIcon={<Save size={16} />}
              className="shrink-0 w-full sm:w-auto"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        )}

        {entityTzError && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mt-3">
            <p className="text-xs text-yellow-400">{entityTzError}</p>
          </div>
        )}

      </div>
    </div>
  );
}
