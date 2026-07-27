import { BookOpen, ChevronDown, PawPrint } from "lucide-react";
import type { ProfileCollectionProgress } from "@/lib/profile-collection-progress";

function ProgressBar({ value, total, color }: { value: number; total: number; color: string }) {
  const percentage = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${percentage}%` }} />
      </div>
      <p className="mt-1 text-[10px] text-slate-500">{percentage}% concluído</p>
    </div>
  );
}

export function ProfileCollectionProgressPanel({
  progress,
  ownerName,
}: {
  progress: ProfileCollectionProgress;
  ownerName: string;
}) {
  if (progress.total === 0) return null;

  return (
    <details className="group overflow-hidden rounded-2xl border border-border bg-slate-950/60">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 marker:hidden">
        <div>
          <h2 className="text-sm font-semibold text-white">Pokédex e Álbum de Figurinhas</h2>
          <p className="mt-1 text-xs text-slate-500">Progresso de coleção de {ownerName}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-right text-[10px] text-slate-500 sm:block">
            <strong className="block text-xs text-cyan-300">{progress.mascots}/{progress.total}</strong>
            Pokédex
          </span>
          <span className="hidden text-right text-[10px] text-slate-500 sm:block">
            <strong className="block text-xs text-[#FFCB05]">{progress.stickers}/{progress.total}</strong>
            Figurinhas
          </span>
          <ChevronDown size={18} className="text-slate-500 transition-transform group-open:rotate-180" />
        </div>
      </summary>

      <div className="border-t border-border/60 p-5">
        <div className="mb-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-cyan-200"><PawPrint size={13} /> Pokédex</span>
              <strong className="text-white">{progress.mascots}/{progress.total}</strong>
            </div>
            <ProgressBar value={progress.mascots} total={progress.total} color="bg-gradient-to-r from-cyan-400 to-purple-400" />
          </div>
          <div className="rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-[#FFCB05]"><BookOpen size={13} /> Álbum</span>
              <strong className="text-white">{progress.stickers}/{progress.total}</strong>
            </div>
            <ProgressBar value={progress.stickers} total={progress.total} color="bg-gradient-to-r from-[#FFCB05] to-[#7AC74C]" />
          </div>
        </div>

        <p className="mb-3 text-xs font-semibold text-slate-300">Progresso por geração</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {progress.generations.map((row) => (
            <div key={row.generation} className="rounded-xl border border-border/70 bg-slate-950 p-3">
              <div className="mb-2 flex items-center justify-between">
                <strong className="text-xs text-white">Geração {row.generation}</strong>
                <span className="text-[10px] text-slate-500">{row.stickers}/{row.total} figurinhas</span>
              </div>
              <div className="space-y-2">
                <ProgressBar value={row.stickers} total={row.total} color="bg-[#FFCB05]" />
                <div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>Mascotes descobertos</span><span>{row.mascots}/{row.total}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-cyan-400" style={{ width: `${row.total > 0 ? Math.min(100, (row.mascots / row.total) * 100) : 0}%` }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
