"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { authApi, countriesApi, type Country } from "@/lib/api";

import {
  User, Mail, Phone, MapPin, CreditCard, Lock,
  Eye, EyeOff, Check, AlertCircle, ShieldCheck,
  Key, LogOut, ChevronRight, Pencil, X, Save, FileText,
  Camera, Trash2, BadgeCheck,
} from "lucide-react";

import { AuditorProfileTabs } from "./AuditorProfileTabs";

interface Organization {
  name: string;
  registration_number: string | null;
  email: string | null;
  address: string | null;
  country: string | null;
  phone_number: string | null;
  code: string;
  entity_type: string;
  account_type: string;
  org_level: number;
}

interface AdminProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  nic: string | null;
  country: string | null;
  role: string;
  account_type: string;
  entity_type: string;
  entity_code: string;
  org_level: number;
  user_type?: string;
  profile_image: string | null;
}

const ACCOUNT_LABELS: Record<string, string> = {
  Customer: "Customer",
  Company: "Company",
  "Audit Firm": "Audit Firm",
};

const MEDIA_ORIGIN =
  process.env.NEXT_PUBLIC_MEDIA_URL ||
  (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "");

const getAvatarUrl = (path: string | null) => {
  if (!path) return null;
  if (path.startsWith("data:")) return path;
  if (path.startsWith("http")) return path;
  return `${MEDIA_ORIGIN}${path}`;
};

const COUNTRY_CODES: Record<string, string> = {
  "Sri Lanka": "+94", "SriLanka": "+94", "India": "+91", "Bangladesh": "+880",
  "United Kingdom": "+44", "UK": "+44", "United States": "+1", "USA": "+1",
};

const extractPhone = (fullPhone: string | null, countryStr: string | null) => {
  if (!fullPhone) {
    const code = COUNTRY_CODES[(countryStr || "").trim()] || "+94";
    return { code, local: "" };
  }
  if (fullPhone.startsWith("+")) {
    const spaceIdx = fullPhone.indexOf(" ");
    if (spaceIdx > 0) return { code: fullPhone.substring(0, spaceIdx), local: fullPhone.substring(spaceIdx + 1) };
    if (fullPhone.startsWith("+880")) return { code: "+880", local: fullPhone.substring(4) };
    if (fullPhone.startsWith("+94") || fullPhone.startsWith("+91")) return { code: "+94", local: fullPhone.substring(3) };
    if (fullPhone.startsWith("+44")) return { code: "+44", local: fullPhone.substring(3) };
    if (fullPhone.startsWith("+1")) return { code: "+1", local: fullPhone.substring(2) };
  }
  const code = COUNTRY_CODES[(countryStr || "").trim()] || "+94";
  return { code, local: fullPhone };
};

const inputCls =
  "w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-secondary-500/50 focus:ring-1 focus:ring-secondary-500/20 transition-all";

