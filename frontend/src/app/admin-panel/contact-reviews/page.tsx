"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Eye, FileSignature, Lock, Mail, MailWarning, Phone, Puzzle, RefreshCw, RotateCcw, Search, Send } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { adminApi, type ContactReviewRequest } from "@/lib/api";
import Loading from "@/components/shared/Loading";
import EmptyState from "@/components/shared/EmptyState";
import TablePagination from "@/components/shared/TablePagination";
import { Button, Modal, Table, TBody, Td, Th, THead, Tr, fieldClass } from "@/components/ui";

type Filter = "all" | "needs_quote" | "unverified" | "quoted" | "registered" | "paid" | "closed";
const verified = (request: ContactReviewRequest) => Boolean(Number(request.email_verified));
const count = (value: number | null) => (value ? Number(value).toLocaleString() : "Not given");
const usd = (value: number | string | null) => `$${Number(value || 0).toFixed(2)}`;
const date = (value?: string | null) => (value ? new Date(value).toLocaleDateString() : "—");

// What the request needs next, used for filters and the status badge.
function stageOf(request: ContactReviewRequest): Exclude<Filter, "all"> {
  if (request.payment_status === "paid") return "paid";
  if (request.status === "closed") return "closed";
  if (request.registered_at) return "registered";
  if (request.status === "quoted") return "quoted";
  return verified(request) ? "needs_quote" : "unverified";
}
const STAGES: Record<Exclude<Filter, "all">, { label: string; tone: string; icon: typeof Clock }> = {
  needs_quote: { label: "Needs quote", tone: "border-secondary-500/30 bg-secondary-500/10 text-secondary-300", icon: FileSignature },
  unverified: { label: "Email not verified", tone: "border-amber-500/30 bg-amber-500/10 text-amber-300", icon: MailWarning },
  quoted: { label: "Quote sent", tone: "border-sky-500/30 bg-sky-500/10 text-sky-300", icon: Send },
  registered: { label: "Awaiting payment", tone: "border-violet-500/30 bg-violet-500/10 text-violet-300", icon: Clock },
  paid: { label: "Paid", tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", icon: CheckCircle2 },
  closed: { label: "Closed", tone: "border-white/15 bg-white/[0.05] text-gray-400", icon: Lock },
};

function StageBadge({ request }: { request: ContactReviewRequest }) {
  const stage = STAGES[stageOf(request)];
  const Icon = stage.icon;
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${stage.tone}`}><Icon size={10} aria-hidden />{stage.label}</span>;
}

export default function ContactReviewsPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const { toast, confirm } = useUiFeedback();
  const router = useRouter();
  const [requests, setRequests] = useState<ContactReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && (!admin || admin.role !== "audito_admin")) router.replace("/login");
  }, [isLoading, admin, router]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true); setError("");
    const result = await adminApi.listContactReviews(accessToken);
    if (result.success && result.data) setRequests(result.data);
    else { setError(result.message || "Could not load requests."); toast(result.message || "Could not load requests.", "error"); }
    setLoading(false);
  }, [accessToken, toast]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setCurrentPage(1); }, [filter, search]);

  const counts = useMemo(() => {
    const result: Record<Filter, number> = { all: requests.length, needs_quote: 0, unverified: 0, quoted: 0, registered: 0, paid: 0, closed: 0 };
    for (const request of requests) result[stageOf(request)]++;
    return result;
  }, [requests]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return requests.filter(request => (filter === "all" || stageOf(request) === filter) && (!term || [request.organization_name, request.contact_name, request.email, request.phone, request.entity_type]
      .some(value => String(value || "").toLowerCase().includes(term))));
  }, [requests, filter, search]);
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selected = requests.find(request => request.request_id === selectedId) || null;

  // Replaces one request after an action, keeping the list order.
  const replace = (updated?: ContactReviewRequest | null) => {
    if (updated?.request_id) setRequests(current => current.map(request => request.request_id === updated.request_id ? updated : request));
  };

  if (isLoading || !admin || admin.role !== "audito_admin") return <Loading />;

  return <div className="min-h-screen space-y-6 p-5 pt-20 lg:p-8 lg:pt-8">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><Puzzle size={22} className="text-secondary-400" aria-hidden /> Account Review Requests</h1>
        <p className="mt-1 text-sm text-gray-400">Customer and Audit Firm accounts: quote, registration and payment.</p>
      </div>
      <Button onClick={() => void load()} disabled={loading} variant="secondary" aria-label="Refresh" leftIcon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />} />
    </div>

    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative max-w-sm flex-1">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden />
        <input type="search" value={search} onChange={event => setSearch(event.target.value)} aria-label="Search requests" placeholder="Search organization, contact, email or phone..."
          className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder-gray-500 transition-all focus:border-secondary-500/50 focus:outline-none" />
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {([["all", "All"], ["needs_quote", "Needs quote"], ["unverified", "Not verified"], ["quoted", "Quote sent"], ["registered", "Awaiting payment"], ["paid", "Paid"], ["closed", "Closed"]] as [Filter, string][]).map(([key, label]) =>
          <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${filter === key ? "bg-secondary-500 text-primary-950" : "border border-white/10 bg-white/5 text-gray-400 hover:text-white"}`}>
            {label} ({counts[key]})
          </button>)}
      </div>
    </div>

    {loading ? <div className="flex items-center justify-center py-24"><RefreshCw size={28} className="animate-spin text-secondary-400" aria-label="Loading" /></div>
      : error ? <div className="py-12 text-center"><p className="mb-4 text-red-400">{error}</p><Button onClick={() => void load()} variant="secondary">Retry</Button></div>
      : filtered.length === 0 ? <EmptyState icon={Puzzle} title={requests.length ? "No requests match" : "No review requests yet"} message={requests.length ? "Try another filter or search." : "Customer and Audit Firm requests appear here after they are sent."} />
      : <>
        <div className="hidden md:block">
          <Table>
            <THead>
              <Th>Organization</Th>
              <Th>Contact</Th>
              <Th align="right">Departments</Th>
              <Th align="right">Audit lines</Th>
              <Th>Status</Th>
              <Th align="right">Quote</Th>
              <Th>Submitted</Th>
              <Th align="right"><span className="sr-only">Actions</span></Th>
            </THead>
            <TBody>
              {paginated.map(request => <Tr key={request.request_id} className="cursor-pointer" onClick={() => setSelectedId(request.request_id)}>
                <Td>
                  <p className="max-w-[220px] truncate text-sm font-medium text-gray-200">{request.organization_name}</p>
                  <p className="text-xs text-gray-500">{request.account_type} · {request.entity_type}{request.country ? ` · ${request.country}` : ""}</p>
                </Td>
                <Td>
                  <p className="text-sm text-gray-300">{request.contact_name}</p>
                  <p className="max-w-[220px] truncate text-xs text-gray-500">{request.email}</p>
                </Td>
                <Td align="right"><span className="text-sm tabular-nums text-gray-300">{count(request.departments)}</span></Td>
                <Td align="right"><span className="text-sm tabular-nums text-gray-300">{count(request.lines_per_audit)}</span></Td>
                <Td><StageBadge request={request} /></Td>
                <Td align="right"><span className="text-sm tabular-nums text-gray-300">{request.assigned_price != null ? usd(request.assigned_price) : "—"}</span></Td>
                <Td><span className="text-xs text-gray-500">{date(request.created_at)}</span></Td>
                <Td align="right">
                  <Button size="sm" variant="secondary" leftIcon={<Eye size={14} />} onClick={event => { event.stopPropagation(); setSelectedId(request.request_id); }}>
                    {stageOf(request) === "needs_quote" ? "Review" : "View"}
                  </Button>
                </Td>
              </Tr>)}
            </TBody>
          </Table>
        </div>
        <div className="space-y-3 md:hidden">
          {paginated.map(request => <button key={request.request_id} type="button" onClick={() => setSelectedId(request.request_id)}
            className="w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] text-left shadow-lg shadow-black/10">
            <div className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-secondary-400">{request.account_type} · {request.entity_type}</p>
                <h2 className="mt-1 truncate text-sm font-semibold text-white">{request.organization_name}</h2>
                <p className="mt-1 truncate text-xs text-gray-400">{request.contact_name} · {request.email}</p>
              </div>
              <StageBadge request={request} />
            </div>
            <div className="grid grid-cols-3 gap-px border-t border-white/[0.08] bg-white/[0.08] text-xs">
              {[["Departments", count(request.departments)], ["Audit lines", count(request.lines_per_audit)], ["Quote", request.assigned_price != null ? usd(request.assigned_price) : "—"]].map(([label, value]) =>
                <div key={label} className="min-w-0 bg-[#08251a]/60 px-3 py-2.5"><p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p><p className="mt-1 truncate text-gray-200">{value}</p></div>)}
            </div>
          </button>)}
        </div>
        <TablePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={filtered.length} pageSize={pageSize}
          onPageSizeChange={size => { setPageSize(size); setCurrentPage(1); }} />
      </>}

    {selected && accessToken && <RequestDialog key={selected.request_id} request={selected} token={accessToken} onClose={() => setSelectedId(null)} onChange={replace} toast={toast} confirm={confirm} />}
  </div>;
}

