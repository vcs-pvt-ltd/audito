"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { auditExecutionApi } from "@/lib/api";
import Loading from "@/components/shared/Loading";
import { ArrowLeft, Calendar, ClipboardCheck, User } from "lucide-react";
import { IconButton } from "@/components/ui";

type AuditProgress = {
  audit_id: string; title: string; audit_type: string; status: string;
  start_date?: string | null; end_date?: string | null; auditor_name?: string | null;
  progress: { total_questions: number; answered_questions: number; progress_pct: number };
};

const date = (value?: string | null) => value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "Not set";

export default function AuditFirmOrganizationUserAuditDetailsPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const router = useRouter();
  const id = useSearchParams().get("audit_id") || "";
  const [audit, setAudit] = useState<AuditProgress | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!accessToken || !id) return;
    const result = await auditExecutionApi.getFirmProgressDetail(accessToken, id);
    if (result.success && result.data) setAudit((result.data as { audit: AuditProgress }).audit);
    else setError(result.message || "Audit progress is unavailable.");
  }, [accessToken, id]);

  useEffect(() => { if (!isLoading && (!admin || admin.role !== "organization_user")) router.replace("/login"); }, [admin, isLoading, router]);
  useEffect(() => { void load(); }, [load]);
  if (isLoading || (!audit && !error)) return <Loading />;

  return <main className="min-h-full px-4 pb-12 pt-20 text-white sm:px-6 lg:px-8 lg:pt-8"><div className="mx-auto max-w-3xl">
    <div className="mb-6 flex items-center gap-3"><IconButton bordered onClick={() => router.push("/organization-user/audits")} title="Back to audits"><ArrowLeft size={17} /></IconButton><div><h1 className="flex items-center gap-2 text-xl font-bold"><ClipboardCheck className="text-secondary-400" />Audit Progress</h1><p className="mt-1 text-sm text-gray-400">Progress-only view for your audit firm.</p></div></div>
    {error ? <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-200">{error}</div> : audit && <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <h2 className="text-xl font-bold">{audit.title}</h2><p className="mt-1 text-sm capitalize text-gray-400">{audit.status.replace(/_/g, " ")} · {audit.audit_type} audit</p>
      <div className="mt-6 rounded-2xl border border-secondary-500/20 bg-secondary-500/[0.07] p-5"><div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-widest text-secondary-300">Overall progress</p><p className="mt-1 text-3xl font-black text-white">{audit.progress.progress_pct}%</p></div><p className="text-sm text-gray-300">{audit.progress.answered_questions} / {audit.progress.total_questions} answered</p></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-secondary-400" style={{ width: `${audit.progress.progress_pct}%` }} /></div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-white/[0.03] p-3"><p className="text-[10px] font-bold uppercase text-gray-500">Timeline</p><p className="mt-1 text-sm font-semibold">{date(audit.start_date)} – {date(audit.end_date)}</p></div><div className="rounded-xl bg-white/[0.03] p-3"><p className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-500"><User size={11} />Assigned auditor</p><p className="mt-1 text-sm font-semibold">{audit.auditor_name || "Not assigned"}</p></div></div>
    </section>}
  </div></main>;
}
