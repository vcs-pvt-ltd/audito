"use client";

import { useState, useEffect } from "react";
import { auditorProfileApi } from "@/lib/api";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import {
  Trash2, FileText, Check, AlertCircle, Save, Paperclip, UploadCloud,
  User, Briefcase, GraduationCap, Award, Plus, MapPin, Phone,
  Building2, Calendar, ExternalLink,
} from "lucide-react";

const inputCls =
  "w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-secondary-500/50 focus:ring-1 focus:ring-secondary-500/20 transition-all";

const labelCls = "block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wide";

export function AuditorProfileTabs({ accessToken }: { accessToken: string }) {
  const [activeTab, setActiveTab] = useState<"personal" | "experiences" | "qualifications" | "trainings">("personal");

  const [profile, setProfile] = useState<any>(null);
  const [experiences, setExperiences] = useState<any[]>([]);
  const [qualifications, setQualifications] = useState<any[]>([]);
  const [trainings, setTrainings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await auditorProfileApi.getProfile(accessToken);
      if (res.success && res.data) {
        const data = res.data as any;
        setProfile(data.profile);
        setExperiences(data.experiences || []);
        setQualifications(data.qualifications || []);
        setTrainings(data.trainings || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [accessToken]);

  const showMsg = (text: string, type: "success" | "error" = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3000);
  };

  const tabs = [
    { id: "personal" as const, label: "Personal", icon: User, count: null },
    { id: "experiences" as const, label: "Experience", icon: Briefcase, count: experiences.length },
    { id: "qualifications" as const, label: "Qualifications", icon: GraduationCap, count: qualifications.length },
    { id: "trainings" as const, label: "Trainings", icon: Award, count: trainings.length },
  ];

  if (loading) {
    return (
      <div className="glass border border-white/[0.08] rounded-xl p-10 flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Sub-tabs */}
      <div className="glass border border-white/[0.08] rounded-xl p-1.5 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-secondary-500/15 text-secondary-400 border border-secondary-500/30"
                  : "text-gray-400 hover:text-white hover:bg-white/[0.04] border border-transparent"
              }`}>
              <Icon size={15} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden text-[11px]">{tab.label.split(" ")[0]}</span>
              {tab.count !== null && tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? "bg-secondary-500/20 text-secondary-300" : "bg-white/10 text-gray-500"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {msg && (
        <div className={`p-3.5 rounded-xl flex items-center gap-3 text-sm font-medium border ${
          msg.type === "success" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
        }`}>
          {msg.type === "success" ? <Check size={16} /> : <AlertCircle size={16} />}
          {msg.text}
        </div>
      )}

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === "personal" && (
          <PersonalTab profile={profile} accessToken={accessToken} onSuccess={() => { showMsg("Profile updated."); loadData(); }} />
        )}
        {activeTab === "experiences" && (
          <ExperiencesTab experiences={experiences} accessToken={accessToken} onSuccess={() => { showMsg("Experience saved."); loadData(); }} />
        )}
        {activeTab === "qualifications" && (
          <QualificationsTab qualifications={qualifications} accessToken={accessToken} onSuccess={() => { showMsg("Qualification saved."); loadData(); }} />
        )}
        {activeTab === "trainings" && (
          <TrainingsTab trainings={trainings} accessToken={accessToken} onSuccess={() => { showMsg("Training saved."); loadData(); }} />
        )}
      </div>
    </div>
  );
}

/* ─── Section heading ─── */
function SectionHeading({ icon: Icon, title, color = "secondary" }: {
  icon: React.ElementType; title: string; color?: "secondary" | "blue" | "emerald";
}) {
  const colorMap = {
    secondary: "bg-secondary-500/10 border-secondary-500/20 text-secondary-400",
    blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  };
  return (
    <div className="flex items-center gap-2.5 sm:col-span-2 lg:col-span-3 pb-2 mt-2 border-b border-white/[0.06]">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${colorMap[color]}`}>
        <Icon size={14} />
      </div>
      <h3 className="text-xs font-semibold text-white uppercase tracking-wide">{title}</h3>
    </div>
  );
}

