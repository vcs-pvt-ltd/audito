import { useId } from "react";
import { QUESTION_LIMITS, QUESTION_PRESETS, formatMoney } from "@/lib/registration/workspaceOptions";
import { Skeleton, focusRing } from "./ui";

export default function QuestionSlider({ value, onChange, cost, freeLines = 0 }: { value: number; onChange: (value: number) => void; cost: number | null; freeLines?: number }) {
  const id = useId();
  return <div>
    <div className="flex items-baseline justify-between gap-3">
      <label htmlFor={id} className="text-[15px] font-bold text-ws-ink">Audit questions</label>
      <span className="text-xs text-ws-soft">1 question = 1 credit</span>
    </div>
    <p className="mt-1.5 flex items-baseline gap-2">
      <span className="text-[28px] font-extrabold leading-none tabular-nums text-ws-ink">{value.toLocaleString("en-US")}</span>
      <span className="text-sm text-ws-soft">questions · {cost === null ? <Skeleton className="h-3.5 w-10" /> : cost === 0 ? <span className="font-semibold text-ws-mint-soft">Free</span> : formatMoney(cost)}</span>
      {freeLines > 0 && <span className="rounded-md bg-ws-mint/15 px-2 py-0.5 text-[11px] font-bold text-ws-mint-soft">{freeLines} free</span>}
    </p>
    <input id={id} type="range" min={QUESTION_LIMITS.min} max={QUESTION_LIMITS.max} step={QUESTION_LIMITS.step} value={value}
      aria-valuetext={`${value.toLocaleString("en-US")} questions`} onChange={(event) => onChange(Number(event.target.value))}
      className={`mt-3 h-2 w-full cursor-pointer accent-ws-gold ${focusRing}`} />
    <div role="group" aria-label="Question presets" className="mt-3 flex flex-wrap gap-2">
      {QUESTION_PRESETS.map((preset) => {
        const active = preset === value;
        return <button key={preset} type="button" aria-pressed={active} onClick={() => onChange(preset)}
          className={`min-h-11 rounded-full border px-3.5 text-[13px] font-semibold tabular-nums transition-colors md:min-h-9 ${active ? "border-ws-gold bg-ws-gold text-ws-gold-ink" : "border-white/12 text-ws-soft hover:border-white/30 hover:text-ws-ink"} ${focusRing}`}>
          {preset.toLocaleString("en-US")}
        </button>;
      })}
    </div>
  </div>;
}
