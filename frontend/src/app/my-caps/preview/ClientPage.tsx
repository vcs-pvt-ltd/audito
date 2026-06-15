"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { capApi } from "@/lib/api";
import { 
  AlertCircle, 
  ArrowLeft, 
  Building2, 
  ChevronDown, 
  ChevronRight, 
  ClipboardCheck, 
  HelpCircle,
  FileText,
  Search,
  CheckCircle2,
  List,
  AlignLeft,
  Building,
  ClipboardList,
  Info
} from "lucide-react";

interface TreeNode {
  entity_type: string;
  code: string;
  name: string;
  edge_id?: number | string | null;
  children: TreeNode[];
  [key: string]: unknown;
}

interface CapQuestion {
  id: number;
  entity_code: string;
  question_text: string;
  answer_type: string;
  total_marks: string | number;
  ca_description?: string;
  order_index?: number;
}

interface CapEntity {
  entity_code: string;
  entity_type: string;
  entity_name?: string;
}

interface CapDetail {
  id: number;
  cap_plan_code: string;
  title: string;
}

const ENTITY_TYPE_COLORS: Record<string, string> = {
  "Customer": "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  "Buying Office": "bg-violet-500/20 text-violet-300 border-violet-500/30",
  "Supplier": "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "Company": "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  "Cluster": "bg-teal-500/20 text-teal-300 border-teal-500/30",
  "Factory": "bg-orange-500/20 text-orange-300 border-orange-500/30",
  "Unit": "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "Department": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "Section": "bg-green-500/20 text-green-300 border-green-500/30",
  "Audit Firm": "bg-rose-500/20 text-rose-300 border-rose-500/30",
  "Audit Firm Company": "bg-rose-500/20 text-rose-300 border-rose-500/30",
  "Branch": "bg-pink-500/20 text-pink-300 border-pink-500/30",
  "Audit Firm Department": "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30",
};

const ANSWER_TYPE_CONFIG: Record<string, { label: string; color: string; icon: ReactNode }> = {
  free_text: { label: "Free Text", color: "bg-gray-500/20 text-gray-300 border-gray-500/30", icon: <AlignLeft size={11} /> },
  single_option: { label: "Single Choice", color: "bg-blue-500/20 text-blue-300 border-blue-500/30", icon: <CheckCircle2 size={11} /> },
  multiple_options: { label: "Multiple Choice", color: "bg-purple-500/20 text-purple-300 border-purple-500/30", icon: <List size={11} /> },
  dropdown: { label: "Dropdown", color: "bg-teal-500/20 text-teal-300 border-teal-500/30", icon: <ChevronDown size={11} /> },
};

function countDescendantQuestions(node: TreeNode, map: Record<string, CapQuestion[]>): number {
  const nodeKey = `${node.code}__${node.edge_id ?? "null"}`;
  const own = (map[nodeKey] || map[`${node.code}__null`] || []).length;
  return own + (node.children ?? []).reduce((s, c) => s + countDescendantQuestions(c, map), 0);
}