/* ─── Personal Tab ─── */
function PersonalTab({ profile, accessToken, onSuccess }: any) {
  const [form, setForm] = useState(profile || {});
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<any>({});

  const handleSave = async () => {
    setSaving(true);
    try {
      await auditorProfileApi.updateProfile(accessToken, form, files);
      onSuccess();
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, val: any) => setForm((p: any) => ({ ...p, [field]: val }));
  const handleFile = (field: string, e: any) => {
    if (e.target.files?.[0]) setFiles((p: any) => ({ ...p, [field]: e.target.files[0] }));
  };

  return (
    <div className="glass border border-white/[0.08] rounded-xl p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-secondary-500/10 border border-secondary-500/20 flex items-center justify-center shrink-0">
            <FileText size={16} className="text-secondary-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Auditor Details</h2>
            <p className="text-xs text-gray-500 mt-0.5">Your professional profile information</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-secondary-500 text-primary-950 hover:bg-secondary-400 disabled:opacity-50 transition-all shrink-0">
          {saving ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Save size={14} />}
          {saving ? "Saving..." : "Save Details"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">

        <SectionHeading icon={User} title="Basic Information" color="secondary" />
        <Field label="Name with Initials" value={form.name_with_initials}
          onChange={(v) => handleChange("name_with_initials", v)} placeholder="e.g. A.B. Silva" />
        <Field label="Designation" value={form.designation}
          onChange={(v) => handleChange("designation", v)} placeholder="e.g. Senior Auditor" />
        <div>
          <label className={labelCls}>Gender</label>
          <select className={inputCls} value={form.gender || ""} onChange={e => handleChange("gender", e.target.value)}>
            <option value="">Select gender...</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Date of Birth</label>
          <input type="date" className={inputCls}
            value={form.date_of_birth ? form.date_of_birth.split("T")[0] : ""}
            onChange={e => handleChange("date_of_birth", e.target.value)}
            placeholder="Select date of birth" />
        </div>
        <div>
          <label className={labelCls}>Civil Status</label>
          <select className={inputCls} value={form.civil_status || ""} onChange={e => handleChange("civil_status", e.target.value)}>
            <option value="">Select status...</option>
            <option value="Single">Single</option>
            <option value="Married">Married</option>
            <option value="Divorced">Divorced</option>
            <option value="Widowed">Widowed</option>
          </select>
        </div>

        <SectionHeading icon={MapPin} title="Address & Location" color="emerald" />
        <Field label="Address Line 1" value={form.address_line_1}
          onChange={(v) => handleChange("address_line_1", v)} placeholder="Street address" />
        <Field label="Address Line 2" value={form.address_line_2}
          onChange={(v) => handleChange("address_line_2", v)} placeholder="Apartment, suite, etc." />
        <Field label="Address Line 3" value={form.address_line_3}
          onChange={(v) => handleChange("address_line_3", v)} placeholder="Additional address info" />
        <Field label="District" value={form.district}
          onChange={(v) => handleChange("district", v)} placeholder="e.g. Colombo" />
        <Field label="City" value={form.city}
          onChange={(v) => handleChange("city", v)} placeholder="e.g. Colombo" />
        <Field label="Latitude" type="number" value={form.latitude}
          onChange={(v) => handleChange("latitude", v)} placeholder="e.g. 6.9271" />
        <Field label="Longitude" type="number" value={form.longitude}
          onChange={(v) => handleChange("longitude", v)} placeholder="e.g. 79.8612" />

        <SectionHeading icon={Phone} title="Contact Details" color="blue" />
        <Field label="Mobile Number" value={form.mobile_number}
          onChange={(v) => handleChange("mobile_number", v)} placeholder="e.g. +94 77 123 4567" />
        <Field label="WhatsApp Number" value={form.whatsapp_number}
          onChange={(v) => handleChange("whatsapp_number", v)} placeholder="e.g. +94 77 123 4567" />
        <Field label="Home Number" value={form.home_number}
          onChange={(v) => handleChange("home_number", v)} placeholder="e.g. +94 11 234 5678" />

        <SectionHeading icon={Briefcase} title="Professional Info" color="secondary" />
        <Field label="Specialized Network" value={form.specialized_network}
          onChange={(v) => handleChange("specialized_network", v)} placeholder="e.g. ISO, CISA, CISM" />
        <div>
          <label className={labelCls}>Working Status</label>
          <select className={inputCls} value={form.working_status || ""} onChange={e => handleChange("working_status", e.target.value)}>
            <option value="">Select status...</option>
            <option value="Employed">Employed</option>
            <option value="Retired">Retired</option>
          </select>
        </div>
        <Field label="Current Sector" value={form.current_sector}
          onChange={(v) => handleChange("current_sector", v)} placeholder="e.g. Financial Services" />
        <Field label="Current Organization" value={form.current_organization}
          onChange={(v) => handleChange("current_organization", v)} placeholder="e.g. ABC Corporation Ltd" />
        <Field label="Join As" value={form.join_as}
          onChange={(v) => handleChange("join_as", v)} placeholder="e.g. Lead Auditor" />
      </div>

      {/* Uploads */}
      <div className="mt-6 pt-5 border-t border-white/[0.06]">
        <h3 className="text-xs font-semibold text-white uppercase tracking-wide mb-4 flex items-center gap-2">
          <UploadCloud size={14} className="text-secondary-400" /> Documents
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <UploadBox label="Profile Picture" icon={UploadCloud} accept="image/*"
            fileName={files.profile_picture?.name} saved={!!form.profile_picture}
            onChange={(e) => handleFile("profile_picture", e)} />
          <UploadBox label="E-Signature" icon={UploadCloud} accept="image/*"
            fileName={files.signature_path?.name} saved={!!form.signature_path}
            onChange={(e) => handleFile("signature_path", e)} />
          <UploadBox label="Detailed CV (PDF)" icon={FileText} accept=".pdf"
            fileName={files.cv_path?.name} saved={!!form.cv_path}
            onChange={(e) => handleFile("cv_path", e)} />
        </div>
      </div>
    </div>
  );
}

/* ─── Experiences Tab ─── */
function ExperiencesTab({ experiences, accessToken, onSuccess }: any) {
  const { confirm } = useUiFeedback();
  const [form, setForm] = useState({ industry_sector: "", experience_type: "", company_name: "", years: "" });
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!form.company_name.trim()) return;
    setAdding(true);
    try {
      await auditorProfileApi.addExperience(accessToken, form);
      setForm({ industry_sector: "", experience_type: "", company_name: "", years: "" });
      onSuccess();
    } finally { setAdding(false); }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({ title: "Delete Experience", message: "Are you sure you want to delete this experience?", confirmText: "Delete", variant: "warning" });
    if (!ok) return;
    await auditorProfileApi.deleteExperience(accessToken, id);
    onSuccess();
  };

  return (
    <div className="space-y-5">
      <AddCard icon={Briefcase} title="Add Experience" onAdd={handleAdd} adding={adding} addLabel="Add Experience" disabled={!form.company_name.trim()}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="Industry Sector" value={form.industry_sector}
            onChange={(v) => setForm(f => ({ ...f, industry_sector: v }))} placeholder="e.g. Finance, IT" />
          <Field label="Experience Type" value={form.experience_type}
            onChange={(v) => setForm(f => ({ ...f, experience_type: v }))} placeholder="e.g. Internal Audit" />
          <Field label="Company Name" value={form.company_name}
            onChange={(v) => setForm(f => ({ ...f, company_name: v }))} placeholder="e.g. ABC Corp Ltd" />
          <Field label="Years" type="number" value={form.years}
            onChange={(v) => setForm(f => ({ ...f, years: v }))} placeholder="e.g. 3" />
        </div>
      </AddCard>

      <ListContainer count={experiences.length} emptyIcon={Briefcase} emptyText="No experiences added yet.">
        {experiences.map((ex: any) => (
          <ItemCard key={ex.id} onDelete={() => handleDelete(ex.id)}
            icon={Building2}
            title={ex.company_name}
            badge={`${ex.years} yr${ex.years === 1 ? "" : "s"}`}
            subtitle={`${ex.industry_sector || "—"} • ${ex.experience_type || "—"}`}
          />
        ))}
      </ListContainer>
    </div>
  );
}

