"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Eye, FileCheck, FilePlus2, Loader2, Pencil, Plus, RefreshCw, Save, Send, ShieldCheck, Trash2 } from "lucide-react";
import Loading from "@/components/shared/Loading";
import { Button, IconButton, Input, Modal, Table, TBody, Td, THead, Th, Tr } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { adminApi, type PrivacyPolicy, type PrivacyPolicySection } from "@/lib/api";

type Draft = Pick<PrivacyPolicy, "title" | "intro" | "sections"> & {
  privacy_policy_id?: string;
  status?: PrivacyPolicy["status"];
  agreement_count?: number;
  version?: string;
  is_current?: boolean;
};

const TEMPLATE_SECTIONS: PrivacyPolicySection[] = [
  { title: "1. Information We Collect", content: "We collect the account, organization, audit, checklist, report, corrective action, communication, and usage information needed to provide Audito." },
  { title: "2. How We Use Information", content: "We use this information to operate and secure the platform, deliver requested services, provide support, improve Audito, and meet legal obligations." },
  { title: "3. Information Sharing", content: "We do not sell personal information. We share information only with authorized users, service providers that support Audito, or where required by law." },
  { title: "4. Data Security", content: "We use appropriate technical and organizational measures to protect information. No online service can guarantee absolute security." },
  { title: "5. Your Rights and Choices", content: "You may request access, correction, or deletion of personal information where applicable, subject to legal and operational requirements." },
  { title: "6. Contact Us", content: "For privacy questions or requests, contact Audito through the support details published in the platform." },
];

const emptyDraft = (): Draft => ({
  title: "Privacy Policy",
  intro: "This Privacy Policy explains how Audito collects, uses, protects, and shares information when you use our platform.",
  sections: TEMPLATE_SECTIONS.map((section) => ({ ...section })),
});

const toDraft = (policy: PrivacyPolicy): Draft => ({
  privacy_policy_id: policy.privacy_policy_id,
  title: policy.title,
  intro: policy.intro,
  sections: policy.sections.map((section) => ({ ...section })),
  status: policy.status,
  agreement_count: Number(policy.agreement_count || 0),
  version: policy.version,
  is_current: policy.is_current,
});

