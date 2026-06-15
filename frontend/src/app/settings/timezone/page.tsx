"use client";
import { useState, useEffect } from "react";
import { Loader2, Save, MapPin } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { settingsApi } from "@/lib/api";

export default function TimeZoneSettingsPage() {
  const { admin, accessToken } = useAuth();
  const [timezones, setTimezones] = useState<string[]>([]);
  const [selectedTz, setSelectedTz] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  useEffect(() => {
    // 1. Fetch from worldtimeapi.org
    fetch("https://worldtimeapi.org/api/timezone")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setTimezones(data);
        else throw new Error("Invalid response");
      })
      .catch((err) => {
        // Fallback to Intl timezones silently to avoid dev overlay
        setTimezones(Intl.supportedValuesOf('timeZone'));
      })
      .finally(() => setLoading(false));

    // 2. Fetch current org timezone
    if (accessToken) {
      settingsApi.getTimezone(accessToken)
        .then(res => {
          if (res.success && res.data?.timezone) {
            setSelectedTz(res.data.timezone);
          }
        })
        .catch(() => {
          // Silent catch to prevent Next.js overlay on network failure
        });
    }
  }, [accessToken]);

  const handleSave = async () => {
    if (!accessToken) return;
    setSaving(true);
    setMessage({ text: "", type: "" });
    
    try {
      const res = await settingsApi.setTimezone(accessToken, selectedTz);
      if (res.success) {
        setMessage({ text: "Timezone updated successfully for your organization.", type: "success" });
      } else {
        setMessage({ text: res.message || "Failed to update timezone.", type: "error" });
      }
    } catch (err) {
      setMessage({ text: "An error occurred.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (!admin) return null;

  return (
    <div className="p-6 max-w-7xl w-full mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MapPin className="text-secondary-400" />
            TimeZone Settings
          </h1>
          <p className="text-sm text-gray-400 mt-1">Configure the official timezone for your organization operations.</p>
        </div>
      </div>

      <div className="glass-dark rounded-xl p-6 border border-white/10">
        <label className="block text-sm font-medium text-gray-300 mb-2">Organization TimeZone</label>
        {loading ? (
           <div className="flex items-center text-gray-400 gap-2"><Loader2 className="animate-spin" size={16} /> Loading timezones...</div>
        ) : (
           <div className="flex flex-col sm:flex-row gap-4">
             <select
               className="flex-1 bg-white/5 border border-white/10 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-secondary-500/50"
               value={selectedTz}
               onChange={(e) => setSelectedTz(e.target.value)}
             >
               <option value="" disabled className="bg-transparent">Select a timezone</option>
               {timezones.map(tz => (
                 <option key={tz} value={tz} className="bg-transparent">{tz}</option>
               ))}
             </select>
             <button
               onClick={handleSave}
               disabled={saving || !selectedTz}
               className="flex items-center gap-2 bg-secondary-500 hover:bg-secondary-600 text-primary-950 font-semibold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50"
             >
               {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
               Save Settings
             </button>
           </div>
        )}
        {message.text && (
          <div className={`mt-4 p-3 rounded-lg text-sm border ${message.type === 'success' ? 'bg-secondary-500/10 text-secondary-400 border-secondary-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}