function EntityTreeNode({
  node,
  questionsMap,
  depth,
}: {
  node: TreeNode;
  questionsMap: Record<string, CapQuestion[]>;
  depth: number;
}) {
  const k = `${node.code}__${node.edge_id ?? 'null'}`;
  const questions = (questionsMap[k] || questionsMap[`${node.code}__null`] || []);
  const totalQs = countDescendantQuestions(node, questionsMap);
  const [expanded, setExpanded] = useState(totalQs > 0);
  const typeColor = ENTITY_TYPE_COLORS[node.entity_type] ?? "bg-gray-500/20 text-gray-300 border-gray-500/30";
  const hasChildren = (node.children ?? []).length > 0;
  const isLeaf = !hasChildren && questions.length === 0;

  return (
    <div className="relative">
      <div
        className="relative"
        style={{ paddingLeft: depth === 0 ? 0 : 28 }}
      >
        {depth > 0 && (
          <>
            <div className="absolute left-[13px] top-0 bottom-0 w-px bg-gradient-to-b from-white/[0.12] via-white/[0.06] to-transparent" />
            <div className="absolute left-[13px] top-[22px] w-[15px] h-px bg-gradient-to-r from-white/[0.12] to-white/[0.04]" />
            <div className="absolute left-[11px] top-[20px] w-1.5 h-1.5 rounded-full bg-white/[0.15] ring-1 ring-white/[0.06]" />
          </>
        )}

        <button
          onClick={() => setExpanded((p) => !p)}
          className={`w-full flex items-center gap-3 py-3 px-4 rounded-xl border transition-all duration-200 text-left group ${
            totalQs > 0 
              ? "bg-white/[0.04] border-white/[0.12] hover:bg-white/[0.07] hover:border-white/[0.22] shadow-[0_2px_12px_rgba(0,0,0,0.15)]"
              : "bg-transparent border-transparent hover:bg-white/[0.02]"
          }`}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {!isLeaf && (
              <div className={`shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-all duration-200 ${
                expanded ? "bg-white/[0.08] text-gray-300" : "bg-white/[0.04] text-gray-600 group-hover:text-gray-400"
              }`}>
                {expanded ? <ChevronDown size={12} strokeWidth={2.5} /> : <ChevronRight size={12} strokeWidth={2.5} />}
              </div>
            )}
            {isLeaf && <div className="w-5 shrink-0" />}
            <div className="w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-200 bg-white/[0.02] border-white/10 group-hover:border-white/20">
               <div className={`w-full h-full rounded-lg flex items-center justify-center border ${typeColor}`}>
                  <Building2 size={18} />
               </div>
            </div>
            <div className="flex-1 min-w-0">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${typeColor.split(' ')[1]} mb-0.5 block`}>
                {node.entity_type}
              </span>
              <span className="text-sm font-semibold truncate block text-white">
                {node.name}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {totalQs > 0 && (
              <span className="text-[10px] font-bold text-secondary-400 bg-secondary-500/10 border border-secondary-500/20 px-2.5 py-1 rounded-lg">
                {totalQs} Actions
              </span>
            )}
          </div>
        </button>
      </div>

      {expanded && (
        <div className="mt-1 space-y-1">
          {questions.length > 0 && (
            <div
              className="space-y-3 py-2"
              style={{ paddingLeft: depth === 0 ? 56 : 84 }}
            >
              {questions.map((q, qi) => {
                const atConf = ANSWER_TYPE_CONFIG[q.answer_type] || ANSWER_TYPE_CONFIG.free_text;
                return (
                  <div key={q.id} className="relative group/q">
                    <div className="absolute -left-5 top-0 bottom-0 w-px bg-gradient-to-b from-white/[0.06] to-transparent" />
                    <div className="absolute -left-5 top-6 w-4 h-px bg-white/[0.06]" />
                    
                    <div className="rounded-2xl border border-white/[0.08] overflow-hidden shadow-lg transition-all duration-200 hover:border-white/[0.18] bg-white/[0.02] backdrop-blur-sm">
                      <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.02] border-b border-white/[0.06]">
                        <span className="w-6 h-6 rounded-lg bg-orange-500/15 border border-orange-500/20 flex items-center justify-center text-orange-400 text-[11px] font-bold shrink-0">
                          {qi + 1}
                        </span>
                        <span className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-tight ${atConf.color.split(' ')[1]}`}>
                          {atConf.icon}
                          {atConf.label}
                        </span>
                         <div className="ml-auto">
                            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{q.total_marks} Marks</span>
                         </div>
                      </div>

                      <div className="p-4 space-y-3">
                        <p className="text-sm text-gray-200 leading-relaxed font-medium">
                          {q.question_text}
                        </p>
                        {q.ca_description && (
                          <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 flex gap-3">
                             <Search size={14} className="text-amber-500 shrink-0 mt-0.5" />
                             <div className="min-w-0">
                                <p className="text-[10px] text-amber-500/60 font-bold uppercase tracking-widest mb-1">Identified Finding</p>
                                <p className="text-xs text-amber-200/80 italic leading-relaxed">{q.ca_description}</p>
                             </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(node.children ?? []).map((child) => (
            <EntityTreeNode
              key={child.edge_id ?? child.code}
              node={child}
              questionsMap={questionsMap}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MyCapPreviewPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const capId = searchParams.get("id") as string;

  const [cap, setCap] = useState<CapDetail | null>(null);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [questions, setQuestions] = useState<CapQuestion[]>([]);
  const [entities, setEntities] = useState<CapEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
  }, [isLoading, admin, router]);

  const load = useCallback(async () => {
    if (!accessToken || !capId) return;
    setLoading(true);
    setError("");
    try {
      const res = await capApi.get(accessToken, capId);
      if (res.success && res.data) {
        const data = res.data as { cap: CapDetail; tree: TreeNode | null; questions: CapQuestion[]; entities: CapEntity[] };
        setCap(data.cap);
        setTree(data.tree || null);
        setQuestions(data.questions || []);
        setEntities(data.entities || []);
      } else {
        setError(res.message || "Failed to load CAP preview.");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  }, [accessToken, capId]);

  useEffect(() => { load(); }, [load]);

  if (isLoading || loading) return <Loading />;
  if (!admin) return null;

  const qMap: Record<string, CapQuestion[]> = {};
  for (const q of questions) {
    const k = `${q.entity_code}__${(q as any).org_tree_id ?? 'null'}`;
    if (!qMap[k]) qMap[k] = [];
    qMap[k].push(q);
  }

  return (
    <div className="min-h-screen text-white pt-24 pb-12 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push(`/my-caps/details?id=${capId}`)} className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
             <h1 className="text-2xl sm:text-3xl font-black font-semibold flex items-center gap-3">
               <ClipboardCheck size={28} className="text-secondary-400 shrink-0" />
               Preview CAP
             </h1>
             {cap && <p className="text-sm text-gray-500 font-mono mt-1 pl-10 truncate">{cap.title}</p>}
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-24">
             <div className="w-10 h-10 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="glass rounded-3xl p-8 text-center border border-white/10 max-w-md mx-auto">
             <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
             <h2 className="text-xl font-bold text-white mb-2">Error</h2>
             <p className="text-gray-400">{error}</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="glass rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2.5">
                  <ClipboardList size={14} className="text-secondary-400" />
                  CAP Scope & Actions
                  <span className="text-gray-700 font-medium normal-case ml-1">({entities.length} assigned entities)</span>
                </h3>
              </div>
              
              {entities.length === 0 ? (
                <div className="py-16 text-center bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
                   <Info size={32} className="text-gray-700 mx-auto mb-3" />
                   <p className="text-sm text-gray-600 italic">No entities assigned to this CAP plan.</p>
                </div>
              ) : tree ? (
                <div className="bg-white/[0.02] rounded-3xl border border-white/[0.08] p-4 sm:p-6 space-y-1">
                   {ENTITY_TYPE_COLORS[tree.entity_type] ? (
                     <EntityTreeNode node={tree} questionsMap={qMap} depth={0} />
                   ) : (
                     (tree.children || []).map((child) => (
                       <EntityTreeNode key={`${child.code}__${(child as any).edge_id ?? 'null'}`} node={child} questionsMap={qMap} depth={0} />
                     ))
                   )}
                </div>
              ) : (
                <div className="py-16 text-center bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
                   <AlertCircle size={32} className="text-gray-700 mx-auto mb-3" />
                   <p className="text-sm text-gray-600">Entity structure is not available for preview.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .glass {
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
      `}</style>
    </div>
  );
}

function Loading() {
  return (
    <div className="h-screen bg-transparent flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