export default function ProfilePage() {
  const { admin, accessToken, isLoading, logout, refreshMe } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "auditor_profile" | "security">("overview");

  const [countries, setCountries] = useState<Country[]>([]);
  const [countrySearch, setCountrySearch] = useState("");
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ first_name: "", last_name: "", phone_prefix: "+94", phone_local: "", nic: "", country: "" });
  const [saving, setSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
  }, [isLoading, admin, router]);

  const fetchProfile = useCallback(async () => {
    if (!accessToken) return;
    const res = await authApi.getMe(accessToken);
    const data = res.data as { admin: AdminProfile; organization: Organization | null } | undefined;
    if (res.success && data) {
      setProfile(data.admin);
      setOrganization(data.organization);
      const { code, local } = extractPhone(data.admin.phone_number, data.admin.country);
      setEditForm({ first_name: data.admin.first_name, last_name: data.admin.last_name, phone_prefix: code, phone_local: local, nic: data.admin.nic || "", country: data.admin.country || "" });
    }
    setLoading(false);
  }, [accessToken]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);
  useEffect(() => { countriesApi.getAll().then(setCountries); }, []);

  const handleEditStart = () => {
    if (!profile) return;
    const { code, local } = extractPhone(profile.phone_number, profile.country);
    setEditForm({ first_name: profile.first_name, last_name: profile.last_name, phone_prefix: code, phone_local: local, nic: profile.nic || "", country: profile.country || "" });
    setProfileMsg(null);
    setShowCountryDropdown(false);
    setCountrySearch("");
    setEditing(true);
  };

  const handleEditCancel = () => { setEditing(false); setProfileMsg(null); setShowCountryDropdown(false); setCountrySearch(""); };

  const handleEditSave = async () => {
    if (!accessToken || !profile) return;
    if (!editForm.first_name.trim() || !editForm.last_name.trim()) {
      setProfileMsg({ type: "error", text: "First name and last name are required." });
      return;
    }
    setSaving(true);
    setProfileMsg(null);
    try {
      const fullPhone = editForm.phone_local.trim() ? `${editForm.phone_prefix} ${editForm.phone_local.trim()}` : "";
      const res = await authApi.updateProfile(accessToken, {
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        phone_number: fullPhone || undefined,
        nic: editForm.nic || undefined,
        country: editForm.country || undefined,
        profile_image: profile.profile_image,
      });
      if (res.success) {
        setProfileMsg({ type: "success", text: "Profile updated successfully." });
        setEditing(false);
        await fetchProfile();
        await refreshMe();
      } else {
        setProfileMsg({ type: "error", text: res.message || "Failed to update profile." });
      }
    } catch {
      setProfileMsg({ type: "error", text: "Something went wrong." });
    } finally {
      setSaving(false);
    }
  };

  const handleImageSelect = () => fileInputRef.current?.click();

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !accessToken || !profile) return;
    if (file.size > 2 * 1024 * 1024) {
      setProfileMsg({ type: "error", text: "Image size should be less than 2MB." });
      return;
    }
    setUploadingImage(true);
    setProfileMsg(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Str = reader.result as string;
        const res = await authApi.updateProfile(accessToken, {
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone_number: profile.phone_number || undefined,
          nic: profile.nic || undefined,
          country: profile.country || undefined,
          profile_image: base64Str,
        });
        if (res.success) {
          setProfileMsg({ type: "success", text: "Profile image updated." });
          await fetchProfile();
          await refreshMe();
        } else {
          setProfileMsg({ type: "error", text: res.message || "Failed to update profile image." });
        }
      } catch {
        setProfileMsg({ type: "error", text: "Failed to upload image." });
      } finally {
        setUploadingImage(false);
      }
    };
    reader.onerror = () => { setProfileMsg({ type: "error", text: "Failed to read file." }); setUploadingImage(false); };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = async () => {
    if (!accessToken || !profile) return;
    setUploadingImage(true);
    setProfileMsg(null);
    try {
      const res = await authApi.updateProfile(accessToken, {
        first_name: profile.first_name,
        last_name: profile.last_name,
        phone_number: profile.phone_number || undefined,
        nic: profile.nic || undefined,
        country: profile.country || undefined,
        profile_image: null,
      });
      if (res.success) {
        setProfileMsg({ type: "success", text: "Profile image removed." });
        await fetchProfile();
        await refreshMe();
      } else {
        setProfileMsg({ type: "error", text: res.message || "Failed to remove profile image." });
      }
    } catch {
      setProfileMsg({ type: "error", text: "Failed to remove profile image." });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    if (newPassword.length < 8) {
      setPasswordMsg({ type: "error", text: "New password must be at least 8 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "Passwords do not match." });
      return;
    }
    setChangingPassword(true);
    try {
      const res = await authApi.changePassword(accessToken!, currentPassword, newPassword);
      if (res.success) {
        setPasswordMsg({ type: "success", text: "Password changed successfully." });
        setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      } else {
        setPasswordMsg({ type: "error", text: res.message || "Failed to change password." });
      }
    } catch {
      setPasswordMsg({ type: "error", text: "Something went wrong." });
    } finally {
      setChangingPassword(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="h-screen bg-transparent flex items-center justify-center pt-14 lg:pt-0">
        <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!admin || !profile) return null;

  const getRoleLabel = () => {
    if (admin.role === "entity_head") {
      const entity = admin.entity_type || "Entity";
      return `${entity.charAt(0).toUpperCase() + entity.slice(1).toLowerCase()} Head`;
    }
    if (admin.role === "admin") return ACCOUNT_LABELS[admin.account_type || ""] || admin.account_type || "Admin";
    const roleCap = admin.role.charAt(0).toUpperCase() + admin.role.slice(1).toLowerCase();
    return admin.user_type || roleCap;
  };

  const accountLabel = getRoleLabel();
  const initials = `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`.toUpperCase();
  const avatarUrl = getAvatarUrl(profile.profile_image);
  const selectedDialCode = countries.find(c => c.country === editForm.country)?.international_dialing || editForm.phone_prefix;

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: User, show: true },
    { id: "auditor_profile" as const, label: "Auditor Profile", icon: FileText, show: admin.role === "auditor" },
    { id: "security" as const, label: "Security", icon: Key, show: true },
  ].filter((t) => t.show);

  return (
    <div className="min-h-full bg-transparent flex flex-col">
      <main className="flex-1 p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8 pb-12 w-full max-w-6xl mx-auto space-y-5 sm:space-y-6">

        {/* ── Page header ── */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <User size={20} className="text-secondary-400" />
            My Profile
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage your account, identity and security settings</p>
        </div>

        {/* ── Identity Banner ── */}
        <div className="glass border border-white/[0.08] rounded-2xl overflow-hidden">
          {/* Cover strip */}
          <div className="relative h-24 sm:h-28 bg-gradient-to-br from-secondary-600/30 via-secondary-500/15 to-primary-700/20 overflow-hidden">
            <div className="absolute -top-12 -left-12 w-48 h-48 bg-secondary-500/25 rounded-full blur-3xl" />
            <div className="absolute -bottom-8 right-1/3 w-40 h-40 bg-primary-500/15 rounded-full blur-2xl" />
            <div className="absolute top-2 right-28 w-20 h-20 bg-secondary-300/10 rounded-full blur-xl" />
            <button onClick={logout}
              className="absolute top-3.5 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-black/20 hover:bg-black/35 border border-white/10 rounded-lg text-xs text-white/75 hover:text-white font-medium backdrop-blur-sm transition-all">
              <LogOut size={12} /> Sign Out
            </button>
          </div>

          {/* Body */}
          <div className="px-5 sm:px-6 pb-5 sm:pb-6">
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />

            {/* Avatar row — overlaps the cover strip */}
            <div className="flex items-end justify-between -mt-10 sm:-mt-12 mb-4">
              <div className="relative shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl p-[2.5px] bg-gradient-to-tr from-secondary-500/70 via-secondary-400/30 to-primary-500/50 shadow-2xl ring-4 ring-primary-950">
                  <div
                    className="w-full h-full bg-primary-950 rounded-xl overflow-hidden flex items-center justify-center relative cursor-pointer group/avatar"
                    onClick={handleImageSelect}
                  >
                    {uploadingImage && (
                      <div className="absolute inset-0 bg-black/60 z-20 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    {avatarUrl
                      ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      : <span className="text-2xl sm:text-3xl font-bold bg-gradient-to-br from-secondary-300 to-secondary-500 text-transparent bg-clip-text select-none">{initials}</span>
                    }
                    <div className="absolute inset-0 bg-black/55 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-opacity duration-200">
                      <Camera size={17} className="text-white" />
                    </div>
                  </div>
                </div>
                <button onClick={handleImageSelect} type="button"
                  className="absolute -bottom-1.5 -right-1.5 w-6 h-6 sm:w-7 sm:h-7 bg-secondary-500 hover:bg-secondary-400 text-primary-950 rounded-xl flex items-center justify-center border-2 border-primary-950 shadow-lg transition-colors z-10">
                  <Camera size={11} />
                </button>
              </div>

              {/* Role badge — bottom-right of cover overlap row */}
              <span className="mb-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-500/10 text-secondary-400 text-[11px] font-bold tracking-wide uppercase border border-secondary-500/20">
                <ShieldCheck size={11} /> {accountLabel}
              </span>
            </div>

            {/* Name + email */}
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-tight">
              {profile.first_name} {profile.last_name}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5 truncate">{profile.email}</p>

            {/* Photo actions */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              <button onClick={handleImageSelect} type="button"
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-secondary-400 bg-secondary-500/10 hover:bg-secondary-500/20 border border-secondary-500/20 rounded-lg transition-all font-medium">
                <Camera size={11} /> Change Photo
              </button>
              {avatarUrl && (
                <button onClick={handleRemoveImage}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-all font-medium">
                  <Trash2 size={11} /> Remove
                </button>
              )}
            </div>

            {/* Quick stats — inline row */}
            {(profile.phone_number || profile.country || organization?.name) && (
              <div className="mt-4 pt-4 border-t border-white/[0.06] flex flex-wrap gap-x-5 gap-y-2">
                {profile.phone_number && (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Phone size={13} className="text-gray-500 shrink-0" />
                    <span className="text-sm text-gray-300 font-medium truncate">{profile.phone_number}</span>
                  </div>
                )}
                {profile.country && (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MapPin size={13} className="text-gray-500 shrink-0" />
                    <span className="text-sm text-gray-300 font-medium truncate">{profile.country}</span>
                  </div>
                )}
                {organization?.name && (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <BadgeCheck size={13} className="text-gray-500 shrink-0" />
                    <span className="text-sm text-gray-300 font-medium truncate">{organization.name}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Tabs + content ── */}
        <div className="space-y-5">

          {/* Tab bar */}
          <div className="glass border border-white/[0.08] rounded-xl p-1.5 flex flex-wrap gap-1.5">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? "bg-secondary-500/15 border border-secondary-500/30 text-secondary-400"
                      : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                  }`}>
                  <Icon size={15} />
                  <span className="whitespace-nowrap">{t.label}</span>
                </button>
              );
            })}
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">

            {/* OVERVIEW */}
            {activeTab === "overview" && (
              <div className="glass border border-white/[0.08] rounded-xl p-5 sm:p-6">
                {/* Section header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-5 border-b border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-secondary-500/10 flex items-center justify-center border border-secondary-500/20 shrink-0">
                      <User size={16} className="text-secondary-400" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-white">Personal Information</h2>
                      <p className="text-xs text-gray-500 mt-0.5">Update your name, country and contact details</p>
                    </div>
                  </div>
                  {!editing ? (
                    <button onClick={handleEditStart}
                      className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-secondary-400 bg-secondary-500/10 hover:bg-secondary-500/20 border border-secondary-500/20 transition-all shrink-0">
                      <Pencil size={13} /> Edit Profile
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={handleEditCancel}
                        className="p-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 border border-white/10 transition-all" title="Cancel">
                        <X size={16} />
                      </button>
                      <button onClick={handleEditSave} disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-secondary-500 text-primary-950 hover:bg-secondary-400 transition-all disabled:opacity-50">
                        {saving ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Save size={13} />}
                        Save
                      </button>
                    </div>
                  )}
                </div>

                {profileMsg && (
                  <div className={`flex items-center gap-3 p-3.5 rounded-xl mb-5 text-sm border ${
                    profileMsg.type === "success" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
                  }`}>
                    {profileMsg.type === "success" ? <Check size={18} /> : <AlertCircle size={18} />}
                    <span className="font-medium">{profileMsg.text}</span>
                  </div>
                )}

                {editing ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">First Name <span className="text-red-400">*</span></label>
                      <input className={inputCls} value={editForm.first_name}
                        onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))}
                        placeholder="Enter your first name" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Last Name <span className="text-red-400">*</span></label>
                      <input className={inputCls} value={editForm.last_name}
                        onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))}
                        placeholder="Enter your last name" />
                    </div>

                    {/* Country dropdown — full width */}
                    <div className="sm:col-span-2 relative">
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Country</label>
                      <button type="button"
                        onClick={() => { setShowCountryDropdown(v => !v); setCountrySearch(""); }}
                        className={`${inputCls} flex items-center gap-2 text-left`}>
                        {editForm.country ? (
                          <>
                            <span className="text-base leading-none">{countries.find(c => c.country === editForm.country)?.flag}</span>
                            <span className="flex-1 truncate">{editForm.country}</span>
                            <span className="text-gray-500 text-xs shrink-0">{countries.find(c => c.country === editForm.country)?.international_dialing}</span>
                          </>
                        ) : (
                          <span className="text-gray-500 flex-1">Select your country</span>
                        )}
                        <ChevronRight size={14} className={`text-gray-500 transition-transform shrink-0 ${showCountryDropdown ? "rotate-90" : ""}`} />
                      </button>
                      {showCountryDropdown && (
                        <div className="absolute z-50 mt-1 w-full bg-primary-900 border border-white/10 rounded-lg shadow-xl max-h-56 overflow-hidden">
                          <div className="p-2 border-b border-white/10">
                            <input type="text" value={countrySearch}
                              onChange={e => setCountrySearch(e.target.value)}
                              placeholder="Search countries..."
                              className="w-full bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-white text-sm placeholder-gray-500 focus:outline-none"
                              autoFocus />
                          </div>
                          <div className="overflow-y-auto max-h-44">
                            {countries
                              .filter(c => c.country.toLowerCase().includes(countrySearch.toLowerCase()))
                              .map(c => (
                                <div key={c.id}
                                  className={`flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-white/10 transition-colors ${editForm.country === c.country ? "bg-secondary-500/15 text-secondary-400" : "text-white"}`}
                                  onClick={() => {
                                    setEditForm(f => ({ ...f, country: c.country, phone_prefix: c.international_dialing || f.phone_prefix }));
                                    setShowCountryDropdown(false);
                                    setCountrySearch("");
                                  }}>
                                  <span className="text-base leading-none">{c.flag}</span>
                                  <span className="flex-1 truncate">{c.country}</span>
                                  {c.international_dialing && <span className="text-gray-500 text-xs shrink-0">{c.international_dialing}</span>}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Phone Number</label>
                      <div className="flex rounded-lg overflow-hidden border border-white/10 focus-within:border-secondary-500/50 focus-within:ring-1 focus-within:ring-secondary-500/20 transition-all bg-white/5">
                        <div className="flex items-center px-3 bg-white/5 border-r border-white/10 select-none text-sm text-gray-400 font-medium whitespace-nowrap shrink-0">
                          {selectedDialCode}
                        </div>
                        <input type="tel" className="w-full bg-transparent px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none"
                          value={editForm.phone_local}
                          onChange={e => setEditForm(f => ({ ...f, phone_local: e.target.value.replace(/[^0-9\s-]/g, "") }))}
                          placeholder="77 123 4567" />
                      </div>
                    </div>

                    {/* NIC */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">National ID (NIC)</label>
                      <input className={inputCls} value={editForm.nic}
                        onChange={e => setEditForm(f => ({ ...f, nic: e.target.value }))}
                        placeholder="e.g. 987654321V" />
                    </div>

                    {/* Email — read-only */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Email Address</label>
                      <div className={`${inputCls} opacity-40 cursor-not-allowed select-none truncate`}>{profile.email}</div>
                      <p className="text-[10px] text-gray-600 font-medium mt-1.5 uppercase tracking-wider">Email address cannot be changed</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                    <DetailItem icon={Mail} label="Email Address" value={profile.email} copyable />
                    <DetailItem icon={Phone} label="Phone Number" value={profile.phone_number} />
                    <DetailItem icon={CreditCard} label="National ID (NIC)" value={profile.nic} />
                    <DetailItem icon={MapPin} label="Country" value={profile.country} />
                  </div>
                )}
              </div>
            )}

            {/* AUDITOR PROFILE */}
            {activeTab === "auditor_profile" && accessToken && (
              <AuditorProfileTabs accessToken={accessToken} />
            )}

            {/* SECURITY */}
            {activeTab === "security" && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
                <div className="xl:col-span-2 glass border border-white/[0.08] rounded-xl p-5 sm:p-6">
                  <div className="flex items-center gap-3 mb-6 pb-5 border-b border-white/[0.06]">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
                      <Lock size={16} className="text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-white">Change Password</h2>
                      <p className="text-xs text-gray-500 mt-0.5">Keep your account secure with a strong password</p>
                    </div>
                  </div>

                  {passwordMsg && (
                    <div className={`flex items-center gap-3 p-3.5 rounded-xl mb-6 text-sm border ${
                      passwordMsg.type === "success" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
                    }`}>
                      {passwordMsg.type === "success" ? <Check size={18} /> : <AlertCircle size={18} />}
                      <span className="font-medium">{passwordMsg.text}</span>
                    </div>
                  )}

                  <form onSubmit={handleChangePassword} className="space-y-5">
                    <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl space-y-4">
                      <div className="pb-4 border-b border-white/[0.06]">
                        <PasswordInput label="Current Password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} show={showCurrent} toggleShow={() => setShowCurrent(!showCurrent)} placeholder="Enter your current password" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <PasswordInput label="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} show={showNew} toggleShow={() => setShowNew(!showNew)} placeholder="Min. 8 characters" />
                        <PasswordInput label="Confirm New Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} show={showConfirm} toggleShow={() => setShowConfirm(!showConfirm)} placeholder="Repeat new password" />
                      </div>
                    </div>
                    <button type="submit" disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                      className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-secondary-500 text-primary-950 hover:bg-secondary-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                      {changingPassword ? "Updating..." : "Save New Password"}
                      {!changingPassword && <ChevronRight size={16} />}
                    </button>
                  </form>
                </div>

                <div className="xl:col-span-1 glass border border-white/[0.08] rounded-xl p-5">
                  <div className="w-10 h-10 rounded-lg bg-secondary-500/10 border border-secondary-500/20 flex items-center justify-center mb-4">
                    <ShieldCheck className="w-5 h-5 text-secondary-400" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1.5">Password Standards</h3>
                  <p className="text-xs text-gray-500 mb-4">Follow these guidelines for a secure account:</p>
                  <ul className="space-y-3 text-xs text-gray-400 font-medium">
                    {[
                      "Minimum 8 characters long",
                      "Mix letters, numbers and symbols",
                      "Avoid common or sequential terms",
                    ].map((tip) => (
                      <li key={tip} className="flex items-start gap-2">
                        <Check size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────── */

function DetailItem({ icon: Icon, label, value, copyable, className = "" }: {
  icon: React.ElementType; label: string; value?: string | null; copyable?: boolean; className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className={`flex items-start gap-3.5 group/item ${className}`}>
      <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
        <Icon size={15} className="text-gray-400" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5 relative">
        <p className="text-[11px] font-medium text-gray-500 mb-1">{label}</p>
        <p className={`text-sm font-medium truncate ${value ? "text-white" : "text-gray-500 italic"}`}>{value || "Not provided"}</p>
        {copyable && value && (
          <button onClick={handleCopy}
            className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[10px] text-gray-300 transition-all font-bold border border-white/10">
            {copied ? "Copied!" : "Copy"}
          </button>
        )}
      </div>
    </div>
  );
}

function PasswordInput({ label, value, onChange, show, toggleShow, placeholder }: {
  label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  show: boolean; toggleShow: () => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
      <div className="relative">
        <input type={show ? "text" : "password"} value={value} onChange={onChange} required
          placeholder={placeholder || "••••••••"}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-secondary-500/50 focus:ring-1 focus:ring-secondary-500/20 transition-all pr-12" />
        <button type="button" onClick={toggleShow} tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-white/10 hover:text-white transition-colors">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}
