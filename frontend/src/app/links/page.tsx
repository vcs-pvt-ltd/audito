"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { countriesApi, linksApi, type Country } from "@/lib/api";

import {
  Link as LinkIcon,
  Plus,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  Send,
  Inbox,
  X,
  Eye,
  Building2,
  User,
  Users,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────

interface OrgLink {
  id: number;
  link_code: string;
  requester_type: string;
  requester_code: string;
  requester_name: string | null;
  requester_email?: string | null;
  requester_phone_number?: string | null;
  requester_address?: string | null;
  requester_country?: string | null;
  requester_admin_name?: string | null;
  requester_admin_email?: string | null;
  requester_admin_phone_number?: string | null;
  requester_level: number;
  target_type: string;
  target_code: string;
  target_name: string | null;
  target_level: number;
  status: "pending" | "accepted" | "rejected";
  requested_at: string;
  responded_at: string | null;
}

// ─── Status Badge ────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "accepted") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/15 text-green-400">
        <CheckCircle size={12} /> Linked
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-400">
        <XCircle size={12} /> Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/15 text-yellow-400">
      <Clock size={12} /> Pending
    </span>
  );
}

// ─── Create Link Modal ──────────────────────────────────────────

// Linked entity data types
interface StructureItem {
  code: string;
  name: string;
}

interface LinkedEntityData {
  link_code: string;
  entity_type: string;
  entity_code: string;
  account_codes?: string[];
  entity: {
    name: string;
    registration_number: string | null;
    email: string | null;
    phone_number: string | null;
    address: string | null;
    country: string | null;
  } | null;
  admin: {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string | null;
  } | null;
  users: {
    user_code: string;
    first_name: string;
    last_name: string;
    email: string;
    phone_number?: string;
    role: string;
    user_type: string;
    email_verified: boolean;
  }[];
  structure?: {
    buying_offices?: StructureItem[];
    suppliers?: StructureItem[];
    clusters?: StructureItem[];
    factories?: StructureItem[];
    units?: StructureItem[];
    departments?: StructureItem[];
  };
}

interface TargetOrganizationPreview {
  entity_type: string;
  entity_code: string;
  entity: {
    name: string;
    registration_number: string | null;
    email: string | null;
    phone_number: string | null;
    address: string | null;
    country: string | null;
  } | null;
  admin: {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string | null;
  } | null;
}

interface LinkCreateResult {
  link_code: string;
  verification_key: string;
  target?: TargetOrganizationPreview;
}

// ─── View Data Modal ─────────────────────────────────────────────

