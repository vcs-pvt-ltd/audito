"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Plus, RefreshCw, Save, Tag } from "lucide-react";
import Loading from "@/components/shared/Loading";
import { Button, Input, Modal, Table } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { adminApi, type PlanCatalog, type PlanSetting } from "@/lib/api";

const LIMIT_FIELDS: { key: keyof PlanSetting; label: string }[] = [
  { key: "max_company_levels", label: "Company levels" }, { key: "max_departments", label: "Departments" },
  { key: "max_audits", label: "Audits" }, { key: "max_checklists", label: "Checklists" }, { key: "max_auditors", label: "Auditors" },
];
const ENTRY_LABELS: Record<string, string> = {
  Customer: "Customer", "Buying Office": "Buying Office", Supplier: "Supplier",
  "Audit Firm Company": "Audit Firm Company", Branch: "Audit Firm Branch", "Audit Firm Department": "Audit Firm Department",
};
type NewPlan = { plan_name: string; monthly_price: number; max_company_levels: number; max_departments: number; max_audits: number; max_checklists: number; max_auditors: number; allow_auditor_eval: boolean; allow_company_to_company: boolean; is_active: boolean; };
const initialPlan = (): NewPlan => ({ plan_name: "", monthly_price: 0, max_company_levels: 1, max_departments: 1, max_audits: 1, max_checklists: 1, max_auditors: 1, allow_auditor_eval: false, allow_company_to_company: false, is_active: true });

