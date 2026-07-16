"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { auditApi, checklistApi, orgTreeApi, usersApi } from "@/lib/api";
import { ArrowLeft, ClipboardCheck, Building2, Users, DollarSign, Calendar, ChevronDown, ChevronRight, CheckSquare, Square, AlertCircle, FileText } from "lucide-react";
import { Button, IconButton, Input, Textarea, fieldClass } from "@/components/ui";

const ENTITY_TYPE_COLORS: Record<string, string> = {
  "Customer": "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  "Buying Office": "bg-purple-500/20 text-purple-300 border-purple-500/30",
  "Company": "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "Cluster": "bg-teal-500/20 text-teal-300 border-teal-500/30",
  "Factory": "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "Unit": "bg-green-500/20 text-green-300 border-green-500/30",
  "Department": "bg-pink-500/20 text-pink-300 border-pink-500/30",
  "Section": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "Audit Firm": "bg-rose-500/20 text-rose-300 border-rose-500/30",
  "Branch": "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
};

interface TreeNode { code: string; name: string; entity_type: string; edge_id?: string | null; children?: TreeNode[]; [key: string]: unknown; }
interface ChecklistEntity { entity_code: string; entity_type: string; entity_name: string; org_tree_id: string | null; question_count: number; }
interface AuditorUser { user_code: string; first_name: string; last_name: string; email: string; role?: string; }
interface AuditFirmItem { code: string; name: string; email?: string; country?: string; }
interface ChecklistBase { checklist_id: string; name: string; time_period_value: number | null; time_period_unit: string | null; budget: string | number | null; currency: string | null; num_workers: number | null; }

function getSubtreeQuestionKeys(node: TreeNode, entityKeysSet: Set<string>): string[] {
  const keys: string[] = [];
  const k = `${node.code}__${node.edge_id || 'null'}`;
  if (entityKeysSet.has(k)) keys.push(k);
  for (const c of node.children || []) keys.push(...getSubtreeQuestionKeys(c, entityKeysSet));
  return keys;
}

function calcEndDate(startDate: string, value: number | null, unit: string | null): string {
  if (!startDate || !value || !unit) return "";
  const d = new Date(startDate);
  const u = unit.toLowerCase();
  if (u === "day" || u === "days") d.setDate(d.getDate() + value);
  else if (u === "week" || u === "weeks") d.setDate(d.getDate() + value * 7);
  else if (u === "month" || u === "months") d.setMonth(d.getMonth() + value);
  else if (u === "year" || u === "years") d.setFullYear(d.getFullYear() + value);
  return d.toISOString().slice(0, 10);
}