export default function PrivacyPoliciesPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const { toast, confirm } = useUiFeedback();
  const [policies, setPolicies] = useState<PrivacyPolicy[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [viewing, setViewing] = useState<PrivacyPolicy | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    const result = await adminApi.listPrivacyPolicies(accessToken);
    if (result.success && result.data) setPolicies(result.data);
    else toast(result.message || "Unable to load privacy policies.", "error");
    setLoading(false);
  }, [accessToken, toast]);

  useEffect(() => { void load(); }, [load]);

  const isLocked = !!draft.privacy_policy_id && draft.status !== "draft" && Number(draft.agreement_count || 0) > 0;
  const canPublish = !!draft.privacy_policy_id && !isLocked && draft.status !== "published";

  const openNew = () => { setDraft(emptyDraft()); setEditorOpen(true); };
  const openEdit = (policy: PrivacyPolicy) => { setDraft(toDraft(policy)); setEditorOpen(true); };
  const updateSection = (index: number, field: keyof PrivacyPolicySection, value: string) => setDraft((current) => ({
    ...current,
    sections: current.sections.map((section, itemIndex) => itemIndex === index ? { ...section, [field]: value } : section),
  }));

  const save = async () => {
    if (!accessToken) return;
    if (!draft.title.trim() || !draft.intro.trim() || draft.sections.some((section) => !section.title.trim() || !section.content.trim())) {
      toast("Add a title, introduction, and content for every policy point.", "error");
      return;
    }
    setSaving(true);
    const payload = { title: draft.title.trim(), intro: draft.intro.trim(), sections: draft.sections.map((section) => ({ title: section.title.trim(), content: section.content.trim() })) };
    const result = draft.privacy_policy_id
      ? await adminApi.updatePrivacyPolicy(accessToken, draft.privacy_policy_id, payload)
      : await adminApi.createPrivacyPolicy(accessToken, payload);
    if (result.success && result.data?.policy) {
      toast(draft.privacy_policy_id ? "Privacy policy updated." : "Privacy policy draft created.", "success");
      setEditorOpen(false);
      await load();
    } else toast(result.message || "Unable to save privacy policy.", "error");
    setSaving(false);
  };

  const publishPolicy = async (policy: Pick<Draft, "privacy_policy_id" | "title">) => {
    if (!accessToken || !policy.privacy_policy_id) return;
    if (!await confirm({ title: "Publish this policy?", message: "It will become the policy required for new registrations. The current published policy will be archived.", confirmText: "Publish policy", variant: "warning" })) return;
    setSaving(true);
    setPublishingId(policy.privacy_policy_id);
    const result = await adminApi.publishPrivacyPolicy(accessToken, policy.privacy_policy_id);
    if (result.success) { toast("Privacy policy published.", "success"); setEditorOpen(false); await load(); }
    else toast(result.message || "Unable to publish privacy policy.", "error");
    setSaving(false);
    setPublishingId(null);
  };

  const remove = async (policy: PrivacyPolicy) => {
    if (!accessToken) return;
    if (!await confirm({ title: "Delete privacy policy?", message: `Delete ${policy.title} (${policy.version}) permanently? This is allowed only before any registration accepts the policy.`, confirmText: "Delete policy", variant: "error" })) return;
    setDeletingId(policy.privacy_policy_id);
    const result = await adminApi.deletePrivacyPolicy(accessToken, policy.privacy_policy_id);
    if (result.success) { toast("Privacy policy deleted.", "success"); await load(); }
    else toast(result.message || "Unable to delete privacy policy.", "error");
    setDeletingId(null);
  };

  if (isLoading || !admin || admin.role !== "audito_admin") return <Loading />;
  if (loading) return <Loading />;

  return <div className="min-h-full bg-transparent"><main className="mx-auto max-w-7xl space-y-6 p-4 pt-20 sm:p-6 sm:pt-20 lg:p-8 lg:pt-8">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="flex items-center gap-2 text-2xl font-bold text-white"><ShieldCheck size={22} className="text-secondary-400" /> Privacy policies</h1><p className="mt-1 text-sm text-gray-400">Manage policy versions and keep every accepted version available as a record.</p></div><div className="flex flex-wrap gap-2"><Button variant="secondary" leftIcon={<RefreshCw size={16} />} onClick={() => void load()}></Button><Button leftIcon={<Plus size={16} />} onClick={openNew}>Add privacy policy</Button></div></header>

    <div className="hidden md:block"><Table><THead><Th>Privacy policy</Th><Th>Version</Th><Th>Status</Th><Th>Effective date</Th><Th align="center">Accepted</Th><Th align="right">Actions</Th></THead><TBody>{policies.map((policy) => { const locked = policy.status !== "draft" && Number(policy.agreement_count || 0) > 0; const canDelete = !locked && !(policy.status === "published" && policy.is_current); const canPublishRow = policy.status !== "published" && !locked; return <Tr key={policy.privacy_policy_id}><Td><div className="flex items-center gap-3"><div className="rounded-lg border border-secondary-400/15 bg-secondary-500/10 p-2 text-secondary-300"><FileCheck size={16} /></div><p className="font-semibold text-white">{policy.title}</p></div></Td><Td className="font-medium text-gray-300">{policy.version}</Td><Td><Status status={policy.status} /></Td><Td className="whitespace-nowrap text-xs text-gray-400">{formatDate(policy.effective_date || policy.published_at)}</Td><Td align="center" className="font-medium text-gray-300">{Number(policy.agreement_count || 0)}</Td><Td align="right"><div className="flex items-center justify-end gap-2">{canPublishRow && <IconButton tone="info" title="Publish policy" disabled={saving} onClick={() => void publishPolicy(policy)}>{publishingId === policy.privacy_policy_id ? <Loader2 size={16} className="animate-spin text-blue-400" /> : <Send size={16} />}</IconButton>}<IconButton tone="secondary" title="View policy" onClick={() => setViewing(policy)}><Eye size={16} /></IconButton><IconButton tone="secondary" title={locked ? "Policy locked after acceptance" : "Edit policy"} disabled={locked} onClick={() => openEdit(policy)}><Pencil size={16} /></IconButton><IconButton tone="danger" title={canDelete ? "Delete policy" : "This policy cannot be deleted"} disabled={!canDelete || saving} onClick={() => void remove(policy)}>{deletingId === policy.privacy_policy_id ? <Loader2 size={16} className="animate-spin text-red-400" /> : <Trash2 size={16} />}</IconButton></div>{locked && <p className="mt-1 text-[10px] text-amber-300">Locked after acceptance</p>}{policy.status === "published" && policy.is_current && !locked && <p className="mt-1 text-[10px] text-gray-500">Publish another policy before deleting</p>}</Td></Tr>; })}</TBody></Table></div>
    <div className="space-y-3 md:hidden">{policies.map((policy) => { const locked = policy.status !== "draft" && Number(policy.agreement_count || 0) > 0; const canDelete = !locked && !(policy.status === "published" && policy.is_current); const canPublishRow = policy.status !== "published" && !locked; return <article key={policy.privacy_policy_id} className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] shadow-lg shadow-black/10"><div className="flex items-start justify-between gap-3 p-4"><div className="flex min-w-0 gap-3"><div className="rounded-lg border border-secondary-400/15 bg-secondary-500/10 p-2 text-secondary-300"><FileCheck size={16} /></div><div className="min-w-0"><p className="truncate font-semibold text-white">{policy.title}</p><p className="mt-1 text-xs text-gray-500">{policy.version} · {formatDate(policy.effective_date || policy.published_at)}</p></div></div><Status status={policy.status} /></div><div className="grid grid-cols-2 border-y border-white/[.07] bg-black/[.08] text-xs"><div className="p-3"><p className="text-gray-500">Accepted</p><p className="mt-1 font-semibold text-white">{Number(policy.agreement_count || 0)}</p></div><div className="border-l border-white/[.07] p-3"><p className="text-gray-500">Availability</p><p className={`mt-1 font-medium ${locked ? "text-amber-300" : "text-emerald-300"}`}>{locked ? "Locked" : "Manageable"}</p></div></div><div className="flex items-center justify-end gap-2 p-3">{canPublishRow && <IconButton tone="info" title="Publish policy" disabled={saving} onClick={() => void publishPolicy(policy)}>{publishingId === policy.privacy_policy_id ? <Loader2 size={16} className="animate-spin text-blue-400" /> : <Send size={16} />}</IconButton>}<IconButton tone="secondary" title="View policy" onClick={() => setViewing(policy)}><Eye size={16} /></IconButton><IconButton tone="secondary" title={locked ? "Policy locked after acceptance" : "Edit policy"} disabled={locked} onClick={() => openEdit(policy)}><Pencil size={16} /></IconButton><IconButton tone="danger" title={canDelete ? "Delete policy" : "This policy cannot be deleted"} disabled={!canDelete || saving} onClick={() => void remove(policy)}>{deletingId === policy.privacy_policy_id ? <Loader2 size={16} className="animate-spin text-red-400" /> : <Trash2 size={16} />}</IconButton></div></article>; })}</div>
    {!policies.length && <div className="rounded-2xl border border-dashed border-white/10 bg-white/[.025] px-5 py-14 text-center"><FilePlus2 size={28} className="mx-auto text-secondary-400" /><p className="mt-3 font-semibold text-white">No privacy policies yet</p><p className="mt-1 text-sm text-gray-500">Create the first policy before accepting registrations.</p><Button className="mt-5" leftIcon={<Plus size={16} />} onClick={openNew}>Add privacy policy</Button></div>}
  </main>

  <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.title || "Privacy policy"} description={viewing ? `${viewing.version} - ${Number(viewing.agreement_count || 0)} accepted` : ""} icon={<div className="rounded-xl bg-secondary-500/15 p-2 text-secondary-300"><Eye size={18} /></div>} size="xl"><PolicyView policy={viewing} /></Modal>
  <Modal open={editorOpen} onClose={() => !saving && setEditorOpen(false)} title={draft.privacy_policy_id ? `Edit ${draft.version || "privacy policy"}` : "Add privacy policy"} description={isLocked ? "This version is locked because a registration has accepted it." : "Use the prepared structure, then save a draft or publish it."} icon={<div className="rounded-xl bg-secondary-500/15 p-2 text-secondary-300"><FileCheck size={18} /></div>} size="xl" footer={<><Button variant="secondary" onClick={() => setEditorOpen(false)} disabled={saving}>Cancel</Button><Button variant="secondary" disabled={isLocked} loading={saving} leftIcon={<Save size={16} />} onClick={() => void save()}>Save draft</Button>{canPublish && <Button loading={saving} leftIcon={<Send size={16} />} onClick={() => void publishPolicy(draft)}>Publish policy</Button>}</>}><PolicyEditor draft={draft} locked={isLocked} onDraft={setDraft} onSection={updateSection} /></Modal>
  </div>;
}

