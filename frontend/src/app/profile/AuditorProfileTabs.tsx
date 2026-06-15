"use client";

import { useState, useEffect } from "react";
import { auditorProfileApi } from "@/lib/api";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { Plus, Pencil, Trash2, FileText, Check, AlertCircle, Save, X, Paperclip, UploadCloud } from "lucide-react";

export function AuditorProfileTabs({ accessToken }: { accessToken: string }) {
  const { confirm } = useUiFeedback();
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

  useEffect(() => {
    loadData();
  }, [accessToken]);

  const showMsg = (text: string, type: "success" | "error" = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3000);
  };

  if (loading) return <div className="text-gray-400 py-10 text-center">Loading auditor data...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-1.5 glass p-1.5 rounded-xl border border-white/10">
        {(["personal", "experiences", "qualifications", "trainings"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all text-center ${
              activeTab === tab
                ? "bg-secondary-500/15 text-secondary-400 border border-secondary-500/30"
                : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {msg && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium border ${msg.type === "success" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
          {msg.type === "success" ? <Check size={16} /> : <AlertCircle size={16} />}
          {msg.text}
        </div>
      )}

      {activeTab === "personal" && (
        <PersonalTab profile={profile} accessToken={accessToken} onSuccess={() => { showMsg("Profile updated."); loadData(); }} />
      )}
      {activeTab === "experiences" && (
        <ExperiencesTab experiences={experiences} accessToken={accessToken} onSuccess={() => { showMsg("Experiences updated."); loadData(); }} />
      )}
      {activeTab === "qualifications" && (
        <QualificationsTab qualifications={qualifications} accessToken={accessToken} onSuccess={() => { showMsg("Qualifications updated."); loadData(); }} />
      )}
      {activeTab === "trainings" && (
        <TrainingsTab trainings={trainings} accessToken={accessToken} onSuccess={() => { showMsg("Trainings updated."); loadData(); }} />
      )}
    </div>
  );
}

const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-secondary-500/50 focus:ring-1 focus:ring-secondary-500/20 transition-all";

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
    <div className="glass border border-white/10 rounded-xl p-5 sm:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Auditor Profile Details</h2>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-secondary-500 text-primary-950 hover:bg-secondary-400 disabled:opacity-50">
          <Save size={16} /> {saving ? "Saving..." : "Save Details"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 uppercase">Name with Initials</label>
          <input className={inputCls} value={form.name_with_initials || ""} onChange={e => handleChange("name_with_initials", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 uppercase">Designation</label>
          <input className={inputCls} value={form.designation || ""} onChange={e => handleChange("designation", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 uppercase">Gender</label>
          <select className={inputCls} value={form.gender || ""} onChange={e => handleChange("gender", e.target.value)}>
            <option value="">Select...</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 uppercase">Date of Birth</label>
          <input type="date" className={inputCls} value={form.date_of_birth ? form.date_of_birth.split("T")[0] : ""} onChange={e => handleChange("date_of_birth", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 uppercase">Civil Status</label>
          <input className={inputCls} value={form.civil_status || ""} onChange={e => handleChange("civil_status", e.target.value)} />
        </div>
        
        <div className="md:col-span-2 lg:col-span-3"><h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide pb-2 border-b border-white/[0.06]">Address & Location</h3></div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 uppercase">Address Line 1</label>
          <input className={inputCls} value={form.address_line_1 || ""} onChange={e => handleChange("address_line_1", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 uppercase">Address Line 2</label>
          <input className={inputCls} value={form.address_line_2 || ""} onChange={e => handleChange("address_line_2", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 uppercase">Address Line 3</label>
          <input className={inputCls} value={form.address_line_3 || ""} onChange={e => handleChange("address_line_3", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 uppercase">District</label>
          <input className={inputCls} value={form.district || ""} onChange={e => handleChange("district", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 uppercase">City</label>
          <input className={inputCls} value={form.city || ""} onChange={e => handleChange("city", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 uppercase">Latitude</label>
          <input type="number" step="any" className={inputCls} value={form.latitude || ""} onChange={e => handleChange("latitude", e.target.value)} placeholder="e.g. 6.9271" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 uppercase">Longitude</label>
          <input type="number" step="any" className={inputCls} value={form.longitude || ""} onChange={e => handleChange("longitude", e.target.value)} placeholder="e.g. 79.8612" />
        </div>

        <div className="md:col-span-2 lg:col-span-3"><h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wide pb-2 border-b border-white/[0.06]">Contact Details</h3></div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 uppercase">Mobile Number</label>
          <input className={inputCls} value={form.mobile_number || ""} onChange={e => handleChange("mobile_number", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 uppercase">WhatsApp Number</label>
          <input className={inputCls} value={form.whatsapp_number || ""} onChange={e => handleChange("whatsapp_number", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 uppercase">Home Number</label>
          <input className={inputCls} value={form.home_number || ""} onChange={e => handleChange("home_number", e.target.value)} />
        </div>

        <div className="md:col-span-2 lg:col-span-3"><h3 className="text-xs font-semibold text-secondary-400 uppercase tracking-wide pb-2 border-b border-white/[0.06]">Professional Info</h3></div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 uppercase">Specialized Network</label>
          <input className={inputCls} value={form.specialized_network || ""} onChange={e => handleChange("specialized_network", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 uppercase">Working Status</label>
          <select className={inputCls} value={form.working_status || ""} onChange={e => handleChange("working_status", e.target.value)}>
            <option value="">Select...</option>
            <option value="Employed">Employed</option>
            <option value="Retired">Retired</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 uppercase">Current Sector</label>
          <input className={inputCls} value={form.current_sector || ""} onChange={e => handleChange("current_sector", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 uppercase">Current Organization</label>
          <input className={inputCls} value={form.current_organization || ""} onChange={e => handleChange("current_organization", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 uppercase">Join As</label>
          <input className={inputCls} value={form.join_as || ""} onChange={e => handleChange("join_as", e.target.value)} placeholder="e.g. Lead Auditor, Judge" />
        </div>

        <div className="md:col-span-2 lg:col-span-3 items-center flex flex-wrap gap-4 mt-4">
          <label className="flex-1 min-w-[250px] p-4 rounded-xl border border-dashed border-white/20 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors text-center">
            <UploadCloud size={24} className="mx-auto mb-2 text-gray-400" />
            <span className="text-sm font-medium text-white block">Upload Profile Picture</span>
            <span className="text-xs text-gray-500">{files.profile_picture?.name || (form.profile_picture ? "Current: Saved" : "No file")}</span>
            <input type="file" className="hidden" accept="image/*" onChange={e => handleFile("profile_picture", e)} />
          </label>
          
          <label className="flex-1 min-w-[250px] p-4 rounded-xl border border-dashed border-white/20 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors text-center">
            <UploadCloud size={24} className="mx-auto mb-2 text-gray-400" />
            <span className="text-sm font-medium text-white block">Upload E-Signature</span>
            <span className="text-xs text-gray-500">{files.signature_path?.name || (form.signature_path ? "Current: Saved" : "No file")}</span>
            <input type="file" className="hidden" accept="image/*" onChange={e => handleFile("signature_path", e)} />
          </label>

          <label className="flex-1 min-w-[250px] p-4 rounded-xl border border-dashed border-white/20 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors text-center">
            <FileText size={24} className="mx-auto mb-2 text-gray-400" />
            <span className="text-sm font-medium text-white block">Upload Detail CV (PDF)</span>
            <span className="text-xs text-gray-500">{files.cv_path?.name || (form.cv_path ? "Current: Saved" : "No file")}</span>
            <input type="file" className="hidden" accept=".pdf" onChange={e => handleFile("cv_path", e)} />
          </label>
        </div>
      </div>
    </div>
  );
}

function ExperiencesTab({ experiences, accessToken, onSuccess }: any) {
  const { confirm } = useUiFeedback();
  const [form, setForm] = useState({ industry_sector: "", experience_type: "", company_name: "", years: "" });
  
  const handleAdd = async () => {
    await auditorProfileApi.addExperience(accessToken, form);
    setForm({ industry_sector: "", experience_type: "", company_name: "", years: "" });
    onSuccess();
  };
  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: "Delete Experience",
      message: "Delete this experience?",
      confirmText: "Delete",
      variant: "warning",
    });
    if (!ok) return;
    await auditorProfileApi.deleteExperience(accessToken, id);
    onSuccess();
  };

  return (
    <div className="space-y-6">
      <div className="glass border border-white/10 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Add Experience</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div><label className="block text-xs text-gray-500 mb-1">Sector</label><input className={inputCls} placeholder="e.g. IT" value={form.industry_sector} onChange={e => setForm(f => ({ ...f, industry_sector: e.target.value }))} /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Type</label><input className={inputCls} placeholder="e.g. Auditing" value={form.experience_type} onChange={e => setForm(f => ({ ...f, experience_type: e.target.value }))} /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Company</label><input className={inputCls} placeholder="Company Name" value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Years</label><input type="number" className={inputCls} placeholder="Years" value={form.years} onChange={e => setForm(f => ({ ...f, years: e.target.value }))} /></div>
        </div>
        <button onClick={handleAdd} className="mt-3 px-4 py-2 bg-secondary-500 text-primary-950 hover:bg-secondary-400 rounded-lg text-sm font-semibold transition-all">Add Experience</button>
      </div>

      <div className="space-y-3">
        {experiences.map((ex: any) => (
          <div key={ex.id} className="glass p-4 rounded-xl border border-white/[0.08] flex items-center justify-between gap-3">
            <div>
              <p className="text-white font-medium">{ex.company_name} <span className="text-gray-400 font-normal text-sm ml-2">({ex.years} years)</span></p>
              <p className="text-sm text-gray-400 mt-1">{ex.industry_sector} • {ex.experience_type}</p>
            </div>
            <button onClick={() => handleDelete(ex.id)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={16} /></button>
          </div>
        ))}
        {experiences.length === 0 && <div className="text-gray-500 italic p-4 text-center">No experiences added.</div>}
      </div>
    </div>
  );
}

function QualificationsTab({ qualifications, accessToken, onSuccess }: any) {
  const { confirm } = useUiFeedback();
  const [form, setForm] = useState({ qualification_name: "", university_name: "", degree: "", year: "" });
  const [file, setFile] = useState<File | null>(null);

  const handleAdd = async () => {
    await auditorProfileApi.addQualification(accessToken, form, file || undefined);
    setForm({ qualification_name: "", university_name: "", degree: "", year: "" });
    setFile(null);
    onSuccess();
  };
  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: "Delete Qualification",
      message: "Delete this qualification?",
      confirmText: "Delete",
      variant: "warning",
    });
    if (!ok) return;
    await auditorProfileApi.deleteQualification(accessToken, id);
    onSuccess();
  };

  return (
    <div className="space-y-6">
      <div className="glass border border-white/10 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Add Qualification</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end mb-4">
          <div><label className="block text-xs text-gray-500 mb-1">Qualification</label><input className={inputCls} placeholder="e.g. BSc" value={form.qualification_name} onChange={e => setForm(f => ({ ...f, qualification_name: e.target.value }))} /></div>
          <div><label className="block text-xs text-gray-500 mb-1">University</label><input className={inputCls} placeholder="University" value={form.university_name} onChange={e => setForm(f => ({ ...f, university_name: e.target.value }))} /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Degree</label><input className={inputCls} placeholder="Degree" value={form.degree} onChange={e => setForm(f => ({ ...f, degree: e.target.value }))} /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Year</label><input className={inputCls} placeholder="YYYY" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} /></div>
        </div>
        <div className="flex items-center gap-4">
          <label className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-300 border border-white/10 cursor-pointer inline-flex items-center gap-2">
            <Paperclip size={16} /> {file ? file.name : "Attach Certificate"}
            <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
          </label>
          <button onClick={handleAdd} className="px-4 py-2 bg-secondary-500 text-primary-950 hover:bg-secondary-400 rounded-xl text-sm font-semibold transition-all">Add Qualification</button>
        </div>
      </div>

      <div className="space-y-3">
        {qualifications.map((q: any) => (
          <div key={q.id} className="glass p-4 rounded-xl border border-white/[0.08] flex items-center justify-between gap-3">
            <div>
              <p className="text-white font-medium">{q.qualification_name} {q.degree && `— ${q.degree}`} <span className="text-gray-400 font-normal text-sm ml-2">({q.year})</span></p>
              <p className="text-sm text-gray-400 mt-1">{q.university_name}</p>
              {q.certificate_path && <a href={q.certificate_path} target="_blank" className="text-secondary-400 text-xs mt-2 inline-block hover:underline">View Certificate</a>}
            </div>
            <button onClick={() => handleDelete(q.id)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={16} /></button>
          </div>
        ))}
        {qualifications.length === 0 && <div className="text-gray-500 italic p-4 text-center">No qualifications added.</div>}
      </div>
    </div>
  );
}

function TrainingsTab({ trainings, accessToken, onSuccess }: any) {
  const { confirm } = useUiFeedback();
  const [form, setForm] = useState({ training_type: "", course_name: "", organization: "", duration: "", year: "" });
  const [file, setFile] = useState<File | null>(null);

  const handleAdd = async () => {
    await auditorProfileApi.addTraining(accessToken, form, file || undefined);
    setForm({ training_type: "", course_name: "", organization: "", duration: "", year: "" });
    setFile(null);
    onSuccess();
  };
  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: "Delete Training",
      message: "Delete this training?",
      confirmText: "Delete",
      variant: "warning",
    });
    if (!ok) return;
    await auditorProfileApi.deleteTraining(accessToken, id);
    onSuccess();
  };

  return (
    <div className="space-y-6">
      <div className="glass border border-white/10 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Add Training</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end mb-4">
          <div><label className="block text-xs text-gray-500 mb-1">Type</label><input className={inputCls} placeholder="e.g. ISO" value={form.training_type} onChange={e => setForm(f => ({ ...f, training_type: e.target.value }))} /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Course</label><input className={inputCls} placeholder="Course" value={form.course_name} onChange={e => setForm(f => ({ ...f, course_name: e.target.value }))} /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Organization</label><input className={inputCls} placeholder="Org" value={form.organization} onChange={e => setForm(f => ({ ...f, organization: e.target.value }))} /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Duration</label><input className={inputCls} placeholder="e.g. 5 Days" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Year</label><input className={inputCls} placeholder="YYYY" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} /></div>
        </div>
        <div className="flex items-center gap-4">
          <label className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-300 border border-white/10 cursor-pointer inline-flex items-center gap-2">
            <Paperclip size={16} /> {file ? file.name : "Attach Certificate"}
            <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
          </label>
          <button onClick={handleAdd} className="px-4 py-2 bg-secondary-500 text-primary-950 hover:bg-secondary-400 rounded-xl text-sm font-semibold transition-all">Add Training</button>
        </div>
      </div>

      <div className="space-y-3">
        {trainings.map((t: any) => (
          <div key={t.id} className="glass p-4 rounded-xl border border-white/[0.08] flex items-center justify-between gap-3">
            <div>
              <p className="text-white font-medium">{t.course_name} <span className="text-gray-400 font-normal text-sm ml-2">({t.year})</span></p>
              <p className="text-sm text-gray-400 mt-1">{t.training_type} • {t.organization} ({t.duration})</p>
              {t.certificate_path && <a href={t.certificate_path} target="_blank" className="text-secondary-400 text-xs mt-2 inline-block hover:underline">View Certificate</a>}
            </div>
            <button onClick={() => handleDelete(t.id)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={16} /></button>
          </div>
        ))}
        {trainings.length === 0 && <div className="text-gray-500 italic p-4 text-center">No trainings added.</div>}
      </div>
    </div>
  );
}