/* ─── Qualifications Tab ─── */
function QualificationsTab({ qualifications, accessToken, onSuccess }: any) {
  const { confirm } = useUiFeedback();
  const [form, setForm] = useState({ qualification_name: "", university_name: "", degree: "", year: "" });
  const [file, setFile] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!form.qualification_name.trim()) return;
    setAdding(true);
    try {
      await auditorProfileApi.addQualification(accessToken, form, file || undefined);
      setForm({ qualification_name: "", university_name: "", degree: "", year: "" });
      setFile(null);
      onSuccess();
    } finally { setAdding(false); }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({ title: "Delete Qualification", message: "Are you sure you want to delete this qualification?", confirmText: "Delete", variant: "warning" });
    if (!ok) return;
    await auditorProfileApi.deleteQualification(accessToken, id);
    onSuccess();
  };

  return (
    <div className="space-y-5">
      <AddCard icon={GraduationCap} title="Add Qualification" onAdd={handleAdd} adding={adding} addLabel="Add Qualification" disabled={!form.qualification_name.trim()}
        attachment={<AttachFile file={file} onChange={(f) => setFile(f)} />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="Qualification Name" value={form.qualification_name}
            onChange={(v) => setForm(f => ({ ...f, qualification_name: v }))} placeholder="e.g. BSc Computer Science" />
          <Field label="University / Institute" value={form.university_name}
            onChange={(v) => setForm(f => ({ ...f, university_name: v }))} placeholder="e.g. University of Colombo" />
          <Field label="Degree / Grade" value={form.degree}
            onChange={(v) => setForm(f => ({ ...f, degree: v }))} placeholder="e.g. Second Class Upper" />
          <Field label="Completion Year" value={form.year}
            onChange={(v) => setForm(f => ({ ...f, year: v }))} placeholder="e.g. 2020" />
        </div>
      </AddCard>

      <ListContainer count={qualifications.length} emptyIcon={GraduationCap} emptyText="No qualifications added yet.">
        {qualifications.map((q: any) => (
          <ItemCard key={q.id} onDelete={() => handleDelete(q.id)}
            icon={GraduationCap}
            title={`${q.qualification_name}${q.degree ? ` — ${q.degree}` : ""}`}
            badge={q.year}
            subtitle={q.university_name}
            link={q.certificate_path}
          />
        ))}
      </ListContainer>
    </div>
  );
}

