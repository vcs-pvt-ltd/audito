"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { adminApi, type AdminDashboardStats } from "@/lib/api";
import {
  ShieldCheck, Mail, Tag, Puzzle, Building2, Loader2, RefreshCw,
  ArrowRight, CreditCard, BarChart3, ChevronDown,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const PLAN_COLORS: Record<string, string> = {
  Basic: "#6b7280",
  Pro: "#10b981",
  Elite: "#8b5cf6",
  Custom: "#f59e0b",
};

const PERIODS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
] as const;

type Period = (typeof PERIODS)[number]["value"];

function StatCard({ icon: Icon, label, value, accent, href, sub }: {
  icon: any; label: string; value: number; accent: string; href?: string; sub?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => href && router.push(href)}
      className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.15] transition-all text-left group"
    >
      <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${accent} shrink-0`}>
        <Icon size={18} className="text-white/80" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-white/45 font-medium uppercase tracking-wider">{label}</div>
        <div className="text-2xl font-extrabold text-white leading-tight">{value.toLocaleString()}</div>
        {sub && <div className="text-[10px] text-white/30 mt-0.5">{sub}</div>}
      </div>
      {href && <ArrowRight size={14} className="text-white/15 group-hover:text-white/40 transition-colors shrink-0" />}
    </button>
  );
}

export default function AuditoAdminDashboard() {
  const { admin, accessToken, isLoading } = useAuth();
  const { toast } = useUiFeedback();
  const router = useRouter();
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("monthly");
  const [periodOpen, setPeriodOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && (!admin || admin.role !== "audito_admin")) {
      router.replace("/login");
    }
  }, [isLoading, admin, router]);

  const loadStats = useCallback(async (p: Period) => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await adminApi.getDashboardStats(accessToken, p);
      if (res.success && res.data) {
        setStats(res.data as AdminDashboardStats);
      } else {
        toast((res as any).message || "Failed to load stats.", "error");
      }
    } catch {
      toast("Failed to load dashboard stats.", "error");
    } finally {
      setLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    loadStats(period);
  }, [period, loadStats]);

  if (isLoading || (!admin || admin.role !== "audito_admin")) return null;

  const c = stats?.counts;
  const charts = stats?.charts;

  const regData = charts?.registrations.map((r) => ({
    label: r.period_label,
    registrations: r.count,
  })) || [];

  const planData = charts?.plan_distribution.map((p) => ({
    name: p.plan_name,
    value: p.count,
    color: PLAN_COLORS[p.plan_name] || "#6b7280",
  })) || [];

  return (
    <div className="min-h-screen p-5 pt-20 lg:p-8 lg:pt-8">

      {loading && !stats ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 size={32} className="animate-spin text-secondary-400" />
        </div>
      ) : !stats ? (
        <div className="text-center py-32 text-gray-500">Failed to load dashboard data.</div>
      ) : (
        <div className="space-y-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              icon={Mail}
              label="Messages"
              value={c!.messages}
              accent="bg-blue-500/15"
              href="/admin-panel/messages"
              sub={`${c!.messages_unread} unread`}
            />
            <StatCard
              icon={CreditCard}
              label="Promo Codes"
              value={c!.promo_codes}
              accent="bg-emerald-500/15"
              href="/admin-panel/promo-codes"
              sub={`${c!.promo_codes_active} active`}
            />
            <StatCard
              icon={Puzzle}
              label="Custom Solutions"
              value={c!.custom_solutions}
              accent="bg-purple-500/15"
              href="/admin-panel/custom-solutions"
              sub={`${c!.custom_solutions_pending} pending`}
            />
            <StatCard
              icon={Building2}
              label="Organizations"
              value={c!.organizations}
              accent="bg-amber-500/15"
              href="/admin-panel/organizations"
              sub={`${c!.organizations_paid} paid`}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Registrations Trend Chart */}
            <div className="lg:col-span-2 rounded-2xl bg-white/[0.03] border border-white/[0.08] p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 size={16} className="text-secondary-400" />
                  <h3 className="text-sm font-semibold text-white">Registrations</h3>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setPeriodOpen(!periodOpen)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/[0.1] text-xs text-gray-300 hover:bg-white/[0.1] transition-colors"
                  >
                    {PERIODS.find((p) => p.value === period)?.label}
                    <ChevronDown size={12} />
                  </button>
                  {periodOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setPeriodOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 z-20 w-28 rounded-xl bg-[#0a1f1c] border border-white/[0.12] shadow-2xl overflow-hidden">
                        {PERIODS.map((p) => (
                          <button
                            key={p.value}
                            onClick={() => { setPeriod(p.value); setPeriodOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                              period === p.value
                                ? "bg-secondary-500/20 text-secondary-300 font-semibold"
                                : "text-gray-400 hover:bg-white/[0.06] hover:text-white"
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
              {regData.length === 0 ? (
                <div className="h-[260px] flex items-center justify-center text-xs text-gray-500">No data yet</div>
              ) : (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={regData} margin={{ left: -10, right: 0, top: 5, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(255,255,255,0.05)" }}
                        contentStyle={{
                          backgroundColor: "rgba(2, 47, 43, 0.95)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "12px",
                          fontSize: "11px",
                        }}
                      />
                      <Bar dataKey="registrations" fill="#10b981" radius={[4, 4, 0, 0]} name="Registrations" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="flex items-center justify-center gap-5 mt-2">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-bold text-emerald-400">Registrations</span>
                </div>
              </div>
            </div>

            {/* Plan Distribution Pie */}
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Tag size={16} className="text-secondary-400" />
                <h3 className="text-sm font-semibold text-white">Plan Distribution</h3>
              </div>
              {planData.length === 0 ? (
                <div className="h-[260px] flex items-center justify-center text-xs text-gray-500">No data yet</div>
              ) : (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={planData}
                        cx="50%"
                        cy="45%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {planData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(2, 47, 43, 0.95)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "12px",
                          fontSize: "11px",
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        iconSize={8}
                        formatter={(value: string) => (
                          <span className="text-[11px] text-gray-400">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Quick Actions</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { icon: Mail, label: "Messages", href: "/admin-panel/messages", color: "text-blue-400" },
                { icon: CreditCard, label: "Promo Codes", href: "/admin-panel/promo-codes", color: "text-emerald-400" },
                { icon: Puzzle, label: "Custom Solutions", href: "/admin-panel/custom-solutions", color: "text-purple-400" },
                { icon: ShieldCheck, label: "Payments", href: "/admin-panel/payments", color: "text-amber-400" },
                { icon: ShieldCheck, label: "Admins", href: "/admin-panel/admins", color: "text-cyan-400" },
              ].map((a) => (
                <button
                  key={a.href}
                  onClick={() => router.push(a.href)}
                  className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.15] transition-all group"
                >
                  <a.icon size={16} className={`${a.color} opacity-60 group-hover:opacity-100 transition-opacity shrink-0`} />
                  <span className="text-xs text-gray-400 group-hover:text-white transition-colors font-medium truncate">{a.label}</span>
                  <ArrowRight size={12} className="text-white/15 group-hover:text-white/40 transition-colors ml-auto shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
