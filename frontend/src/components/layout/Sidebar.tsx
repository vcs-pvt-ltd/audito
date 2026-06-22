"use client";
import Image from "next/image";
import auditoLogo from "../../assets/logo/audito_logo.png";

import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import type { AccountInfo } from "@/context/AuthContext";
import { noticeApi, linksApi } from "@/lib/api";
import {
  LogOut, LayoutDashboard, Building2, Link as LinkIcon, ClipboardList, Menu, X,
  ChevronDown, PanelLeftClose, PanelLeftOpen, FolderTree, Users, Shield, FileCheck, Repeat, Eye, EyeOff,
  Loader2, Settings, MapPin, Bell, UserCircle2, CreditCard, HelpCircle,
} from "lucide-react";

// ─── Avatar helper (mirrors profile page) ────────────────────────
const MEDIA_ORIGIN =
  process.env.NEXT_PUBLIC_MEDIA_URL ||
  (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "");

function getAvatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("data:")) return path;
  if (path.startsWith("http")) return path;
  return `${MEDIA_ORIGIN}${path}`;
}

// ─── Avatar component — image if available, else initials ────────
function Avatar({
  firstName, lastName, profileImage, size = "sm",
}: {
  firstName: string; lastName: string;
  profileImage?: string | null;
  size?: "sm" | "md";
}) {
  const initials = `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  const url = getAvatarUrl(profileImage);
  const dim = size === "md" ? "w-10 h-10 text-sm" : "w-9 h-9 text-sm";

  if (url) {
    return (
      <img
        src={url}
        alt={`${firstName} ${lastName}`}
        className={`${dim} rounded-full object-cover border border-white/10 shrink-0`}
      />
    );
  }
  return (
    <div className={`${dim} rounded-full bg-secondary-500/20 flex items-center justify-center text-secondary-400 font-bold shrink-0`}>
      {initials}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────

interface NavItem {
  label: string; path: string; icon: React.ElementType;
  minOrgLevel?: number; planFeature?: "auditor_eval" | "company_to_company";
  excludeEntityTypes?: string[];
}
interface NavSection { label: string; icon: React.ElementType; items: NavItem[]; }
interface TopLevelLink {
  type: "link"; label: string; path: string; icon: React.ElementType;
  matchPrefix?: boolean; planFeature?: "auditor_eval" | "company_to_company";
}
type NavEntry = NavSection | TopLevelLink;
const isTopLevel = (e: NavEntry): e is TopLevelLink => (e as TopLevelLink).type === "link";

// Customer: Customer=8, Buying Office=7, Supplier=7 (Buying Office & Supplier share org_level)
// Suppliers excluded for Supplier entity_type — they see their own entity, not manage it from here
const CUSTOMER_STRUCTURE_NAV_ITEMS: NavItem[] = [
  { label: "Buying Offices", path: "/structure/list?type=buying-office", icon: Building2, minOrgLevel: 7 },
  { label: "Suppliers", path: "/structure/list?type=supplier", icon: Building2, minOrgLevel: 6, excludeEntityTypes: ["Supplier"] },
];
const CUSTOMER_USER_NAV_ITEMS: NavItem[] = [
  { label: "Buying Office Heads", path: "/users/list?type=buying-office-heads", icon: Users, minOrgLevel: 7 },
  { label: "Supplier Heads", path: "/users/list?type=supplier-heads", icon: Users, minOrgLevel: 6, excludeEntityTypes: ["Supplier"] },
];

const COMPANY_STRUCTURE_NAV_ITEMS: NavItem[] = [
  { label: "Clusters", path: "/structure/list?type=cluster", icon: Building2, minOrgLevel: 4 },
  { label: "Factories", path: "/structure/list?type=factory", icon: Building2, minOrgLevel: 3 },
  { label: "Units", path: "/structure/list?type=unit", icon: Building2, minOrgLevel: 2 },
  { label: "Departments", path: "/structure/list?type=department", icon: Building2, minOrgLevel: 1 },
  { label: "Sections", path: "/structure/list?type=section", icon: Building2, minOrgLevel: 0 },
];
const COMPANY_USER_NAV_ITEMS: NavItem[] = [
  { label: "Cluster Heads", path: "/users/list?type=cluster-heads", icon: Users, minOrgLevel: 4 },
  { label: "Factory Heads", path: "/users/list?type=factory-heads", icon: Users, minOrgLevel: 3 },
  { label: "Unit Heads", path: "/users/list?type=unit-heads", icon: Users, minOrgLevel: 2 },
  { label: "Department Heads", path: "/users/list?type=department-heads", icon: Users, minOrgLevel: 1 },
  { label: "Section Heads", path: "/users/list?type=section-heads", icon: Users, minOrgLevel: 0 },
];

// Audit Firm: Audit Firm Company=6, Branch=3, Audit Firm Department=1 (distinct levels — no shared-level ambiguity)
// Branches:    minOrgLevel=3 → only Firm(6) creates Branches; Branch(3) & Dept(1) cannot
// Departments: minOrgLevel=1 → Firm(6) & Branch(3) create Departments; Dept(1) is the leaf and sees nothing
const AUDIT_FIRM_STRUCTURE_NAV_ITEMS: NavItem[] = [
  { label: "Branches", path: "/structure/list?type=branch", icon: Building2, minOrgLevel: 3 },
  { label: "Departments", path: "/structure/list?type=audit-firm-department", icon: Building2, minOrgLevel: 1 },
];
const AUDIT_FIRM_USER_NAV_ITEMS: NavItem[] = [
  { label: "Branch Heads", path: "/users/list?type=branch-heads", icon: Users, minOrgLevel: 3 },
  { label: "Department Heads", path: "/users/list?type=audit-firm-department-heads", icon: Users, minOrgLevel: 1 },
];

function stripOrgLevel(items: NavItem[]): NavItem[] {
  return items.map(({ minOrgLevel: _minOrgLevel, ...item }) => item);
}

function hasAcceptedCompanySupplierLink(
  links: { status: string; requester_type: string; target_type: string }[]
): boolean {
  return links.some(
    (l) => l.status === "accepted" &&
      ((l.requester_type === "Supplier" && l.target_type === "Company") ||
       (l.requester_type === "Company" && l.target_type === "Supplier"))
  );
}

const NAV_CONFIG: Record<string, NavEntry[]> = {
  "admin:Customer": [
    { type: "link", label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Structure", icon: Building2, items: [
      ...CUSTOMER_STRUCTURE_NAV_ITEMS,
      { label: "Org Tree", path: "/organization", icon: FolderTree },
      { label: "Links", path: "/links", icon: LinkIcon },
    ]},
    { label: "Users", icon: Users, items: [
      { label: "Auditors", path: "/users/list?type=auditors", icon: Shield },
      ...CUSTOMER_USER_NAV_ITEMS,
    ]},
    { label: "Checklists", icon: ClipboardList, items: [
      { label: "Checklist Types", path: "/checklists/types", icon: FileCheck },
      { label: "Checklists", path: "/checklists", icon: ClipboardList },
    ]},
    { type: "link", label: "Audits", path: "/audits", icon: FileCheck, matchPrefix: true },
    { type: "link", label: "CAPs", path: "/caps", icon: ClipboardList, matchPrefix: true },
    { label: "Learning", icon: ClipboardList, items: [
      { label: "Trainings", path: "/learning/trainings", icon: FileCheck },
      { label: "Field Visits", path: "/learning/field-visits", icon: MapPin },
      { label: "Evaluation Papers", path: "/learning/evaluation-papers", icon: ClipboardList },
    ]},
    { label: "Settings", icon: Settings, items: [
      { label: "TimeZone", path: "/settings/timezone", icon: MapPin },
      { label: "Notices", path: "/settings/notices", icon: Bell },
      { label: "Organization Info", path: "/settings/organization", icon: Building2 },
      { label: "Billing", path: "/settings/billing", icon: CreditCard },
      { label: "Help", path: "/settings/help", icon: HelpCircle },
    ]},
  ],
  "admin:Company": [
    { type: "link", label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Structure", icon: Building2, items: [
      ...COMPANY_STRUCTURE_NAV_ITEMS,
      { label: "Org Tree", path: "/organization", icon: FolderTree },
      { label: "Links", path: "/links", icon: LinkIcon },
    ]},
    { label: "Users", icon: Users, items: [
      { label: "Auditors", path: "/users/list?type=auditors", icon: Shield },
      ...COMPANY_USER_NAV_ITEMS,
    ]},
    { label: "Checklists", icon: ClipboardList, items: [
      { label: "Checklist Types", path: "/checklists/types", icon: FileCheck },
      { label: "Checklists", path: "/checklists", icon: ClipboardList },
    ]},
    { type: "link", label: "Audits", path: "/audits", icon: FileCheck, matchPrefix: true },
    { type: "link", label: "CAPs", path: "/caps", icon: ClipboardList, matchPrefix: true },
    { label: "Learning", icon: ClipboardList, items: [
      { label: "Trainings", path: "/learning/trainings", icon: FileCheck },
      { label: "Field Visits", path: "/learning/field-visits", icon: MapPin },
      { label: "Evaluation Papers", path: "/learning/evaluation-papers", icon: ClipboardList },
    ]},
    { label: "Settings", icon: Settings, items: [
      { label: "TimeZone", path: "/settings/timezone", icon: MapPin, minOrgLevel: 4 },
      { label: "Notices", path: "/settings/notices", icon: Bell, minOrgLevel: 4 },
      { label: "Organization Info", path: "/settings/organization", icon: Building2 },
      { label: "Billing", path: "/settings/billing", icon: CreditCard },
      { label: "Help", path: "/settings/help", icon: HelpCircle },
    ]},
  ],
  "admin:Audit Firm": [
    { type: "link", label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Structure", icon: Building2, items: [
      ...AUDIT_FIRM_STRUCTURE_NAV_ITEMS,
      { label: "Org Tree", path: "/organization", icon: FolderTree },
      { label: "Links", path: "/links", icon: LinkIcon },
    ]},
    { label: "Users", icon: Users, items: [
      { label: "Auditors", path: "/users/list?type=auditors", icon: Shield },
      ...AUDIT_FIRM_USER_NAV_ITEMS,
    ]},
    { type: "link", label: "Assigned Audits", path: "/audits", icon: FileCheck, matchPrefix: true },
    { label: "Learning", icon: ClipboardList, items: [
      { label: "Trainings", path: "/learning/trainings", icon: FileCheck },
      { label: "Field Visits", path: "/learning/field-visits", icon: MapPin },
      { label: "Evaluation Papers", path: "/learning/evaluation-papers", icon: ClipboardList },
    ]},
    { label: "Settings", icon: Settings, items: [
      { label: "TimeZone", path: "/settings/timezone", icon: MapPin, minOrgLevel: 5 },
      { label: "Notices", path: "/settings/notices", icon: Bell, minOrgLevel: 5 },
      { label: "Organization Info", path: "/settings/organization", icon: Building2 },
      { label: "Billing", path: "/settings/billing", icon: CreditCard },
      { label: "Help", path: "/settings/help", icon: HelpCircle },
    ]},
  ],
  auditor: [
    { type: "link", label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { type: "link", label: "My Audits", path: "/my-audits", icon: FileCheck, matchPrefix: true },
    { type: "link", label: "My CAPs", path: "/my-caps", icon: FileCheck, matchPrefix: true },
    { label: "My Learning", icon: ClipboardList, items: [
      { label: "Trainings", path: "/my-learning/trainings", icon: FileCheck },
      { label: "Field Visits", path: "/my-learning/field-visits", icon: MapPin },
      { label: "Evaluation Papers", path: "/my-learning/evaluation-papers", icon: ClipboardList },
    ]},
    { type: "link", label: "Help", path: "/settings/help", icon: HelpCircle },
  ],
  entity_head: [
    { type: "link", label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { type: "link", label: "Audits", path: "/entity-head/audits", icon: FileCheck, matchPrefix: true },
    { type: "link", label: "CAPs", path: "/entity-head/caps", icon: ClipboardList, matchPrefix: true },
    { type: "link", label: "Help", path: "/settings/help", icon: HelpCircle },
  ],
};

const ACCOUNT_LABELS: Record<string, string> = {
  Customer: "Customer", Company: "Company", "Audit Firm": "Audit Firm",
};
const ROLE_LABELS: Record<string, string> = {
  admin: "Admin", auditor: "Auditor", entity_head: "Entity Head",
};

function resolveNavKey(role: string, accountType?: string | null): string {
  if (role === "admin") {
    const normalized = accountType === "Audit Firm Company" ? "Audit Firm" : (accountType ?? "");
    const key = `admin:${normalized}`;
    return key in NAV_CONFIG ? key : "admin:Customer";
  }
  return role in NAV_CONFIG ? role : "auditor";
}

function filterByOrgLevel(items: NavItem[], orgLevel: number, planLimits?: any, entityType?: string | null): NavItem[] {
  return items.filter((item) => {
    if (item.minOrgLevel !== undefined && orgLevel <= item.minOrgLevel) return false;
    if (item.planFeature && planLimits && !planLimits[item.planFeature]) return false;
    if (item.excludeEntityTypes && entityType && item.excludeEntityTypes.includes(entityType)) return false;
    return true;
  });
}

function CollapsedSectionFlyout({ section, pathname, orgLevel, planLimits, entityType, onNavigate, onClose }: {
  section: NavSection; pathname: string; orgLevel: number; planLimits?: any; entityType?: string | null;
  onNavigate: () => void; onClose: () => void;
}) {
  const visibleItems = filterByOrgLevel(section.items, orgLevel, planLimits, entityType);
  if (visibleItems.length === 0) return null;
  return (
    <div className="w-64 rounded-xl border border-white/10 bg-primary-900/90 backdrop-blur-md shadow-2xl p-2">
      <div className="px-2 py-2 text-xs font-medium text-gray-400 flex items-center justify-between">
        <span>{section.label}</span>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X size={16} /></button>
      </div>
      <div className="space-y-1">
        {visibleItems.map((item) => {
          const ItemIcon = item.icon;
          const active = pathname === item.path;
          return (
            <Link key={item.path} href={item.path}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${active ? "bg-primary-500/15 text-secondary-400 font-medium" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
              onClick={() => { onNavigate(); onClose(); }}>
              <ItemIcon size={16} />{item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function DropdownSection({ section, pathname, orgLevel, planLimits, entityType, onNavigate, open, onToggle }: {
  section: NavSection; pathname: string; orgLevel: number; planLimits?: any; entityType?: string | null;
  onNavigate: () => void; open: boolean; onToggle: () => void;
}) {
  const visibleItems = filterByOrgLevel(section.items, orgLevel, planLimits, entityType);
  const isChildActive = visibleItems.some((item) => pathname === item.path);
  if (visibleItems.length === 0) return null;
  const Icon = section.icon;
  return (
    <div>
      <button onClick={onToggle}
        className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-all ${isChildActive ? "text-secondary-400 font-medium" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
        <Icon size={18} />
        <span className="flex-1 text-left">{section.label}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-0" : "-rotate-90"}`} />
      </button>
      {open && (
        <div className="ml-4 pl-3 border-l border-white/[0.06] space-y-0.5 mt-0.5">
          {visibleItems.map((item) => {
            const ItemIcon = item.icon;
            const active = pathname === item.path;
            return (
              <Link key={item.path} href={item.path}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all ${active ? "bg-primary-500/15 text-secondary-400 font-medium" : "text-gray-500 hover:text-white hover:bg-white/5"}`}
                onClick={onNavigate}>
                <ItemIcon size={15} />{item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AccountSwitcher({ accounts, currentRole, onSwitch }: {
  accounts: AccountInfo[]; currentRole: string;
  onSwitch: (targetRole: string, password?: string) => Promise<{ success: boolean; message?: string; needsPassword?: boolean }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [modalRole, setModalRole] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalLoading, setModalLoading] = useState(false);

  const otherAccounts = accounts.filter((a) => a.role !== currentRole);
  if (otherAccounts.length === 0) return null;

  const getLandingPage = (_role: string) => "/dashboard";

  const handleSwitch = async (targetRole: string) => {
    setSwitching(targetRole);
    const res = await onSwitch(targetRole);
    setSwitching(null);
    if (res.success) { setOpen(false); router.push(getLandingPage(targetRole)); }
    else if (res.needsPassword) { setOpen(false); setModalRole(targetRole); setPassword(""); setModalError(""); setShowPassword(false); }
  };

  const handleModalSubmit = async () => {
    if (!modalRole || !password.trim()) { setModalError("Password is required."); return; }
    setModalLoading(true); setModalError("");
    const res = await onSwitch(modalRole, password);
    setModalLoading(false);
    if (res.success) { const r = modalRole; closeModal(); router.push(getLandingPage(r)); }
    else setModalError(res.message || "Invalid password.");
  };

  const closeModal = () => { setModalRole(null); setPassword(""); setModalError(""); setShowPassword(false); setModalLoading(false); };
  const close = () => { setOpen(false); setSwitching(null); };
  const modalAccount = modalRole ? otherAccounts.find((a) => a.role === modalRole) : null;

  return (
    <>
      <div className="relative">
        <button onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-secondary-400 transition-colors w-full px-1">
          <Repeat size={16} />Switch Account
        </button>
        {open && typeof document !== "undefined" && createPortal(
          <div data-sidebar-portal="switch-account" className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={close} />
            <div className="relative glass border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Switch to</p>
                <button onClick={close} className="text-gray-400 hover:text-white transition-colors"><X size={18} /></button>
              </div>
              <div className="space-y-2">
                {otherAccounts.map((acct) => {
                  const label = acct.role === "admin" ? acct.entity_type || acct.account_type || "Admin" : acct.user_type || ROLE_LABELS[acct.role] || acct.role;
                  return (
                    <div key={acct.role} className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                      <Avatar
                        firstName={acct.first_name}
                        lastName={acct.last_name}
                        profileImage={(acct as any).profile_image}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{acct.first_name} {acct.last_name}</p>
                        <p className="text-xs text-gray-500">{label}</p>
                      </div>
                      <button disabled={!!switching} onClick={() => handleSwitch(acct.role)}
                        className="px-3 py-1 text-xs bg-secondary-500/20 text-secondary-400 rounded-lg hover:bg-secondary-500/30 transition-colors disabled:opacity-50">
                        {switching === acct.role ? <Loader2 size={12} className="animate-spin" /> : "Switch"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>, document.body
        )}
      </div>
      {modalRole && modalAccount && typeof document !== "undefined" && createPortal(
        <div data-sidebar-portal="switch-account" className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={closeModal} />
          <div className="relative glass border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={18} /></button>
            <div className="flex items-center gap-3 mb-5">
              <Avatar
                firstName={modalAccount.first_name}
                lastName={modalAccount.last_name}
                profileImage={(modalAccount as any).profile_image}
                size="md"
              />
              <div>
                <p className="text-sm text-white font-medium">{modalAccount.first_name} {modalAccount.last_name}</p>
                <p className="text-xs text-gray-500">{modalRole === "admin" ? modalAccount.entity_type || modalAccount.account_type || "Admin" : modalAccount.user_type || ROLE_LABELS[modalRole] || modalRole}</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-4">Enter the password for this account to switch.</p>
            <div className="relative mb-4">
              <input type={showPassword ? "text" : "password"} value={password}
                onChange={(e) => { setPassword(e.target.value); setModalError(""); }}
                placeholder="Password" autoFocus
                className="w-full px-4 py-3 pr-10 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-secondary-500/50 transition-colors"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleModalSubmit(); } }} />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {modalError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2.5 mb-4">
                <p className="text-xs text-red-400">{modalError}</p>
              </div>
            )}
            <button type="button" onClick={handleModalSubmit} disabled={modalLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-secondary-500 hover:bg-secondary-600 disabled:opacity-50 text-primary-950 font-semibold rounded-lg text-sm transition-all">
              {modalLoading ? <Loader2 size={16} className="animate-spin" /> : "Switch Account"}
            </button>
          </div>
        </div>, document.body
      )}
    </>
  );
}

export default function Sidebar() {
  const { admin, accounts, isLoading, logout, switchAccount, accessToken } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const asideRef = useRef<HTMLElement | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [flyoutSectionLabel, setFlyoutSectionLabel] = useState<string | null>(null);
  const [openSectionLabel, setOpenSectionLabel] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notices, setNotices] = useState<any[]>([]);
  const [loadingNotices, setLoadingNotices] = useState(false);
  const desktopNotifButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileNotifButtonRef = useRef<HTMLButtonElement | null>(null);
  const notifPopupRef = useRef<HTMLDivElement | null>(null);
  const [popupPos, setPopupPos] = useState<{ left: number; top: number } | null>(null);
  const [hasCompanyLink, setHasCompanyLink] = useState(false);

  useEffect(() => {
    if (!accessToken || admin?.entity_type !== "Supplier") { setHasCompanyLink(false); return; }
    let cancelled = false;
    void linksApi.getMyLinks(accessToken).then((res) => {
      if (cancelled) return;
      const links = res.success && res.data
        ? ((res.data as { links?: { status: string; requester_type: string; target_type: string }[] }).links ?? [])
        : [];
      setHasCompanyLink(hasAcceptedCompanySupplierLink(links));
    });
    return () => { cancelled = true; };
  }, [accessToken, admin?.entity_type, pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (collapsed) return;
    if (sidebarOpen) return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const asideEl = asideRef.current;
      if (!asideEl) return;
      const target = e.target as Node | null;
      if (target && (notifPopupRef.current?.contains(target) || desktopNotifButtonRef.current?.contains(target) || mobileNotifButtonRef.current?.contains(target))) return;
      if (target && target instanceof Element && target.closest('[data-sidebar-portal="switch-account"]')) return;
      if (target && asideEl.contains(target)) return;
      window.setTimeout(() => { setCollapsed(true); setFlyoutSectionLabel(null); }, 0);
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [collapsed, sidebarOpen]);

  useEffect(() => {
    const openFromBottomNav = () => setSidebarOpen(true);
    window.addEventListener("open-mobile-sidebar", openFromBottomNav);
    return () => window.removeEventListener("open-mobile-sidebar", openFromBottomNav);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!sidebarOpen) return;
    if (window.matchMedia("(max-width: 1023px)").matches) setCollapsed(false);
  }, [sidebarOpen]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (t && (notifPopupRef.current?.contains(t) || desktopNotifButtonRef.current?.contains(t) || mobileNotifButtonRef.current?.contains(t))) return;
      setNotificationsOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [notificationsOpen]);

  const loadNotices = async () => {
    if (!accessToken || admin?.role === "admin") return;
    setLoadingNotices(true);
    try {
      const res = await noticeApi.getMyNotices(accessToken);
      if (res.success && res.data) setNotices(res.data.notices || []);
      else setNotices([]);
    } catch { setNotices([]); }
    setLoadingNotices(false);
  };

  useEffect(() => {
    if (accessToken && admin?.role !== "admin") void loadNotices();
  }, [accessToken, admin?.role]);

  const updateNoticeState = async (action: "read" | "unread" | "delete", n: any) => {
    if (!accessToken || !n?.id) return;
    try {
      if (action === "read") {
        await noticeApi.markRead(accessToken, Number(n.id));
        setNotices((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: true } : x));
      } else if (action === "unread") {
        await noticeApi.markUnread(accessToken, Number(n.id));
        setNotices((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: false } : x));
      } else {
        await noticeApi.deleteMine(accessToken, Number(n.id));
        setNotices((prev) => prev.filter((x) => x.id !== n.id));
      }
    } catch { /* no-op */ }
  };

  const navKey = resolveNavKey(admin?.role ?? "", admin?.account_type);
  const navEntries = useMemo(() => {
    const base = NAV_CONFIG[navKey] ?? [];
    if (navKey !== "admin:Customer" || !hasCompanyLink || admin?.entity_type !== "Supplier") return base;
    return base.map((entry) => {
      if (isTopLevel(entry) || !("items" in entry)) return entry;
      if (entry.label === "Structure") {
        const orgItems = entry.items.filter((i) => i.label === "Org Tree" || i.label === "Links");
        const coreItems = entry.items.filter((i) => i.label !== "Org Tree" && i.label !== "Links");
        // Linked Company itself (read-only) + its sub-structure, before Org Tree/Links.
        const companyItem: NavItem = { label: "Company", path: "/structure/list?type=company", icon: Building2 };
        return { ...entry, items: [...coreItems, companyItem, ...stripOrgLevel(COMPANY_STRUCTURE_NAV_ITEMS), ...orgItems] };
      }
      if (entry.label === "Users") {
        // Linked Company's admin shown as a read-only "Company Head" + company sub-heads.
        const companyHeadItem: NavItem = { label: "Company Heads", path: "/users/list?type=company-heads", icon: Users };
        return { ...entry, items: [...entry.items, companyHeadItem, ...stripOrgLevel(COMPANY_USER_NAV_ITEMS)] };
      }
      return entry;
    });
  }, [navKey, hasCompanyLink, admin?.entity_type]);

  if (isLoading || !admin) return null;

  const orgLevel = admin.org_level ?? Infinity;
  const accountLabel = admin.role === "admin"
    ? admin.entity_type || admin.account_type || "Admin"
    : admin.user_type ?? ROLE_LABELS[admin.role] ?? admin.role;

  const closeMobile = () => setSidebarOpen(false);
  const closeFlyout = () => setFlyoutSectionLabel(null);
  const handleLogout = async () => { await logout(); router.push("/login"); };

  const navLinkClass = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${active
      ? "bg-primary-500/15 text-secondary-400 font-medium"
      : "text-gray-400 hover:text-white hover:bg-white/5"
    }`;

  return (
    <>
      {/* Mobile header */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 backdrop-blur-md border-b border-white/10 flex items-center px-4"
        style={{ background: "linear-gradient(90deg, #003F2D 0%, #003F2D 50%, #003F2D 100%)" }}
      >
        <button onClick={() => { setCollapsed(false); setSidebarOpen(true); }} className="text-gray-400 hover:text-white">
          <Menu size={22} />
        </button>
        <Image src={auditoLogo} alt="Audito" width={90} height={20} className="h-5 ml-3" />
        <div className="ml-auto flex items-center gap-1">
          <button ref={mobileNotifButtonRef}
            onClick={async () => {
              setNotificationsOpen((p) => {
                const next = !p;
                if (next && mobileNotifButtonRef.current) {
                  const rect = mobileNotifButtonRef.current.getBoundingClientRect();
                  setPopupPos({ left: Math.max(10, rect.left - 260), top: rect.bottom + 8 });
                }
                if (!p && notices.length === 0) void loadNotices();
                return next;
              });
            }}
            className="h-9 w-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-all relative"
          >
            <Bell size={18} />
            {notices.some((n) => !(n as any).is_read) && (
              <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-primary-950" />
            )}
          </button>
          <Link href="/profile" className="h-9 w-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-all">
            {/* Show profile image or fallback icon in mobile header */}
            {(admin as any).profile_image
              ? <img src={getAvatarUrl((admin as any).profile_image) || ""} alt="" className="w-6 h-6 rounded-full object-cover" />
              : <UserCircle2 size={19} />
            }
          </Link>
        </div>
      </header>

      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={closeMobile} />}

      <aside
        ref={asideRef}
        className={`fixed lg:sticky lg:top-0 lg:h-screen inset-y-0 left-0 z-[80]
          ${collapsed ? "lg:w-[72px]" : "lg:w-64"} w-64
          glass border-r border-white/10 flex flex-col transition-all
          lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Logo */}
        <div className={`h-16 flex items-center border-b border-white/10 ${collapsed ? "px-2 justify-center" : "px-5 justify-between"}`}>
          <div className="flex items-center gap-2">
            {!collapsed && (
              <Link href="/dashboard"><Image src={auditoLogo} alt="Audito" width={90} height={20} className="h-6" /></Link>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!collapsed && (
              <button ref={desktopNotifButtonRef}
                onClick={async () => {
                  setNotificationsOpen((p) => {
                    const next = !p;
                    if (next && desktopNotifButtonRef.current) {
                      const rect = desktopNotifButtonRef.current.getBoundingClientRect();
                      setPopupPos({ left: rect.left, top: rect.bottom + 8 });
                    }
                    if (!p && notices.length === 0) void loadNotices();
                    return next;
                  });
                }}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors relative"
              >
                <Bell size={17} />
                {notices.some((n) => !(n as any).is_read) && (
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-primary-950" />
                )}
              </button>
            )}
            <button onClick={() => { setCollapsed((p) => !p); closeFlyout(); }}
              className="hidden lg:inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </div>
          <button onClick={closeMobile} className="lg:hidden text-gray-400 hover:text-white"><X size={20} /></button>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 py-4 space-y-1 overflow-y-auto sidebar-scroll ${collapsed ? "px-2" : "px-3"}`}>
          {navEntries.map((entry, idx) => {
            if (isTopLevel(entry)) {
              if (entry.planFeature && admin.plan_limits && !admin.plan_limits[entry.planFeature]) return null;
              const Icon = entry.icon;
              const active = entry.matchPrefix ? pathname.startsWith(entry.path) : pathname === entry.path;
              return (
                <Link key={entry.path + idx} href={entry.path}
                  className={collapsed
                    ? `flex items-center justify-center h-11 rounded-lg transition-all ${active ? "bg-primary-500/15 text-secondary-400" : "text-gray-400 hover:text-white hover:bg-white/5"}`
                    : navLinkClass(active)}
                  onClick={(e) => {
                    if (collapsed) { e.preventDefault(); setCollapsed(false); setFlyoutSectionLabel(null); return; }
                    closeMobile(); closeFlyout();
                  }}
                  title={collapsed ? entry.label : undefined}>
                  <Icon size={18} />
                  {!collapsed && entry.label}
                </Link>
              );
            }

            if (!collapsed) {
              const visibleItems = filterByOrgLevel(entry.items, orgLevel, admin.plan_limits, admin.entity_type);
              const isChildActive = visibleItems.some((item) => pathname === item.path);
              const isOpen = openSectionLabel === entry.label || (openSectionLabel === null && isChildActive);
              return (
                <DropdownSection key={entry.label + idx} section={entry} pathname={pathname} orgLevel={orgLevel}
                  planLimits={admin.plan_limits} entityType={admin.entity_type} onNavigate={() => { closeMobile(); closeFlyout(); }}
                  open={isOpen} onToggle={() => setOpenSectionLabel((prev) => prev === entry.label ? null : entry.label)}
                />
              );
            }

            const SectionIcon = entry.icon;
            const visibleItems = filterByOrgLevel(entry.items, orgLevel, admin.plan_limits, admin.entity_type);
            const isChildActive = visibleItems.some((item) => pathname === item.path);
            const isOpen = flyoutSectionLabel === entry.label;
            return (
              <div key={entry.label + idx} className="relative">
                <button type="button"
                  onClick={() => {
                    if (collapsed) { setCollapsed(false); setFlyoutSectionLabel(null); return; }
                    setFlyoutSectionLabel((p) => (p === entry.label ? null : entry.label));
                  }}
                  className={`w-full flex items-center justify-center h-11 rounded-lg transition-all ${isChildActive ? "bg-primary-500/15 text-secondary-400" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
                  title={entry.label}>
                  <SectionIcon size={18} />
                </button>
                {isOpen && <div className="hidden lg:block fixed inset-0 z-[60]" onClick={closeFlyout} />}
                {isOpen && (
                  <div className="hidden lg:block absolute left-[72px] top-0 z-[70]">
                    <CollapsedSectionFlyout section={entry} pathname={pathname} orgLevel={orgLevel}
                      entityType={admin.entity_type} onNavigate={closeMobile} onClose={closeFlyout} />
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User footer */}
        <div className={`border-t border-white/10 ${collapsed ? "p-3" : "p-4"}`}>
          <Link href="/profile"
            className={`flex items-center gap-3 mb-3 group cursor-pointer ${collapsed ? "justify-center" : ""}`}
            onClick={(e) => {
              if (collapsed) { e.preventDefault(); setCollapsed(false); setFlyoutSectionLabel(null); return; }
              closeMobile(); closeFlyout();
            }}
            title={collapsed ? `${admin.first_name} ${admin.last_name}` : undefined}>

            {/* ── Profile avatar: image if set, else initials ── */}
            <Avatar
              firstName={admin.first_name}
              lastName={admin.last_name}
              profileImage={(admin as any).profile_image}
            />

            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate group-hover:text-secondary-400 transition-colors">
                  {admin.first_name} {admin.last_name}
                </p>
                <p className="text-xs text-gray-500 truncate">{accountLabel}</p>
              </div>
            )}
          </Link>

          {accounts.length > 1 && (
            <div className="mb-2">
              {collapsed ? (
                <button type="button"
                  onClick={() => { setCollapsed(false); setFlyoutSectionLabel(null); }}
                  className="w-full flex items-center justify-center h-10 rounded-lg text-gray-400 hover:text-secondary-400 hover:bg-white/5 transition-colors"
                  title="Switch Account">
                  <Repeat size={16} />
                </button>
              ) : (
                <AccountSwitcher accounts={accounts} currentRole={admin.role} onSwitch={switchAccount} />
              )}
            </div>
          )}

          <button type="button"
            onClick={() => {
              if (collapsed) { setCollapsed(false); setFlyoutSectionLabel(null); return; }
              void handleLogout();
            }}
            className={collapsed
              ? "w-full flex items-center justify-center h-10 rounded-lg text-gray-400 hover:text-red-400 hover:bg-white/5 transition-colors"
              : "flex items-center gap-2 text-sm text-gray-400 hover:text-red-400 transition-colors w-full px-1"}
            title={collapsed ? "Sign Out" : undefined}>
            <LogOut size={16} />
            {!collapsed && "Sign Out"}
          </button>
        </div>
      </aside>

      {/* Notifications popup */}
      {notificationsOpen && typeof document !== "undefined" && createPortal(
        <div ref={notifPopupRef}
          style={{ position: "absolute", left: popupPos?.left ?? 0, top: popupPos?.top ?? 0 }}
          className="w-80 max-h-[60vh] overflow-auto rounded-xl border border-white/10 glass p-3 z-[9999] shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white font-medium">Notifications</span>
            <button onClick={() => setNotificationsOpen(false)} className="text-gray-400 hover:text-white"><X size={14} /></button>
          </div>
          {loadingNotices ? (
            <div className="py-6 flex items-center justify-center text-gray-400">Loading...</div>
          ) : notices.length === 0 ? (
            <div className="py-6 text-center text-gray-500">No notifications</div>
          ) : (
            <div className="space-y-2">
              {notices.map((n, i) => (
                <div key={`${(n as any).id || i}`} className={`p-2 rounded-lg hover:bg-white/5 ${(n as any).is_read ? "opacity-80" : ""}`}>
                  <p className="text-sm text-white truncate flex items-center gap-2">
                    {!(n as any).is_read && <span className="w-1.5 h-1.5 rounded-full bg-secondary-400 shrink-0" />}
                    {(n as any).title || (n as any).message || "Notification"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{(n as any).created_at ? new Date((n as any).created_at).toLocaleString() : ""}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <button onClick={() => void updateNoticeState((n as any).is_read ? "unread" : "read", n)}
                      className="text-[11px] px-2 py-1 rounded border border-white/10 text-gray-300 hover:text-white hover:border-white/20">
                      {(n as any).is_read ? "Mark as unread" : "Mark as read"}
                    </button>
                    <button onClick={() => void updateNoticeState("delete", n)}
                      className="text-[11px] px-2 py-1 rounded border border-red-500/30 text-red-300 hover:text-red-200 hover:border-red-400/50">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>, document.body
      )}
    </>
  );
}