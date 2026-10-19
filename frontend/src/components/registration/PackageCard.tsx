import { formatMoney } from "@/lib/registration/workspaceOptions";
import LevelChips from "./LevelChips";
import { Skeleton, focusRing } from "./ui";

export default function PackageCard({ name, tagline, levels, fee, selected, onSelect }: {
  name: string;
  tagline: string;
  levels: number;
  /** null while prices load. */
  fee: number | null;
  selected: boolean;
  onSelect: () => void;
}) {
  return <button type="button" aria-pressed={selected} onClick={onSelect}
    className={`w-full rounded-xl border px-3.5 py-3 text-left transition-colors ${selected ? "border-ws-gold bg-ws-raised" : "border-white/5 bg-ws-raised/60 hover:border-white/20"} ${focusRing}`}>
    <span className="flex items-baseline justify-between gap-3">
      <span className="min-w-0">
        <span className={`text-base font-bold ${selected ? "text-ws-gold" : "text-ws-ink"}`}>{name}</span>
        <span className="ml-2 text-xs text-ws-soft">{tagline}</span>
      </span>
      <span className={`shrink-0 text-base font-bold ${fee === 0 ? "text-ws-mint-soft" : "text-ws-ink"}`}>
        {fee === null ? <Skeleton className="h-4 w-12" /> : fee === 0 ? "Free" : `+${formatMoney(fee)}`}
      </span>
    </span>
    <LevelChips levels={levels} highlightTop={selected} />
  </button>;
}