/* ─── Trainings Tab ─── */
function TrainingsTab({ trainings, accessToken, onSuccess }: any) {
  const { confirm } = useUiFeedback();
  const [form, setForm] = useState({ training_type: "", course_name: "", organization: "", duration: "", year: "" });
  const [file, setFile] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!form.course_name.trim()) return;
    setAdding(true);
    try {
      await auditorProfileApi.addTraining(accessToken, form, file || undefined);
      setForm({ training_type: "", course_name: "", organization: "", duration: "", year: "" });
      setFile(null);
      onSuccess();
    } finally { setAdding(false); }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({ title: "Delete Training", message: "Are you sure you want to delete this training?", confirmText: "Delete", variant: "warning" });
    if (!ok) return;
    await auditorProfileApi.deleteTraining(accessToken, id);
    onSuccess();
  };

  return (
    <div className="space-y-5">
      <AddCard icon={Award} title="Add Training" onAdd={handleAdd} adding={adding} addLabel="Add Training" disabled={!form.course_name.trim()}
        attachment={<AttachFile file={file} onChange={(f) => setFile(f)} />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Field label="Training Type" value={form.training_type}
            onChange={(v) => setForm(f => ({ ...f, training_type: v }))} placeholder="e.g. ISO 9001" />
          <Field label="Course Name" value={form.course_name}
            onChange={(v) => setForm(f => ({ ...f, course_name: v }))} placeholder="e.g. Lead Auditor" />
          <Field label="Organization" value={form.organization}
            onChange={(v) => setForm(f => ({ ...f, organization: v }))} placeholder="e.g. BSI Group" />
          <Field label="Duration" value={form.duration}
            onChange={(v) => setForm(f => ({ ...f, duration: v }))} placeholder="e.g. 5 Days" />
          <Field label="Year" value={form.year}
            onChange={(v) => setForm(f => ({ ...f, year: v }))} placeholder="e.g. 2023" />
        </div>
      </AddCard>

      <ListContainer count={trainings.length} emptyIcon={Award} emptyText="No trainings added yet.">
        {trainings.map((t: any) => (
          <ItemCard key={t.id} onDelete={() => handleDelete(t.id)}
            icon={Award}
            title={t.course_name}
            badge={t.year}
            subtitle={`${t.training_type || "—"} • ${t.organization || "—"}${t.duration ? ` (${t.duration})` : ""}`}
            link={t.certificate_path}
          />
        ))}
      </ListContainer>
    </div>
  );
}

