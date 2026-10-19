import { COMPANY_LEVEL_NAMES } from "@/lib/registration/workspaceOptions";

/** L1–L5 company levels: included levels in green, the rest struck through. */
export default function LevelChips({ levels, highlightTop = false }: { levels: number; highlightTop?: boolean }) {
  return <span className="mt-2 flex flex-wrap gap-1.5">
    {COMPANY_LEVEL_NAMES.map((name, index) => {
      const level = index + 1;
      const included = level <= levels;
      const tone = !included ? "bg-white/5 text-ws-muted line-through" : highlightTop && level === levels ? "bg-ws-level text-ws-bg" : "bg-ws-level-in text-white";
      return <span key={name} className={`rounded-md px-2 py-1 text-[11px] font-bold leading-none ${tone}`}>
        L{level} {name}{!included && <span className="sr-only"> (not included)</span>}
      </span>;
    })}
  </span>;
}
