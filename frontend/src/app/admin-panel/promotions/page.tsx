"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgePercent, CalendarClock, Edit3, Loader2, Pause, Play, Plus, RefreshCw, Tag } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { adminApi, type PlanCatalog, type PromotionCampaign, type PromotionCampaignPlan } from "@/lib/api";
import Loading from "@/components/shared/Loading";
import EmptyState from "@/components/shared/EmptyState";
import { Button, Input, Modal, Select, Textarea } from "@/components/ui";

type CampaignDraft = Omit<PromotionCampaign, "campaign_id" | "created_at" | "updated_at">;

const toLocalDateTime = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const createDraft = (): CampaignDraft => {
  const now = new Date();
  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    name: "", description: "", discount_type: "percentage", discount_value: 15, priority: 0,
    starts_at: toLocalDateTime(now), ends_at: toLocalDateTime(end),
    applies_to_registration: true, applies_to_upgrade: false, applies_to_renewal: false,
    is_active: true, plans: [],
  };
};

function campaignStatus(campaign: PromotionCampaign) {
  if (!campaign.is_active) return { label: "Paused", classes: "border-gray-400/20 bg-white/5 text-gray-400" };
  const now = Date.now();
  if (new Date(campaign.ends_at).getTime() <= now) return { label: "Ended", classes: "border-red-400/20 bg-red-400/10 text-red-300" };
  if (new Date(campaign.starts_at).getTime() > now) return { label: "Scheduled", classes: "border-sky-400/20 bg-sky-400/10 text-sky-300" };
  return { label: "Live", classes: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" };
}

function formatOffer(campaign: PromotionCampaign | CampaignDraft) {
  return campaign.discount_type === "percentage" ? `${campaign.discount_value}% off` : `$${Number(campaign.discount_value).toLocaleString()} off`;
}

export default function PromotionCampaignsPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const { toast, confirm } = useUiFeedback();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<PromotionCampaign[]>([]);
  const [catalog, setCatalog] = useState<PlanCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<CampaignDraft>(createDraft);
  const [editing, setEditing] = useState<PromotionCampaign | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!isLoading && (!admin || admin.role !== "audito_admin")) router.replace("/login");
  }, [admin, isLoading, router]);

  const load = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const [campaignResult, planResult] = await Promise.all([
        adminApi.listPromotionCampaigns(accessToken),
        adminApi.listPlanSettings(accessToken),
      ]);
      if (campaignResult.success && campaignResult.data) setCampaigns(campaignResult.data);
      else setError(campaignResult.message || "Unable to load promotion campaigns.");
      if (planResult.success && planResult.data) setCatalog(planResult.data);
    } catch {
      setError("Unable to load promotion campaigns.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [accessToken]);

  const planOptions = useMemo(() => (catalog?.plans || []).filter((plan) => plan.plan_name !== "Custom"), [catalog]);
  const openCreate = () => { setEditing(null); setDraft(createDraft()); setError(""); setShowForm(true); };
  const openEdit = (campaign: PromotionCampaign) => {
    setEditing(campaign);
    setDraft({
      ...campaign,
      starts_at: toLocalDateTime(new Date(campaign.starts_at)),
      ends_at: toLocalDateTime(new Date(campaign.ends_at)),
      plans: campaign.plans,
    });
    setError(""); setShowForm(true);
  };
  const closeModal = () => { setEditing(null); setDraft(createDraft()); setError(""); setShowForm(false); };

  const togglePlan = (planName: string, billingCycle: PromotionCampaignPlan["billing_cycle"]) => {
    setDraft((current) => {
      const exists = current.plans.some((item) => item.plan_name === planName && item.billing_cycle === billingCycle);
      return {
        ...current,
        plans: exists
          ? current.plans.filter((item) => !(item.plan_name === planName && item.billing_cycle === billingCycle))
          : [...current.plans, { plan_name: planName, billing_cycle: billingCycle }],
      };
    });
  };

  const save = async () => {
    if (!accessToken) return;
    setSaving(true);
    setError("");
    try {
      const result = editing
        ? await adminApi.updatePromotionCampaign(accessToken, editing.campaign_id, draft)
        : await adminApi.createPromotionCampaign(accessToken, draft);
      if (!result.success || !result.data?.campaign) {
        setError(result.message || "Unable to save this promotion campaign.");
        return;
      }
      toast(editing ? "Promotion campaign updated." : "Promotion campaign created.", "success");
      closeModal();
      await load();
    } catch {
      setError("Unable to save this promotion campaign.");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (campaign: PromotionCampaign) => {
    if (!accessToken) return;
    const nextState = !campaign.is_active;
    const approved = await confirm({
      title: nextState ? "Activate promotion" : "Pause promotion",
      message: nextState ? `Make “${campaign.name}” eligible at its scheduled time?` : `Stop “${campaign.name}” from being applied to new purchases?`,
      confirmText: nextState ? "Activate" : "Pause",
      variant: nextState ? "success" : "warning",
    });
    if (!approved) return;
    const result = await adminApi.setPromotionCampaignStatus(accessToken, campaign.campaign_id, nextState);
    if (result.success) {
      toast(nextState ? "Promotion campaign activated." : "Promotion campaign paused.", "success");
      await load();
    } else toast(result.message || "Unable to update campaign status.", "error");
  };

  if (isLoading || !admin) return <Loading />;

  return (
    <div className="min-h-screen p-5 pt-20 lg:p-8 lg:pt-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><BadgePercent size={22} className="text-secondary-400" /> Promotion campaigns</h1>
          <p className="mt-1 text-sm text-gray-400">Create automatic limited-time offers. These are separate from promo codes.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => void load()} disabled={loading} leftIcon={<RefreshCw size={15} className={loading ? "animate-spin" : ""} />}></Button>
          <Button onClick={openCreate} leftIcon={<Plus size={16} />}>Add promotion</Button>
        </div>
      </header>

      {error && <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      {loading ? <div className="flex justify-center py-24"><Loader2 className="animate-spin text-secondary-400" size={30} /></div> : campaigns.length === 0 ? (
        <EmptyState icon={BadgePercent} title="No promotion campaigns" message="Add a campaign to show a limited-time offer on eligible plan cards." action={<Button onClick={openCreate} leftIcon={<Plus size={16} />}>Add promotion</Button>} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {campaigns.map((campaign) => {
            const status = campaignStatus(campaign);
            return <article key={campaign.campaign_id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-lg shadow-black/10">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><div className="flex items-center gap-2"><h2 className="text-lg font-semibold text-white">{campaign.name}</h2><span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${status.classes}`}>{status.label}</span></div><p className="mt-1 text-sm text-gray-400">{campaign.description || "No customer-facing description."}</p></div>
                <div className="rounded-xl border border-secondary-400/20 bg-secondary-500/10 px-3 py-2 text-right"><p className="text-xs text-secondary-200">Offer</p><p className="font-bold text-secondary-300">{formatOffer(campaign)}</p></div>
              </div>
              <div className="mt-4 grid gap-3 text-xs text-gray-400 sm:grid-cols-2"><p><span className="font-medium text-gray-300">Schedule:</span> {new Date(campaign.starts_at).toLocaleString()} — {new Date(campaign.ends_at).toLocaleString()}</p><p><span className="font-medium text-gray-300">Applies to:</span> {[campaign.applies_to_registration && "registration", campaign.applies_to_upgrade && "upgrades", campaign.applies_to_renewal && "renewals"].filter(Boolean).join(", ")}</p></div>
              <div className="mt-4 flex flex-wrap gap-2">{campaign.plans.map((plan) => <span key={`${plan.plan_name}-${plan.billing_cycle}`} className="rounded-lg border border-white/10 bg-black/10 px-2.5 py-1 text-xs font-medium text-gray-300">{plan.plan_name} · {plan.billing_cycle}</span>)}</div>
              <div className="mt-5 flex justify-end gap-2 border-t border-white/10 pt-4"><Button variant="secondary" size="sm" onClick={() => openEdit(campaign)} leftIcon={<Edit3 size={14} />}>Edit</Button><Button variant={campaign.is_active ? "secondary" : "primary"} size="sm" onClick={() => void toggleStatus(campaign)} leftIcon={campaign.is_active ? <Pause size={14} /> : <Play size={14} />}>{campaign.is_active ? "Pause" : "Activate"}</Button></div>
            </article>;
          })}
        </div>
      )}

      <Modal open={showForm} onClose={closeModal} title={editing ? "Edit promotion campaign" : "Add promotion campaign"} description="This campaign is applied automatically while its schedule is active." icon={<Tag className="text-secondary-400" />} size="xl" footer={<><Button variant="secondary" onClick={closeModal} disabled={saving}>Cancel</Button><Button onClick={() => void save()} loading={saving}>{editing ? "Save changes" : "Create campaign"}</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2"><Input label="Campaign name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Quarter-end offer" required /><Select label="Discount type" value={draft.discount_type} onChange={(e) => setDraft({ ...draft, discount_type: e.target.value as CampaignDraft["discount_type"] })}><option value="percentage">Percentage off</option><option value="fixed">Fixed USD amount off</option></Select><Input label={draft.discount_type === "percentage" ? "Discount (%)" : "Discount (USD)"} type="number" min="0.01" max={draft.discount_type === "percentage" ? 100 : undefined} value={draft.discount_value} onChange={(e) => setDraft({ ...draft, discount_value: Number(e.target.value) })} required /><Input label="Priority" type="number" min="0" max="1000" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })} /><Input label="Starts" type="datetime-local" value={draft.starts_at} onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })} required /><Input label="Ends" type="datetime-local" value={draft.ends_at} onChange={(e) => setDraft({ ...draft, ends_at: e.target.value })} required /></div>
        <div className="mt-4"><Textarea label="Customer-facing description" value={draft.description || ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Save on your first year of Audito." rows={2} /></div>
        <div className="mt-5 grid gap-3 rounded-xl border border-white/10 bg-black/10 p-4 sm:grid-cols-3">{([['applies_to_registration', 'New registrations'], ['applies_to_upgrade', 'Plan upgrades'], ['applies_to_renewal', 'Renewals']] as const).map(([key, label]) => <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.checked })} className="h-4 w-4 accent-secondary-500" />{label}</label>)}</div>
        <div className="mt-5"><p className="mb-2 text-sm font-medium text-gray-300">Eligible plan and billing cycle <span className="text-red-400">*</span></p><div className="grid gap-3 sm:grid-cols-2">{planOptions.map((plan) => <div key={plan.plan_name} className="rounded-xl border border-white/10 bg-black/10 p-3"><p className="mb-2 text-sm font-semibold text-white">{plan.plan_name}</p><div className="flex flex-wrap gap-x-4 gap-y-2">{(["Monthly", "Yearly", "Any"] as const).map((cycle) => { const checked = draft.plans.some((item) => item.plan_name === plan.plan_name && item.billing_cycle === cycle); return <label key={cycle} className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-400"><input type="checkbox" checked={checked} onChange={() => togglePlan(plan.plan_name, cycle)} className="h-3.5 w-3.5 accent-secondary-500" />{cycle}</label>; })}</div></div>)}</div></div>
        <label className="mt-5 flex cursor-pointer items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} className="h-4 w-4 accent-secondary-500" />Campaign enabled</label>
      </Modal>
    </div>
  );
}
