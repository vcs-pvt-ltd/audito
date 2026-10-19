import { LayoutGrid, UserRound, Warehouse, type LucideIcon } from "lucide-react";
import { ACCOUNT_TYPES, type AccountTypeKey } from "@/lib/registration/workspaceOptions";
import { focusRing } from "./ui";

const ICONS: Record<AccountTypeKey, LucideIcon> = { customer: Warehouse, company: LayoutGrid, audit_firm: UserRound };

export default function AccountTypeSelector({ value, onChange }: { value: AccountTypeKey; onChange: (value: AccountTypeKey) => void }) {
  return <div role="group" aria-label="Account type" className="grid gap-2.5 sm:grid-cols-3 sm:gap-3">
    {ACCOUNT_TYPES.map((type) => {
      const Icon = ICONS[type.key];
      const active = value === type.key;
      return <button key={type.key} type="button" aria-pressed={active} onClick={() => onChange(type.key)}
        className={`flex min-h-[60px] items-center gap-3 rounded-[14px] border px-3.5 py-2.5 text-left transition-colors ${active ? "border-ws-gold bg-ws-gold/12" : "border-white/8 bg-ws-panel hover:border-white/20"} ${focusRing}`}>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] ${active ? "bg-ws-gold/20 text-ws-gold" : "bg-ws-raised text-ws-soft"}`}><Icon size={17} aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className={`block text-[15px] font-bold ${active ? "text-ws-gold" : "text-ws-ink"}`}>{type.label}</span>
          <span className="block truncate text-xs text-ws-muted">{type.description}</span>
        </span>
        <span className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-bold ${type.badge === "Buy online" ? "bg-ws-mint/15 text-ws-mint-soft" : "bg-white/8 text-ws-soft"}`}>{type.badge}</span>
      </button>;
    })}
  </div>;
}