export default function PlanSettingsPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const { toast, confirm } = useUiFeedback();
  const [catalog, setCatalog] = useState<PlanCatalog | null>(null);
  const [drafts, setDrafts] = useState<Record<string, PlanSetting>>({});
  const [entryPrices, setEntryPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState<string | null>(null);
  const [savingEntry, setSavingEntry] = useState<string | null>(null);
  const [yearlyDiscount, setYearlyDiscount] = useState(20);
  const [savingDiscount, setSavingDiscount] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newPlan, setNewPlan] = useState<NewPlan>(initialPlan());
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    const result = await adminApi.listPlanSettings(accessToken);
    if (result.success && result.data) {
      setCatalog(result.data);
      setDrafts(Object.fromEntries(result.data.plans.map((plan) => [plan.plan_name, normalize(plan)])));
      setEntryPrices(Object.fromEntries(result.data.entry_prices.map((item) => [item.entity_type, Number(item.monthly_price)])));
      setYearlyDiscount(Number(result.data.plans[0]?.yearly_discount_percent ?? 20));
    } else toast(result.message || "Unable to load plan settings.", "error");
    setLoading(false);
  }, [accessToken, toast]);

  useEffect(() => { void load(); }, [load]);
  const plans = useMemo(() => (catalog?.plans || []).map((item) => drafts[item.plan_name] || normalize(item)), [catalog, drafts]);
  const entries = useMemo(() => Object.keys(ENTRY_LABELS).map((entityType) => ({ entityType, price: entryPrices[entityType] ?? 0 })), [entryPrices]);
  const updatePlan = (planName: string, key: keyof PlanSetting, value: number | boolean) => setDrafts((current) => ({ ...current, [planName]: { ...current[planName], [key]: value } }));

  const savePlan = async (planName: string) => {
    const plan = drafts[planName];
    if (!accessToken || !plan) return;
    if (!await confirm({ title: `Save ${plan.plan_name}?`, message: "This changes future registration, renewal, and upgrade limits.", confirmText: "Save changes", variant: "warning" })) return;
    setSavingPlan(planName);
    const { plan_name: _name, updated_at: _updated, yearly_discount_percent: _discount, ...payload } = plan;
    const result = await adminApi.updatePlanSettings(accessToken, planName, payload);
    if (result.success && result.data?.plan) {
      const saved = normalize(result.data.plan);
      setDrafts((current) => ({ ...current, [planName]: saved }));
      setCatalog((current) => current ? { ...current, plans: current.plans.map((item) => item.plan_name === planName ? saved : item) } : current);
      toast(`${planName} saved.`, "success");
    } else toast(result.message || "Could not save plan.", "error");
    setSavingPlan(null);
  };

  const saveDiscount = async () => {
    if (!accessToken || yearlyDiscount < 0 || yearlyDiscount > 100) return toast("Enter a discount from 0 to 100%.", "error");
    if (!await confirm({ title: "Update yearly discount?", message: `Apply ${yearlyDiscount}% to all annual plan prices?`, confirmText: "Update discount", variant: "warning" })) return;
    setSavingDiscount(true);
    const result = await adminApi.updateYearlyDiscount(accessToken, yearlyDiscount);
    if (result.success && result.data) { setCatalog(result.data); setDrafts(Object.fromEntries(result.data.plans.map((plan) => [plan.plan_name, normalize(plan)]))); toast("Yearly discount updated.", "success"); }
    else toast(result.message || "Could not update yearly discount.", "error");
    setSavingDiscount(false);
  };

  const saveEntry = async (entityType: string) => {
    const price = Number(entryPrices[entityType]);
    if (!accessToken || !Number.isFinite(price) || price < 0) return toast("Enter a valid price.", "error");
    if (!await confirm({ title: `Save ${ENTRY_LABELS[entityType]} price?`, message: `Set this price to $${Math.round(price).toLocaleString()}?`, confirmText: "Save price", variant: "warning" })) return;
    setSavingEntry(entityType);
    const result = await adminApi.updateEntryPrice(accessToken, entityType, price);
    result.success ? toast("Entry price updated.", "success") : toast(result.message || "Could not update entry price.", "error");
    setSavingEntry(null);
  };

  const addPlan = async () => {
    if (!accessToken || !newPlan.plan_name.trim()) return toast("Plan name is required.", "error");
    if (!await confirm({ title: "Add plan?", message: "You can compare and adjust the plan immediately after it is added.", confirmText: "Add plan", variant: "warning" })) return;
    setCreating(true);
    const result = await adminApi.createPlanSettings(accessToken, { ...newPlan, plan_name: newPlan.plan_name.trim(), display_name: newPlan.plan_name.trim(), sort_order: (plans.length + 1) * 10 });
    if (result.success) { toast("Plan added.", "success"); setAddOpen(false); setNewPlan(initialPlan()); await load(); }
    else toast(result.message || "Could not add plan.", "error");
    setCreating(false);
  };

  if (isLoading || !admin || admin.role !== "audito_admin") return null;
  if (loading) return <Loading />;

  return <div className="min-h-full bg-transparent"><main className="mx-auto max-w-7xl space-y-6 p-4 pt-20 sm:p-6 sm:pt-20 lg:p-8 lg:pt-8">
    
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="flex items-center gap-2 text-2xl font-bold text-white"><Tag size={22} className="text-secondary-400" /> Plans & limits</h1><p className="mt-1 text-sm text-gray-400">Compare and manage the pricing and capacity offered to organizations.</p></div><Button variant="secondary" leftIcon={<RefreshCw size={16} />} onClick={() => void load()} className="self-start sm:self-auto"></Button></header>
    <section className="flex flex-col gap-4 rounded-2xl border border-secondary-400/20 bg-secondary-500/[.06] p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-secondary-300">Annual billing</p><p className="mt-1 text-sm font-semibold text-white">One yearly discount across every plan</p></div><div className="flex items-end gap-2"><NumberField label="Discount (%)" value={yearlyDiscount} onChange={setYearlyDiscount} /><Button leftIcon={<Save size={15} />} loading={savingDiscount} onClick={() => void saveDiscount()}>Save</Button></div></section>
    <section className="flex flex-col gap-4 rounded-2xl border border-dashed border-secondary-400/35 bg-secondary-500/[.04] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><p className="text-sm font-semibold text-white">Need another pricing tier?</p><p className="mt-1 text-xs text-gray-400">Add a plan, configure it in the comparison table, then activate it when ready.</p></div><Button leftIcon={<Plus size={16} />} onClick={() => setAddOpen(true)} className="shrink-0">Add plan</Button></section>
    <Table className="min-w-[920px] border-collapse"><thead><tr className="bg-white/[.04]"><th className="sticky left-0 z-10 w-48 bg-[#0b2118] px-4 py-4 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">Plan comparison</th>{plans.map((plan) => <th key={plan.plan_name} className="min-w-[210px] border-l border-white/[.06] px-4 py-3 text-left"><div className="flex items-start justify-between gap-2"><p className="text-base font-bold text-white">{plan.plan_name}</p><label className="text-[10px] text-gray-400"><input type="checkbox" checked={!!plan.is_active} onChange={(event) => updatePlan(plan.plan_name, "is_active", event.target.checked)} className="mr-1 accent-secondary-500" />Active</label></div><Button size="sm" fullWidth leftIcon={<Save size={13} />} loading={savingPlan === plan.plan_name} onClick={() => void savePlan(plan.plan_name)} className="mt-3">Save</Button></th>)}</tr></thead><tbody><PlanRow label="Monthly price (USD)" plans={plans}>{(plan) => <NumberField label="" value={Number(plan.monthly_price)} step="0.01" onChange={(value) => updatePlan(plan.plan_name, "monthly_price", value)} />}</PlanRow><PlanRow label="Workspace limits" plans={plans} heading />{LIMIT_FIELDS.map((field) => <PlanRow key={field.key} label={field.label} plans={plans}>{(plan) => <NumberField label="" value={Number(plan[field.key])} onChange={(value) => updatePlan(plan.plan_name, field.key, value)} />}</PlanRow>)}<PlanRow label="Core features" plans={plans} heading />{([{ key: "allow_auditor_eval", label: "Auditor evaluation" }, { key: "allow_company_to_company", label: "Company-to-company links" }] as const).map((feature) => <PlanRow key={feature.key} label={feature.label} plans={plans}>{(plan) => <Toggle checked={!!plan[feature.key]} onChange={(value) => updatePlan(plan.plan_name, feature.key, value)} />}</PlanRow>)}</tbody></Table>
    <section className="rounded-2xl border border-white/10 bg-white/[.03] p-4 sm:p-5"><div className="mb-4 flex items-start gap-3"><div className="rounded-xl bg-secondary-500/15 p-2 text-secondary-300"><Tag size={17} /></div><div><h2 className="text-base font-bold text-white">Hierarchy entry prices</h2><p className="mt-1 text-xs text-gray-500">Customer and Audit Firm prices. Company, Cluster, and Factory follow Elite, Pro, and Basic plan prices.</p></div></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{entries.map(({ entityType, price }) => <div key={entityType} className="flex items-end gap-2 rounded-xl border border-white/[.08] bg-black/10 p-3"><NumberField label={ENTRY_LABELS[entityType]} value={price} step="0.01" onChange={(value) => setEntryPrices((current) => ({ ...current, [entityType]: value }))} /><Button size="sm" variant="secondary" loading={savingEntry === entityType} onClick={() => void saveEntry(entityType)} className="h-10 px-3"><Check size={15} /></Button></div>)}</div></section>
  </main><AddPlanModal open={addOpen} plan={newPlan} setPlan={setNewPlan} loading={creating} onClose={() => setAddOpen(false)} onSubmit={() => void addPlan()} /></div>;
}

