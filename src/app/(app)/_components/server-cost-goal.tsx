import { Server, TrendingUp } from "lucide-react";

export function ServerCostGoal({ title, percentage }: {
  title: string;
  percentage: number;
}) {
  const progress = Math.min(100, Math.max(0, Math.round(percentage)));

  return (
    <section className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-gradient-to-r from-emerald-950/35 via-slate-950/80 to-cyan-950/30 p-4 shadow-[0_16px_45px_rgba(2,6,23,0.25)] sm:p-5" aria-label={`${title}: ${progress}%`}>
      <div className="pointer-events-none absolute -right-10 -top-16 h-36 w-36 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="relative flex items-center gap-3 sm:gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-300 sm:h-12 sm:w-12">
          <Server size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300/75 sm:text-[10px]">Apoio da comunidade</p>
              <h2 className="truncate text-sm font-bold text-slate-100 sm:text-base" title={title}>{title}</h2>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 text-emerald-300">
              <TrendingUp size={14} />
              <span className="text-lg font-black tabular-nums sm:text-xl">{progress}%</span>
            </div>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full border border-white/5 bg-slate-950/90 sm:h-3">
            <div className="relative h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-[#FFCB05] shadow-[0_0_12px_rgba(52,211,153,0.45)] transition-[width] duration-700" style={{ width: `${progress}%` }}>
              <div className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
