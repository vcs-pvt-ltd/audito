"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Coins, CreditCard, History, Layers3, RefreshCw, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import {
  paymentApi, tokenApi,
  type PaymentDetails, type TokenLedgerEntry,
  type TokenReloadPackage, type TokenWallet,
} from "@/lib/api";
import Loading from "@/components/shared/Loading";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui";
import DepartmentUpgradeModal from "@/components/billing/DepartmentUpgradeModal";

const money = (value: number, currency = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value || 0);
const tokens = (value: number) => Number(value || 0).toLocaleString();
const TOKEN_ACTION_LABEL: Record<TokenLedgerEntry["entry_type"], string> = {
  grant: "Tokens added",
  reserve: "Tokens put on hold",
  release: "On-hold tokens restored",
  burn: "Tokens burned",
  expire: "Tokens expired",
  adjustment: "Token adjustment",
};

function tokenHistoryTitle(entry: TokenLedgerEntry) {
  const action = TOKEN_ACTION_LABEL[entry.entry_type] || "Token activity";
  if (entry.audit_title) return `${entry.audit_title} — ${action}`;
  if (["reserve", "release", "burn", "expire"].includes(entry.entry_type)) return `Deleted audit — ${action}`;
  return action;
}

function tokenHistoryMeta(entry: TokenLedgerEntry) {
  return [entry.root_entity_code ? `Wallet: ${entry.root_entity_code}` : null, entry.auditor_name ? `Auditor: ${entry.auditor_name}` : null, new Date(entry.created_at).toLocaleString()]
    .filter(Boolean)
    .join(" · ");
}

function paymentHistoryMeta(payment: PaymentDetails) {
  return [
    payment.invoice_number ? `Invoice ${payment.invoice_number}` : null,
    payment.status || "pending",
    payment.created_at ? new Date(payment.created_at).toLocaleDateString() : null,
  ].filter(Boolean).join(" · ");
}

