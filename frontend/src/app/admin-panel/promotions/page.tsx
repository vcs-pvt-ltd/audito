"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { adminApi, type PromotionCampaign } from "@/lib/api";

type Draft = {
  name: string; description: string; discount_type: "percentage" | "fixed"; discount_value: number;
  priority: number; starts_at: string; ends_at: string;
};
const emptyDraft = (): Draft => ({ name: "", description: "", discount_type: "percentage", discount_value: 10,
  priority: 0, starts_at: "", ends_at: "" });
const localDate = (value: string) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function PromotionsPage() {
  const { admin, accessToken } = useAuth();
  const { toast } = useUiFeedback();
  const [campaigns, setCampaigns] = useState<PromotionCampaign[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    const result = await adminApi.listPromotionCampaigns(accessToken);
    if (result.success && result.data) setCampaigns(result.data);
    else toast(result.message || "Could not load campaigns.", "error");
  }, [accessToken, toast]);
  useEffect(() => { void load(); }, [load]);

  function edit(item: PromotionCampaign) {
    setEditing(item.campaign_id);
    setDraft({ name: item.name, description: item.description || "", discount_type: item.discount_type,
      discount_value: Number(item.discount_value), priority: Number(item.priority),
      starts_at: localDate(item.starts_at), ends_at: localDate(item.ends_at) });
  }

  async function save() {
    if (!accessToken || !draft.starts_at || !draft.ends_at) return toast("Enter the campaign schedule.", "error");
    setBusy(true);
    const payload = { ...draft, starts_at: new Date(draft.starts_at).toISOString(), ends_at: new Date(draft.ends_at).toISOString(),
      applies_to_registration: false, applies_to_upgrade: false, applies_to_renewal: false, applies_to_token_reload: true,
      is_active: editing ? Boolean(campaigns.find((item) => item.campaign_id === editing)?.is_active) : true };
    const result = editing ? await adminApi.updatePromotionCampaign(accessToken, editing, payload)
      : await adminApi.createPromotionCampaign(accessToken, payload);
    setBusy(false);
    if (result.success) { toast("Token reload campaign saved.", "success"); setEditing(null); setDraft(emptyDraft()); await load(); }
    else toast(result.message || "Could not save campaign.", "error");
  }

  async function toggle(item: PromotionCampaign) {
    if (!accessToken) return;
    setBusy(true);
    const result = await adminApi.setPromotionCampaignStatus(accessToken, item.campaign_id, !item.is_active);
    setBusy(false);
    if (result.success) await load();
    else toast(result.message || "Could not update campaign.", "error");
  }

  if (!admin || admin.role !== "audito_admin") return null;
  return <main className="mx-auto max-w-5xl space-y-6 p-4 pt-20 text-white sm:p-6 lg:pt-8">
    <div><h1 className="text-2xl font-bold">Token reload campaigns</h1><p className="mt-2 text-sm text-gray-400">Discounts apply to token reload checkout across workspaces. Token quantities stay the same; the discount appears on the payment.</p></div>
    <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
      <h2 className="text-lg font-semibold">{editing ? "Edit campaign" : "New campaign"}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-1 w-full rounded-lg border border-white/15 bg-[#102c28] px-3 py-2" /></label>
        <label className="text-sm">Description<input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="mt-1 w-full rounded-lg border border-white/15 bg-[#102c28] px-3 py-2" /></label>
        <label className="text-sm">Discount type<select value={draft.discount_type} onChange={(event) => setDraft({ ...draft, discount_type: event.target.value as Draft["discount_type"] })} className="mt-1 w-full rounded-lg border border-white/15 bg-[#102c28] px-3 py-2"><option value="percentage">Percentage</option><option value="fixed">Fixed USD</option></select></label>
        <label className="text-sm">Discount value<input type="number" min="0.01" step="0.01" value={draft.discount_value} onChange={(event) => setDraft({ ...draft, discount_value: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-white/15 bg-[#102c28] px-3 py-2" /></label>
        <label className="text-sm">Starts<input type="datetime-local" value={draft.starts_at} onChange={(event) => setDraft({ ...draft, starts_at: event.target.value })} className="mt-1 w-full rounded-lg border border-white/15 bg-[#102c28] px-3 py-2" /></label>
        <label className="text-sm">Ends<input type="datetime-local" value={draft.ends_at} onChange={(event) => setDraft({ ...draft, ends_at: event.target.value })} className="mt-1 w-full rounded-lg border border-white/15 bg-[#102c28] px-3 py-2" /></label>
      </div>
      <div className="mt-4 flex gap-3"><button disabled={busy} onClick={() => void save()} className="rounded-xl bg-secondary-500 px-5 py-2 font-semibold text-primary-950 disabled:opacity-50">{editing ? "Save changes" : "Create campaign"}</button>{editing && <button onClick={() => { setEditing(null); setDraft(emptyDraft()); }} className="rounded-xl border border-white/15 px-4 py-2">Cancel</button>}</div>
    </section>
    <section className="space-y-3">{campaigns.map((item) => <article key={item.campaign_id} className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
      <div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold">{item.name}</h2><p className="mt-1 text-sm text-gray-400">{item.description}</p></div><span className="text-sm text-secondary-300">{item.discount_type === "percentage" ? `${item.discount_value}%` : `$${Number(item.discount_value).toFixed(2)}`} off</span></div>
      <p className="mt-2 text-xs text-gray-500">{new Date(item.starts_at).toLocaleString()} – {new Date(item.ends_at).toLocaleString()} · {item.is_active ? "Active" : "Paused"}{item.applies_to_registration || item.applies_to_upgrade ? " · Historical plan target" : ""}</p>
      <div className="mt-3 flex gap-2"><button onClick={() => edit(item)} className="rounded-lg border border-white/15 px-3 py-1.5 text-sm">Edit</button><button disabled={busy} onClick={() => void toggle(item)} className="rounded-lg border border-white/15 px-3 py-1.5 text-sm disabled:opacity-50">{item.is_active ? "Pause" : "Activate"}</button></div>
    </article>)}</section>
  </main>;
}
