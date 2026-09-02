import { Server } from "lucide-react";

export function ServerCostGoal({ title, percentage, compact = false }: {
  title: string;
  percentage: number;
  compact?: boolean;
}) {
  const progress = Math.min(100, Math.max(0, Math.round(percentage)));

  return (
    <div className={compact
      ? "mx-auto flex max-w-[1536px] items-center gap-2 px-3 py-1.5 sm:px-6"
      : "min-w-0 w-44 shrink-0 2xl:w-52"
    } title={`${title}: ${progress}%`}>
      {compact && <Server size={12} className="shrink-0 text-emerald-300" />}
      <div className="min-w-0 flex-1">
        <div className={`flex items-center justify-between gap-2 font-bold ${compact ? "text-[9px]" : "mb-1 text-[9px]"}`}>
          <span className="truncate text-slate-300">{title}</span>
          <span className="shrink-0 text-emerald-300">{progress}%</span>
        </div>
        <div className={`${compact ? "mt-1 h-1" : "h-1.5"} overflow-hidden rounded-full border border-white/5 bg-slate-950/80`}>
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-[#FFCB05] shadow-[0_0_8px_rgba(52,211,153,0.45)]" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}