function normalize(plan: PlanSetting): PlanSetting { return { ...plan, monthly_price: Number(plan.monthly_price), yearly_discount_percent: Number(plan.yearly_discount_percent), max_company_levels: Number(plan.max_company_levels), max_departments: Number(plan.max_departments), max_audits: Number(plan.max_audits), max_checklists: Number(plan.max_checklists), max_auditors: Number(plan.max_auditors) }; }
function PlanRow({ label, plans, children, heading = false }: { label: string; plans: PlanSetting[]; children?: (plan: PlanSetting) => React.ReactNode; heading?: boolean }) { return <tr className={heading ? "bg-white/[.035]" : "border-t border-white/[.06]"}><td className={`sticky left-0 z-[1] bg-[#0b2118] px-4 py-3 text-xs ${heading ? "font-semibold uppercase tracking-wider text-secondary-400" : "font-medium text-gray-300"}`}>{label}</td>{plans.map((plan) => <td key={plan.plan_name} className="border-l border-white/[.06] px-3 py-2">{!heading && children?.(plan)}</td>)}</tr>; }
function NumberField({ label, value, onChange, step = "1" }: { label: string; value: number; onChange: (value: number) => void; step?: string }) { return <Input label={label || undefined} type="number" min="0" step={step} value={Number.isFinite(value) ? value : 0} onWheel={(event) => event.currentTarget.blur()} onChange={(event) => onChange(Number(event.target.value))} className="min-h-9 h-9 appearance-none rounded-lg px-2.5 py-1.5 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />; }
function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex h-9 cursor-pointer items-center justify-center rounded-lg border border-white/[.07] bg-black/10"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-secondary-500" /></label>; }
function AddPlanModal({ open, plan, setPlan, loading, onClose, onSubmit }: { open: boolean; plan: NewPlan; setPlan: React.Dispatch<React.SetStateAction<NewPlan>>; loading: boolean; onClose: () => void; onSubmit: () => void }) { const set = <K extends keyof NewPlan>(key: K, value: NewPlan[K]) => setPlan((current) => ({ ...current, [key]: value })); return <Modal open={open} onClose={onClose} title="Add plan" description="Set the starting price and limits. You can refine them in the comparison table." size="lg" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={loading} leftIcon={<Plus size={16} />} onClick={onSubmit}>Add plan</Button></>}><div className="grid gap-4 sm:grid-cols-2"><Input label="Plan name" value={plan.plan_name} placeholder="Enterprise" onChange={(event) => set("plan_name", event.target.value)} /><NumberField label="Monthly price (USD)" value={plan.monthly_price} step="0.01" onChange={(value) => set("monthly_price", value)} />{(["max_company_levels", "max_departments", "max_audits", "max_checklists", "max_auditors"] as const).map((key) => <NumberField key={key} label={key.replace("max_", "").replaceAll("_", " ")} value={plan[key]} onChange={(value) => set(key, value)} />)}</div><div className="mt-5 grid gap-2 sm:grid-cols-3"><ToggleWithLabel label="Active" checked={plan.is_active} onChange={(value) => set("is_active", value)} /><ToggleWithLabel label="Auditor evaluation" checked={plan.allow_auditor_eval} onChange={(value) => set("allow_auditor_eval", value)} /><ToggleWithLabel label="Company links" checked={plan.allow_company_to_company} onChange={(value) => set("allow_company_to_company", value)} /></div></Modal>; }
function ToggleWithLabel({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex min-h-11 cursor-pointer items-center justify-between rounded-xl border border-white/[.07] bg-black/10 px-3 text-sm text-gray-300"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-secondary-500" /></label>; }
