"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Star, StarOff } from "lucide-react";
import { toggleHighlightAchievement } from "../actions";

const rarityColors: Record<string, string> = {
  COMMON:    "border-slate-600 bg-slate-800/40",
  UNCOMMON:  "border-[#7AC74C]/40 bg-[#7AC74C]/5",
  RARE:      "border-[#6390F0]/40 bg-[#6390F0]/5",
  EPIC:      "border-[#735797]/50 bg-[#735797]/10",
  LEGENDARY: "border-[#FFCB05]/50 bg-[#FFCB05]/5",
  SECRET:    "border-slate-700 bg-slate-900/50"
};

interface Props {
  achievements: Array<{
    id: string;
    name: string;
    rarity: string;
    iconUrl: string | null;
    isHighlighted: boolean;
    unlockedAt: string;
  }>;
}

export function MyAchievementsPanel({ achievements }: Props) {
  const [pending, startTransition] = useTransition();

  const highlighted = achievements.filter(a => a.isHighlighted);
  const rest = achievements.filter(a => !a.isHighlighted);

  const toggle = (id: string, current: boolean) => {
    startTransition(async () => {
      try {
        const result = await toggleHighlightAchievement(id, !current);
        if (result.error) { toast.error(result.error); return; }
        toast.success(current ? "Removido do destaque." : "Adicionado ao destaque!");
      } catch { toast.error("Erro."); }
    });
  };

  return (
    <div className="space-y-4">
      {/* Vitrine — até 3 em destaque */}
      {highlighted.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <Star size={12} className="text-[#FFCB05]" /> Em destaque no perfil ({highlighted.length}/3)
          </p>
          <div className="flex flex-wrap gap-3">
            {highlighted.map(a => (
              <div key={a.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${rarityColors[a.rarity]}`}>
                {a.iconUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.iconUrl} alt={a.name} className="h-6 w-6 object-contain" />
                )}
                <span className="text-sm font-semibold text-slate-200">{a.name}</span>
                <button type="button" disabled={pending} onClick={() => toggle(a.id, true)}
                  className="text-slate-500 hover:text-red-400 ml-1">
                  <StarOff size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Todas as conquistas */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Todas ({achievements.length})
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {achievements.map(a => (
            <div key={a.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${rarityColors[a.rarity]}`}>
              {a.iconUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.iconUrl} alt="" className="h-7 w-7 object-contain shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-200 truncate">{a.name}</p>
                <p className="text-[10px] text-slate-500">
                  {new Date(a.unlockedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                </p>
              </div>
              {!a.isHighlighted && highlighted.length < 3 && (
                <button type="button" disabled={pending} onClick={() => toggle(a.id, false)}
                  title="Adicionar ao destaque"
                  className="shrink-0 text-slate-600 hover:text-[#FFCB05] transition-colors">
                  <Star size={14} />
                </button>
              )}
              {a.isHighlighted && (
                <Star size={14} className="shrink-0 fill-[#FFCB05] text-[#FFCB05]" />
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-slate-600">
          Clique ⭐ para destacar até 3 conquistas no seu perfil público.
        </p>
      </div>
    </div>
  );
}
