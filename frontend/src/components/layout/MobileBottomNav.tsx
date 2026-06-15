"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  BookOpen,
  ClipboardCheck,
  FileCheck,
  LayoutDashboard,
  UserCircle2,
} from "lucide-react";

type NavItem = {
  label: string;
  path?: string;
  icon: React.ElementType;
  matchPrefix?: boolean;
};

function getNavItems(role: string): NavItem[] {
  if (role === "auditor") {
    return [
      { label: "Home", path: "/dashboard", icon: LayoutDashboard },
      { label: "Audits", path: "/my-audits", icon: FileCheck, matchPrefix: true },
      { label: "CAPs", path: "/my-caps", icon: ClipboardCheck, matchPrefix: true },
      { label: "Profile", path: "/profile", icon: UserCircle2 },
    ];
  }

  if (role === "entity_head") {
    return [
      { label: "Home", path: "/dashboard", icon: LayoutDashboard },
      { label: "Audits", path: "/my-audits", icon: FileCheck, matchPrefix: true },
      { label: "CAPs", path: "/my-caps", icon: ClipboardCheck, matchPrefix: true },
      { label: "Profile", path: "/profile", icon: UserCircle2 },
    ];
  }

  if (role === "admin") {
    return [
      { label: "Home", path: "/dashboard", icon: LayoutDashboard },
      { label: "Audits", path: "/audits", icon: FileCheck, matchPrefix: true },
      { label: "CAPs", path: "/caps", icon: ClipboardCheck, matchPrefix: true },
      { label: "Profile", path: "/profile", icon: UserCircle2 },
    ];
  }

  return [
    { label: "Home", path: "/dashboard", icon: LayoutDashboard },
    { label: "Profile", path: "/profile", icon: UserCircle2 },
  ];
}

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { admin } = useAuth();

  if (!admin) return null;

  const items = getNavItems(admin.role);

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 backdrop-blur-xl px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-2"
      style={{ background: "linear-gradient(180deg, #003F2D 0%, #002d1f 100%)" }}
    >
      <ul className={`grid gap-1 ${items.length >= 5 ? "grid-cols-5" : "grid-cols-4"}`}>
        {items.map((item) => {
          const path = item.path || "";
          const Icon = item.icon;
          const isActive = item.path ? (item.matchPrefix ? pathname.startsWith(path) : pathname === path) : false;

          return (
            <li key={item.path || item.label}>
              <Link
                href={path || "/dashboard"}
                className={`flex flex-col items-center justify-center rounded-lg px-1 py-2 transition-all ${
                  isActive
                    ? "bg-secondary-500/20 text-secondary-300"
                    : "text-gray-300 hover:text-white hover:bg-white/8"
                }`}
              >
                <Icon size={18} />
                <span className={`mt-1 text-[11px] leading-none font-medium ${isActive ? "text-secondary-300" : "text-gray-400"}`}>
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}