/* ─── Shared sub-components ─── */

function Field({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: any; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input type={type} step={type === "number" ? "any" : undefined} className={inputCls}
        value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function UploadBox({ label, icon: Icon, accept, fileName, saved, onChange }: {
  label: string; icon: React.ElementType; accept: string; fileName?: string; saved?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="p-4 rounded-xl border border-dashed border-white/15 bg-white/[0.02] hover:bg-white/[0.05] hover:border-secondary-500/30 cursor-pointer transition-all text-center flex flex-col items-center justify-center min-h-[110px] group">
      <Icon size={22} className="mb-2 text-gray-400 group-hover:text-secondary-400 transition-colors" />
      <span className="text-sm font-medium text-white block">{label}</span>
      <span className={`text-xs mt-1 truncate max-w-full ${fileName ? "text-secondary-400" : saved ? "text-emerald-400" : "text-gray-500"}`}>
        {fileName || (saved ? "✓ Saved" : "No file selected")}
      </span>
      <input type="file" className="hidden" accept={accept} onChange={onChange} />
    </label>
  );
}

function AttachFile({ file, onChange }: { file: File | null; onChange: (f: File | null) => void }) {
  return (
    <label className="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-300 border border-white/10 cursor-pointer inline-flex items-center gap-2 transition-colors w-full sm:w-auto justify-center">
      <Paperclip size={15} />
      <span className="truncate max-w-[180px]">{file ? file.name : "Attach Certificate"}</span>
      <input type="file" className="hidden" onChange={(e) => onChange(e.target.files?.[0] || null)} />
    </label>
  );
}

function AddCard({ icon: Icon, title, children, onAdd, adding, addLabel, disabled, attachment }: {
  icon: React.ElementType; title: string; children: React.ReactNode;
  onAdd: () => void; adding?: boolean; addLabel: string; disabled?: boolean; attachment?: React.ReactNode;
}) {
  return (
    <div className="glass border border-white/[0.08] rounded-xl p-5 sm:p-6">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 rounded-lg bg-secondary-500/10 border border-secondary-500/20 flex items-center justify-center shrink-0">
          <Icon size={15} className="text-secondary-400" />
        </div>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      {children}
      <div className={`mt-4 flex flex-col sm:flex-row sm:items-center gap-3 ${attachment ? "justify-between" : "justify-end"}`}>
        {attachment}
        <button onClick={onAdd} disabled={adding || disabled}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary-500 text-primary-950 hover:bg-secondary-400 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto">
          {adding ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Plus size={15} />}
          {addLabel}
        </button>
      </div>
    </div>
  );
}

function ListContainer({ count, children, emptyIcon: EmptyIcon, emptyText }: {
  count: number; children: React.ReactNode; emptyIcon: React.ElementType; emptyText: string;
}) {
  if (count === 0) {
    return (
      <div className="glass border border-white/[0.08] rounded-xl p-10 text-center">
        <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
          <EmptyIcon size={22} className="text-gray-600" />
        </div>
        <p className="text-gray-500 text-sm">{emptyText}</p>
      </div>
    );
  }
  return <div className="space-y-2.5">{children}</div>;
}

function ItemCard({ icon: Icon, title, badge, subtitle, link, onDelete }: {
  icon: React.ElementType; title: string; badge?: string; subtitle?: string; link?: string; onDelete: () => void;
}) {
  return (
    <div className="glass border border-white/[0.08] rounded-xl p-4 flex items-start justify-between gap-3 hover:border-white/[0.14] transition-all">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-secondary-500/10 border border-secondary-500/20 flex items-center justify-center shrink-0 mt-0.5">
          <Icon size={15} className="text-secondary-400" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm text-white font-medium">{title}</p>
            {badge && (
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400">
                <Calendar size={9} /> {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          {link && (
            <a href={link} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-secondary-400 text-xs mt-1.5 hover:underline">
              <ExternalLink size={11} /> View Certificate
            </a>
          )}
        </div>
      </div>
      <button onClick={onDelete}
        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0 border border-transparent hover:border-red-500/20">
        <Trash2 size={15} />
      </button>
    </div>
  );
}
