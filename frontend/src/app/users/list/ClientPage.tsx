"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { usersApi, orgTreeApi, countriesApi, authApi, type Country } from "@/lib/api";

import { Plus, RefreshCw, Pencil, Trash2, Mail, CheckCircle, Clock, X, UserCheck, Users, Search, Crown } from "lucide-react";
import LimitReachedModal from "@/components/modals/LimitReachedModal";
import TablePagination from "@/components/shared/TablePagination";

// ─── Config per user type slug ───────────────────────────────────

interface UserTypeConfig {
  label: string;
  labelPlural: string;
  backendType: string;
  accountTypes: string[];
  // Cascading entity type steps derived from the org tree.
  // Each entry is the entity_type name as it appears in the tree.
  // The LAST entry is the final assigned entity.
  // Empty array = no entity assignment (e.g. auditors).
  // When per-account steps are needed, use treeStepsByAccount.
  treeSteps: string[];
  treeStepsByAccount?: Record<string, string[]>;
  // Read-only view (no add/edit/delete). Used for linked-partner records
  // like a linked Company's admin shown to a Supplier as "Company Head".
  viewOnly?: boolean;
}

const USER_TYPE_CONFIGS: Record<string, UserTypeConfig> = {
  "company-heads": {
    label: "Company Head",
    labelPlural: "Company Heads",
    backendType: "Company Head",
    accountTypes: ["Customer"],
    treeSteps: [],
    viewOnly: true,
  },
  auditors: {
    label: "Auditor",
    labelPlural: "Auditors",
    backendType: "Auditor",
    accountTypes: ["Customer", "Company", "Audit Firm"],
    treeSteps: [],
    treeStepsByAccount: {
      "Audit Firm": ["Branch", "Audit Firm Department"],
    },
  },
  "branch-heads": {
    label: "Branch Head",
    labelPlural: "Branch Heads",
    backendType: "Branch Head",
    accountTypes: ["Audit Firm"],
    treeSteps: ["Branch"],
  },
  "audit-firm-department-heads": {
    label: "Department Head",
    labelPlural: "Department Heads",
    backendType: "Audit Firm Department Head",
    accountTypes: ["Audit Firm"],
    treeSteps: ["Branch", "Audit Firm Department"],
  },
  "buying-office-heads": {
    label: "Buying Office Head",
    labelPlural: "Buying Office Heads",
    backendType: "Buying Office Head",
    accountTypes: ["Customer"],
    treeSteps: ["Buying Office"],
  },
  "supplier-heads": {
    label: "Supplier Head",
    labelPlural: "Supplier Heads",
    backendType: "Supplier Head",
    accountTypes: ["Customer"],
    treeSteps: ["Supplier"],
  },
  "cluster-heads": {
    label: "Cluster Head",
    labelPlural: "Cluster Heads",
    backendType: "Cluster Head",
    accountTypes: ["Company", "Customer"],
    treeSteps: ["Cluster"],
  },
  "factory-heads": {
    label: "Factory Head",
    labelPlural: "Factory Heads",
    backendType: "Factory Head",
    accountTypes: ["Company", "Customer"],
    treeSteps: ["Cluster", "Factory"],
  },
  "unit-heads": {
    label: "Unit Head",
    labelPlural: "Unit Heads",
    backendType: "Unit Head",
    accountTypes: ["Company", "Customer"],
    treeSteps: ["Cluster", "Factory", "Unit"],
  },
  "department-heads": {
    label: "Department Head",
    labelPlural: "Department Heads",
    backendType: "Department Head",
    accountTypes: ["Company", "Customer"],
    treeSteps: ["Cluster", "Factory", "Unit", "Department"],
  },
  "section-heads": {
    label: "Section Head",
    labelPlural: "Section Heads",
    backendType: "Section Head",
    accountTypes: ["Company", "Customer"],
    treeSteps: ["Cluster", "Factory", "Unit", "Department", "Section"],
  },
};

// ─── User interface ──────────────────────────────────────────────

interface User {
  id: number;
  user_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  nic?: string;
  country?: string;
  role: string;
  user_type: string;
  assigned_entity_type?: string;
  assigned_entity_code?: string;
  assigned_org_tree_id?: number;
  email_verified: boolean;
  is_active: boolean;
  is_linked?: boolean;
  created_at: string;
}

// ─── Add/Edit Modal ──────────────────────────────────────────────

interface UserFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  nic: string;
  country: string;
  assigned_entity_code: string;
  assigned_entity_type: string;
  assigned_org_tree_id?: number;
}

// Flattened tree node with parentage info
export interface FlatNode {
  id: string; // org-tree edge_id when available; fallback to code
  code: string;
  name: string;
  entity_type: string;
  parent_id: string | null; // parent org-tree edge_id (null for root-level)
}

