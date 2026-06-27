"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Minus, Egg, Cookie } from "lucide-react";
import { grantEggToPlayer, revokeEggFromPlayer, grantFoodToPlayer, revokeFoodFromPlayer } from "../actions";

const EGG_TYPES = [
  { value: "COMMON", label: "Comum" },
  { value: "RARE", label: "Raro" },
  { value: "SPECIAL", label: "Especial" },
  { value: "EVENT", label: "Evento" },
  { value: "LAB", label: "Laboratório" },
];

type PlayerEgg = { id: string; type: string; obtainedAt: string; origin: string | null };
type PlayerFood = { type: string; quantity: number };

export function AdminEggFoodPanel({
  playerId,
  eggs,
  foods,
}: {
  playerId: string;
  eggs: PlayerEgg[];
  foods: PlayerFood[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [eggType, setEggType] = useState("COMMON");
  const [eggQty, setEggQty] = useState(1);
  const [foodQty, setFoodQty] = useState(1);

  const grant = (type: "egg" | "food" | "sweet") => {
    startTransition(async () => {
      try {
        const res = type === "egg"
          ? await grantEggToPlayer(playerId, eggType, eggQty)
          : await grantFoodToPlayer(playerId, type === "food" ? "FOOD" : "SWEET", foodQty);
        if (res.error) { toast.error(res.error); return; }
        toast.success(`Concedido!`);
        router.refresh();
      } catch { toast.error("Erro"); }
    });
  };

  const revokeEgg = (eggId: string) => {
    if (!confirm("Remover este ovo?")) return;
    startTransition(async () => {
      try {
        const res = await revokeEggFromPlayer(playerId, eggId);
        if (res.error) { toast.error(res.error); return; }
        toast.success("Ovo removido.");
        router.refresh();
      } catch { toast.error("Erro"); }
    });
  };

  const revokeFood = (foodType: "FOOD" | "SWEET") => {
    startTransition(async () => {
      try {
        const res = await revokeFoodFromPlayer(playerId, foodType, foodQty);
        if (res.error) { toast.error(res.error); return; }
        toast.success("Removido.");
        router.refresh();
      } catch { toast.error("Erro"); }
    });
  };

  const eggCounts = EGG_TYPES.map(t => ({
    ...t,
    count: eggs.filter(e => e.type === t.value).length,
  }));

  const foodCount = foods.find(f => f.type === "FOOD")?.quantity ?? 0;
  const sweetCount = foods.find(f => f.type === "SWEET")?.quantity ?? 0;

  return (
    <div className="rounded-2xl border border-border bg-slate-950/50 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Egg size={16} className="text-[#FFCB05]" />
        <h3 className="font-semibold text-slate-200">Gerenciar Ovos e Comida</h3>
      </div>

      {/* Grant egg */}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-[10px] text-slate-500">Tipo de Ovo</label>
          <select value={eggType} onChange={e => setEggType(e.target.value)}
            className="block w-full rounded-lg border border-border bg-slate-900 px-2 py-1.5 text-xs text-slate-200">
            {EGG_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-500">Qtd</label>
          <input type="number" min={1} max={20} value={eggQty} onChange={e => setEggQty(Math.max(1, +e.target.value))}
            className="block w-16 rounded-lg border border-border bg-slate-900 px-2 py-1.5 text-xs text-slate-200 text-center" />
        </div>
        <button onClick={() => grant("egg")} disabled={pending}
          className="rounded-lg bg-[#FFCB05] px-3 py-1.5 text-xs font-bold text-[#1A1A2E] disabled:opacity-40">
          <Plus size={12} className="inline mr-1" />Conceder Ovo
        </button>
      </div>

      {/* Current eggs */}
      <div className="space-y-1">
        <p className="text-[10px] font-bold text-slate-500 uppercase">Ovos do jogador ({eggs.length})</p>
        {eggCounts.filter(t => t.count > 0).length === 0 ? (
          <p className="text-[10px] text-slate-600">Nenhum ovo.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {eggCounts.filter(t => t.count > 0).map(t => (
              <span key={t.value} className="rounded-full border border-border bg-slate-900 px-2 py-0.5 text-[10px] text-slate-300">
                🥚 {t.label} ×{t.count}
              </span>
            ))}
          </div>
        )}
        {eggs.length > 0 && (
          <details className="mt-1">
            <summary className="cursor-pointer text-[10px] text-slate-600 hover:text-slate-400">Ver todos e remover individualmente ▾</summary>
            <div className="mt-1 max-h-40 overflow-y-auto space-y-1">
              {eggs.map(egg => (
                <div key={egg.id} className="flex items-center justify-between rounded-lg bg-slate-900/40 px-2 py-1">
                  <span className="text-[10px] text-slate-300">🥚 {EGG_TYPES.find(t => t.value === egg.type)?.label ?? egg.type} · {egg.origin ?? "?"}</span>
                  <button onClick={() => revokeEgg(egg.id)} disabled={pending}
                    className="text-[10px] text-red-400 hover:text-red-300 disabled:opacity-40">
                    <Minus size={10} className="inline" /> Remover
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Food */}
      <div className="space-y-2 border-t border-border/40 pt-3">
        <div className="flex items-center gap-2">
          <Cookie size={14} className="text-orange-400" />
          <p className="text-[10px] font-bold text-slate-500 uppercase">Comida e Doces</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] text-slate-300">
          <span>🍖 Comida: ×{foodCount}</span>
          <span>🍬 Doce: ×{sweetCount}</span>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-[10px] text-slate-500">Qtd</label>
            <input type="number" min={1} max={99} value={foodQty} onChange={e => setFoodQty(Math.max(1, +e.target.value))}
              className="block w-16 rounded-lg border border-border bg-slate-900 px-2 py-1.5 text-xs text-slate-200 text-center" />
          </div>
          <button onClick={() => grant("food")} disabled={pending}
            className="rounded-lg border border-green-500/30 bg-green-500/10 px-2 py-1.5 text-[10px] font-bold text-green-300 disabled:opacity-40">
            <Plus size={10} className="inline mr-0.5" />Comida
          </button>
          <button onClick={() => grant("sweet")} disabled={pending}
            className="rounded-lg border border-pink-500/30 bg-pink-500/10 px-2 py-1.5 text-[10px] font-bold text-pink-300 disabled:opacity-40">
            <Plus size={10} className="inline mr-0.5" />Doce
          </button>
          <button onClick={() => revokeFood("FOOD")} disabled={pending || foodCount === 0}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[10px] font-bold text-red-300 disabled:opacity-40">
            <Minus size={10} className="inline mr-0.5" />Comida
          </button>
          <button onClick={() => revokeFood("SWEET")} disabled={pending || sweetCount === 0}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[10px] font-bold text-red-300 disabled:opacity-40">
            <Minus size={10} className="inline mr-0.5" />Doce
          </button>
        </div>
      </div>
    </div>
  );
}