function PolicyEditor({ draft, locked, onDraft, onSection }: { draft: Draft; locked: boolean; onDraft: React.Dispatch<React.SetStateAction<Draft>>; onSection: (index: number, field: keyof PrivacyPolicySection, value: string) => void }) {
  return <div className="space-y-5"><Input label="Policy title" value={draft.title} disabled={locked} onChange={(event) => onDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Privacy Policy" /><label className="block"><span className="mb-2 block text-sm font-medium text-gray-300">Introduction</span><textarea value={draft.intro} disabled={locked} onChange={(event) => onDraft((current) => ({ ...current, intro: event.target.value }))} rows={3} className="w-full resize-y rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-white outline-none focus:border-secondary-400/60 disabled:cursor-not-allowed disabled:opacity-60" /></label><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-white">Policy points</h3><p className="mt-1 text-xs text-gray-500">Each point is visible in the registration Privacy Policy page.</p></div><Button size="sm" variant="secondary" disabled={locked} leftIcon={<Plus size={14} />} onClick={() => onDraft((current) => ({ ...current, sections: [...current.sections, { title: `${current.sections.length + 1}. New Section`, content: "" }] }))}>Add point</Button></div>{draft.sections.map((section, index) => <div key={index} className="rounded-xl border border-white/[.08] bg-black/[.08] p-4"><div className="mb-3 flex items-center gap-3"><FileCheck size={16} className="text-secondary-400" /><span className="text-xs font-semibold text-gray-300">Point {index + 1}</span><button type="button" aria-label="Remove policy point" disabled={locked || draft.sections.length === 1} onClick={() => onDraft((current) => ({ ...current, sections: current.sections.filter((_, itemIndex) => itemIndex !== index) }))} className="ml-auto text-gray-500 transition hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 size={15} /></button></div><div className="grid gap-3"><Input label="Point title" value={section.title} disabled={locked} onChange={(event) => onSection(index, "title", event.target.value)} /><textarea value={section.content} disabled={locked} onChange={(event) => onSection(index, "content", event.target.value)} rows={4} className="w-full resize-y rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm leading-relaxed text-white outline-none focus:border-secondary-400/60 disabled:cursor-not-allowed disabled:opacity-60" placeholder="Explain this policy point." /></div></div>)}</div>;
}

function PolicyView({ policy }: { policy: PrivacyPolicy | null }) { if (!policy) return null; return <div className="space-y-5"><p className="whitespace-pre-line text-sm leading-relaxed text-gray-400">{policy.intro}</p>{policy.sections.map((section, index) => <article key={`${section.title}-${index}`} className="rounded-xl border border-white/[.08] bg-black/[.08] p-4"><h3 className="font-semibold text-white">{section.title}</h3><p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-400">{section.content}</p></article>)}</div>; }

function Status({ status }: { status?: PrivacyPolicy["status"] }) { const value = status || "draft"; const colors = { draft: "border-gray-400/20 bg-gray-400/10 text-gray-300", published: "border-emerald-400/30 bg-emerald-500/10 text-emerald-400", archived: "border-amber-400/30 bg-amber-500/10 text-amber-300" }; return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${colors[value]}`}>{value === "published" && <CheckCircle2 size={10} />}{value.charAt(0).toUpperCase() + value.slice(1)}</span>; }
function formatDate(value?: string | null) { return value ? new Date(value).toLocaleDateString() : "Not published"; }