function RequestDialog({ request, token, onClose, onChange, toast, confirm }: {
  request: ContactReviewRequest; token: string; onClose: () => void; onChange: (request?: ContactReviewRequest | null) => void;
  toast: ReturnType<typeof useUiFeedback>["toast"]; confirm: ReturnType<typeof useUiFeedback>["confirm"];
}) {
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState(request.internal_notes || "");
  const [busy, setBusy] = useState<"" | "quote" | "notes" | "status" | "resend" | "resendQuote">("");
  const [quoteError, setQuoteError] = useState("");
  const [unitPrice, setUnitPrice] = useState<number | null>(null);
  const stage = stageOf(request);
  // Everything paid becomes tokens, the same as the Company package.
  useEffect(() => {
    if (stage !== "needs_quote") return;
    adminApi.getPackagePricing(token).then(result => { if (result.success && result.data) setUnitPrice(Number(result.data.token_unit_price)); }).catch(() => undefined);
  }, [stage, token]);
  const typedPrice = Number(price);
  const previewTokens = unitPrice && typedPrice > 0 ? Math.round(typedPrice / unitPrice) : 0;

  const run = async (kind: typeof busy, action: () => ReturnType<typeof adminApi.closeContactReview>, success: string) => {
    setBusy(kind);
    const result = await action();
    setBusy("");
    if (result.success) { onChange(result.data); toast(result.message || success, "success"); }
    else toast(result.message || "Something went wrong. Try again.", "error");
    return result.success;
  };
  const sendQuote = async () => {
    const amount = Number(price);
    if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100) return setQuoteError("Enter a price in USD greater than 0, with up to 2 decimals.");
    setQuoteError("");
    const approved = await confirm({ title: `Send ${usd(amount)} quote?`, message: `The quote is emailed to ${request.email} with a Register button, your message and the Audito contact details. The registration link works for 30 days.`, confirmText: "Send quote", cancelText: "Keep editing" });
    if (approved) await run("quote", () => adminApi.quoteContactReview(token, request.request_id, amount, message.trim()), "Quote sent.");
  };
  const toggleClosed = async () => {
    if (request.status !== "closed") {
      const approved = await confirm({ title: "Close this request?", message: "Use this when the request is finished or will not continue. You can reopen it later.", confirmText: "Close request", cancelText: "Keep open", variant: "warning" });
      if (!approved) return;
      await run("status", () => adminApi.closeContactReview(token, request.request_id), "Request closed.");
    } else await run("status", () => adminApi.reopenContactReview(token, request.request_id), "Request reopened.");
  };

  const detail = (label: string, value: ReactNode) => <div className="min-w-0"><dt className="text-[11px] uppercase tracking-wide text-gray-500">{label}</dt><dd className="mt-1 break-words text-sm text-gray-200">{value}</dd></div>;

  return <Modal open onClose={onClose} size="lg" title={request.organization_name} description={`${request.account_type} · ${request.entity_type} · submitted ${new Date(request.created_at).toLocaleString()}`}
    headerActions={<StageBadge request={request} />}>
    <div className="space-y-5">
      <dl className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2">
        {detail("Contact", request.contact_name)}
        {detail("Email", <span className="flex flex-wrap items-center gap-2"><a className="text-secondary-300 underline underline-offset-2" href={`mailto:${request.email}`}>{request.email}</a>
          {verified(request) ? <span className="text-xs text-emerald-400">Verified</span> : <span className="text-xs text-amber-300">Not verified</span>}</span>)}
        {detail("Phone", <a className="inline-flex items-center gap-1 text-secondary-300 underline underline-offset-2" href={`tel:${request.phone.replace(/[^\d+]/g, "")}`}><Phone size={12} aria-hidden />{request.phone}</a>)}
        {detail("Account", `${request.account_type} · ${request.entity_type}`)}`n        {detail("Country", request.country || "Not given")}
        {detail("Departments", count(request.departments))}
        {detail("Audit lines per audit", count(request.lines_per_audit))}
        {request.notes && <div className="sm:col-span-2">{detail("Requester's notes", <span className="whitespace-pre-wrap">{request.notes}</span>)}</div>}
      </dl>

      {!verified(request) && request.status !== "closed" && <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-amber-100"><MailWarning size={15} className="mr-1.5 inline" aria-hidden />The requester has not verified their email. A quote can be sent after they verify.</p>
        <Button size="sm" variant="secondary" loading={busy === "resend"} leftIcon={<Mail size={14} />} onClick={() => void run("resend", () => adminApi.resendContactReviewVerification(token, request.request_id), "Verification email sent.")}>Resend verification</Button>
      </div>}

      {stage === "needs_quote" && <section className="space-y-3 rounded-2xl border border-secondary-500/20 bg-secondary-500/[0.05] p-4" aria-labelledby="quote-title">
        <h3 id="quote-title" className="text-sm font-semibold text-white">Send a quote</h3>
        <label className="block text-sm text-gray-300">Price (USD) <span className="text-red-400">*</span>
          <input type="number" min={0.01} step={0.01} inputMode="decimal" value={price} onChange={event => { setPrice(event.target.value); setQuoteError(""); }} className={`${fieldClass} mt-1.5`} placeholder="0.00" aria-invalid={Boolean(quoteError)} />
        </label>
        <label className="block text-sm text-gray-300">Message to the requester <span className="text-xs text-gray-500">(optional)</span>
          <textarea rows={4} maxLength={2000} value={message} onChange={event => setMessage(event.target.value)} className={`${fieldClass} mt-1.5`} placeholder="What the price includes and the next steps" />
        </label>
        {previewTokens > 0 && unitPrice && <p className={`text-xs ${request.lines_per_audit && previewTokens < request.lines_per_audit ? "text-amber-200" : "text-gray-300"}`}>
          Includes <b>{previewTokens.toLocaleString()} tokens</b> at {usd(unitPrice)} each (1 token = 1 audit line).
          {request.lines_per_audit && previewTokens < request.lines_per_audit ? ` That is fewer than one audit of ${request.lines_per_audit.toLocaleString()} lines.` : ""}
        </p>}
        <p className="text-xs text-gray-400">The email includes a Register button, the request details, and the Audito WhatsApp number and email. After registering, the customer pays on the normal payment page.</p>
        {quoteError && <p role="alert" className="text-sm text-red-400">{quoteError}</p>}
        <Button loading={busy === "quote"} disabled={Boolean(busy)} leftIcon={<Send size={15} />} onClick={() => void sendQuote()}>Send quote</Button>
      </section>}

      {request.assigned_price != null && <section className="space-y-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4" aria-label="Quote and registration">
        <p className="text-sm text-gray-300">Quoted <b className="text-white">{usd(request.assigned_price)}</b>
          {request.quoted_tokens ? ` · ${Number(request.quoted_tokens).toLocaleString()} tokens` : ""}{request.quoted_at ? ` · ${new Date(request.quoted_at).toLocaleString()}` : ""}</p>
        {request.admin_notes && <p className="whitespace-pre-wrap text-sm text-gray-400">{request.admin_notes}</p>}
        {/* Registration and payment progress after the quote. */}
        <ol className="space-y-1.5 border-t border-white/10 pt-3 text-sm">
          <li className="text-gray-300"><CheckCircle2 size={13} className="mr-1.5 inline text-emerald-400" aria-hidden />Quote emailed with a registration link</li>
          <li className={request.registered_at ? "text-gray-300" : "text-gray-500"}>
            {request.registered_at ? <CheckCircle2 size={13} className="mr-1.5 inline text-emerald-400" aria-hidden /> : <Clock size={13} className="mr-1.5 inline" aria-hidden />}
            {request.registered_at ? `Registered on ${new Date(request.registered_at).toLocaleString()}` : request.registration_link_active
              ? `Not registered yet · link works until ${date(request.registration_expires_at)}` : "Not registered yet · the registration link has expired"}
          </li>
          <li className={request.payment_status === "paid" ? "text-gray-300" : "text-gray-500"}>
            {request.payment_status === "paid" ? <CheckCircle2 size={13} className="mr-1.5 inline text-emerald-400" aria-hidden /> : <Clock size={13} className="mr-1.5 inline" aria-hidden />}
            {request.payment_status === "paid" ? `Paid${request.paid_at ? ` on ${new Date(request.paid_at).toLocaleString()}` : ""}${request.payment_amount != null ? ` · ${usd(request.payment_amount)}` : ""} · workspace active`
              : request.registered_at ? `Payment ${request.payment_status === "failed" ? "failed — the customer can try again from the payment page" : "pending — see Payments for approval requests"}` : "Payment after registration"}
          </li>
        </ol>
        {request.status === "quoted" && !request.registered_at && <Button size="sm" variant="secondary" loading={busy === "resendQuote"} disabled={Boolean(busy)} leftIcon={<Mail size={14} />}
          onClick={() => void run("resendQuote", () => adminApi.resendContactReviewQuote(token, request.request_id), "Quote email sent again.")}>Resend quote email with a new link</Button>}
      </section>}

      <section className="space-y-2">
        <label htmlFor="internal-notes" className="block text-sm font-semibold text-white">Team notes <span className="text-xs font-normal text-gray-500">(only visible to Audito admins)</span></label>
        <textarea id="internal-notes" rows={3} maxLength={4000} value={notes} onChange={event => setNotes(event.target.value)} className={fieldClass} placeholder="Calls, follow-ups, decisions" />
        <Button size="sm" variant="secondary" loading={busy === "notes"} disabled={Boolean(busy) || notes.trim() === (request.internal_notes || "").trim()}
          onClick={() => void run("notes", () => adminApi.updateContactReviewNotes(token, request.request_id, notes), "Notes saved.")}>Save notes</Button>
      </section>

      <div className="flex flex-col-reverse gap-2 border-t border-white/10 pt-4 sm:flex-row sm:justify-between">
        <Button variant="ghost" loading={busy === "status"} disabled={Boolean(busy)} leftIcon={request.status === "closed" ? <RotateCcw size={14} /> : <Lock size={14} />} onClick={() => void toggleClosed()}>
          {request.status === "closed" ? "Reopen request" : "Close request"}
        </Button>
        <Button variant="secondary" onClick={onClose}>Done</Button>
      </div>
    </div>
  </Modal>;
}