function ViewDataModal({
  open,
  onClose,
  data,
  loading,
  error,
}: {
  open: boolean;
  onClose: () => void;
  data: LinkedEntityData | null;
  loading: boolean;
  error: string;
}) {
  if (!open) return null;

  const infoRow = (label: string, value: string | null | undefined) => (
    <div className="flex justify-between py-1.5 border-b border-white/5 last:border-0">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className="text-white text-xs text-right">{value || "—"}</span>
    </div>
  );

  const structureSections: { key: keyof NonNullable<LinkedEntityData["structure"]>; label: string }[] = [
    { key: "buying_offices", label: "Buying Offices" },
    { key: "suppliers", label: "Suppliers" },
    { key: "clusters", label: "Clusters" },
    { key: "factories", label: "Factories" },
    { key: "units", label: "Units" },
    { key: "departments", label: "Departments" },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative glass rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">
            {data ? `${data.entity_type} Data` : "Entity Data"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <p className="text-red-400 text-sm text-center py-6">{error}</p>
          ) : !data ? (
            <p className="text-gray-400 text-sm text-center py-6">No data available.</p>
          ) : (
            <>
              {/* Entity Info */}
              {data.entity && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 size={16} className="text-secondary-400" />
                    <h3 className="text-sm font-medium text-white">Organization Info</h3>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    {infoRow("Name", data.entity.name)}
                    {infoRow("Registration No.", data.entity.registration_number)}
                    {infoRow("Email", data.entity.email)}
                    {infoRow("Phone", data.entity.phone_number)}
                    {infoRow("Address", data.entity.address)}
                    {infoRow("Country", data.entity.country)}
                  </div>
                </div>
              )}

              {/* Admin Info */}
              {data.admin && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <User size={16} className="text-secondary-400" />
                    <h3 className="text-sm font-medium text-white">Admin</h3>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    {infoRow("Name", `${data.admin.first_name} ${data.admin.last_name}`)}
                    {infoRow("Email", data.admin.email)}
                    {infoRow("Phone", data.admin.phone_number)}
                  </div>
                </div>
              )}

             


            
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Create Link Modal ──────────────────────────────────────────

const LINKABLE_ENTITY_TYPES = new Set([
  "Buying Office",
  "Supplier",
  "Company",
  "Cluster",
  "Factory",
  "Unit",
  "Department",
  "Section",
  "Branch",
  "Audit Firm Department",
]);

const LINK_TARGET_HINTS: Record<string, string> = {
  "Buying Office": "Customer",
  Supplier: "Buying Office",
  Company: "Supplier",
  Cluster: "Company",
  Factory: "Cluster",
  Unit: "Factory",
  Department: "Unit",
  Section: "Department",
  Branch: "Audit Firm Company",
  "Audit Firm Department": "Branch",
};

function formatPhoneWithDialCode(phone: string | null | undefined, dialCode: string | null | undefined) {
  const rawPhone = (phone || "").trim();
  const rawDialCode = (dialCode || "").trim();
  if (!rawPhone) return "-";
  if (rawPhone.startsWith("+")) return rawPhone;
  if (!rawDialCode) return rawPhone;

  const normalizedDialCode = rawDialCode.startsWith("+") ? rawDialCode : `+${rawDialCode}`;
  const localPhone = rawPhone.replace(/^0+/, "");
  return `${normalizedDialCode} ${localPhone || rawPhone}`;
}

function CreateLinkModal({
  open,
  onClose,
  onSubmit,
  onPreview,
  entityType,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (targetEmail: string) => Promise<LinkCreateResult>;
  onPreview: (targetEmail: string) => Promise<TargetOrganizationPreview>;
  entityType: string;
}) {
  const [targetEmail, setTargetEmail] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [targetPreview, setTargetPreview] = useState<TargetOrganizationPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [createdLink, setCreatedLink] = useState<LinkCreateResult | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canLink = LINKABLE_ENTITY_TYPES.has(entityType);
  const targetHint = LINK_TARGET_HINTS[entityType];

  useEffect(() => {
    if (open) {
      setTargetEmail("");
      setVerifiedEmail("");
      setTargetPreview(null);
      setCreatedLink(null);
      setError("");
    }
  }, [open]);

  useEffect(() => {
    if (!open || countries.length > 0) return;
    let cancelled = false;
    countriesApi.getAll()
      .then((items) => {
        if (!cancelled) setCountries(items);
      })
      .catch(() => {
        if (!cancelled) setCountries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, countries.length]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canLink) return setError("No link target is available for your entity type.");
    if (!targetEmail.trim()) return setError("Please enter the organization email.");
    if (!targetPreview || verifiedEmail !== targetEmail.trim()) {
      return setError("Verify the target organization before sending the request.");
    }
    setLoading(true);
    setError("");
    try {
      const created = await onSubmit(targetEmail.trim());
      setCreatedLink(created);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send request.");
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    if (!canLink) return setError("No link target is available for your entity type.");
    const email = targetEmail.trim();
    if (!email) return setError("Please enter the organization email.");
    setPreviewLoading(true);
    setError("");
    setTargetPreview(null);
    setVerifiedEmail("");
    setCreatedLink(null);
    try {
      const preview = await onPreview(email);
      setTargetPreview(preview);
      setVerifiedEmail(email);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to verify organization.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const previewIsCurrent = !!targetPreview && verifiedEmail === targetEmail.trim();
  const previewCountry = targetPreview?.entity?.country || "";
  const previewDialCode = countries.find(
    (country) => country.country.toLowerCase() === previewCountry.toLowerCase()
  )?.international_dialing;
  const organizationPhoneWithDialCode = formatPhoneWithDialCode(
    targetPreview?.entity?.phone_number,
    previewDialCode
  );
  const adminPhoneWithDialCode = formatPhoneWithDialCode(
    targetPreview?.admin?.phone_number,
    previewDialCode
  );

  const inputClass =
    "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-secondary-500/50 focus:ring-1 focus:ring-secondary-500/30 transition-all";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative glass rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Request</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {createdLink && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
              <p className="text-sm font-semibold text-emerald-300">Link request sent</p>
              <p className="text-xs text-gray-400 mt-1">Share this 6-digit key with the target organization. They must enter it to accept.</p>
              <div className="mt-3 rounded-lg bg-black/30 border border-white/10 px-4 py-3 text-center font-mono text-2xl tracking-[0.35em] text-white">
                {createdLink.verification_key}
              </div>
            </div>
          )}

          <p className="text-sm text-gray-400">
            Send a link request using the organization administrator&apos;s email.
          </p>

          {canLink ? (
            <p className="text-xs text-gray-500">
              Allowed target: <span className="text-gray-300">{targetHint}</span>
            </p>
          ) : (
            <p className="text-sm text-gray-500">No link target is available for your entity type.</p>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              Administrator Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={targetEmail}
              onChange={(e) => {
                setTargetEmail(e.target.value);
                setError("");
                setCreatedLink(null);
              }}
              placeholder="e.g. admin@company.com"
              className={inputClass}
              disabled={!!createdLink}
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the email address of the organization administrator you want to link with.
            </p>
          </div>

          {!createdLink && (
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewLoading || !targetEmail.trim() || !canLink}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-medium text-secondary-300 border border-secondary-500/20 bg-secondary-500/10 hover:bg-secondary-500/15 disabled:opacity-50 transition-all"
            >
              {previewLoading ? "Verifying..." : "Verify Organization"}
            </button>
          )}

          {previewIsCurrent && targetPreview && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Building2 size={15} className="text-secondary-400" />
                <p className="text-sm font-semibold text-white">{targetPreview.entity?.name || "Verified Organization"}</p>
              </div>
              <div className="grid grid-cols-1 gap-1 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Type</span>
                  <span className="text-gray-300 text-right">{targetPreview.entity_type}</span>
                </div>
               
               
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Country</span>
                  <span className="text-gray-300 text-right">{targetPreview.entity?.country || "-"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Organization Email</span>
                  <span className="text-gray-300 text-right break-all">{targetPreview.entity?.email || "-"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Organization Phone</span>
                  <span className="text-gray-300 text-right">{organizationPhoneWithDialCode}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Address</span>
                  <span className="text-gray-300 text-right">{targetPreview.entity?.address || "-"}</span>
                </div>
                
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Admin</span>
                  <span className="text-gray-300 text-right">
                    {targetPreview.admin ? `${targetPreview.admin.first_name} ${targetPreview.admin.last_name}` : "-"}
                  </span>
                </div>
               
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Admin Phone</span>
                  <span className="text-gray-300 text-right">{adminPhoneWithDialCode}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm text-gray-400 border border-white/10 hover:border-white/20 hover:text-white transition-all"
            >
              {createdLink ? "Close" : "Cancel"}
            </button>
            {!createdLink && (
              <button
                type="submit"
                disabled={loading || !canLink || !previewIsCurrent}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-secondary-500 text-primary-950 hover:bg-secondary-400 disabled:opacity-50 transition-all"
              >
                {loading ? "Sending..." : "Send Request"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page Component ──────────────────────────────────────────────

function AcceptLinkModal({
  link,
  open,
  loading,
  onClose,
  onAccept,
}: {
  link: OrgLink | null;
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onAccept: (verificationKey: string) => Promise<void>;
}) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [countries, setCountries] = useState<Country[]>([]);

  useEffect(() => {
    if (open) {
      setKey("");
      setError("");
    }
  }, [open]);

  useEffect(() => {
    if (!open || countries.length > 0) return;
    let cancelled = false;
    countriesApi.getAll()
      .then((items) => {
        if (!cancelled) setCountries(items);
      })
      .catch(() => {
        if (!cancelled) setCountries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, countries.length]);

  if (!open || !link) return null;

  const requesterDialCode = countries.find(
    (country) => country.country.toLowerCase() === (link.requester_country || "").toLowerCase()
  )?.international_dialing;
  const requesterPhone = formatPhoneWithDialCode(link.requester_phone_number, requesterDialCode);
  const requesterAdminPhone = formatPhoneWithDialCode(link.requester_admin_phone_number, requesterDialCode);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(key)) {
      setError("Enter the 6-digit verification key.");
      return;
    }
    setError("");
    try {
      await onAccept(key);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to accept request.");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative glass rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Accept Link Request</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}
          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Building2 size={15} className="text-secondary-400" />
              <p className="text-sm font-semibold text-white">{link.requester_name || "Requester Organization"}</p>
            </div>
            <div className="grid grid-cols-1 gap-1 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Type</span>
                <span className="text-gray-300 text-right">{link.requester_type}</span>
              </div>
             
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Country</span>
                <span className="text-gray-300 text-right">{link.requester_country || "-"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Organization Email</span>
                <span className="text-gray-300 text-right break-all">{link.requester_email || "-"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Organization Phone</span>
                <span className="text-gray-300 text-right">{requesterPhone}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Address</span>
                <span className="text-gray-300 text-right">{link.requester_address || "-"}</span>
              </div>
              <div className="flex justify-between gap-3 pt-1 border-t border-white/5 mt-1">
                <span className="text-gray-500">Admin</span>
                <span className="text-gray-300 text-right">{link.requester_admin_name || "-"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Admin Email</span>
                <span className="text-gray-300 text-right break-all">{link.requester_admin_email || "-"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Admin Phone</span>
                <span className="text-gray-300 text-right">{requesterAdminPhone}</span>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-400">
            Enter the 6-digit key shared by the requester to confirm this link.
          </p>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            pattern="[0-9]{6}"
            placeholder="000000"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-white text-center text-xl font-mono tracking-[0.35em] placeholder-gray-600 focus:outline-none focus:border-secondary-500/50 focus:ring-1 focus:ring-secondary-500/30 transition-all"
            autoFocus
          />
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm text-gray-400 border border-white/10 hover:border-white/20 hover:text-white transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || key.length !== 6}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-50 transition-all"
            >
              {loading ? "Accepting..." : "Accept"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LinksPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const { confirm, toast } = useUiFeedback();
  const router = useRouter();

  const [links, setLinks] = useState<OrgLink[]>([]);
  const [pendingRequests, setPendingRequests] = useState<OrgLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [tab, setTab] = useState<"links" | "requests">("links");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [viewDataOpen, setViewDataOpen] = useState(false);
  const [viewData, setViewData] = useState<LinkedEntityData | null>(null);
  const [viewDataLoading, setViewDataLoading] = useState(false);
  const [viewDataError, setViewDataError] = useState("");
  const [acceptingLink, setAcceptingLink] = useState<OrgLink | null>(null);

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
  }, [isLoading, admin, router]);

  const fetchData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    const [linksRes, pendingRes] = await Promise.all([
      linksApi.getMyLinks(accessToken),
      linksApi.getPendingLinks(accessToken),
    ]);
    if (linksRes.success && linksRes.data) {
      const d = linksRes.data as { links: OrgLink[] };
      setLinks(d.links);
    }
    if (pendingRes.success && pendingRes.data) {
      const d = pendingRes.data as { links: OrgLink[] };
      setPendingRequests(d.links);
    }
    setLoading(false);
  }, [accessToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <div className="h-screen bg-transparent flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!admin) return null;

  const entityType = admin.entity_type || "";
  const entityCode = admin.entity_code;
  const canRequest = LINKABLE_ENTITY_TYPES.has(entityType);

  const handleCreateLink = async (targetEmail: string) => {
    if (!accessToken) throw new Error("You are not authenticated.");
    const res = await linksApi.createLink(accessToken, targetEmail);
    if (!res.success) throw new Error(res.message || "Failed to create link.");
    toast("Link request sent successfully.", "success");
    await fetchData();
    return res.data as LinkCreateResult;
  };

  const handlePreviewTarget = async (targetEmail: string) => {
    if (!accessToken) throw new Error("You are not authenticated.");
    const res = await linksApi.previewTarget(accessToken, targetEmail);
    if (!res.success || !res.data) throw new Error(res.message || "Failed to verify organization.");
    return res.data as TargetOrganizationPreview;
  };

  const handleRespond = async (linkCode: string, action: "accept" | "reject", verificationKey?: string) => {
    if (!accessToken) return;
    setActionLoading(linkCode);
    try {
      const res = await linksApi.respondToLink(accessToken, linkCode, action, verificationKey);
      if (res.success) {
        toast(`Link ${action}ed successfully.`, "success");
        if (action === "accept") setAcceptingLink(null);
        fetchData();
      } else {
        toast(res.message || `Failed to ${action} link.`, "error");
        if (action === "accept") throw new Error(res.message || "Failed to accept link.");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (linkCode: string) => {
    if (!accessToken) return;
    const confirmed = await confirm({
      title: "Remove Link",
      message: "Are you sure you want to remove this link?",
      confirmText: "Remove",
      variant: "warning",
    });
    if (!confirmed) return;
    const res = await linksApi.removeLink(accessToken, linkCode);
    if (res.success) {
      toast("Link removed successfully.", "success");
      fetchData();
    } else {
      toast(res.message || "Failed to remove link.", "error");
    }
  };

  const handleViewData = async (linkCode: string) => {
    if (!accessToken) return;
    setViewDataLoading(true);
    setViewData(null);
    setViewDataError("");
    setViewDataOpen(true);
    const res = await linksApi.getLinkedData(accessToken, linkCode);
    if (res.success && res.data) {
      setViewData(res.data as LinkedEntityData);
    } else {
      setViewDataError(res.message || "No data available.");
    }
    setViewDataLoading(false);
  };

  // Helper: determine which side is "other" relative to this entity
  const otherSide = (link: OrgLink) => {
    if (link.requester_code === entityCode) {
      return { 
        type: link.target_type, 
        code: link.target_code, 
        name: link.target_name,
        direction: "to" as const 
      };
    }
    return { 
      type: link.requester_type, 
      code: link.requester_code, 
      name: link.requester_name,
      direction: "from" as const 
    };
  };

  return (
    <div className="h-screen bg-transparent flex">

      <main className="flex-1 p-6 lg:p-8 pt-20 lg:pt-8 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <LinkIcon size={22} className="text-secondary-400" />
              Organization Links
            </h1>
            <p className="hidden sm:block text-sm text-gray-400 mt-0.5">
              Connect and link with other high-level organizations to build your hierarchy.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="p-2.5 rounded-lg text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all"
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
            {canRequest && (
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-secondary-500 text-primary-950 hover:bg-secondary-400 transition-all shadow-lg shadow-secondary-500/10"
              >
                <Plus size={16} />
                Request
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-white/5 rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab("links")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tab === "links"
                ? "bg-secondary-500/20 text-secondary-400"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Send size={14} />
            My Links
            {links.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-white/10">
                {links.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("requests")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tab === "requests"
                ? "bg-secondary-500/20 text-secondary-400"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Inbox size={14} />
            Incoming Requests
            {pendingRequests.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-yellow-500/20 text-yellow-400">
                {pendingRequests.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tab === "links" ? (
          /* ─── My Links Tab ─── */
          links.length === 0 ? (
            <div className="glass rounded-xl p-10 text-center">
              <LinkIcon size={40} className="text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">
                No links yet.{" "}
                {canRequest
                  ? "Use \u201cRequest Link\u201d to connect with an upper-level entity."
                  : "Other entities can request to link with you."}
              </p>
            </div>
          ) : (
            <div className="glass rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">Direction</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium whitespace-nowrap">Organization</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">Date</th>
                      <th className="text-right px-4 py-3 text-gray-400 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {links.map((link) => {
                      const other = otherSide(link);
                      return (
                        <tr
                          key={link.link_code}
                          className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="px-4 py-3">
                            <StatusBadge status={link.status} />
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs">
                            {other.direction === "to" ? (
                              <span className="text-blue-400">→ Linked to</span>
                            ) : (
                              <span className="text-purple-400">← Linked from</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="text-white font-medium">{other.name || "Unknown Entity"}</span>
                              <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">
                                {other.type}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {new Date(link.requested_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right flex items-center justify-end gap-1">
                            {link.status === "accepted" && link.target_code === entityCode && (
                              <button
                                onClick={() => handleViewData(link.link_code)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-secondary-400 hover:bg-secondary-500/10 transition-all"
                                title="View entity data"
                              >
                                <Eye size={15} />
                              </button>
                            )}
                            {/* Requester: cancel while pending | Target: remove at any non-rejected status */}
                            {link.status !== "rejected" &&
                              (link.target_code === entityCode ||
                                (link.requester_code === entityCode && link.status === "pending")) && (
                              <button
                                onClick={() => handleRemove(link.link_code)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                title={link.status === "pending" ? "Cancel request" : "Remove link"}
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          /* ─── Incoming Requests Tab ─── */
          pendingRequests.length === 0 ? (
            <div className="glass rounded-xl p-10 text-center">
              <Inbox size={40} className="text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No pending link requests.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((link) => (
                <div
                  key={link.link_code}
                  className="glass rounded-xl p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge status={link.status} />
                    </div>
                    <p className="text-sm text-white">
                      <span className="text-secondary-400 font-bold">{link.requester_name || link.requester_type}</span> wants to link with your organization
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5 font-medium">
                      Entity Type: {link.requester_type}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-1 uppercase font-bold tracking-widest">
                      Requested {new Date(link.requested_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setAcceptingLink(link)}
                      disabled={actionLoading === link.link_code}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-50 transition-all"
                    >
                      <CheckCircle size={14} /> Accept
                    </button>
                    <button
                      onClick={() => handleRespond(link.link_code, "reject")}
                      disabled={actionLoading === link.link_code}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 transition-all"
                    >
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Create Link Modal */}
        <CreateLinkModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSubmit={handleCreateLink}
          onPreview={handlePreviewTarget}
          entityType={entityType}
        />

        <ViewDataModal
          open={viewDataOpen}
          onClose={() => setViewDataOpen(false)}
          data={viewData}
          loading={viewDataLoading}
          error={viewDataError}
        />

        <AcceptLinkModal
          open={!!acceptingLink}
          link={acceptingLink}
          loading={!!acceptingLink && actionLoading === acceptingLink.link_code}
          onClose={() => setAcceptingLink(null)}
          onAccept={(verificationKey) =>
            acceptingLink
              ? handleRespond(acceptingLink.link_code, "accept", verificationKey)
              : Promise.resolve()
          }
        />
      </main>
    </div>
  );
}
