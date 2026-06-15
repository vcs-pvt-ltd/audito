"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/lib/api";

import {
  User, Mail, Phone, MapPin, CreditCard, Lock,
  Eye, EyeOff, Check, AlertCircle, Globe, Hash, ShieldCheck,
  Briefcase, Key, LogOut, ChevronRight, Pencil, X, Save, FileText,
  Camera, Trash2, Upload
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

const MEDIA_ORIGIN = process.env.NEXT_PUBLIC_MEDIA_URL || (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "");

const getAvatarUrl = (path: string | null) => {
  if (!path) return null;
  if (path.startsWith("data:")) return path; // base64 preview
  if (path.startsWith("http")) return path;
  return `${MEDIA_ORIGIN}${path}`;
};

const COUNTRY_CODES: Record<string, string> = {
  "Sri Lanka": "+94",
  "SriLanka": "+94",
  "India": "+91",
  "Bangladesh": "+880",
  "United Kingdom": "+44",
  "UK": "+44",
  "United States": "+1",
  "USA": "+1",
};

const extractPhone = (fullPhone: string | null, countryStr: string | null) => {
  if (!fullPhone) {
    const cleanCountry = (countryStr || "").trim();
    const code = COUNTRY_CODES[cleanCountry] || "+94";
    return { code, local: "" };
  }

  if (fullPhone.startsWith("+")) {
    const spaceIdx = fullPhone.indexOf(" ");
    if (spaceIdx > 0) {
      return {
        code: fullPhone.substring(0, spaceIdx),
        local: fullPhone.substring(spaceIdx + 1)
      };
    }
    if (fullPhone.startsWith("+880")) return { code: "+880", local: fullPhone.substring(4) };
    if (fullPhone.startsWith("+94") || fullPhone.startsWith("+91")) return { code: "+94", local: fullPhone.substring(3) };
    if (fullPhone.startsWith("+44")) return { code: "+44", local: fullPhone.substring(3) };
    if (fullPhone.startsWith("+1")) return { code: "+1", local: fullPhone.substring(2) };
  }

  const cleanCountry = (countryStr || "").trim();
  const code = COUNTRY_CODES[cleanCountry] || "+94";
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

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    phone_prefix: "+94",
    phone_local: "",
    nic: "",
  });
  const [saving, setSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Profile image upload state
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Change password state
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
      setEditForm({
        first_name: data.admin.first_name,
        last_name: data.admin.last_name,
        phone_prefix: code,
        phone_local: local,
        nic: data.admin.nic || "",
      });
    }
    setLoading(false);
  }, [accessToken]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleEditStart = () => {
    if (!profile) return;
    const { code, local } = extractPhone(profile.phone_number, profile.country);
    setEditForm({
      first_name: profile.first_name,
      last_name: profile.last_name,
      phone_prefix: code,
      phone_local: local,
      nic: profile.nic || "",
    });
    setProfileMsg(null);
    setEditing(true);
  };

  const handleEditCancel = () => {
    setEditing(false);
    setProfileMsg(null);
  };

  const handleEditSave = async () => {
    if (!accessToken || !profile) return;
    if (!editForm.first_name.trim() || !editForm.last_name.trim()) {
      setProfileMsg({ type: "error", text: "First name and last name are required." });
      return;
    }
    setSaving(true);
    setProfileMsg(null);
    try {
      const fullPhone = editForm.phone_local.trim()
        ? `${editForm.phone_prefix} ${editForm.phone_local.trim()}`
        : "";
      const res = await authApi.updateProfile(accessToken, {
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        phone_number: fullPhone || undefined,
        nic: editForm.nic || undefined,
        country: profile.country || undefined, // keep existing country
        profile_image: profile.profile_image, // keep existing image
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

  const handleImageSelect = () => {
    fileInputRef.current?.click();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !accessToken || !profile) return;

    // Check size limit (2MB)
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
          setProfileMsg({ type: "success", text: "Profile image updated successfully." });
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
    reader.onerror = () => {
      setProfileMsg({ type: "error", text: "Failed to read file." });
      setUploadingImage(false);
    };
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
        setProfileMsg({ type: "success", text: "Profile image removed successfully." });
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
      const entityCap = entity.charAt(0).toUpperCase() + entity.slice(1).toLowerCase();
      return `${entityCap} head`;
    }
    if (admin.role === "admin") {
      return ACCOUNT_LABELS[admin.account_type || ""] || admin.account_type || "Admin";
    }
    const roleCap = admin.role.charAt(0).toUpperCase() + admin.role.slice(1).toLowerCase();
    return admin.user_type || roleCap;
  };

  const accountLabel = getRoleLabel();

  const initials = `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`.toUpperCase();

  return (
    <div className="h-screen bg-transparent flex flex-col">
      <main className="flex-1 p-4 lg:p-8 pt-20 lg:pt-8 overflow-y-auto w-full max-w-7xl mx-auto space-y-8">

        {/* Dynamic & Premium Layout Structure */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* 1. Left Side: Premium User Identity Column */}
          <div className="lg:col-span-4 space-y-6">
            <div className="glass border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all duration-300 shadow-xl relative overflow-hidden">
              {/* Premium Glow Accents */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-secondary-500/10 rounded-full blur-3xl -z-10" />
              <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-primary-500/5 rounded-full blur-2xl -z-10" />

              <div className="flex flex-col items-center text-center">
                {/* Photo Upload Container */}
                <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-2xl p-[2px] bg-gradient-to-tr from-secondary-500/30 to-primary-500/30 shadow-xl mb-5">
                  <div className="w-full h-full bg-primary-950 rounded-2xl overflow-hidden relative flex items-center justify-center group/avatar">
                    {uploadingImage ? (
                      <div className="absolute inset-0 bg-black/60 z-20 flex items-center justify-center">
                        <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : null}

                    {profile.profile_image ? (
                      <img
                        src={getAvatarUrl(profile.profile_image) || ""}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-br from-secondary-300 to-secondary-500 text-transparent bg-clip-text">
                        {initials || <User size={48} className="text-secondary-400" />}
                      </div>
                    )}

                    {/* Photo Action Hover Overlay */}
                    <button
                      onClick={handleImageSelect}
                      type="button"
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover/avatar:opacity-100 flex flex-col items-center justify-center gap-2 transition-all duration-200 cursor-pointer z-10 text-white"
                    >
                      <Camera size={24} className="text-secondary-400" />
                      <span className="text-[11px] font-semibold tracking-wider uppercase">Change Photo</span>
                    </button>
                  </div>

                  {/* Small Floating Camera Icon for Mobile indicator */}
                  <div className="absolute bottom-1 right-1 w-8 h-8 bg-secondary-500 text-primary-950 rounded-xl flex items-center justify-center border-2 border-primary-950 shadow-lg pointer-events-none md:hidden">
                    <Camera size={14} />
                  </div>
                </div>

                {/* File input for images */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />

                {/* Remove Image Button if image exists */}
                {profile.profile_image && (
                  <button
                    onClick={handleRemoveImage}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 rounded-xl transition-all duration-200 mb-6"
                  >
                    <Trash2 size={12} /> Remove photo
                  </button>
                )}

                {/* User Badges & Meta */}
                <h2 className="text-xl font-bold text-white tracking-tight leading-snug">
                  {profile.first_name} {profile.last_name}
                </h2>

                <p className="text-sm text-gray-500 font-medium mt-1 truncate max-w-full">
                  {profile.email}
                </p>

                <div className="flex flex-wrap gap-2 justify-center mt-4 mb-8">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-500/10 text-secondary-400 text-[11px] font-bold tracking-wider uppercase border border-secondary-500/20">
                    <ShieldCheck size={12} /> {accountLabel}
                  </span>

                </div>

                {/* Sign Out CTA */}
                <button
                  onClick={logout}
                  className="w-full mt-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl text-sm font-medium transition-all border border-red-500/20"
                >
                  <LogOut size={16} /> Sign Out
                </button>
              </div>
            </div>
          </div>

          {/* 2. Right Side: Tab Selector and Forms Container */}
          <div className="lg:col-span-8 space-y-6">

            {/* Header Tabs Navigation */}
            <div className="glass border border-white/10 rounded-xl p-1.5 flex flex-wrap gap-1.5 items-center">
              <button
                onClick={() => setActiveTab("overview")}
                className={`flex-1 min-w-[90px] flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "overview"
                    ? "bg-secondary-500/15 border border-secondary-500/30 text-secondary-400 shadow-inner"
                    : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
              >
                <User size={16} /> Overview
              </button>

              {admin.role === "auditor" && (
                <button
                  onClick={() => setActiveTab("auditor_profile")}
                  className={`flex-1 min-w-[110px] flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "auditor_profile"
                      ? "bg-secondary-500/15 border border-secondary-500/30 text-secondary-400 shadow-inner"
                      : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                    }`}
                >
                  <FileText size={16} /> Auditor Profile
                </button>
              )}

              <button
                onClick={() => setActiveTab("security")}
                className={`flex-1 min-w-[110px] flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "security"
                    ? "bg-secondary-500/15 border border-secondary-500/30 text-secondary-400 shadow-inner"
                    : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
              >
                <Key size={16} /> Security Settings
              </button>
            </div>

            {/* Tab Contents */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">

              {/* ── A. OVERVIEW TAB CONTENT ── */}
              {activeTab === "overview" && (
                <div className="glass border border-white/10 rounded-xl p-5 sm:p-6">
                  {/* Ambient Glow */}
                  <div className="absolute top-0 right-0 w-48 h-48 bg-primary-500/5 rounded-full blur-3xl -z-10" />

                  <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/[0.06]">
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 rounded-lg bg-secondary-500/10 flex items-center justify-center border border-secondary-500/20">
                        <User size={16} className="text-secondary-400" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-white">Personal Information</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Manage your identity details</p>
                      </div>
                    </div>

                    {!editing ? (
                      <button
                        onClick={handleEditStart}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-secondary-400 bg-secondary-500/10 hover:bg-secondary-500/20 border border-secondary-500/20 transition-all"
                      >
                        <Pencil size={13} /> Edit Profile
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleEditCancel}
                          className="p-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 border border-white/10 transition-all duration-200"
                          title="Cancel Editing"
                        >
                          <X size={16} />
                        </button>
                        <button
                          onClick={handleEditSave}
                          disabled={saving}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-secondary-500 text-primary-950 hover:bg-secondary-400 transition-all disabled:opacity-50"
                        >
                          {saving ? (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Save size={13} />
                          )}
                          Save
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Profile Status Messages */}
                  {profileMsg && (
                    <div className={`flex items-center gap-3 p-3.5 rounded-xl mb-5 text-sm border ${profileMsg.type === "success"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-red-500/10 text-red-400 border-red-500/20"
                      }`}>
                      {profileMsg.type === "success" ? <Check size={18} /> : <AlertCircle size={18} />}
                      <span className="font-medium">{profileMsg.text}</span>
                    </div>
                  )}

                  {/* Details Field Layout */}
                  {editing ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">First Name <span className="text-red-400">*</span></label>
                        <input
                          className={inputCls}
                          value={editForm.first_name}
                          onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))}
                          placeholder="Enter first name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Last Name <span className="text-red-400">*</span></label>
                        <input
                          className={inputCls}
                          value={editForm.last_name}
                          onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))}
                          placeholder="Enter last name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Phone Number</label>
                        <div className="relative flex rounded-lg overflow-hidden border border-white/10 focus-within:border-secondary-500/50 focus-within:ring-1 focus-within:ring-secondary-500/20 transition-all bg-white/5">
                          <div className="flex items-center gap-1.5 px-3 bg-white/5 border-r border-white/10 select-none text-sm text-gray-400 font-medium">
                            <span>{editForm.phone_prefix}</span>
                          </div>
                          <input
                            type="tel"
                            className="w-full bg-transparent px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none"
                            value={editForm.phone_local}
                            onChange={e => {
                              const val = e.target.value.replace(/[^0-9\s-]/g, "");
                              setEditForm(f => ({ ...f, phone_local: val }));
                            }}
                            placeholder="77 123 4567"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">National ID (NIC)</label>
                        <input
                          className={inputCls}
                          value={editForm.nic}
                          onChange={e => setEditForm(f => ({ ...f, nic: e.target.value }))}
                          placeholder="Enter National Identity Number"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Country</label>
                        <div className={`${inputCls} opacity-40 cursor-not-allowed select-none`}>{profile.country || "Not provided"}</div>
                        <p className="text-[10px] text-gray-600 font-medium mt-1.5 uppercase tracking-wider">Country is read-only</p>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Email Address</label>
                        <div className={`${inputCls} opacity-40 cursor-not-allowed select-none`}>{profile.email}</div>
                        <p className="text-[10px] text-gray-600 font-medium mt-1.5 uppercase tracking-wider">Email address is read-only</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-8">
                      <DetailItem icon={Mail} label="Email Address" value={profile.email} />
                      <DetailItem icon={Phone} label="Phone Number" value={profile.phone_number} />
                      <DetailItem icon={CreditCard} label="National ID (NIC)" value={profile.nic} />
                      <DetailItem icon={MapPin} label="Country" value={profile.country} />
                    </div>
                  )}
                </div>
              )}

              {/* ── B. AUDITOR PROFILE TAB CONTENT ── */}
              {activeTab === "auditor_profile" && accessToken && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <AuditorProfileTabs accessToken={accessToken} />
                </div>
              )}

              {/* ── C. SECURITY SETTINGS TAB CONTENT ── */}
              {activeTab === "security" && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">

                  <div className="xl:col-span-2 glass border border-white/10 rounded-xl p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-6 pb-5 border-b border-white/[0.06]">
                      <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                        <Lock size={16} className="text-emerald-400" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-white">Change Password</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Ensure your account is highly secured</p>
                      </div>
                    </div>

                    {passwordMsg && (
                      <div className={`flex items-center gap-3 p-3.5 rounded-xl mb-6 text-sm border ${passwordMsg.type === "success"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-red-500/10 text-red-400 border-red-500/20"
                        }`}>
                        {passwordMsg.type === "success" ? <Check size={18} /> : <AlertCircle size={18} />}
                        <span className="font-medium">{passwordMsg.text}</span>
                      </div>
                    )}

                    <form onSubmit={handleChangePassword} className="space-y-6">
                      <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl space-y-4">
                        <div className="pb-5 border-b border-white/[0.06]">
                          <PasswordInput
                            label="Current Password"
                            value={currentPassword}
                            onChange={e => setCurrentPassword(e.target.value)}
                            show={showCurrent}
                            toggleShow={() => setShowCurrent(!showCurrent)}
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                          <PasswordInput
                            label="New Password"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            show={showNew}
                            toggleShow={() => setShowNew(!showNew)}
                          />
                          <PasswordInput
                            label="Confirm New Password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            show={showConfirm}
                            toggleShow={() => setShowConfirm(!showConfirm)}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-4 pt-2">
                        <button
                          type="submit"
                          disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                          className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-secondary-500 text-primary-950 hover:bg-secondary-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {changingPassword ? "Updating..." : "Save New Password"}
                          {!changingPassword && <ChevronRight size={16} />}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Password Guide Column */}
                  <div className="xl:col-span-1">
                    <div className="glass border border-white/10 rounded-xl p-5">
                      <ShieldCheck className="w-10 h-10 text-secondary-400 mb-4 opacity-80" />
                      <h3 className="text-base font-bold text-white mb-2">Password Standards</h3>
                      <p className="text-xs text-gray-500 mb-4">Please adhere to secure account policies:</p>

                      <ul className="space-y-3.5 text-xs text-gray-400 font-medium">
                        <li className="flex items-start gap-2">
                          <Check size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                          <span>Minimum 8 characters long</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                          <span>Mix alphanumeric with special symbols</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                          <span>Avoid common terms or sequential digits</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                </div>
              )}

            </div>
          </div>

        </div>

      </main>
    </div>
  );
}

/* ─── Helper Components ──────────────────────────────────────────── */

function DetailItem({ icon: Icon, label, value, copyable, className = "" }: {
  icon: React.ElementType; label: string; value?: string | null; copyable?: boolean; className?: string
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className={`flex items-start gap-4 group/item ${className}`}>
      <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 transition-all">
        <Icon size={15} className="text-gray-400" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5 relative">
        <p className="text-[11px] font-medium text-gray-500 mb-1">{label}</p>
        <p className={`text-sm font-medium ${value ? "text-white" : "text-gray-500 italic"} truncate`}>
          {value || "Not provided"}
        </p>
        {copyable && value && (
          <button
            onClick={handleCopy}
            className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] text-gray-300 transition-all duration-200 font-bold border border-white/10 shadow"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        )}
      </div>
    </div>
  );
}

function PasswordInput({ label, value, onChange, show, toggleShow }: {
  label: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  show: boolean; toggleShow: () => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
      <div className="relative group">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          required
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-secondary-500/50 focus:ring-1 focus:ring-secondary-500/20 transition-all pr-12"
          placeholder="••••••••"
        />
        <button
          type="button"
          onClick={toggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-white/10 hover:text-white transition-colors"
          tabIndex={-1}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}