export default function BillingPage() {
  const { admin, accessToken, isLoading, subscription } = useAuth();
  const { toast } = useUiFeedback();
  const router = useRouter();
  const [wallet, setWallet] = useState<TokenWallet | null>(null);
  const [packages, setPackages] = useState<TokenReloadPackage[]>([]);
  const [ledger, setLedger] = useState<TokenLedgerEntry[]>([]);
  const [payments, setPayments] = useState<PaymentDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    const [walletResult, packageResult, ledgerResult, paymentResult] = await Promise.all([
      tokenApi.wallet(accessToken), tokenApi.packages(accessToken), tokenApi.ledger(accessToken, 100),
      paymentApi.list(accessToken),
    ]);
    if (walletResult.success && walletResult.data) setWallet(walletResult.data.wallet);
    if (packageResult.success && packageResult.data) setPackages(packageResult.data.packages);
    if (ledgerResult.success && ledgerResult.data) setLedger(ledgerResult.data.entries);
    if (paymentResult.success && paymentResult.data) setPayments(paymentResult.data.payments || []);
    if (!walletResult.success) toast(walletResult.message || "Unable to load token wallet.", "error");
    setLoading(false);
  }, [accessToken, toast]);

  useEffect(() => { void load(); }, [load]);

  const activePlan = wallet?.plan_name || subscription?.plan_name || "Package";
  const usesLinkedTokenPool = (wallet?.wallet_members?.length || 0) > 1;

  const reload = async (reloadPackage: TokenReloadPackage) => {
    if (!accessToken) return;
    setCheckoutId(reloadPackage.token_reload_package_id);
    const result = await tokenApi.checkout(accessToken, reloadPackage.token_reload_package_id);
    if (result.success && result.data?.payment.payment_code) {
      router.push(`/payment?code=${encodeURIComponent(result.data.payment.payment_code)}`);
    } else {
      toast(result.message || "Unable to create token reload checkout.", "error");
      setCheckoutId(null);
    }
  };

  if (isLoading || !admin) return null;
  if (admin.role !== "admin") return <div className="p-8 text-center text-gray-400">Only workspace administrators can manage tokens and billing.</div>;
  if (loading) return <Loading />;

  return (
    <main className="mx-auto max-w-7xl space-y-7 p-4 pt-20 sm:p-6 lg:p-8 lg:pt-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-secondary-400">Workspace billing</p><h1 className="mt-1 text-2xl font-bold text-white">Tokens & billing</h1><p className="mt-1 text-sm text-gray-400">1 token = 1 audit line (1 audit question).{usesLinkedTokenPool ? " Available tokens include accepted linked requester workspaces." : ""}</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" leftIcon={<Layers3 size={15} />} onClick={() => setUpgradeOpen(true)}>Add departments</Button>
          <Button variant="secondary" leftIcon={<RefreshCw size={15} />} onClick={() => void load()}>Refresh</Button>
        </div>
      </header>
      <DepartmentUpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} onApplied={() => void load()} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Coins} label="Available" value={tokens(wallet?.available_tokens || 0)} accent="text-amber-300" />
        <Metric icon={ShieldCheck} label="On hold for audits" value={tokens(wallet?.held_tokens || 0)} accent="text-blue-300" />
        <Metric icon={History} label="Lifetime burned" value={tokens(wallet?.lifetime_burned_tokens || 0)} accent="text-rose-300" />
        <Metric icon={Layers3} label="Workspace" value={activePlan === "Package" ? "Company package" : activePlan === "Custom" ? "Quoted account" : activePlan} accent="text-secondary-300" detail={`${money(wallet?.token_unit_price || 0)} per token`} />
      </section>

      {usesLinkedTokenPool && <section className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[.04] p-5">
        <div className="flex items-start gap-3"><Coins size={18} className="mt-0.5 shrink-0 text-emerald-300" /><div><h2 className="text-base font-bold text-white">Linked token pool</h2><p className="mt-1 text-xs text-gray-300">Your available balance includes tokens from accepted requester entities. Audits use this combined balance automatically.</p></div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{wallet?.wallet_members?.map((member) => <div key={member.root_entity_code} className="rounded-xl border border-white/[.08] bg-black/10 p-3"><p className="text-xs font-semibold text-gray-200">{member.root_entity_code === wallet.root_entity_code ? "This workspace" : `Linked requester · ${member.display_name || member.root_entity_code}`}</p>{member.display_name && member.root_entity_code !== wallet.root_entity_code && <p className="mt-0.5 text-[10px] text-gray-500">{member.root_entity_code}</p>}<p className="mt-1 text-lg font-bold text-white">{tokens(member.available_tokens)} <span className="text-xs font-medium text-gray-500">available</span></p><p className="mt-1 text-[11px] text-gray-500">{tokens(member.held_tokens)} on hold ·{tokens(member.lifetime_burned_tokens)} burned</p></div>)}</div>
      </section>}

      <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
        <div className="mb-5"><h2 className="text-lg font-bold text-white">Reload tokens</h2><p className="mt-1 text-xs text-gray-400">Purchased tokens do not expire. Any package bonus is shown separately.</p></div>
        {packages.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{packages.map((item) => (
          <div key={item.token_reload_package_id} className="rounded-xl border border-white/[.08] bg-black/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{item.display_name}</p>
            <p className="mt-2 text-2xl font-bold text-white">{tokens(item.token_quantity)} <span className="text-sm font-medium text-gray-500">tokens</span></p>
            {item.bonus_token_quantity > 0 && <p className="mt-1 text-xs text-emerald-300">+ {tokens(item.bonus_token_quantity)} bonus</p>}
            <Button fullWidth className="mt-4" loading={checkoutId === item.token_reload_package_id} onClick={() => void reload(item)}>{money(item.amount, item.currency)}</Button>
          </div>
        ))}</div> : <EmptyState icon={Coins} title="No reload packages" message="Ask Audito support to configure token packages for this workspace." />}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <HistoryPanel title="Token history" empty="Token grants, holds, releases, and burns will appear here.">{ledger.map((entry) => <HistoryRow key={entry.token_ledger_entry_id} title={tokenHistoryTitle(entry)} meta={tokenHistoryMeta(entry)} value={`${signed(entry.available_delta)} available · ${signed(entry.held_delta)} on hold ·${signed(entry.burned_delta)} burned`} />)}</HistoryPanel>
        <HistoryPanel title="Payment history" empty="Package and token payments will appear here.">{payments.map((payment) => <HistoryRow key={payment.payment_code} title={payment.purpose === "token_reload" ? `${tokens(payment.token_quantity || 0)} token reload` : payment.pricing_snapshot?.purchase_type === "department_upgrade" ? `Departments ${Number(payment.pricing_snapshot.from_departments)} → ${Number(payment.pricing_snapshot.departments)}` : payment.plan_name === "Package" ? "Company package" : `${payment.plan_name} plan`} meta={paymentHistoryMeta(payment)} value={money(payment.amount, payment.currency)} />)}</HistoryPanel>
      </section>
    </main>
  );
}

function signed(value: number) { const number = Number(value || 0); return number > 0 ? `+${number}` : String(number); }
function Metric({ icon: Icon, label, value, accent, detail }: { icon: typeof Coins; label: string; value: string; accent: string; detail?: string }) { return <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4"><div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${accent}`}><Icon size={15} />{label}</div><p className="mt-3 text-2xl font-bold text-white">{value}</p>{detail && <p className="mt-1 text-xs text-gray-500">{detail}</p>}</div>; }
function HistoryPanel({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) { return <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><h2 className="mb-4 flex items-center gap-2 text-base font-bold text-white"><CreditCard size={16} className="text-secondary-400" />{title}</h2>{children.length ? <div className="divide-y divide-white/[.06]">{children}</div> : <p className="py-8 text-center text-sm text-gray-500">{empty}</p>}</section>; }
function HistoryRow({ title, meta, value }: { title: string; meta: string; value: string }) { return <div className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-gray-200">{title}</p><p className="mt-0.5 text-[11px] text-gray-500">{meta}</p></div><p className="shrink-0 text-xs font-semibold text-gray-300">{value}</p></div>; }
