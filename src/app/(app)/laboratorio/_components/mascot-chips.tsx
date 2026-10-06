import { PERFORMANCE_META, normalizePerformanceTag } from "@/lib/mascot-performance";
import { shortMascotCode } from "@/lib/mascot-data";

export type MascotStats = { force: number; agility: number; charisma: number; instinct: number; vitality: number };

const STAT_COLS = [
  ["force", "FOR", "text-red-300"],
  ["agility", "AGI", "text-yellow-300"],
  ["charisma", "CAR", "text-pink-300"],
  ["instinct", "INS", "text-cyan-300"],
  ["vitality", "VIT", "text-emerald-300"],
] as const;

export const statsTotal = (s: MascotStats) => s.force + s.agility + s.charisma + s.instinct + s.vitality;

export function CodeChip({ id }: { id: string }) {
  return (
    <span className="rounded border border-slate-600/60 bg-slate-950/60 px-1 py-px font-mono text-[8px] font-bold tracking-wider text-slate-300" title={`ID único: ${id}`}>
      #{shortMascotCode(id)}
    </span>
  );
}

export function TagChip({ tag }: { tag?: string | null }) {
  const meta = PERFORMANCE_META[normalizePerformanceTag(tag)];
  return (
    <span className={`inline-flex items-center gap-0.5 rounded border px-1 py-px text-[8px] font-bold ${meta.badge}`} title={meta.description}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${meta.dot}`} />{meta.label}
    </span>
  );
}

// Faixa compacta com os 5 atributos + total.
export function StatStrip({ stats, size = "sm" }: { stats?: MascotStats | null; size?: "sm" | "md" }) {
  if (!stats) return null;
  const md = size === "md";
  return (
    <div className="w-full">
      <div className="grid grid-cols-5 gap-px">
        {STAT_COLS.map(([key, label, color]) => (
          <div key={key} className="min-w-0 text-center leading-none">
            <p className={`${md ? "text-[9px]" : "text-[7px]"} font-bold text-slate-500`}>{label}</p>
            <p className={`${md ? "mt-0.5 text-sm" : "mt-px text-[10px]"} font-black tabular-nums ${color}`}>{stats[key]}</p>
          </div>
        ))}
      </div>
      <p className={`${md ? "mt-1.5 text-[11px]" : "mt-1 text-[8px]"} text-center text-slate-500`}>
        Total <strong className="tabular-nums text-slate-300">{statsTotal(stats)}</strong>
      </p>
    </div>
  );
}
