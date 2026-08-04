"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { capApi } from "@/lib/api";
import Loading from "@/components/shared/Loading";
import { ArrowLeft, ClipboardList, User } from "lucide-react";
import { IconButton } from "@/components/ui";

type CapProgress = { cap_id: string; title: string; status: string; created_at?: string | null; audit_title?: string | null; auditor_name?: string | null; progress: { total_questions: number; answered_questions: number; progress_pct: number } };

export default function AuditFirmOrganizationUserCapDetailsPage() {
  const { admin, accessToken, isLoading } = useAuth(); const router = useRouter(); const id = useSearchParams().get("cap_id") || "";
  const [cap, setCap] = useState<CapProgress | null>(null); const [error, setError] = useState("");
  const load = useCallback(async () => { if (!accessToken || !id) return; const result = await capApi.getFirmProgressDetail(accessToken, id); if (result.success && result.data) setCap((result.data as { cap: CapProgress }).cap); else setError(result.message || "CAP progress is unavailable."); }, [accessToken, id]);
  useEffect(() => { if (!isLoading && (!admin || admin.role !== "organization_user")) router.replace("/login"); }, [admin, isLoading, router]); useEffect(() => { void load(); }, [load]);
  if (isLoading || (!cap && !error)) return <Loading />;
  return <main className="min-h-full px-4 pb-12 pt-20 text-white sm:px-6 lg:px-8 lg:pt-8"><div className="mx-auto max-w-3xl"><div className="mb-6 flex items-center gap-3"><IconButton bordered onClick={() => router.push("/organization-user/caps")} title="Back to CAPs"><ArrowLeft size={17} /></IconButton><div><h1 className="flex items-center gap-2 text-xl font-bold"><ClipboardList className="text-secondary-400" />CAP Progress</h1><p className="mt-1 text-sm text-gray-400">Progress-only view for your audit firm.</p></div></div>{error ? <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-200">{error}</div> : cap && <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"><h2 className="text-xl font-bold">{cap.title}</h2><p className="mt-1 text-sm text-gray-400">Source audit: {cap.audit_title || "Not available"}</p><div className="mt-6 rounded-2xl border border-secondary-500/20 bg-secondary-500/[0.07] p-5"><div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-widest text-secondary-300">Overall progress</p><p className="mt-1 text-3xl font-black">{cap.progress.progress_pct}%</p></div><p className="text-sm text-gray-300">{cap.progress.answered_questions} / {cap.progress.total_questions} answered</p></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-secondary-400" style={{ width: `${cap.progress.progress_pct}%` }} /></div></div><div className="mt-5 rounded-xl bg-white/[0.03] p-3"><p className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-500"><User size={11} />Assigned auditor</p><p className="mt-1 text-sm font-semibold">{cap.auditor_name || "Not assigned"}</p></div></section>}</div></main>;
}
