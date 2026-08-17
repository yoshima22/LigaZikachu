import Link from "next/link";

// Abas do topo da área de torneios: "Torneios TCG" e "Zika TV".
// A aba Zika TV ganha a tag "Ao vivo" quando há alguma transmissão acontecendo.
export function ZikaTvTabs({ active, liveNow }: { active: "torneios" | "zikatv"; liveNow: boolean }) {
  const base = "relative inline-flex items-center gap-2 rounded-t-xl border-b-2 px-4 py-2 text-sm font-black transition-colors";
  return (
    <div className="flex items-end gap-1 border-b border-border">
      <Link
        href="/torneios"
        className={`${base} ${active === "torneios" ? "border-[#FFCB05] text-[#FFCB05]" : "border-transparent text-slate-400 hover:text-slate-200"}`}
      >
        🏆 Torneios TCG
      </Link>
      <Link
        href="/spec"
        className={`${base} ${active === "zikatv" ? "border-[#FFCB05] text-[#FFCB05]" : "border-transparent text-slate-400 hover:text-slate-200"}`}
      >
        📺 Zika TV
        {liveNow && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-red-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" /> Ao vivo
          </span>
        )}
      </Link>
    </div>
  );
}
