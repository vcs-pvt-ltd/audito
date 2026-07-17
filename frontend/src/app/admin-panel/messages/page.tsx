"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { adminApi, type ContactMessage } from "@/lib/api";
import {
  Mail, RefreshCw, Loader2, Send, Clock, CheckCircle2, Circle, Eye,
} from "lucide-react";
import Loading from "@/components/shared/Loading";
import EmptyState from "@/components/shared/EmptyState";
import TablePagination from "@/components/shared/TablePagination";
import {
  Button,
  IconButton,
  Modal,
  Table,
  THead,
  Th,
  TBody,
  Tr,
  Td,
  Textarea,
} from "@/components/ui";

function StatusBadge({ status }: { status: ContactMessage["status"] }) {
  if (status === "unread")
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium">
        <Circle size={8} className="fill-current" /> Unread
      </span>
    );
  if (status === "read")
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-medium">
        <Circle size={8} className="fill-current" /> Read
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
      <CheckCircle2 size={10} /> Replied
    </span>
  );
}

export default function MessagesPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const { toast } = useUiFeedback();
  const router = useRouter();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "read" | "replied">("all");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Selected message for viewing/replying
  const [selectedMsg, setSelectedMsg] = useState<ContactMessage | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState("");

  useEffect(() => {
    if (!isLoading && (!admin || admin.role !== "audito_admin")) {
      router.replace("/login");
    }
  }, [isLoading, admin, router]);

  const loadMessages = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const res = await adminApi.listMessages(accessToken);
      if (res.success && res.data) {
        setMessages(res.data as ContactMessage[]);
      } else {
        setError((res as any).message || "Failed to load messages.");
        toast((res as any).message || "Failed to load messages.", "error");
      }
    } catch {
      setError("Failed to load messages.");
      toast("Failed to load messages.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) loadMessages();
  }, [accessToken]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !selectedMsg || !replyText.trim()) return;
    setSending(true);
    setReplyError("");
    try {
      const res = await adminApi.replyMessage(accessToken, selectedMsg.contact_message_id, replyText.trim());
      if (res.success) {
        toast("Reply sent successfully.", "success");
        const now = new Date().toISOString();
        setMessages((prev) =>
          prev.map((m) =>
            m.contact_message_id === selectedMsg.contact_message_id
              ? { ...m, status: "replied", reply_content: replyText.trim(), replied_at: now }
              : m
          )
        );
        setSelectedMsg({
          ...selectedMsg,
          status: "replied",
          reply_content: replyText.trim(),
          replied_at: now,
        });
        setReplyText("");
      } else {
        const errMsg = (res as any).message || "Failed to send reply.";
        setReplyError(errMsg);
        toast(errMsg, "error");
      }
    } catch {
      setReplyError("Failed to send reply.");
      toast("Failed to send reply.", "error");
    } finally {
      setSending(false);
    }
  };

  // Reset page relative to filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const filtered = filter === "all" ? messages : messages.filter((m) => m.status === filter);
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIdx = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(startIdx, startIdx + pageSize);

  const counts = {
    all: messages.length,
    unread: messages.filter((m) => m.status === "unread").length,
    read: messages.filter((m) => m.status === "read").length,
    replied: messages.filter((m) => m.status === "replied").length,
  };

  if (isLoading || !admin) return <Loading />;

  return (
    <div className="min-h-screen p-5 pt-20 lg:p-8 lg:pt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Mail size={22} className="text-secondary-400" /> Messages
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Contact form submissions from landing page visitors
          </p>
        </div>
        <Button
          onClick={loadMessages}
          disabled={loading}
          variant="secondary"
          size="md"
          leftIcon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />}
        />
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {(["all", "unread", "read", "replied"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              filter === f
                ? "bg-secondary-500 text-primary-950 font-bold"
                : "bg-white/5 border border-white/10 text-gray-400 hover:text-white"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin text-secondary-400" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No messages found"
          message={filter === "all" ? "No contact messages yet." : `No ${filter} messages.`}
        />
      ) : (
        <>
          <div className="hidden md:block">
          <Table>
            <THead>
              <Th>Sender</Th>
              <Th>Contact Details</Th>
              <Th>Received Date</Th>
              <Th>Status</Th>
              <Th align="right">Actions</Th>
            </THead>
            <TBody>
              {pageItems.map((msg) => (
                <Tr key={msg.contact_message_id}>
                  <Td>
                    <div className="font-semibold text-white">{msg.name}</div>
                    <span className="text-gray-400 text-xs">{msg.email}</span>
                  </Td>
                  <Td>
                    <div className="text-gray-300">{msg.company || "—"}</div>
                    <span className="text-gray-500 text-xs">{msg.phone || "—"}</span>
                  </Td>
                  <Td>
                    <div className="text-gray-300 text-xs flex items-center gap-1">
                      <Clock size={12} className="text-gray-500" />
                      {new Date(msg.created_at).toLocaleDateString()}
                    </div>
                  </Td>
                  <Td>
                    <StatusBadge status={msg.status} />
                  </Td>
                  <Td align="right">
                    <IconButton
                      onClick={() => {
                        setSelectedMsg(msg);
                        setReplyText("");
                        setReplyError("");
                      }}
                      tone="secondary"
                      title="View Message"
                    >
                      <Eye size={16} />
                    </IconButton>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          </div>
          <div className="space-y-3 md:hidden">
            {pageItems.map((msg) => (
              <article key={msg.contact_message_id} className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] shadow-lg shadow-black/10">
                <div className="flex items-start justify-between gap-3 p-4"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">Contact message</p><h2 className="mt-1 truncate text-sm font-semibold text-white">{msg.name}</h2><p className="mt-1 truncate text-xs text-gray-400">{msg.email}</p></div><StatusBadge status={msg.status} /></div>
                <div className="grid grid-cols-2 gap-px border-y border-white/[0.08] bg-white/[0.08] text-xs"><div className="min-w-0 bg-[#08251a]/60 px-3 py-2.5"><p className="text-[10px] uppercase tracking-wide text-gray-500">Company</p><p className="mt-1 truncate text-gray-200">{msg.company || "—"}</p></div><div className="min-w-0 bg-[#08251a]/60 px-3 py-2.5"><p className="text-[10px] uppercase tracking-wide text-gray-500">Received</p><p className="mt-1 truncate text-gray-200">{new Date(msg.created_at).toLocaleDateString()}</p></div>{msg.phone && <div className="col-span-2 min-w-0 bg-[#08251a]/60 px-3 py-2.5"><p className="text-[10px] uppercase tracking-wide text-gray-500">Phone</p><p className="mt-1 truncate text-gray-200">{msg.phone}</p></div>}</div>
                <div className="flex justify-end p-3"><IconButton onClick={() => { setSelectedMsg(msg); setReplyText(""); setReplyError(""); }} tone="secondary" title="View Message"><Eye size={16} /></IconButton></div>
              </article>
            ))}
          </div>

          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}

      {/* Message View / Reply Modal */}
      {selectedMsg && (
        <Modal
          open={!!selectedMsg}
          onClose={() => setSelectedMsg(null)}
          title="Message Details"
          icon={<Mail className="text-secondary-400" />}
          size="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
              <div>
                <span className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">
                  Sender
                </span>
                <span className="text-white font-medium text-sm">{selectedMsg.name}</span>
                <span className="block text-xs text-gray-400 mt-0.5">{selectedMsg.email}</span>
              </div>
              <div>
                <span className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">
                  Details
                </span>
                <span className="text-white text-sm block">Company: {selectedMsg.company || "—"}</span>
                <span className="block text-xs text-gray-400 mt-0.5">Phone: {selectedMsg.phone || "—"}</span>
              </div>
              <div>
                <span className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">
                  Received At
                </span>
                <span className="text-white text-sm">
                  {new Date(selectedMsg.created_at).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">
                  Status
                </span>
                <StatusBadge status={selectedMsg.status} />
              </div>
            </div>

            <div>
              <span className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">
                Message Content
              </span>
              <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-line bg-white/5 rounded-xl p-4 border border-white/5">
                {selectedMsg.message}
              </div>
            </div>

            {selectedMsg.reply_content ? (
              <div>
                <span className="block text-xs uppercase tracking-wider text-emerald-500/80 font-semibold mb-2 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Reply Sent
                </span>
                <div className="text-emerald-200/90 text-sm leading-relaxed whitespace-pre-line bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4">
                  {selectedMsg.reply_content}
                </div>
                {selectedMsg.replied_at && (
                  <span className="block text-[11px] text-gray-500 mt-1.5">
                    Sent on {new Date(selectedMsg.replied_at).toLocaleString()}
                  </span>
                )}
              </div>
            ) : (
              <form onSubmit={handleReply} className="space-y-3 pt-2">
                <Textarea
                  label="Response Email"
                  required
                  placeholder="Type your response to send to their email..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={5}
                />
                {replyError && <p className="text-xs text-red-400">{replyError}</p>}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setSelectedMsg(null)}
                    disabled={sending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    loading={sending}
                    leftIcon={<Send size={14} />}
                  >
                    Send Reply
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
