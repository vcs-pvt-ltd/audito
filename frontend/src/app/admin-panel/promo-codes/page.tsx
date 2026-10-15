"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgePercent, Copy, Plus, Power, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { Button, Input, Modal } from "@/components/ui";
import { adminApi, type PromoCode } from "@/lib/api";

type Status = "active" | "inactive" | "expired" | "used_up";

function statusOf(item: PromoCode): Status {
  if (!item.is_active) return "inactive";
  if (item.expires_at && new Date(item.expires_at).getTime() <= Date.now()) return "expired";
  if (item.max_redemptions && Number(item.redemptions || 0) >= item.max_redemptions) return "used_up";
  return "active";
}
const STATUS_STYLE: Record<Status, [string, string]> = {
  active: ["Active", "border-primary-400/25 bg-primary-400/10 text-primary-200"],
  inactive: ["Inactive", "border-white/10 bg-white/[.04] text-gray-400"],
  expired: ["Expired", "border-amber-400/25 bg-amber-400/10 text-amber-200"],
  used_up: ["Fully used", "border-sky-400/25 bg-sky-400/10 text-sky-200"],
};
const emptyForm = { code: "", discount: "", expires: "", limit: "" };

export default function PromoCodesPage() {
  const { admin, accessToken } = useAuth();
  const { toast, confirm } = useUiFeedback();
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!accessToken) return;
    const result = await adminApi.listPromoCodes(accessToken);
    if (result.success && result.data) setCodes(result.data);
    else toast(result.message || "Could not load promo codes.", "error");
    setLoading(false);
  }, [accessToken, toast]);
  useEffect(() => { void load(); }, [load]);

  const activeCount = useMemo(() => codes.filter(item => statusOf(item) === "active").length, [codes]);
  if (!admin || admin.role !== "audito_admin") return null;

  const create = async () => {
    if (!accessToken) return;
    setError("");
    const discount = Number(form.discount);
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{2,29}$/.test(form.code.trim())) return setError("Use 3–30 letters, numbers, dashes or underscores for the code.");
    if (!Number.isFinite(discount) || discount <= 0 || discount > 100) return setError("Enter a discount more than 0 and at most 100 percent.");
    setSaving(true);
    const result = await adminApi.createPromoCode(accessToken, {
      code: form.code.trim().toUpperCase(),
      discount_percentage: discount,
      // End of the chosen day, in the admin's time zone.
      expires_at: form.expires ? new Date(`${form.expires}T23:59:59`).toISOString() : null,
      max_redemptions: form.limit ? Number(form.limit) : null,
    });
    setSaving(false);
    if (!result.success) return setError(result.message || "Could not create the promo code.");
    toast(result.message || "Promo code created.", "success");
    setOpen(false); setForm(emptyForm);
    await load();
  };

  const toggle = async (item: PromoCode) => {
    if (!accessToken) return;
    const result = item.is_active ? await adminApi.deactivatePromoCode(accessToken, item.promo_code_id) : await adminApi.activatePromoCode(accessToken, item.promo_code_id);
    toast(result.message || (result.success ? "Promo code updated." : "Could not update the promo code."), result.success ? "success" : "error");
    if (result.success) await load();
  };

  const remove = async (item: PromoCode) => {
    if (!accessToken) return;
    const approved = await confirm({ title: `Delete ${item.code}?`, message: "Customers can no longer use this code. Codes used on a payment are kept for invoices and can only be deactivated.", confirmText: "Delete", cancelText: "Keep", variant: "error" });
    if (!approved) return;
    const result = await adminApi.deletePromoCode(accessToken, item.promo_code_id);
    toast(result.message || (result.success ? "Promo code deleted." : "Could not delete the promo code."), result.success ? "success" : "error");
    if (result.success) await load();
  };

  const copy = async (code: string) => {
    try { await navigator.clipboard.writeText(code); toast(`${code} copied.`, "success"); } catch { toast("Could not copy the code.", "error"); }
  };

  return <main className="mx-auto w-full max-w-5xl px-4 pb-10 pt-20 text-white sm:px-6 lg:pt-8">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><BadgePercent size={22} className="text-secondary-400" aria-hidden />Promo codes</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">Customers enter a code on the payment page to take a percentage off a Company package, plan activation or token reload. A code does not combine with automatic campaigns; the lower price applies.</p>
      </div>
      <Button leftIcon={<Plus size={16} />} onClick={() => { setForm(emptyForm); setError(""); setOpen(true); }}>New promo code</Button>
    </div>

    <p className="mt-6 text-sm text-gray-400"><b className="text-white">{activeCount}</b> active · {codes.length} total</p>

    <div className="mt-3 space-y-2">
      {loading && <p className="rounded-xl border border-white/10 p-5 text-sm text-gray-400">Loading promo codes…</p>}
      {!loading && codes.length === 0 && <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
        <p className="font-semibold">No promo codes yet</p>
        <p className="mt-1 text-sm text-gray-400">Create a code and share it with customers before they pay.</p>
      </div>}
      {codes.map(item => {
        const status = statusOf(item);
        const [label, tone] = STATUS_STYLE[status];
        const used = Number(item.redemptions || 0);
        return <div key={item.promo_code_id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void copy(item.code)} className="flex items-center gap-1.5 rounded-lg font-mono text-base font-semibold tracking-wide hover:text-secondary-200" title="Copy code">
                {item.code}<Copy size={13} className="text-gray-500" aria-hidden />
              </button>
              <span className="rounded-full bg-secondary-400/15 px-2 py-0.5 text-xs font-semibold text-secondary-200">{Number(item.discount_percentage)}% off</span>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{label}</span>
            </div>
            <p className="mt-1.5 text-xs text-gray-400">
              Used {used}{item.max_redemptions ? ` of ${item.max_redemptions}` : ""} time{used === 1 && !item.max_redemptions ? "" : "s"}
              {Number(item.total_discount || 0) > 0 && <> · {Number(item.total_discount).toFixed(2)} discounted in total</>}
              {" · "}{item.expires_at ? `Expires ${new Date(item.expires_at).toLocaleDateString()}` : "No expiry"}
              {" · "}Created {new Date(item.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" leftIcon={<Power size={14} />} onClick={() => void toggle(item)}>{item.is_active ? "Deactivate" : "Activate"}</Button>
            <Button size="sm" variant="ghost" leftIcon={<Trash2 size={14} />} onClick={() => void remove(item)} aria-label={`Delete ${item.code}`}>Delete</Button>
          </div>
        </div>;
      })}
    </div>

    <Modal open={open} onClose={() => setOpen(false)} title="New promo code" description="The discount is taken off the list price at checkout." size="md"
      footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={() => void create()}>Create code</Button></>}>
      <div className="space-y-4">
        <Input label="Code" required value={form.code} maxLength={30} placeholder="For example: WELCOME20" autoFocus
          onChange={event => setForm({ ...form, code: event.target.value.toUpperCase().replace(/\s/g, "") })} />
        <Input label="Discount (%)" required type="number" min={0.01} max={100} step={0.01} value={form.discount} placeholder="20"
          onChange={event => setForm({ ...form, discount: event.target.value })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Expires on (optional)" type="date" value={form.expires} min={new Date().toISOString().slice(0, 10)}
            onChange={event => setForm({ ...form, expires: event.target.value })} />
          <Input label="Usage limit (optional)" type="number" min={1} step={1} value={form.limit} placeholder="No limit"
            onChange={event => setForm({ ...form, limit: event.target.value })} />
        </div>
        <p className="text-xs text-gray-400">The usage limit counts completed payments. A 100% code lets the customer complete the purchase without paying.</p>
        {error && <p role="alert" className="rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
      </div>
    </Modal>
  </main>;
}
