"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { auditApi, orgTreeApi, usersApi } from "@/lib/api";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import {
  ArrowLeft,
  UserPlus,
  Building,
  Briefcase,
  Users,
  Search,
  ClipboardList,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Phone,
  Eye
} from "lucide-react";
import { Button, IconButton, fieldClass } from "@/components/ui";

interface TreeNode {
  id: number;
  parent_code: string;
  child_code: string;
  child_type: string;
  entity_type: string;
  name?: string;
  children?: TreeNode[];
}

function AuditAssignContent() {
  const { accessToken, admin } = useAuth();
  const { toast } = useUiFeedback();
  const router = useRouter();
  const searchParams = useSearchParams();
  const auditId = searchParams.get("id");
  const selectClass = `${fieldClass} pl-12 pr-10 py-4 rounded-2xl hover:border-white/20 appearance-none cursor-pointer`;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [audit, setAudit] = useState<any>(null);
  const [treeData, setTreeData] = useState<any[]>([]);
  const [allAuditors, setAllAuditors] = useState<any[]>([]);

  const [selBranchId, setSelBranchId] = useState<number | "">("");
  const [selDeptId, setSelDeptId] = useState<number | "">("");
  const [selAuditorCode, setSelAuditorCode] = useState("");

  useEffect(() => {
    if (!accessToken || !auditId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [aRes, tRes, uRes] = await Promise.all([
          auditApi.get(accessToken, auditId),
          orgTreeApi.getTree(accessToken),
          usersApi.list(accessToken, "Auditor")
        ]);

        if (aRes.success && aRes.data) {
          const fetchedAudit = (aRes.data as any).audit || aRes.data;
          setAudit(fetchedAudit);
          if (fetchedAudit.assigned_auditor_code) {
            setSelAuditorCode(fetchedAudit.assigned_auditor_code);
          }
        }
        if (tRes.success) {
          setTreeData((tRes.data as any).tree || []);
        }
        if (uRes.success) {
          setAllAuditors((uRes.data as any).users || []);
        }
      } catch (err) {
        toast("Failed to load assignment data.", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [accessToken, auditId]);

  // Pre-fill selections when audit and auditors are loaded
  useEffect(() => {
    if (audit && allAuditors.length > 0 && treeData && selAuditorCode && !selBranchId) {
      const currentAuditor = allAuditors.find(u => u.user_code === selAuditorCode);
      if (currentAuditor && currentAuditor.assigned_org_tree_id) {
        const targetId = currentAuditor.assigned_org_tree_id;

        // Find if this ID is a branch or a dept
        const findNode = (nodes: any[], id: number): any => {
          if (!Array.isArray(nodes)) return null;
          for (const n of nodes) {
            const nId = n.edge_id || n.id;
            if (String(nId) === String(id)) return n;
            if (n.children) {
              const f = findNode(n.children, id);
              if (f) return f;
            }
          }
          return null;
        };

        const roots = Array.isArray(treeData) ? treeData : [treeData];
        const node = findNode(roots, targetId);

        if (node) {
          const nodeId = node.edge_id || node.id;
          const nodeType = node.child_type || node.entity_type || "";

          if (nodeType.includes("Branch")) {
            setSelBranchId(Number(nodeId));
          } else if (nodeType.includes("Department") || nodeType.includes("Dept")) {
            setSelDeptId(Number(nodeId));
            // Find parent branch
            const findParent = (nodes: any[], childId: number): any => {
              for (const n of nodes) {
                if (n.children && n.children.some((c: any) => String(c.edge_id || c.id) === String(childId))) return n;
                if (n.children) {
                  const f = findParent(n.children, childId);
                  if (f) return f;
                }
              }
              return null;
            };
            const parent = findParent(roots, nodeId);
            if (parent) {
              const pId = parent.edge_id || parent.id;
              setSelBranchId(Number(pId));
            }
          }
        }
      }
    }
  }, [audit, allAuditors, treeData, selAuditorCode, selBranchId]);

  // Extract branches from tree
  const branches = useMemo(() => {
    // Top level nodes or nodes where child_type === Branch
    // In this system, the firm admin's tree root is their company. 
    // Their children are usually Branches.
    const list: any[] = [];
    const traverse = (nodes: any[]) => {
      if (!Array.isArray(nodes)) return;
      for (const n of nodes) {
        // Match Branch types
        const type = n.child_type || n.entity_type || "";
        if (type.includes("Branch")) {
          list.push({
            id: n.edge_id || n.id,
            name: n.child_name || n.name || n.child_code || n.code,
            code: n.child_code || n.code
          });
        }
        if (n.children) traverse(n.children);
      }
    };
    if (treeData) {
      traverse(Array.isArray(treeData) ? treeData : [treeData]);
    }
    return list;
  }, [treeData]);

  // Extract departments for selected branch
  const departments = useMemo(() => {
    if (!selBranchId) return [];
    const list: any[] = [];
    const traverse = (nodes: any[]) => {
      if (!Array.isArray(nodes)) return;
      for (const n of nodes) {
        // Match both edge_id and id
        const nId = n.edge_id || n.id;
        if (String(nId) === String(selBranchId)) {
          if (n.children && Array.isArray(n.children)) {
            for (const c of n.children) {
              const cType = c.child_type || c.entity_type || "";
              if (cType.includes("Department") || cType.includes("Dept")) {
                list.push({
                  id: c.edge_id || c.id,
                  name: c.child_name || c.name || c.child_code || c.code,
                  code: c.child_code || c.code
                });
              }
            }
          }
          return;
        }
        if (n.children) traverse(n.children);
      }
    };
    if (treeData) {
      traverse(Array.isArray(treeData) ? treeData : [treeData]);
    }
    return list;
  }, [treeData, selBranchId]);

  // Filter auditors based on selected branch/dept
  const filteredAuditors = useMemo(() => {
    if (!selBranchId && !selDeptId) return [];

    // Get all valid org tree IDs for the selected scope
    const allowedIds = new Set<number>();

    if (selDeptId) {
      allowedIds.add(Number(selDeptId));
    } else if (selBranchId) {
      const collectIds = (nodes: any[]) => {
        if (!Array.isArray(nodes)) return;
        for (const n of nodes) {
          const nId = n.edge_id || n.id;
          if (String(nId) === String(selBranchId)) {
            allowedIds.add(Number(nId));
            const addChildren = (cnodes: any[]) => {
              for (const cn of cnodes) {
                const cnId = cn.edge_id || cn.id;
                allowedIds.add(Number(cnId));
                if (cn.children) addChildren(cn.children);
              }
            };
            if (n.children) addChildren(n.children);
            return true;
          }
          if (n.children && collectIds(n.children)) return true;
        }
        return false;
      };

      const roots = Array.isArray(treeData) ? treeData : [treeData];
      collectIds(roots);
    }

    return allAuditors.filter(u => u.assigned_org_tree_id && allowedIds.has(u.assigned_org_tree_id));
  }, [allAuditors, treeData, selBranchId, selDeptId]);

  const handleSave = async () => {
    if (!accessToken || !auditId || !selAuditorCode) return;
    setSaving(true);
    try {
      // Per user request: auditors table identifies entity, no need for assigned_org_tree_id in audit_assignments
      const res = await auditApi.update(accessToken, auditId, {
        assigned_auditor_code: selAuditorCode
      });
      if (res.success) {
        toast("Auditor assigned successfully.", "success");
        router.push("/audits");
      } else {
        toast(res.message || "Assignment failed.", "error");
      }
    } catch (err) {
      toast("An error occurred while saving.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-secondary-500 border-t-transparent rounded-full animate-spin mb-4" />
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Audit Not Found</h1>
        <p className="text-gray-400 mb-8">The audit assignment you are looking for does not exist or was deleted.</p>
        <Button onClick={() => router.push("/audits")} variant="secondary" className="px-6 py-3 rounded-xl">
          Back to Audits
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent relative">
      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Header Action */}
        <div className="mb-10 flex items-center justify-between">
          <IconButton
            onClick={() => router.back()}
            bordered
            size="md"
            className="bg-white/5 px-4 py-2 rounded-xl group"
            title="Back"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          </IconButton>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary-500/10 border border-secondary-500/20">
            <div className="w-2 h-2 rounded-full bg-secondary-500 animate-pulse" />
            <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Internal Assignment</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* LEFT: Assignment Workflow (8 cols) */}
          <div className="lg:col-span-8 flex flex-col">
            <div className="glass-card overflow-hidden h-full flex flex-col">
              <div className="px-8 py-6 border-b border-white/10 bg-white/[0.02]">
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary-500/10 flex items-center justify-center border border-secondary-500/20">
                    <UserPlus className="text-secondary-400" size={20} />
                  </div>
                  Assigning Entity
                </h2>
                <p className="text-sm text-gray-400 mt-1 ml-13">Choose the organizational node and auditor for this task.</p>
              </div>

              <div className="p-8 space-y-8 flex-grow">
                {/* Step 1 & 2: Structure */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 ml-1">1. Select Branch</label>
                    <div className="relative group">
                      <Building size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-secondary-400 transition-colors" />
                      <select
                        value={selBranchId}
                        onChange={(e) => {
                          setSelBranchId(e.target.value ? Number(e.target.value) : "");
                          setSelDeptId("");
                          setSelAuditorCode("");
                        }}
                        className={selectClass}
                      >
                        <option value="" className="bg-[#0c2218]">All Branches</option>
                        {branches.map(b => (
                          <option key={b.id} value={b.id} className="bg-[#0c2218]">{b.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 ml-1">2. Select Department</label>
                    <div className="relative group">
                      <Briefcase size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-secondary-400 transition-colors" />
                      <select
                        value={selDeptId}
                        disabled={!selBranchId}
                        onChange={(e) => {
                          setSelDeptId(e.target.value ? Number(e.target.value) : "");
                          setSelAuditorCode("");
                        }}
                        className={`${selectClass} disabled:opacity-30 disabled:cursor-not-allowed`}
                      >
                        <option value="" className="bg-[#0c2218]">{!selBranchId ? "Select branch first" : "All Departments"}</option>
                        {departments.map(d => (
                          <option key={d.id} value={d.id} className="bg-[#0c2218]">{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {selBranchId && (
                  <>
                    <hr className="border-white/5" />

                    {/* Step 3: Auditor List */}
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">3. Select Auditor</label>
                        <span className="text-[10px] font-medium px-2 py-1 bg-white/5 border border-white/10 rounded-md text-gray-400">
                          Found {filteredAuditors.length}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredAuditors.length > 0 ? (
                          filteredAuditors.map(u => (
                            <button
                              key={u.user_code}
                              onClick={() => setSelAuditorCode(u.user_code)}
                              className={`relative p-5 rounded-3xl border transition-all text-left overflow-hidden group ${selAuditorCode === u.user_code
                                  ? "bg-secondary-500/10 border-secondary-500/40 shadow-lg shadow-secondary-500/5"
                                  : "bg-white/[0.03] border-white/5 hover:border-white/20 hover:bg-white/[0.05]"
                                }`}
                            >
                              {/* Active Shine */}
                              {selAuditorCode === u.user_code && (
                                <div className="absolute top-0 right-0 p-2">
                                  <div className="w-6 h-6 rounded-full bg-secondary-500 text-primary-950 flex items-center justify-center">
                                    <CheckCircle2 size={14} strokeWidth={3} />
                                  </div>
                                </div>
                              )}

                              <div className="flex items-start gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0 transition-colors ${selAuditorCode === u.user_code ? "bg-secondary-500 text-primary-950" : "bg-white/5 text-gray-400 border border-white/10"
                                  }`}>
                                  {u.first_name[0]}{u.last_name[0]}
                                </div>
                                <div className="min-w-0">
                                  <h4 className={`text-sm font-bold truncate ${selAuditorCode === u.user_code ? "text-secondary-400" : "text-white"}`}>
                                    {u.first_name} {u.last_name}
                                  </h4>
                                  <p className="text-xs text-gray-500 mt-0.5 truncate">{u.email}</p>
                                </div>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="col-span-full py-16 flex flex-col items-center justify-center text-center bg-white/[0.02] border border-dashed border-white/10 rounded-[32px]">
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                              <Users size={32} className="text-gray-600" />
                            </div>
                            <h4 className="text-white font-semibold">No auditors available</h4>
                            <p className="text-xs text-gray-500 mt-1 max-w-[240px]">We couldn't find any auditors assigned to this specific organizational node.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Action Bar */}
              <div className="px-8 py-6 bg-black/20 border-t border-white/10 flex items-center justify-end gap-4 mt-auto">
                <Button
                  onClick={() => router.back()}
                  variant="ghost"
                  className="px-6 py-3 rounded-2xl font-bold"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !selAuditorCode}
                  loading={saving}
                  leftIcon={<UserPlus size={18} strokeWidth={2.5} />}
                  className="px-8 py-3.5 rounded-2xl font-bold disabled:grayscale shadow-lg shadow-secondary-500/20 active:scale-95"
                >
                  {audit.assigned_auditor_code ? "Update Assignment" : "Finalize Assignment"}
                </Button>
              </div>
            </div>
          </div>

          {/* RIGHT: Audit Context (4 cols) */}
          <div className="lg:col-span-4 space-y-6 flex flex-col">
            {/* Main Summary Card */}
            <div className="glass-card p-8 group overflow-hidden relative flex-grow">
              <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-secondary-500/5 rounded-full blur-3xl group-hover:bg-secondary-500/10 transition-colors" />

              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <ClipboardList size={18} className="text-secondary-400" />
                  Audit Summary
                </h2>
                <Button
                  onClick={() => router.push(`/audits/details?id=${auditId}`)}
                  variant="secondary"
                  size="sm"
                  leftIcon={<Eye size={14} />}
                  className="rounded-xl bg-white/5 text-[10px] font-bold uppercase tracking-widest"
                  title="View Audit Details"
                >
                  <span>Preview</span>
                </Button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Title</label>
                  <p className="text-white text-lg font-bold leading-tight">{audit.title}</p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    <ClipboardList size={18} className="text-gray-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-0.5">Checklist</label>
                    <p className="text-sm text-gray-200 font-medium">{audit.checklist_name || "Unspecified Template"}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    <Calendar size={18} className="text-gray-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-0.5">Timeline</label>
                    <p className="text-sm text-gray-200 font-medium">
                      {new Date(audit.start_date).toLocaleDateString('en-US', ({ day: 'numeric', month: 'short' }))} - {new Date(audit.end_date).toLocaleDateString('en-US', ({ day: 'numeric', month: 'short', year: 'numeric' }))}
                    </p>
                  </div>
                </div>

                {/* Target Organization Details */}
                {audit.assigned_company && (
                  <div className="pt-6 border-t border-white/5 space-y-5">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-xs font-bold text-secondary-400 uppercase tracking-widest">Target Client</h3>

                    </div>

                    <div className="space-y-4">
                      <div>
                        <p className="text-white font-bold text-base leading-tight">{audit.assigned_company.name}</p>
                        <p className="text-[10px] text-gray-500 capitalize mt-1">{audit.assigned_company.entity_type || "Client"}</p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Search size={14} className="text-gray-500" />
                          <p className="text-xs text-gray-400 truncate">{audit.assigned_company.email || "No email"}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Phone size={14} className="text-gray-500" />
                          <p className="text-xs text-gray-400">{audit.assigned_company.phone_number || "No contact number"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Tips */}
            <div className="p-6 rounded-3xl bg-blue-500/5 border border-blue-500/10 flex gap-4 mt-6">
              <div className="shrink-0 text-blue-400 mt-1">
                <AlertCircle size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-blue-200">Assignment Tip</h4>
                <p className="text-xs text-blue-400/80 mt-1 leading-relaxed">
                  Auditors will receive a notification immediately upon assignment. If the audit is already in progress, the new auditor will take over from the current point.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <style jsx>{`
        .glass-card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 32px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        }
        .ml-13 {
          margin-left: 3.25rem;
        }
      `}</style>
    </div>
  );
}

export default function AuditAssignPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-secondary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AuditAssignContent />
    </Suspense>
  );
}
