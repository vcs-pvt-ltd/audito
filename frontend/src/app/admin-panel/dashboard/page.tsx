"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, Mail, Tag, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function AuditoAdminDashboard() {
  const { admin, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!admin || admin.role !== "audito_admin")) {
      router.replace("/login");
    }
  }, [isLoading, admin, router]);

  if (isLoading || !admin) return null;

  const cards = [
    {
      title: "Messages",
      description: "View and reply to contact form messages from landing page visitors.",
      icon: Mail,
      href: "/admin-panel/messages",
      color: "from-blue-500/20 to-blue-600/10",
      border: "border-blue-500/30",
      iconColor: "text-blue-400",
    },
    {
      title: "Promo Codes",
      description: "Generate and manage promotional discount codes for user registration.",
      icon: Tag,
      href: "/admin-panel/promo-codes",
      color: "from-emerald-500/20 to-emerald-600/10",
      border: "border-emerald-500/30",
      iconColor: "text-emerald-400",
    },
  ];

  return (
    <div className="min-h-screen p-5 pt-20 lg:p-8 lg:pt-8">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-secondary-500/20 border border-secondary-500/30 flex items-center justify-center">
            <ShieldCheck size={20} className="text-secondary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Audito Admin Panel</h1>
            <p className="text-gray-400 text-sm">Welcome back, {admin.first_name}!</p>
          </div>
        </div>
        <div className="h-px bg-white/10 mt-4" />
      </div>

      {/* Quick Action Cards */}
      <div className="mb-8">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Quick Actions</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className={`group glass rounded-2xl p-6 border ${card.border} bg-gradient-to-br ${card.color} hover:-translate-y-1 transition-all duration-200`}
              >
                <div className={`w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon size={22} className={card.iconColor} />
                </div>
                <h3 className="text-white font-semibold text-base mb-1">{card.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{card.description}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Info Panel */}
      <div className="glass rounded-2xl p-6 border border-white/10">
        <div className="flex items-center gap-2 mb-4">
          <LayoutDashboard size={16} className="text-secondary-400" />
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Dashboard Overview</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Role</p>
            <p className="text-white font-semibold">Audito Admin</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Email</p>
            <p className="text-white font-semibold truncate">{admin.email}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Status</p>
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-emerald-400 text-xs font-medium">Active</span>
            </span>
          </div>
        </div>
        <p className="text-gray-500 text-xs mt-4 leading-relaxed">
          This is the Audito team admin panel. Use the sidebar or quick action cards above to manage contact messages and promotional discount codes.
          More features will be added in future updates.
        </p>
      </div>
    </div>
  );
}
