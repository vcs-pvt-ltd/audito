"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { adminApi, type AdminTokenReloadPackage, type PackagePricing } from "@/lib/api";

export default function PricingSettingsPage() {
  const { admin, accessToken } = useAuth();
  const { toast, confirm } = useUiFeedback();
  const [pricing, setPricing] = useState<PackagePricing | null>(null);
  const [rate, setRate] = useState("1.00");
  const [packages, setPackages] = useState<AdminTokenReloadPackage[]>([]);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(100);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    const [priceResult, packagesResult] = await Promise.all([adminApi.getPackagePricing(accessToken), adminApi.listTokenPackages(accessToken)]);
    if (priceResult.success && priceResult.data) { setPricing(priceResult.data); setRate(Number(priceResult.data.token_unit_price).toFixed(2)); }
    else toast(priceResult.message || "Could not load pricing.", "error");
    if (packagesResult.success && packagesResult.data) setPackages(packagesResult.data.packages);
  }, [accessToken, toast]);

  useEffect(() => { void load(); }, [load]);

  async function saveRate() {
    if (!accessToken) return;
    setBusy(true);
    const result = await adminApi.updatePackagePricing(accessToken, Number(rate));
    setBusy(false);
    if (result.success && result.data) { setPricing(result.data); toast("Token price saved for future purchases.", "success"); }
    else toast(result.message || "Could not save token price.", "error");
  }

  async function addPackage() {
    if (!accessToken) return;
    setBusy(true);
    const result = await adminApi.createTokenPackage(accessToken, { display_name: name.trim(), token_quantity: quantity, bonus_token_quantity: 0, is_active: true });
    setBusy(false);
    if (result.success) { setName(""); await load(); toast("Token reload package added.", "success"); }
    else toast(result.message || "Could not add package.", "error");
  }

  async function savePackage(item: AdminTokenReloadPackage) {
    if (!accessToken) return;
    setBusy(true);
    const result = await adminApi.updateTokenPackage(accessToken, item.token_reload_package_id, {
      display_name: item.display_name, token_quantity: Number(item.token_quantity),
      bonus_token_quantity: Number(item.bonus_token_quantity), is_active: Boolean(item.is_active),
    });
    setBusy(false);
    if (result.success) { toast("Token package saved.", "success"); await load(); }
    else toast(result.message || "Could not save package.", "error");
  }

  async function removePackage(item: AdminTokenReloadPackage) {
    if (!accessToken || !await confirm({ title: "Delete token package?", message: `Delete ${item.display_name}? Existing payments remain unchanged.`, confirmText: "Delete", variant: "error" })) return;
    setBusy(true);
    const result = await adminApi.deleteTokenPackage(accessToken, item.token_reload_package_id);
    setBusy(false);
    if (result.success) { toast("Token package deleted.", "success"); await load(); }
    else toast(result.message || "Could not delete package.", "error");
  }

  if (!admin || admin.role !== "audito_admin") return null;
  return <main className="mx-auto max-w-4xl space-y-6 p-4 pt-20 text-white sm:p-6 lg:pt-8">
    <h1 className="text-2xl font-bold">Pricing Settings</h1>
    <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
      <h2 className="text-lg font-semibold">Company package pricing</h2>
      <p className="mt-2 text-sm text-gray-400">1 token = 1 audit line (1 audit question). Changes to the token price apply to future purchases; existing payment snapshots retain their price.</p>
      <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-xl bg-white/5 p-3"><p className="font-semibold text-white">Company levels</p><p className="mt-2">Levels 1–3: Department, Unit, Factory — free.</p><p className="mt-1">Level 4: Cluster — $50 + $50 = $100 total.</p><p className="mt-1">Level 5: Company — $50 + $50 + $50 = $150 total.</p><p className="mt-2 text-xs text-gray-400">Each choice includes all levels below it. These amounts also give tokens at the current token price.</p></div>
        <div className="rounded-xl bg-white/5 p-3">Departments: up to 5 free; above 5, $10 × all selected departments</div>
      </div>
      <label className="mt-6 block text-sm">Price per token (USD)
        <input type="number" min="0.01" step="0.01" value={rate} onChange={(event) => setRate(event.target.value)} className="mt-2 block w-48 rounded-xl border border-white/15 bg-[#102c28] px-3 py-2 text-white" />
      </label>
      <p className="mt-2 text-xs text-gray-400">Use a whole-cent price that divides $10 into whole tokens, such as $0.50, $1.00, or $2.00.</p>
      {pricing?.updated_at && <p className="mt-2 text-xs text-gray-500">Last updated: {new Date(pricing.updated_at).toLocaleString()}</p>}
      <button type="button" disabled={busy} onClick={() => void saveRate()} className="mt-4 rounded-xl bg-secondary-500 px-5 py-2.5 font-semibold text-primary-950 disabled:opacity-50">Save token price</button>
    </section>
    <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
      <h2 className="text-lg font-semibold">Token reload packages</h2>
      <p className="mt-1 text-sm text-gray-400">Reload prices use the global token price when checkout is created.</p>
      <ul className="mt-4 space-y-2">{packages.map((item) => <li key={item.token_reload_package_id} className="grid gap-2 rounded-xl bg-white/5 p-3 text-sm sm:grid-cols-[1fr_100px_100px_auto_auto]">
        <input aria-label="Package name" value={item.display_name} onChange={(event) => setPackages((current) => current.map((entry) => entry.token_reload_package_id === item.token_reload_package_id ? { ...entry, display_name: event.target.value } : entry))} className="min-w-0 rounded-lg border border-white/15 bg-[#102c28] px-2 py-1" />
        <input aria-label="Token quantity" type="number" min="1" value={item.token_quantity} onChange={(event) => setPackages((current) => current.map((entry) => entry.token_reload_package_id === item.token_reload_package_id ? { ...entry, token_quantity: Number(event.target.value) } : entry))} className="min-w-0 rounded-lg border border-white/15 bg-[#102c28] px-2 py-1" />
        <input aria-label="Bonus tokens" type="number" min="0" value={item.bonus_token_quantity} onChange={(event) => setPackages((current) => current.map((entry) => entry.token_reload_package_id === item.token_reload_package_id ? { ...entry, bonus_token_quantity: Number(event.target.value) } : entry))} className="min-w-0 rounded-lg border border-white/15 bg-[#102c28] px-2 py-1" />
        <label className="flex items-center gap-1"><input type="checkbox" checked={Boolean(item.is_active)} onChange={(event) => setPackages((current) => current.map((entry) => entry.token_reload_package_id === item.token_reload_package_id ? { ...entry, is_active: event.target.checked } : entry))} /> Active</label>
        <div className="flex gap-2"><button disabled={busy} onClick={() => void savePackage(item)} className="rounded-lg bg-secondary-500 px-3 py-1 font-semibold text-primary-950 disabled:opacity-50">Save</button><button disabled={busy} onClick={() => void removePackage(item)} className="rounded-lg border border-red-500/30 px-3 py-1 text-red-300 disabled:opacity-50">Delete</button></div>
      </li>)}</ul>
      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_130px_auto]">
        <input aria-label="Package name" placeholder="Package name" value={name} onChange={(event) => setName(event.target.value)} className="rounded-xl border border-white/15 bg-[#102c28] px-3 py-2 text-white" />
        <input aria-label="Token quantity" type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="rounded-xl border border-white/15 bg-[#102c28] px-3 py-2 text-white" />
        <button type="button" disabled={busy} onClick={() => void addPackage()} className="rounded-xl bg-secondary-500 px-4 py-2 font-semibold text-primary-950 disabled:opacity-50">Add package</button>
      </div>
    </section>
  </main>;
}
