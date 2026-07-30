"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Bot, Eye, FileText, Loader2, Pencil, Plus, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { adminApi, type AiKnowledgeSource } from "@/lib/api";
import Loading from "@/components/shared/Loading";
import EmptyState from "@/components/shared/EmptyState";
import { Button, IconButton, Input, Modal, Table, TBody, Td, THead, Th, Tr } from "@/components/ui";

type SourceKind = "article" | "document";
const statusClass: Record<AiKnowledgeSource["status"], string> = {
  draft: "border-gray-500/25 bg-gray-500/10 text-gray-300",
  processing: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  published: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  failed: "border-red-500/25 bg-red-500/10 text-red-300",
  archived: "border-slate-500/25 bg-slate-500/10 text-slate-300",
};

const emptyForm = { title: "", category: "", tags: "", body_content: "" };

export default function AiKnowledgePage() {
  const { admin, accessToken, isLoading } = useAuth();
  const { confirm, toast } = useUiFeedback();
  const router = useRouter();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [sources, setSources] = useState<AiKnowledgeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | AiKnowledgeSource["status"]>("all");
  const [showEditor, setShowEditor] = useState(false);
  const [showView, setShowView] = useState(false);
  const [kind, setKind] = useState<SourceKind>("article");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<AiKnowledgeSource | null>(null);
  const [viewing, setViewing] = useState<AiKnowledgeSource | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [workingId, setWorkingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && (!admin || admin.role !== "audito_admin")) router.replace("/login");
  }, [isLoading, admin, router]);

  const loadSources = async () => {
    if (!accessToken) return;
    setLoading(true); setError("");
    try {
      const response = await adminApi.listAiKnowledgeSources(accessToken);
      if (response.success && response.data) setSources(response.data);
      else setError(response.message || "Failed to load AI knowledge sources.");
    } catch { setError("Failed to load AI knowledge sources."); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (accessToken) void loadSources(); }, [accessToken]);

  const openCreate = (nextKind: SourceKind) => {
    setEditing(null); setKind(nextKind); setForm(emptyForm); setSelectedFile(null); setFormError(""); setShowEditor(true);
  };
  const openEdit = (source: AiKnowledgeSource) => {
    setEditing(source); setKind(source.source_type); setSelectedFile(null);
    setForm({ title: source.title, category: source.category || "", tags: source.tags.join(", "), body_content: source.body_content || "" });
    setFormError(""); setShowEditor(true);
  };
  const tags = () => form.tags.split(",").map(item => item.trim()).filter(Boolean);

  const saveSource = async () => {
    if (!accessToken || saving) return;
    if (!form.title.trim()) { setFormError("Title is required."); return; }
    if (kind === "article" && !form.body_content.trim()) { setFormError("Article content is required."); return; }
    if (!editing && kind === "document" && !selectedFile) { setFormError("Select a document to upload."); return; }
    if (selectedFile && selectedFile.size > 10 * 1024 * 1024) { setFormError("Document must be 10 MB or smaller."); return; }
    setSaving(true); setFormError("");
    try {
      const payload = { title: form.title.trim(), category: form.category.trim(), tags: tags(), body_content: form.body_content.trim() };
      const response = editing
        ? await adminApi.updateAiKnowledgeSource(accessToken, editing.ai_knowledge_source_id, payload)
        : kind === "article"
          ? await adminApi.createAiKnowledgeArticle(accessToken, payload)
          : await adminApi.uploadAiKnowledgeDocument(accessToken, selectedFile!, payload);
      if (response?.success) {
        toast(editing ? "Knowledge source updated." : "Knowledge source saved as a draft.", "success");
        setShowEditor(false); await loadSources();
      } else setFormError(response?.message || "The knowledge source could not be saved. Please try again.");
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : "The knowledge source could not be saved. Please try again.");
    }
    finally { setSaving(false); }
  };

  const runAction = async (source: AiKnowledgeSource, action: "publish" | "unpublish" | "delete") => {
    if (!accessToken) return;
    const labels = { publish: "Publish", unpublish: "Unpublish", delete: "Delete" };
    const message = action === "publish"
      ? `Publish “${source.title}” to the public Audito AI knowledge base?`
      : action === "unpublish"
        ? `Remove “${source.title}” from Audito AI? Visitors will no longer receive answers from it.`
        : `Delete “${source.title}” permanently?`;
    const accepted = await confirm({ title: `${labels[action]} Knowledge Source`, message, confirmText: labels[action], variant: action === "delete" ? "error" : action === "unpublish" ? "warning" : "info" });
    if (!accepted) return;
    setWorkingId(source.ai_knowledge_source_id);
    try {
      const response = action === "publish"
        ? await adminApi.publishAiKnowledgeSource(accessToken, source.ai_knowledge_source_id)
        : action === "unpublish"
          ? await adminApi.unpublishAiKnowledgeSource(accessToken, source.ai_knowledge_source_id)
          : await adminApi.deleteAiKnowledgeSource(accessToken, source.ai_knowledge_source_id);
      if (response.success) { toast(`Knowledge source ${action === "delete" ? "deleted" : `${action}ed`} successfully.`, "success"); await loadSources(); }
      else toast(response.message || `Failed to ${action} knowledge source.`, "error");
    } catch { toast(`Failed to ${action} knowledge source.`, "error"); }
    finally { setWorkingId(null); }
  };

  const filtered = filter === "all" ? sources : sources.filter(source => source.status === filter);
  if (isLoading || !admin) return <Loading />;

  return (
    <div className="min-h-screen p-5 pt-20 lg:p-8 lg:pt-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-2xl font-bold text-white"><Bot size={22} className="text-secondary-400" /> AI Knowledge</h1><p className="mt-1 text-sm text-gray-400">Publish trusted articles and documents that Audito AI can use to answer visitor questions.</p></div>
        <div className="flex items-center gap-2"><IconButton bordered onClick={() => void loadSources()} title="Refresh"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></IconButton><Button leftIcon={<Plus size={16} />} onClick={() => openCreate("article")}>Add Knowledge</Button></div>
      </div>

      <div className="mb-5 rounded-xl border border-secondary-500/20 bg-secondary-500/[0.06] px-4 py-3 text-xs leading-relaxed text-secondary-100"><span className="font-semibold">Public knowledge only.</span> Published sources are indexed with OpenAI and can be used by the landing-page assistant. Do not upload audit records, customer information, or confidential documents.</div>
      <div className="mb-5 flex flex-wrap gap-2">{(["all", "published", "draft", "processing", "failed"] as const).map(item => <button key={item} onClick={() => setFilter(item)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition ${filter === item ? "border-secondary-400 bg-secondary-500 text-primary-950" : "border-white/10 bg-white/[.03] text-gray-400 hover:text-white"}`}>{item} {item === "all" ? `(${sources.length})` : `(${sources.filter(source => source.status === item).length})`}</button>)}</div>

      {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div> : loading ? <Loading /> : filtered.length === 0 ? <EmptyState icon={Bot} title="No AI knowledge sources" message="Add an article or document, then publish it for Audito AI." action={<Button leftIcon={<Plus size={15} />} onClick={() => openCreate("article")}>Add Article</Button>} /> : <>
        <div className="hidden md:block"><Table><THead><Th>Source</Th><Th>Category</Th><Th>Type</Th><Th>Status</Th><Th>Updated</Th><Th align="right">Actions</Th></THead><TBody>{filtered.map(source => <Tr key={source.ai_knowledge_source_id}><Td><div className="min-w-0"><p className="max-w-[19rem] truncate font-medium text-white">{source.title}</p><p className="mt-0.5 text-xs text-gray-500">{source.source_file_name || source.tags.join(", ") || "Article"}</p></div></Td><Td className="text-gray-300">{source.category || "—"}</Td><Td><span className="inline-flex items-center gap-1 text-xs text-gray-300">{source.source_type === "article" ? <FileText size={12} /> : <UploadCloud size={12} />}{source.source_type}</span></Td><Td><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold capitalize ${statusClass[source.status]}`}>{source.status}</span>{source.status === "failed" && source.error_message ? <p className="mt-1 max-w-48 truncate text-[10px] text-red-300" title={source.error_message}>{source.error_message}</p> : null}</Td><Td className="text-xs text-gray-400">{source.updated_at ? new Date(source.updated_at).toLocaleDateString() : "—"}</Td><Td align="right"><div className="flex justify-end gap-1"><IconButton bordered title="View" onClick={() => { setViewing(source); setShowView(true); }}><Eye size={14} /></IconButton>{source.status !== "published" && source.status !== "processing" ? <IconButton bordered title="Edit" onClick={() => openEdit(source)}><Pencil size={14} /></IconButton> : null}{source.status === "published" ? <IconButton bordered title="Unpublish" disabled={workingId === source.ai_knowledge_source_id} onClick={() => void runAction(source, "unpublish")}><Archive size={14} /></IconButton> : <IconButton bordered title="Publish" disabled={workingId === source.ai_knowledge_source_id || source.status === "processing"} onClick={() => void runAction(source, "publish")}>{workingId === source.ai_knowledge_source_id ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}</IconButton>}<IconButton bordered title="Delete" disabled={workingId === source.ai_knowledge_source_id} onClick={() => void runAction(source, "delete")} className="text-red-300 hover:text-red-200"><Trash2 size={14} /></IconButton></div></Td></Tr>)}</TBody></Table></div>
        <div className="space-y-3 md:hidden">{filtered.map(source => <div key={source.ai_knowledge_source_id} className="rounded-xl border border-white/[.08] bg-white/[.025] p-4"><div className="flex gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary-500/10 text-secondary-300">{source.source_type === "article" ? <FileText size={16} /> : <UploadCloud size={16} />}</div><div className="min-w-0 flex-1"><p className="truncate font-semibold text-white">{source.title}</p><p className="mt-0.5 text-xs text-gray-500">{source.category || source.source_file_name || "Public knowledge"}</p><span className={`mt-2 inline-block rounded-full border px-2 py-1 text-[10px] font-semibold capitalize ${statusClass[source.status]}`}>{source.status}</span></div></div><div className="mt-3 flex gap-2 border-t border-white/[.06] pt-3"><Button size="sm" variant="secondary" onClick={() => { setViewing(source); setShowView(true); }}>View</Button>{source.status === "published" ? <Button size="sm" variant="secondary" onClick={() => void runAction(source, "unpublish")}>Unpublish</Button> : <Button size="sm" onClick={() => void runAction(source, "publish")}>Publish</Button>}<IconButton bordered title="Delete" onClick={() => void runAction(source, "delete")} className="ml-auto text-red-300"><Trash2 size={14} /></IconButton></div></div>)}</div>
      </>}

      <Modal open={showEditor} onClose={() => !saving && setShowEditor(false)} title={editing ? "Edit Knowledge Source" : "Add AI Knowledge"} description="Save first, then publish when the content is ready for public Audito AI answers." size="lg" footer={<><Button type="button" variant="secondary" disabled={saving} onClick={() => setShowEditor(false)}>Cancel</Button><Button type="button" loading={saving} onClick={() => void saveSource()}>{editing ? "Save Changes" : "Save Draft"}</Button></>}>
        <div className="space-y-4">{formError ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{formError}</div> : null}{!editing ? <div className="grid grid-cols-2 gap-2"><button onClick={() => setKind("article")} className={`rounded-xl border p-3 text-left ${kind === "article" ? "border-secondary-400 bg-secondary-500/10" : "border-white/10 bg-white/[.02]"}`}><FileText size={16} className="mb-2 text-secondary-300" /><p className="text-sm font-semibold text-white">Article</p><p className="mt-0.5 text-[11px] text-gray-500">Write product information directly.</p></button><button onClick={() => setKind("document")} className={`rounded-xl border p-3 text-left ${kind === "document" ? "border-secondary-400 bg-secondary-500/10" : "border-white/10 bg-white/[.02]"}`}><UploadCloud size={16} className="mb-2 text-secondary-300" /><p className="text-sm font-semibold text-white">Document</p><p className="mt-0.5 text-[11px] text-gray-500">Upload PDF, Word, TXT, or Markdown.</p></button></div> : null}<Input label="Title" value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="e.g. Creating and assigning an audit" /><div className="grid gap-4 sm:grid-cols-2"><Input label="Category" value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value }))} placeholder="e.g. Audit workflow" /><Input label="Tags" value={form.tags} onChange={event => setForm(current => ({ ...current, tags: event.target.value }))} placeholder="audit, assign, auditor" /></div>{kind === "article" ? <div><label className="mb-1.5 block text-sm text-gray-400">Article content</label><textarea rows={11} value={form.body_content} onChange={event => setForm(current => ({ ...current, body_content: event.target.value }))} maxLength={50000} placeholder="Write clear public information that Audito AI can use..." className="w-full resize-y rounded-xl border border-white/10 bg-white/[.04] px-3.5 py-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-secondary-400/50" /><p className="mt-1 text-right text-[11px] text-gray-500">{form.body_content.length.toLocaleString()} / 50,000</p></div> : <div><label className="mb-1.5 block text-sm text-gray-400">Document</label><input ref={uploadRef} type="file" accept=".pdf,.doc,.docx,.txt,.md" className="hidden" onChange={event => setSelectedFile(event.target.files?.[0] || null)} /><button type="button" onClick={() => uploadRef.current?.click()} className="flex w-full items-center gap-3 rounded-xl border border-dashed border-white/20 bg-white/[.025] p-4 text-left hover:border-secondary-400/40"><UploadCloud className="text-secondary-300" size={19} /><span><span className="block text-sm font-medium text-white">{selectedFile?.name || editing?.source_file_name || "Choose document"}</span><span className="mt-0.5 block text-xs text-gray-500">PDF, Word, TXT, or Markdown · 10 MB maximum</span></span></button></div>}</div>
      </Modal>

      <Modal open={showView} onClose={() => setShowView(false)} title={viewing?.title || "Knowledge source"} description={viewing?.source_type === "article" ? "Article content used by Audito AI after publication." : "Document metadata. The private document is indexed only after publication."} size="lg" footer={<Button variant="secondary" onClick={() => setShowView(false)}>Close</Button>}><div className="space-y-3"><div className="flex flex-wrap gap-2"><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold capitalize ${viewing ? statusClass[viewing.status] : ""}`}>{viewing?.status}</span>{viewing?.category ? <span className="rounded-full border border-white/10 bg-white/[.04] px-2 py-1 text-[10px] text-gray-300">{viewing.category}</span> : null}</div>{viewing?.source_type === "article" ? <article className="max-h-[52vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/[.08] bg-white/[.02] p-4 text-sm leading-relaxed text-gray-200">{viewing.body_content}</article> : <div className="rounded-xl border border-white/[.08] bg-white/[.02] p-5 text-sm text-gray-300"><FileText size={20} className="mb-3 text-secondary-300" />{viewing?.source_file_name || "Document"}<p className="mt-2 text-xs text-gray-500">Document contents are not publicly exposed from the admin page.</p></div>}{viewing?.error_message ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{viewing.error_message}</div> : null}</div></Modal>
    </div>
  );
}