// Tree node from API
interface TreeNode {
  code: string;
  name: string;
  entity_type: string;
  edge_id?: number;
  children?: TreeNode[];
  [key: string]: unknown;
}

/** Flatten org tree into a flat list with parent references */
function flattenTree(node: TreeNode, parentId: string | null = null): FlatNode[] {
  const id = node.edge_id ? String(node.edge_id) : node.code;
  const result: FlatNode[] = [{
    id,
    code: node.code,
    name: node.name,
    entity_type: node.entity_type,
    parent_id: parentId,
  }];
  if (node.children) {
    for (const child of node.children) {
      result.push(...flattenTree(child as TreeNode, node.edge_id ? String(node.edge_id) : null));
    }
  }
  return result;
}

function UserModal({
  open,
  onClose,
  onSubmit,
  userTypeLabel,
  editData,
  treeSteps,
  accessToken,
  accountType,
  orgCountry,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: UserFormData) => Promise<void>;
  userTypeLabel: string;
  editData: User | null;
  treeSteps: string[];
  accessToken: string | null;
  accountType: string;
  orgCountry?: string;
}) {
  const [form, setForm] = useState<UserFormData>({
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    nic: "",
    country: "",
    assigned_entity_code: "",
    assigned_entity_type: "",
    assigned_org_tree_id: undefined,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Countries
  const [countries, setCountries] = useState<Country[]>([]);
  const [countrySearch, setCountrySearch] = useState("");
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);

  const selectedCountry = countries.find((c) => c.country === form.country);
  const dialCode = selectedCountry?.international_dialing || "";

  // Flat list of all entities from org tree
  const [flatNodes, setFlatNodes] = useState<FlatNode[]>([]);
  // Selected code per step
  const [stepSelections, setStepSelections] = useState<Record<number, string>>({});

  const isEdit = !!editData;

  // Fetch countries on first open
  useEffect(() => {
    if (!open) return;
    if (countries.length > 0) return;
    countriesApi.getAll().then(setCountries);
  }, [open, countries.length]);

  // Fetch org tree and flatten when modal opens
  useEffect(() => {
    if (!open || !accessToken || treeSteps.length === 0 || editData) return;

    // Audit Firm: use configured org-tree links (Branch -> Audit Firm Department)
    if (accountType === "Audit Firm") {
      const fetchAuditFirmTreeNodes = async () => {
        const res = await orgTreeApi.getTree(accessToken);
        if (res.success && res.data) {
          const data = res.data as { tree: TreeNode };
          if (data.tree) {
            const all = flattenTree(data.tree);
            setFlatNodes(
              all.filter(
                (n) =>
                  n.entity_type === "Branch" || n.entity_type === "Audit Firm Department"
              )
            );
          } else {
            setFlatNodes([]);
          }
        } else {
          setFlatNodes([]);
        }
      };

      fetchAuditFirmTreeNodes();
      return;
    }

    const fetchTree = async () => {
      const res = await orgTreeApi.getTree(accessToken);
      if (res.success && res.data) {
        const data = res.data as { tree: TreeNode };
        if (data.tree) {
          setFlatNodes(flattenTree(data.tree));
        }
      }
    };
    fetchTree();
  }, [open, accessToken, treeSteps.length, accountType, editData]);

  // Handle edit prepopulation
  useEffect(() => {
    if (editData && flatNodes.length > 0 && open) {
      const selections: Record<number, string> = {};
      const targetId = String(editData.assigned_org_tree_id);

      let currentNode = flatNodes.find(n => n.id === targetId);
      if (currentNode) {
        let stepIdx = treeSteps.length - 1;
        let temp = currentNode;
        while (temp && stepIdx >= 0) {
          selections[stepIdx] = temp.id;
          temp = flatNodes.find(n => n.id === temp.parent_id) as FlatNode;
          stepIdx--;
        }
        setStepSelections(selections);
      }
    }
  }, [editData, flatNodes, treeSteps, open]);

  // Compute options for each step based on the tree and current selections
  const getStepOptions = (stepIndex: number): FlatNode[] => {
    if (flatNodes.length === 0) return [];
    const entityType = treeSteps[stepIndex];

    if (stepIndex === 0) {
      // First step: all nodes of this entity type in the tree
      return flatNodes.filter((n) => n.entity_type === entityType);
    }

    // Subsequent steps: only children of the selected parent
    const parentId = stepSelections[stepIndex - 1];
    if (!parentId) return [];
    return flatNodes.filter((n) => n.entity_type === entityType && n.parent_id === parentId);
  };

  const handleStepChange = (stepIndex: number, code: string) => {
    const newSelections: Record<number, string> = {};
    // Keep selections up to this step, clear the rest
    for (let i = 0; i <= stepIndex; i++) {
      newSelections[i] = i === stepIndex ? code : (stepSelections[i] || "");
    }
    setStepSelections(newSelections);

    // The last step is the assigned entity
    const isFinal = stepIndex === treeSteps.length - 1;
    if (isFinal && code) {
      const selected = flatNodes.find((n) => n.id === code || n.code === code);
      setForm((f) => ({
        ...f,
        assigned_entity_code: selected?.code || code,
        assigned_entity_type: treeSteps[stepIndex],
        assigned_org_tree_id: selected?.id && /^[0-9]+$/.test(selected.id) ? Number(selected.id) : undefined,
      }));
    } else {
      // Clear assignment if an upstream step changed
      setForm((f) => ({ ...f, assigned_entity_code: "", assigned_entity_type: "", assigned_org_tree_id: undefined }));
    }
  };

  useEffect(() => {
    if (editData) {
      setForm({
        first_name: editData.first_name || "",
        last_name: editData.last_name || "",
        email: editData.email || "",
        phone_number: editData.phone_number || "",
        nic: editData.nic || "",
        country: editData.country || "",
        assigned_entity_code: editData.assigned_entity_code || "",
        assigned_entity_type: editData.assigned_entity_type || "",
        assigned_org_tree_id: editData.assigned_org_tree_id || undefined,
      });
    } else {
      setForm({
        first_name: "",
        last_name: "",
        email: "",
        phone_number: "",
        nic: "",
        country: orgCountry || "",
        assigned_entity_code: "",
        assigned_entity_type: "",
        assigned_org_tree_id: undefined,
      });
    }
    setStepSelections({});
    setCountrySearch("");
    setShowCountryDropdown(false);
    setError("");
  }, [editData, open]);

  useEffect(() => {
    if (!open || editData || !orgCountry) return;
    setForm((current) =>
      current.country ? current : { ...current, country: orgCountry }
    );
  }, [open, editData, orgCountry]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim()) return setError("First name is required.");
    if (!form.last_name.trim()) return setError("Last name is required.");
    if (!form.email.trim()) return setError("Email is required.");
    if (!form.country.trim()) return setError("Country is required.");
    if (!form.phone_number.trim()) return setError("Phone number is required.");
    if (!form.nic.trim()) return setError("NIC is required.");
    if (treeSteps.length > 0 && !form.assigned_entity_code) {
      return setError(`Please select a ${treeSteps[treeSteps.length - 1]} to assign.`);
    }
    setLoading(true);
    setError("");
    try {
      await onSubmit(form);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-secondary-500/50 focus:ring-1 focus:ring-secondary-500/30 transition-all";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative glass rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">
            {isEdit ? `Edit ${userTypeLabel}` : `Add ${userTypeLabel}`}
          </h2>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                First Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                placeholder="First name"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                Last Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                placeholder="Last name"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="user@example.com"
              className={inputClass}
            />
          </div>

          {/* Country */}
          <div className="relative">
            <label className="block text-sm text-gray-400 mb-1.5">Country <span className="text-red-400">*</span></label>
            <div
              className={`${inputClass} cursor-pointer flex items-center gap-2`}
              onClick={() => setShowCountryDropdown(!showCountryDropdown)}
            >
              {form.country ? (
                <>
                  <span>{selectedCountry?.flag}</span>
                  <span className="truncate">{form.country}</span>
                  {dialCode && <span className="text-gray-500 ml-auto text-xs">{dialCode}</span>}
                </>
              ) : (
                <span className="text-gray-500">Select country</span>
              )}
            </div>
            {showCountryDropdown && (
              <div className="absolute z-50 mt-1 w-full bg-primary-900 border border-white/10 rounded-lg shadow-xl max-h-52 overflow-hidden">
                <div className="p-2 border-b border-white/10">
                  <input
                    type="text"
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    placeholder="Search countries..."
                    className="w-full bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-white text-sm placeholder-gray-500 focus:outline-none"
                    autoFocus
                  />
                </div>
                <div className="overflow-y-auto max-h-40">
                  {countries
                    .filter((c) => c.country.toLowerCase().includes(countrySearch.toLowerCase()))
                    .map((c) => (
                      <div
                        key={c.id}
                        className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-white/10 ${form.country === c.country ? "bg-secondary-500/15 text-secondary-400" : "text-white"
                          }`}
                        onClick={() => {
                          setForm({ ...form, country: c.country });
                          setShowCountryDropdown(false);
                          setCountrySearch("");
                        }}
                      >
                        <span>{c.flag}</span>
                        <span className="truncate">{c.country}</span>
                        {c.international_dialing && (
                          <span className="text-gray-500 ml-auto text-xs">{c.international_dialing}</span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Phone with dial code prefix */}
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Phone Number <span className="text-red-400">*</span></label>
              <div className="flex">
                {dialCode && (
                  <span className="inline-flex items-center px-2.5 bg-white/5 border border-white/10 border-r-0 rounded-l-lg text-gray-400 text-sm">
                    {dialCode}
                  </span>
                )}
                <input
                  type="text"
                  value={form.phone_number}
                  onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                  placeholder="Phone number"
                  className={`${inputClass} ${dialCode ? "rounded-l-none" : ""}`}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">NIC <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={form.nic}
                onChange={(e) => setForm({ ...form, nic: e.target.value })}
                placeholder="NIC number"
                className={inputClass}
              />
            </div>
          </div>

          {/* Entity Assignment – cascading dropdowns from org tree */}
          {treeSteps.length > 0 && (
            <div className="space-y-3 pt-1">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Assign to Entity</p>
              {treeSteps.map((entityType, idx) => {
                const options = getStepOptions(idx);
                const isDisabled = idx > 0 && !stepSelections[idx - 1];
                const isFinal = idx === treeSteps.length - 1;
                return (
                  <div key={entityType}>
                    <label className="block text-sm text-gray-400 mb-1.5">
                      {entityType}
                      {isFinal && <span className="text-red-400 ml-1">*</span>}
                    </label>
                    <select
                      value={stepSelections[idx] || ""}
                      onChange={(e) => handleStepChange(idx, e.target.value)}
                      className={inputClass}
                      disabled={isDisabled}
                    >
                      <option value="">
                        {isDisabled
                          ? `Select ${treeSteps[idx - 1]} first`
                          : `Select ${entityType}`}
                      </option>
                      {options.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}

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
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-secondary-500 text-primary-950 hover:bg-secondary-400 disabled:opacity-50 transition-all"
            >
              {loading ? "Saving..." : isEdit ? "Update" : "Send Invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Register Self Modal ────────────────────────────────────────

function RegisterSelfModal({
  open,
  onNo,
  onYes,
  loading,
  label,
  treeSteps,
  accessToken,
  accountType,
}: {
  open: boolean;
  onNo: () => void;
  onYes: (entityCode: string, entityType: string, assignedOrgTreeId?: number) => void;
  loading: boolean;
  label: string;
  treeSteps: string[];
  accessToken: string | null;
  accountType: string;
}) {
  const [step, setStep] = useState<"confirm" | "select-entity">("confirm");
  const [flatNodes, setFlatNodes] = useState<FlatNode[]>([]);
  const [stepSelections, setStepSelections] = useState<Record<number, string>>({});
  const [selectedEntityCode, setSelectedEntityCode] = useState("");
  const [selectedEntityType, setSelectedEntityType] = useState("");
  const [selectedOrgTreeId, setSelectedOrgTreeId] = useState<number | undefined>(undefined);
  const [treeLoading, setTreeLoading] = useState(false);
  const [entityError, setEntityError] = useState("");

  useEffect(() => {
    if (!open) {
      setStep("confirm");
      setFlatNodes([]);
      setStepSelections({});
      setSelectedEntityCode("");
      setSelectedEntityType("");
      setSelectedOrgTreeId(undefined);
      setEntityError("");
    }
  }, [open]);

  const fetchTree = async () => {
    if (!accessToken || treeSteps.length === 0) return;
    setTreeLoading(true);
    if (accountType === "Audit Firm") {
      const res = await orgTreeApi.getTree(accessToken);
      if (res.success && res.data) {
        const data = res.data as { tree: TreeNode };
        if (data.tree) {
          const all = flattenTree(data.tree);
          setFlatNodes(
            all.filter(
              (n) =>
                n.entity_type === "Branch" || n.entity_type === "Audit Firm Department"
            )
          );
        } else {
          setFlatNodes([]);
        }
      } else {
        setFlatNodes([]);
      }
    } else {
      const res = await orgTreeApi.getTree(accessToken);
      if (res.success && res.data) {
        const data = res.data as { tree: TreeNode };
        if (data.tree) setFlatNodes(flattenTree(data.tree));
      }
    }
    setTreeLoading(false);
  };

  const handleConfirmYes = () => {
    if (treeSteps.length > 0) {
      setStep("select-entity");
      fetchTree();
    } else {
      onYes("", "");
    }
  };

  const getStepOptions = (stepIndex: number): FlatNode[] => {
    if (flatNodes.length === 0) return [];
    const et = treeSteps[stepIndex];
    if (stepIndex === 0) return flatNodes.filter((n) => n.entity_type === et);
    const parentId = stepSelections[stepIndex - 1];
    if (!parentId) return [];
    return flatNodes.filter((n) => n.entity_type === et && n.parent_id === parentId);
  };

  const handleStepChange = (stepIndex: number, code: string) => {
    const newSel: Record<number, string> = {};
    for (let i = 0; i <= stepIndex; i++) newSel[i] = i === stepIndex ? code : (stepSelections[i] || "");
    setStepSelections(newSel);
    if (stepIndex === treeSteps.length - 1 && code) {
      const selected = flatNodes.find((n) => n.id === code || n.code === code);
      setSelectedEntityCode(selected?.code || code);
      setSelectedEntityType(treeSteps[stepIndex]);
      setSelectedOrgTreeId(selected?.id && /^[0-9]+$/.test(selected.id) ? Number(selected.id) : undefined);
    } else {
      setSelectedEntityCode("");
      setSelectedEntityType("");
      setSelectedOrgTreeId(undefined);
    }
  };

  const handleRegister = () => {
    if (!selectedEntityCode) {
      setEntityError(`Please select a ${treeSteps[treeSteps.length - 1]} to assign.`);
      return;
    }
    onYes(selectedEntityCode, selectedEntityType, selectedOrgTreeId);
  };

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-secondary-500/50 focus:ring-1 focus:ring-secondary-500/30 transition-all";

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative glass rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-white font-semibold">Register as {label}</h2>
          <button onClick={onNo} className="text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {step === "confirm" ? (
          <>
            <div className="px-6 py-6 text-center">
              <div className="w-16 h-16 rounded-full bg-secondary-500/15 border border-secondary-500/20 flex items-center justify-center mx-auto mb-4">
                <UserCheck size={32} className="text-secondary-500" />
              </div>
              <h3 className="text-white font-semibold text-base mb-2">Register Yourself as {label}?</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-3">
                Would you like to register yourself as {label.toLowerCase()} using your admin account details?
              </p>
              <p className="text-gray-500 text-xs italic">
                Click &quot;No&quot; if you want to register a different person as {label.toLowerCase()}.
              </p>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button type="button" onClick={onNo} className="flex-1 py-2.5 rounded-lg text-sm text-gray-400 border border-white/10 hover:border-white/20 hover:text-white transition-all">
                No, Add Another
              </button>
              <button type="button" onClick={handleConfirmYes} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium bg-secondary-500 text-primary-950 hover:bg-secondary-400 transition-all">
                <UserCheck size={15} />
                Yes, Register Me
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-400">Select the entity to assign yourself to:</p>
              {treeLoading ? (
                <div className="flex items-center justify-center py-6">
                  <span className="w-5 h-5 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="space-y-3">
                  {treeSteps.map((et, idx) => {
                    const options = getStepOptions(idx);
                    const isDisabled = idx > 0 && !stepSelections[idx - 1];
                    return (
                      <div key={et}>
                        <label className="block text-sm text-gray-400 mb-1.5">
                          {et}{idx === treeSteps.length - 1 && <span className="text-red-400 ml-1">*</span>}
                        </label>
                        <select
                          value={stepSelections[idx] || ""}
                          onChange={(e) => { handleStepChange(idx, e.target.value); setEntityError(""); }}
                          className={inputClass}
                          disabled={isDisabled}
                        >
                          <option value="">{isDisabled ? `Select ${treeSteps[idx - 1]} first` : `Select ${et}`}</option>
                          {options.map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.name}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
              {entityError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{entityError}</div>
              )}
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button type="button" onClick={() => { setStep("confirm"); setStepSelections({}); setSelectedEntityCode(""); setSelectedEntityType(""); setSelectedOrgTreeId(undefined); setEntityError(""); }} className="flex-1 py-2.5 rounded-lg text-sm text-gray-400 border border-white/10 hover:border-white/20 hover:text-white transition-all">
                Back
              </button>
              <button type="button" onClick={handleRegister} disabled={loading || !selectedEntityCode} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium bg-secondary-500 text-primary-950 hover:bg-secondary-400 disabled:opacity-60 transition-all">
                {loading ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <UserCheck size={15} />}
                Register
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Badges ──────────────────────────────────────────────────────

function EmailBadge({ verified, hasPassword }: { verified: boolean; hasPassword: boolean }) {
  if (verified) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
        <CheckCircle size={10} />
        Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
      <Clock size={10} />
      Pending
    </span>
  );
}

// ─── Page ────────────────────────────────────────────────────────

const REGISTERED_ME_STORAGE_KEY = (email: string, typeSlug: string) => `audito_register_me_${email}_${typeSlug}`;

export default function UsersClientPage() {
  const { admin, accessToken, isLoading, refreshMe } = useAuth();
  const { confirm, toast } = useUiFeedback();
  const router = useRouter();
  const searchParams = useSearchParams();

  const typeSlug = searchParams.get("type") || "auditors";
  const config = USER_TYPE_CONFIGS[typeSlug];

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [limitModalOpen, setLimitModalOpen] = useState(false);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [registerSelfOpen, setRegisterSelfOpen] = useState(false);
  const [registerSelfLoading, setRegisterSelfLoading] = useState(false);
  const [orgCountry, setOrgCountry] = useState("");

  // Pagination and search state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState("");

  const effectiveTreeSteps = useMemo(() => {
    if (!admin || !config) return [];
    if (config.treeStepsByAccount && admin.account_type && config.treeStepsByAccount[admin.account_type]) {
      return config.treeStepsByAccount[admin.account_type];
    }
    return config.treeSteps;
  }, [admin, config]);

  const fetchUsers = useCallback(async () => {
    if (!accessToken || !config) return;
    setLoading(true);
    try {
      const res = await usersApi.list(accessToken, config.backendType);
      if (res.success && res.data) {
        const data = res.data as { users: User[] };
        setUsers(data.users || []);
      }
    } catch {
      // no-op
    } finally {
      setLoading(false);
    }
  }, [accessToken, config]);

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
  }, [isLoading, admin, router]);

  useEffect(() => {
    if (!accessToken) return;
    authApi
      .getMe(accessToken)
      .then((res) => {
        if (res.success && res.data) {
          const data = res.data as { organization?: { country?: string } | null };
          setOrgCountry(data.organization?.country || "");
        }
      })
      .catch(() => {
        setOrgCountry("");
      });
  }, [accessToken]);

  useEffect(() => {
    if (config) fetchUsers();
  }, [fetchUsers, config]);

  const markRegisterMeCompleted = () => {
    if (!admin) return;
    localStorage.setItem(REGISTERED_ME_STORAGE_KEY(admin.email, typeSlug), "true");
  };

  const isRegisterMeCompleted = () => {
    if (!admin) return true;
    return !!localStorage.getItem(REGISTERED_ME_STORAGE_KEY(admin.email, typeSlug));
  };

  useEffect(() => {
    if (loading) return;
    if (isRegisterMeCompleted()) return;
    const alreadyInList = admin?.email
      ? users.some((u) => u.email.toLowerCase() === admin.email.toLowerCase())
      : true;
    if (alreadyInList) return;
    const isRegistering = searchParams.get("register-me") === "1";
    if (isRegistering) {
      setRegisterSelfOpen(true);
    }
  }, [loading, users, searchParams, admin?.email]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return users;
    return users.filter((u) => {
      const hay = `${u.first_name || ""} ${u.last_name || ""} ${u.email || ""} ${u.user_code || ""}`.toLowerCase();
      return hay.includes(query);
    });
  }, [users, q]);

  useEffect(() => {
    setCurrentPage(1);
  }, [q]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const handleAdd = () => {
    if (config.backendType === "Auditor" && admin?.plan_limits && users.length >= admin.plan_limits.auditors) {
      setLimitModalOpen(true);
      return;
    }
    const alreadyInList = admin?.email
      ? users.some((u) => u.email.toLowerCase() === admin.email.toLowerCase())
      : true;
    if (!alreadyInList && !isRegisterMeCompleted()) {
      setRegisterSelfOpen(true);
      return;
    }
    setEditUser(null);
    setModalOpen(true);
  };

  const isLimitExceeded = config && config.backendType === "Auditor" && admin?.plan_limits && users.length >= admin.plan_limits.auditors;



  const handleEdit = (user: User) => {
    setEditUser(user);
    setModalOpen(true);
  };

  const handleResend = async (user: User) => {
    if (!accessToken) return;
    setActionLoading(user.user_code);
    const res = await usersApi.resendVerification(accessToken, user.user_code);
    setActionLoading(null);
    if (res.success) toast("Verification email resent.", "success");
    else toast(res.message || "Failed to resend email.", "error");
  };

  const handleDelete = async (user: User) => {
    if (!accessToken) return;
    const ok = await confirm({
      title: "Deactivate User",
      message: `Are you sure you want to deactivate ${user.first_name} ${user.last_name}?`,
      confirmText: "Deactivate",
      variant: "warning",
    });
    if (!ok) return;

    setActionLoading(user.user_code);
    const res = await usersApi.deleteUser(accessToken, String(user.user_code));
    setActionLoading(null);
    if (res.success) {
      toast("User deactivated successfully.", "success");
      fetchUsers();
    } else {
      toast(res.message || "Failed to deactivate user.", "error");
    }
  };

  const [entities, setEntities] = useState<FlatNode[]>([]);
  useEffect(() => {
    if (accessToken) {
      orgTreeApi.getTree(accessToken).then(res => {
        if (res.success && res.data) {
          const data = res.data as { tree: TreeNode };
          if (data.tree) setEntities(flattenTree(data.tree));
        }
      });
    }
  }, [accessToken]);

  const getEntityName = (orgTreeId?: number, entityCode?: string) => {
    if (orgTreeId) {
      const node = entities.find(n => n.id === String(orgTreeId));
      if (node) return node.name;
    }
    return entityCode || "—";
  };

  const handleSubmit = async (formData: UserFormData) => {
    if (!accessToken) return;
    if (editUser) {
      const res = await usersApi.update(accessToken, editUser.user_code, {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone_number: formData.phone_number,
        nic: formData.nic,
        country: formData.country,
        assigned_entity_code: formData.assigned_entity_code || undefined,
        assigned_entity_type: formData.assigned_entity_type || undefined,
        assigned_org_tree_id: formData.assigned_org_tree_id || undefined,
      });
      if (!res.success) throw new Error(res.message || "Failed to update.");
      toast("User updated successfully.", "success");
    } else {
      const res = await usersApi.create(accessToken, {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone_number: formData.phone_number,
        nic: formData.nic,
        country: formData.country,
        user_type: config.backendType,
        assigned_entity_code: formData.assigned_entity_code || undefined,
        assigned_entity_type: formData.assigned_entity_type || undefined,
        assigned_org_tree_id: formData.assigned_org_tree_id || undefined,
      });
      if (!res.success) throw new Error(res.message || "Failed to create.");
      toast("User added successfully.", "success");
    }
    fetchUsers();
  };

  const handleSubmitFromAdmin = async (
    email: string,
    assignedEntityCode: string,
    assignedEntityType: string,
    assignedOrgTreeId?: number
  ) => {
    if (!accessToken) return;
    const res = await usersApi.createFromAdmin(accessToken, {
      email,
      user_type: config.backendType,
      assigned_entity_code: assignedEntityCode || undefined,
      assigned_entity_type: assignedEntityType || undefined,
      assigned_org_tree_id: assignedOrgTreeId || undefined,
    });
    if (!res.success) throw new Error(res.message || "Failed to create.");
    toast("User registered successfully.", "success");
    fetchUsers();
  };

  const handleRegisterSelf = async (entityCode: string, entityType: string, assignedOrgTreeId?: number) => {
    if (!accessToken || !admin) return;
    setRegisterSelfLoading(true);
    try {
      await handleSubmitFromAdmin(admin.email, entityCode, entityType, assignedOrgTreeId);
      markRegisterMeCompleted();
      setRegisterSelfOpen(false);
      await refreshMe();
      fetchUsers();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to register.", "error");
    } finally {
      setRegisterSelfLoading(false);
    }
  };

  if (isLoading || !config) {
    return (
      <div className="h-screen bg-transparent flex items-center justify-center pt-14 lg:pt-0">
        <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!admin) return null;

  return (
    <div className="min-h-full bg-transparent flex flex-col relative w-full">
      <main className="flex-1 p-6 lg:p-8 pt-20 lg:pt-8 ">
        <LimitReachedModal
          isOpen={limitModalOpen}
          onClose={() => setLimitModalOpen(false)}
          title="Auditor Limit Reached"
          message="Your current plan has reached the maximum number of auditors allowed."
          limit={admin?.plan_limits?.auditors || 0}
        />
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Users size={22} className="text-secondary-400" />
              {config.labelPlural}
            </h1>
            <p className="hidden sm:block text-sm text-gray-400 mt-0.5">
              Invite and manage {config.labelPlural.toLowerCase()} who will be responsible for audits and data entry.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchUsers}
              className="p-2.5 rounded-lg text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all font-medium"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            {!config.viewOnly && (
              <button
                onClick={handleAdd}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium bg-secondary-500 text-primary-950 hover:bg-secondary-400 shadow-lg shadow-secondary-500/10 transition-all active:scale-95"
              >
                {isLimitExceeded ? <Crown size={18} /> : <Plus size={18} />}
                <span className="sm:hidden">{isLimitExceeded ? "Upgrade" : "Add"}</span>
                <span className="hidden sm:block">{isLimitExceeded ? "Upgrade" : `Add ${config.label}`}</span>
              </button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        {!loading && users.length > 0 && (
          <div className="mb-6 max-w-lg">
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl glass border border-white/[0.06]">
              <Search size={14} className="text-gray-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Search ${config.labelPlural.toLowerCase()}...`}
                className="bg-transparent outline-none text-sm text-gray-200 placeholder:text-gray-600 w-full"
              />
            </div>
          </div>
        )}

        {/* Data */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="glass rounded-xl p-10 text-center">
            <p className="text-gray-400 text-sm">
              No {config.labelPlural.toLowerCase()} found. Add your first one above.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-xl p-16 text-center">
            <Search size={36} className="text-gray-600 mx-auto mb-4" />
            <p className="text-white font-medium mb-1">No matches found</p>
            <p className="text-gray-400 text-sm">Try adjusting your search query.</p>
          </div>
        ) : (
          <>
            <div className="glass rounded-xl overflow-hidden hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left px-4 py-3 text-gray-400 font-medium w-12">#</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">Name</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">Email</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">Phone</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">Country</th>
                      {effectiveTreeSteps.length > 0 && (
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Assigned To</th>
                      )}
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
                      <th className="text-right px-4 py-3 text-gray-400 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((user, index) => {
                      const itemIndex = (currentPage - 1) * pageSize + index + 1;
                      return (
                        <tr
                          key={user.user_code}
                          className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="px-4 py-3 text-gray-400 text-sm">{itemIndex}</td>
                          <td className="px-4 py-3 text-white font-medium">
                            {user.first_name} {user.last_name}
                          </td>

                          <td className="px-4 py-3 text-gray-400">{user.email}</td>
                          <td className="px-4 py-3 text-gray-400">{user.phone_number || "—"}</td>
                          <td className="px-4 py-3 text-gray-400">{user.country || "—"}</td>
                          {effectiveTreeSteps.length > 0 && (
                            <td className="px-4 py-3 text-gray-400 text-xs">
                              {getEntityName(user.assigned_org_tree_id, user.assigned_entity_code)}
                            </td>
                          )}
                          <td className="px-4 py-3">
                            <EmailBadge verified={user.email_verified} hasPassword={false} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {user.is_linked ? (
                                <span className="text-[11px] text-gray-500 italic">Linked</span>
                              ) : (
                                <>
                                  {!user.email_verified && (
                                    <button
                                      onClick={() => handleResend(user)}
                                      disabled={actionLoading === user.user_code}
                                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all font-medium disabled:opacity-50"
                                      title="Resend verification email"
                                    >
                                      <Mail size={15} />
                                    </button>
                                  )}

                                  <button
                                    onClick={() => handleEdit(user)}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-secondary-400 hover:bg-secondary-500/10 transition-all font-medium"
                                    title="Edit"
                                  >
                                    <Pencil size={15} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(user)}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all font-medium"
                                    title="Deactivate"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="md:hidden space-y-3">
              {paginated.map((user, index) => {
                const itemIndex = (currentPage - 1) * pageSize + index + 1;
                return (
                  <div key={user.user_code} className="glass rounded-xl border border-white/10 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">#{itemIndex}</p>
                        <h3 className="text-sm font-semibold text-white truncate">
                          {user.first_name} {user.last_name}
                        </h3>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{user.email}</p>
                      </div>
                      <EmailBadge verified={user.email_verified} hasPassword={false} />
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-2">
                        <p className="text-gray-500">Phone</p>
                        <p className="text-gray-300 mt-0.5 truncate">{user.phone_number || "-"}</p>
                      </div>
                      <div className="rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-2">
                        <p className="text-gray-500">Country</p>
                        <p className="text-gray-300 mt-0.5 truncate">{user.country || "-"}</p>
                      </div>
                      {effectiveTreeSteps.length > 0 && (
                        <div className="col-span-2 rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-2">
                          <p className="text-gray-500">Assigned To</p>
                          <p className="text-gray-300 mt-0.5 truncate">
                            {getEntityName(user.assigned_org_tree_id, user.assigned_entity_code)}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-end gap-1">
                      {user.is_linked ? (
                        <span className="text-[11px] text-gray-500 italic">Linked (view-only)</span>
                      ) : (
                        <>
                          {!user.email_verified && (
                            <button
                              onClick={() => handleResend(user)}
                              disabled={actionLoading === user.user_code}
                              className="p-2 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all font-medium disabled:opacity-50"
                              title="Resend verification email"
                            >
                              <Mail size={15} />
                            </button>
                          )}

                          <button
                            onClick={() => handleEdit(user)}
                            className="p-2 rounded-lg text-gray-400 hover:text-secondary-400 hover:bg-secondary-500/10 transition-all font-medium"
                            title="Edit"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all font-medium"
                            title="Deactivate"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={filtered.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}

        {/* Modal */}
        <UserModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSubmit}
          userTypeLabel={config.label}
          editData={editUser}
          treeSteps={effectiveTreeSteps}
          accessToken={accessToken}
          accountType={admin.account_type || ""}
          orgCountry={orgCountry}
        />

        {/* Register self confirmation */}
        <RegisterSelfModal
          open={registerSelfOpen}
          onNo={() => { markRegisterMeCompleted(); setRegisterSelfOpen(false); setEditUser(null); setModalOpen(true); }}
          onYes={handleRegisterSelf}
          loading={registerSelfLoading}
          label={config.label}
          treeSteps={effectiveTreeSteps}
          accessToken={accessToken}
          accountType={admin.account_type || ""}
        />
      </main>
    </div>
  );
}