export default function AssignAuditPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const { toast } = useUiFeedback();
  const router = useRouter();
  const searchParams = useSearchParams();
  const checklistId = searchParams.get("checklistId") as string;

  const [mounted, setMounted] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistBase | null>(null);
  const [entities, setEntities] = useState<ChecklistEntity[]>([]);
  const [treeRoot, setTreeRoot] = useState<TreeNode | null>(null);
  const [auditors, setAuditors] = useState<AuditorUser[]>([]);
  const [firmCompanies, setFirmCompanies] = useState<AuditFirmItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState("");

  const [title, setTitle] = useState("");
  const [auditType, setAuditType] = useState<"internal" | "external">("internal");
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState("$");
  const [currencies, setCurrencies] = useState<string[]>(["$", "€", "£", "¥", "₹", "AED", "SAR"]);
  const [numWorkers, setNumWorkers] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [selectedAuditorCode, setSelectedAuditorCode] = useState("");
  const [selectedFirmCode, setSelectedFirmCode] = useState("");
  const [sendAssignmentEmail, setSendAssignmentEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!isLoading && !admin) router.push("/login"); }, [isLoading, admin, router]);

  const loadData = useCallback(async () => {
    if (!accessToken || !checklistId) return;
    setLoadingData(true);
    setDataError("");
    try {
      const [clRes, entRes, treeRes, auditorRes, firmRes] = await Promise.all([
        checklistApi.get(accessToken, checklistId),
        auditApi.getChecklistEntities(accessToken, checklistId),
        orgTreeApi.getTree(accessToken),
        usersApi.list(accessToken, "Auditor"),
        orgTreeApi.listEntities(accessToken, "Audit Firm Company"),
      ]);
      if (auditorRes.success && auditorRes.data) setAuditors(((auditorRes.data as any).users || []));
      if (firmRes.success && firmRes.data) setFirmCompanies(((firmRes.data as any).items || []));
      if (clRes.success && clRes.data) {
        const cl = (clRes.data as any).checklist;
        setChecklist(cl); setBudget(cl.budget ? String(cl.budget) : "");
        setCurrency(cl.currency || "$"); setNumWorkers(cl.num_workers ? String(cl.num_workers) : "");
      } else setDataError("Failed to load checklist.");
      if (entRes.success && entRes.data) {
        const ents = ((entRes.data as any).entities || []);
        setEntities(ents);
        setSelectedKeys(new Set(ents.map((e: ChecklistEntity) => `${e.entity_code}__${e.org_tree_id || 'null'}`)));
      } else setDataError("Failed to load checklist entities.");
      if (treeRes.success && treeRes.data) { const t = (treeRes.data as any).tree; if (t) setTreeRoot(t); }
    } catch { setDataError("Network error. Please try again."); }
    setLoadingData(false);
  }, [accessToken, checklistId]);

  useEffect(() => {
    fetch("https://api.exchangerate-api.com/v4/latest/USD")
      .then(r => r.json()).then(data => {
        if (data?.rates) {
          const codes = Object.keys(data.rates).sort();
          setCurrencies([...["$","€","£","¥","₹"], ...codes.filter(c => !["USD","EUR","GBP","JPY","INR"].includes(c))]);
        }
      }).catch(() => {});
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    if (checklist && startDate) {
      const calc = calcEndDate(startDate, checklist.time_period_value, checklist.time_period_unit);
      if (calc) setEndDate(calc);
    }
  }, [startDate, checklist]);

  const getEntKey = (e: ChecklistEntity) => `${e.entity_code}__${e.org_tree_id || 'null'}`;
  const toggleEntity = (key: string) => setSelectedKeys(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const selectAll = () => setSelectedKeys(new Set(entities.map(getEntKey)));
  const clearAll = () => setSelectedKeys(new Set());
  const bulkToggleEntities = (keys: string[], select: boolean) => setSelectedKeys(prev => {
    const n = new Set(prev); keys.forEach(k => select ? n.add(k) : n.delete(k)); return n;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !checklist) return;
    if (!title.trim()) { setSubmitError("Audit title is required."); return; }
    if (selectedKeys.size === 0) { setSubmitError("Please select at least one entity to audit."); return; }
    if (auditType === "internal" && !selectedAuditorCode) { setSubmitError("Please select an auditor."); return; }
    if (auditType === "external" && !selectedFirmCode) { setSubmitError("Please select an audit firm."); return; }
    if (!startDate || !endDate) { setSubmitError("Start date and end date are required."); return; }
    if (!budget || parseFloat(budget) <= 0) { setSubmitError("Budget must be greater than 0."); return; }
    if (!numWorkers || parseInt(numWorkers) <= 0) { setSubmitError("Number of workers must be greater than 0."); return; }

    setSubmitting(true); setSubmitError("");
    const res = await auditApi.create(accessToken, {
      checklist_id: checklist.checklist_id, title: title.trim(), audit_type: auditType,
      assigned_auditor_id: auditType === "internal" ? selectedAuditorCode : undefined,
      assigned_firm_code: auditType === "external" ? selectedFirmCode : undefined,
      send_assignment_email: auditType === "internal" && sendAssignmentEmail,
      budget: budget || undefined, currency: currency || "$", num_workers: numWorkers || undefined,
      start_date: startDate, end_date: endDate, notes: notes.trim() || undefined,
      entities: entities.filter(e => selectedKeys.has(getEntKey(e))).map(e => ({
        entity_code: e.entity_code, entity_type: e.entity_type, entity_name: e.entity_name, org_tree_id: e.org_tree_id,
      })),
    });
    if (res.success) { toast("Audit assignment created successfully.", "success"); router.push("/audits"); }
    else { const msg = res.message || "Failed to create audit assignment."; setSubmitError(msg); toast(msg, "error"); setSubmitting(false); }
  };

  if (!mounted || isLoading) return (
    <div className="h-screen flex items-center justify-center pt-14 lg:pt-0">
      <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!admin) return null;

  const inputAccentCls = "px-4 py-3 rounded-xl bg-white/[0.03] placeholder-gray-600 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50";
  const inputCls = `${fieldClass} ${inputAccentCls}`;

  return (
    <div className="min-h-screen bg-transparent">
      <main className="p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6 max-w-6xl mx-auto">
          <IconButton onClick={() => router.back()} bordered size="md" title="Back" className="bg-white/5">
            <ArrowLeft size={16} />
          </IconButton>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <ClipboardCheck size={22} className="text-amber-400" /> Assign Audit
            </h1>
            {checklist && <p className="text-sm text-gray-400 mt-0.5">Based on: <span className="text-amber-400/80 font-medium">{checklist.name}</span></p>}
          </div>
        </div>

        {loadingData ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-10 h-10 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : dataError ? (
          <div className="glass rounded-xl p-8 text-center max-w-xl mx-auto">
            <AlertCircle size={36} className="text-red-400 mx-auto mb-3" />
            <p className="text-red-400 font-medium">{dataError}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="max-w-6xl mx-auto">

            {/* Two-column grid — stacks on mobile */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">

              {/* Left column */}
              <div className="lg:col-span-7 space-y-6">

                {/* Audit Details */}
                <div className="glass rounded-xl p-5 sm:p-6 space-y-5 border border-white/[0.08] relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
                  <h2 className="text-white font-semibold text-xs uppercase tracking-wider flex items-center gap-2">
                    <ClipboardCheck size={14} className="text-amber-400" /> Audit Details
                  </h2>
                  <Input label="Audit Title" required type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter audit title" className={inputAccentCls} />
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2.5">Audit Type <span className="text-red-400">*</span></label>
                    <div className="grid grid-cols-2 gap-3">
                      {(["internal", "external"] as const).map(type => (
                        <label key={type} className={`flex items-center gap-3 p-3 sm:p-4 rounded-xl border cursor-pointer transition-all ${
                          auditType === type
                            ? type === "internal" ? "border-blue-500/40 bg-blue-500/5" : "border-purple-500/40 bg-purple-500/5"
                            : "border-white/5 bg-white/[0.01] hover:border-white/10"
                        }`}>
                          <input type="radio" className="sr-only" checked={auditType === type} onChange={() => setAuditType(type)} />
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${auditType === type ? (type === "internal" ? "border-blue-400" : "border-purple-400") : "border-gray-600"}`}>
                            {auditType === type && <div className={`w-2 h-2 rounded-full ${type === "internal" ? "bg-blue-400" : "bg-purple-400"}`} />}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white capitalize">{type}</p>
                            <p className="text-[11px] text-gray-500 mt-0.5 hidden sm:block">{type === "internal" ? "Use internal team" : "Assign to firm"}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Schedule */}
                <div className="glass rounded-xl p-5 sm:p-6 space-y-4 border border-white/[0.08]">
                  <h2 className="text-white font-semibold text-xs uppercase tracking-wider flex items-center gap-2">
                    <Calendar size={14} className="text-amber-400" /> Schedule
                    {checklist?.time_period_value && checklist?.time_period_unit && (
                      <span className="text-gray-500 font-normal normal-case text-[10px] ml-1 hidden sm:inline">
                        (end auto-calculated from {checklist.time_period_value} {checklist.time_period_unit})
                      </span>
                    )}
                  </h2>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <Input label="Start Date" required type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={`${inputAccentCls} [color-scheme:dark]`} />
                    <Input label="End Date" required type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={`${inputAccentCls} [color-scheme:dark]`} />
                  </div>
                </div>

                {/* Resources */}
                <div className="glass rounded-xl p-5 sm:p-6 space-y-4 border border-white/[0.08]">
                  <h2 className="text-white font-semibold text-xs uppercase tracking-wider flex items-center gap-2">
                    <DollarSign size={14} className="text-amber-400" /> Resources
                  </h2>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-2">Budget <span className="text-red-400">*</span></label>
                      <div className="flex items-center bg-white/[0.03] border border-white/10 rounded-xl focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-500/50 transition-all overflow-hidden">
                        <input type="number" min="0" step="0.01" value={budget} onChange={e => setBudget(e.target.value)} required
                          className="flex-1 min-w-0 bg-transparent px-3 py-3 text-white placeholder-gray-600 focus:outline-none text-sm" placeholder="Amount" />
                        <div className="w-px h-6 bg-white/10 shrink-0" />
                        <select value={currency} onChange={e => setCurrency(e.target.value)}
                          className="bg-transparent pl-2 pr-6 py-3 text-xs text-gray-300 focus:outline-none cursor-pointer appearance-none border-none shrink-0"
                          style={{ backgroundImage: "url(\"data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239CA3AF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 0.4rem top 50%", backgroundSize: "0.5rem auto" }}>
                          {currencies.map(c => <option key={c} value={c} className="bg-[#1e1a17] text-white">{c}</option>)}
                        </select>
                      </div>
                    </div>
                    <Input
                      label="Workers"
                      required
                      type="number"
                      min="1"
                      value={numWorkers}
                      onChange={e => setNumWorkers(e.target.value)}
                      leftAddon={<Users size={14} />}
                      className={inputAccentCls}
                      placeholder="Number"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="glass rounded-xl p-5 sm:p-6 space-y-4 border border-white/[0.08]">
                  <h2 className="text-white font-semibold text-xs uppercase tracking-wider flex items-center gap-2">
                    <FileText size={14} className="text-amber-400" /> Notes <span className="text-gray-500 font-normal normal-case text-[10px] ml-1">(Optional)</span>
                  </h2>
                  <Textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={4}
                    className={`${inputAccentCls} resize-none`}
                    placeholder="Additional context or instructions..."
                  />
                </div>
              </div>

              {/* Right column */}
              <div className="lg:col-span-5 space-y-6">

                {/* Auditor / Firm */}
                <div className="glass rounded-xl p-5 sm:p-6 space-y-4 border border-white/[0.08] flex flex-col h-72 lg:h-[320px]">
                  <h2 className="text-white font-semibold text-xs uppercase tracking-wider flex items-center gap-2 shrink-0">
                    <Users size={14} className="text-amber-400" />
                    {auditType === "internal" ? "Assign Auditor" : "Assign Audit Firm"} <span className="text-red-400">*</span>
                  </h2>
                  <div className="flex-1 overflow-y-auto pr-1 space-y-1.5">
                    {auditType === "internal" ? (
                      auditors.length === 0 ? (
                        <div className="text-center py-10"><Users size={28} className="text-gray-600 mx-auto mb-2" /><p className="text-gray-500 text-xs">No auditors found.</p></div>
                      ) : auditors.map(a => (
                        <label key={a.user_code} className={`flex items-center gap-3 px-3.5 py-3 rounded-xl cursor-pointer transition-all border ${selectedAuditorCode === a.user_code ? "bg-amber-500/10 border-amber-500/30" : "border-transparent bg-white/[0.01] hover:bg-white/[0.03]"}`}>
                          <input type="radio" className="sr-only" checked={selectedAuditorCode === a.user_code} onChange={() => setSelectedAuditorCode(a.user_code)} />
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedAuditorCode === a.user_code ? "border-amber-400" : "border-gray-600"}`}>
                            {selectedAuditorCode === a.user_code && <div className="w-2 h-2 rounded-full bg-amber-400" />}
                          </div>
                          <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-white">{a.first_name} {a.last_name}</p><p className="text-[11px] text-gray-500 truncate">{a.email}</p></div>
                        </label>
                      ))
                    ) : (
                      firmCompanies.length === 0 ? (
                        <div className="text-center py-10"><Building2 size={28} className="text-gray-600 mx-auto mb-2" /><p className="text-gray-500 text-xs">No audit firms available.</p></div>
                      ) : firmCompanies.map(f => (
                        <label key={f.code} className={`flex items-center gap-3 px-3.5 py-3 rounded-xl cursor-pointer transition-all border ${selectedFirmCode === f.code ? "bg-purple-500/10 border-purple-500/30" : "border-transparent bg-white/[0.01] hover:bg-white/[0.03]"}`}>
                          <input type="radio" className="sr-only" checked={selectedFirmCode === f.code} onChange={() => setSelectedFirmCode(f.code)} />
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedFirmCode === f.code ? "border-purple-400" : "border-gray-600"}`}>
                            {selectedFirmCode === f.code && <div className="w-2 h-2 rounded-full bg-purple-400" />}
                          </div>
                          <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-white">{f.name}</p><p className="text-[11px] text-gray-500 truncate">{f.country}{f.email ? ` · ${f.email}` : ""}</p></div>
                        </label>
                      ))
                    )}
                  </div>
                  {auditType === "internal" && (
                    <label className="flex items-start gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sendAssignmentEmail}
                        onChange={(event) => setSendAssignmentEmail(event.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-white/20 bg-transparent text-amber-500 focus:ring-amber-500"
                      />
                      <span>
                        <span className="block text-xs font-medium text-gray-300">Send assignment email to auditor</span>
                        <span className="mt-0.5 block text-[11px] leading-relaxed text-gray-500">The auditor will receive the audit details by email.</span>
                      </span>
                    </label>
                  )}
                </div>

                {/* Entities */}
                <div className="glass rounded-xl p-5 sm:p-6 space-y-4 border border-white/[0.08] flex flex-col h-96 lg:h-[500px]">
                  <div className="shrink-0 space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-white font-semibold text-xs uppercase tracking-wider flex items-center gap-2">
                        <Building2 size={14} className="text-amber-400" /> Entities to Audit
                      </h2>
                      <span className="text-gray-500 text-[10px] bg-white/5 px-2 py-0.5 rounded-full">{selectedKeys.size} / {entities.length}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="secondary" size="sm" fullWidth onClick={selectAll}>Select All</Button>
                      <Button type="button" variant="secondary" size="sm" fullWidth onClick={clearAll}>Clear All</Button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto pr-1">
                    {entities.length === 0 ? (
                      <div className="text-center py-16"><Building2 size={28} className="text-gray-600 mx-auto mb-2" /><p className="text-gray-500 text-xs">No entities found.</p></div>
                    ) : (() => {
                      const entityMap = new Map(entities.map(e => [getEntKey(e), e]));
                      const entityKeysSet = new Set(entityMap.keys());
                      const treeHasMatch = treeRoot && getSubtreeQuestionKeys(treeRoot, entityKeysSet).length > 0;
                      return treeHasMatch ? (
                        <OrgTreeEntitySelector node={treeRoot!} entityKeysSet={entityKeysSet} entityMap={entityMap} selectedKeys={selectedKeys} onToggle={toggleEntity} onBulkToggle={bulkToggleEntities} />
                      ) : (
                        <div className="space-y-1.5">
                          {entities.map(e => {
                            const key = getEntKey(e); const checked = selectedKeys.has(key);
                            const cc = ENTITY_TYPE_COLORS[e.entity_type] || "bg-gray-500/20 text-gray-300 border-gray-500/30";
                            return (
                              <label key={key} className={`flex items-center gap-3 px-3.5 py-3 rounded-xl cursor-pointer transition-all border ${checked ? "bg-amber-500/5 border-amber-500/20" : "border-transparent bg-white/[0.01] hover:bg-white/[0.03]"}`}>
                                {checked ? <CheckSquare size={15} className="text-amber-400 shrink-0" /> : <Square size={15} className="text-gray-600 shrink-0" />}
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${cc}`}>{e.entity_type}</span>
                                <span className="flex-1 text-sm text-white truncate">{e.entity_name}</span>
                                <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full shrink-0">{e.question_count}Q</span>
                              </label>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Buttons OUTSIDE the grid — always last on mobile AND desktop ── */}
            <div className="space-y-3 pb-8">
              {submitError && (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <AlertCircle size={16} className="shrink-0" />
                  <span className="font-medium">{submitError}</span>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  type="submit"
                  loading={submitting}
                  leftIcon={<ClipboardCheck size={16} />}
                  className="px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black shadow-[0_4px_20px_rgba(251,191,36,0.2)]"
                >
                  Create Audit Assignment
                </Button>
                <Button type="button" variant="secondary" onClick={() => router.back()} className="px-5 py-3.5 rounded-xl">
                  Cancel
                </Button>
              </div>
            </div>

          </form>
        )}
      </main>
    </div>
  );
}

function OrgTreeEntitySelector({ node, entityKeysSet, entityMap, selectedKeys, onToggle, onBulkToggle, depth = 0 }: {
  node: TreeNode; entityKeysSet: Set<string>; entityMap: Map<string, ChecklistEntity>;
  selectedKeys: Set<string>; onToggle: (key: string) => void; onBulkToggle: (keys: string[], select: boolean) => void; depth?: number;
}) {
  const subtreeKeys = getSubtreeQuestionKeys(node, entityKeysSet);
  if (subtreeKeys.length === 0) return null;
  const relevantChildren = (node.children || []).filter(c => getSubtreeQuestionKeys(c, entityKeysSet).length > 0);
  const [expanded, setExpanded] = useState(depth < 4);
  const nodeKey = `${node.code}__${node.edge_id || 'null'}`;
  const hasOwnQuestions = entityKeysSet.has(nodeKey);
  const entity = entityMap.get(nodeKey);
  const cc = ENTITY_TYPE_COLORS[node.entity_type] || "bg-gray-500/20 text-gray-300 border-gray-500/30";
  const allSubSelected = subtreeKeys.every(c => selectedKeys.has(c));
  const someSubSelected = subtreeKeys.some(c => selectedKeys.has(c));

  return (
    <div>
      <div className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-white/[0.03] transition-colors">
        {relevantChildren.length > 0 ? (
          <button type="button" onClick={() => setExpanded(p => !p)} className="text-gray-500 hover:text-gray-300 shrink-0">
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : <span className="w-[13px] shrink-0" />}
        <button type="button" onClick={() => hasOwnQuestions ? onToggle(nodeKey) : onBulkToggle(subtreeKeys, !allSubSelected)} className="shrink-0">
          {hasOwnQuestions ? (selectedKeys.has(nodeKey) ? <CheckSquare size={15} className="text-secondary-400" /> : <Square size={15} className="text-gray-500" />)
            : allSubSelected ? <CheckSquare size={15} className="text-secondary-400/60" />
            : someSubSelected ? <CheckSquare size={15} className="text-secondary-400/30" />
            : <Square size={15} className="text-gray-600" />}
        </button>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 leading-none ${cc}`}>{node.entity_type}</span>
        <span className={`text-sm flex-1 truncate ${hasOwnQuestions ? "text-white" : "text-gray-400"}`}>{node.name}</span>
        {entity && <span className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full shrink-0">{entity.question_count}Q</span>}
        {!entity && subtreeKeys.length > 0 && <span className="text-[11px] text-gray-600 shrink-0">{subtreeKeys.length} entit{subtreeKeys.length !== 1 ? "ies" : "y"}</span>}
      </div>
      {expanded && relevantChildren.length > 0 && (
        <div className="ml-[18px] border-l border-white/[0.08] pl-3 mt-0.5 space-y-0.5 pb-1">
          {relevantChildren.map(child => (
            <OrgTreeEntitySelector key={`${child.code}__${child.edge_id || 'null'}`} node={child}
              entityKeysSet={entityKeysSet} entityMap={entityMap} selectedKeys={selectedKeys}
              onToggle={onToggle} onBulkToggle={onBulkToggle} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
