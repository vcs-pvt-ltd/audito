import type { LadderLevel } from "@/lib/registration/workspaceOptions";
import { focusRing } from "./ui";

/** Starting level picker: the selected level and every level below it are included. */
export default function LevelLadder({ levels, value, onChange }: { levels: LadderLevel[]; value: number; onChange: (level: number) => void }) {
  return <div role="group" aria-label="Starting level" className="flex flex-col gap-2">
    {levels.map((item) => {
      const selected = item.level === value;
      const included = item.level < value;
      const tone = selected ? "bg-ws-level text-ws-bg ring-2 ring-ws-gold" : included ? "bg-ws-level-in text-white hover:brightness-110" : "bg-ws-raised text-ws-soft hover:bg-ws-raised/70";
      return <button key={item.level} type="button" aria-pressed={selected} onClick={() => onChange(item.level)}
        className={`flex min-h-12 items-center gap-3 rounded-[10px] px-4 text-left transition ${tone} ${focusRing}`}>
        <span className={`w-5 text-[11px] font-bold ${selected ? "text-ws-gold-ink" : included ? "text-white" : "text-ws-gold"}`}>L{item.level}</span>
        <span className="flex-1 text-[15px] font-bold">{item.label}</span>
        <span className="text-xs font-bold">{selected ? "Starting level" : included ? "Included" : ""}</span>
      </button>;
    })}
  </div>;
}
