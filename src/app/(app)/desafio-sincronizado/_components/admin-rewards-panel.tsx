import { EggType } from "@prisma/client";
import { Gift, Save } from "lucide-react";
import { updateSyncRewardsAction } from "../actions";
import type { SyncRewardPosition, SyncRewardsConfig } from "@/lib/sync-event-rewards";

type RewardItem = { id: string; name: string; type: string; active: boolean; inventoryEnabled: boolean };

const POSITIONS: { key: SyncRewardPosition; label: string }[] = [
  { key: "1", label: "1º lugar" },
  { key: "2", label: "2º lugar" },
  { key: "3", label: "3º lugar" },
  { key: "4", label: "4º lugar" },
  { key: "participation", label: "5º em diante" },
];

const EGG_LABELS: Partial<Record<EggType, string>> = {
  COMMON: "Ovo Comum",
  RARE: "Ovo Raro",
  SPECIAL: "Ovo Especial",
  EVENT: "Ovo de Evento",
  LAB: "Ovo de Laboratório",
};

export function AdminRewardsPanel({ rewards, items }: { rewards: SyncRewardsConfig; items: RewardItem[] }) {
  return (
    <div className="border-t border-border pt-5 space-y-3">
      <div>
        <h2 className="flex items-center gap-2 font-semibold text-slate-100"><Gift size={17} className="text-[#FFCB05]" /> Admin — Premiação por colocação</h2>
        <p className="mt-1 text-xs text-slate-500">Cada valor é entregue individualmente aos dois jogadores da dupla. Zero ZC ou “Sem ovo/item” desativa aquela parte do prêmio.</p>
      </div>
      <form action={updateSyncRewardsAction} className="space-y-3">
        <div className="grid gap-3 xl:grid-cols-2">
          {POSITIONS.map(({ key, label }) => {
            const reward = rewards[key];
            const prefix = `reward_${key}`;
            return (
              <fieldset key={key} className="rounded-xl border border-border bg-slate-950/50 p-3">
                <legend className="px-2 text-sm font-bold text-[#FFCB05]">{label}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs text-slate-400">ZikaCoins por jogador
                    <input name={`${prefix}_coins`} type="number" min={0} max={1000000} defaultValue={reward.coins} className="mt-1 w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-slate-100" />
                  </label>
                  <label className="text-xs text-slate-400">Tipo de ovo
                    <select name={`${prefix}_eggType`} defaultValue={reward.eggType ?? ""} className="mt-1 w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-slate-100">
                      <option value="">Sem ovo</option>
                      {Object.values(EggType).map((type) => <option key={type} value={type}>{EGG_LABELS[type] ?? type.replaceAll("_", " ")}</option>)}
                    </select>
                  </label>
                  <label className="text-xs text-slate-400">Quantidade de ovos
                    <input name={`${prefix}_eggQuantity`} type="number" min={1} max={99} defaultValue={Math.max(1, reward.eggQuantity)} className="mt-1 w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-slate-100" />
                  </label>
                  <label className="text-xs text-slate-400">Quantidade do item
                    <input name={`${prefix}_shopItemQuantity`} type="number" min={1} max={99} defaultValue={reward.shopItemQuantity} className="mt-1 w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-slate-100" />
                  </label>
                  <label className="text-xs text-slate-400 sm:col-span-2">Item da ZikaShop
                    <select name={`${prefix}_shopItemId`} defaultValue={reward.shopItemId ?? ""} className="mt-1 w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-slate-100">
                      <option value="">Sem item</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>{item.name} · {item.type}{!item.active ? " · oculto" : ""}{!item.inventoryEnabled ? " · bloqueado no inventário" : ""}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </fieldset>
            );
          })}
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-[#FFCB05] px-4 py-2 text-sm font-bold text-slate-950 hover:bg-yellow-300">
          <Save size={15} /> Salvar premiação do evento
        </button>
      </form>
    </div>
  );
}
