"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addAchievementReward, removeAchievementReward } from "../actions";

const REWARD_TYPES = [
  { value: "ZIKA_COINS",    label: "ZikaCoins", needsAmount: true, needsItem: false, needsTitle: false },
  { value: "LOOT_TICKET",   label: "Ticket ZikaLoot", needsAmount: true, needsItem: false, needsTitle: false },
  { value: "STICKER_PACK",  label: "Pacote de Figurinhas", needsAmount: true, needsItem: false, needsTitle: false },
  { value: "SHOP_ITEM",     label: "Item da ZikaShop (Banner/Moldura)", needsAmount: false, needsItem: true, needsTitle: false },
  { value: "TITLE_TEXT",    label: "Título de Perfil (texto)", needsAmount: false, needsItem: false, needsTitle: true },
  { value: "BADGE",         label: "Insígnia Visual", needsAmount: false, needsItem: false, needsTitle: false },
];

interface Reward {
  id: string; rewardType: string; rewardAmount: number | null;
  rewardItemId: string | null; titleText: string | null; deliverViaGift: boolean;
}

interface Props {
  achievements: Array<{ id: string; name: string; rewards: Reward[] }>;
  shopItems: Array<{ id: string; name: string; type: string }>;
}

export function RewardManager({ achievements, shopItems }: Props) {
  const [pending, startTransition] = useTransition();
  const [selectedAchId, setSelectedAchId] = useState("");
  const [rewardType, setRewardType] = useState("ZIKA_COINS");
  const [amount, setAmount] = useState(100);
  const [itemId, setItemId] = useState("");
  const [titleText, setTitleText] = useState("");
  const [viaGift, setViaGift] = useState(true);

  const rtInfo = REWARD_TYPES.find(r => r.value === rewardType)!;
  const selectedAch = achievements.find(a => a.id === selectedAchId);

  const handleAdd = () => {
    if (!selectedAchId) { toast.error("Selecione uma conquista."); return; }
    startTransition(async () => {
      try {
        const result = await addAchievementReward({
          achievementId: selectedAchId,
          rewardType: rewardType as "ZIKA_COINS" | "LOOT_TICKET" | "STICKER_PACK" | "SHOP_ITEM" | "TITLE_TEXT" | "BADGE",
          rewardAmount: rtInfo.needsAmount ? amount : undefined,
          rewardItemId: rtInfo.needsItem && itemId ? itemId : undefined,
          titleText: rtInfo.needsTitle && titleText ? titleText : undefined,
          deliverViaGift: viaGift
        });
        if (result.error) { toast.error(result.error); return; }
        toast.success("Recompensa adicionada!");
      } catch { toast.error("Erro ao adicionar."); }
    });
  };

  const handleRemove = (rewardId: string) => {
    startTransition(async () => {
      try {
        const result = await removeAchievementReward(rewardId);
        if (result.error) { toast.error(result.error); return; }
        toast.success("Recompensa removida.");
      } catch { toast.error("Erro."); }
    });
  };

  const rewardLabel = (r: Reward) => {
    switch (r.rewardType) {
      case "ZIKA_COINS":   return `${r.rewardAmount} ZikaCoins`;
      case "LOOT_TICKET":  return `${r.rewardAmount ?? 1}x Ticket ZikaLoot`;
      case "STICKER_PACK": return `${r.rewardAmount ?? 1}x Pacote de Figurinhas`;
      case "SHOP_ITEM":    return `Item da Shop: ${shopItems.find(i => i.id === r.rewardItemId)?.name ?? r.rewardItemId}`;
      case "TITLE_TEXT":   return `Título: "${r.titleText}"`;
      case "BADGE":        return "Insígnia Visual";
      default:             return r.rewardType;
    }
  };

  const inputCls = "w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]";

  return (
    <div className="rounded-xl border border-border bg-slate-950/50 p-5 space-y-4">
      <h2 className="flex items-center gap-2 font-semibold text-slate-200">
        <Gift size={16} className="text-[#FFCB05]" /> Configurar Recompensas das Conquistas
      </h2>
      <p className="text-xs text-slate-500">
        Defina o que o jogador recebe ao desbloquear cada conquista. As recompensas vão para a Caixa de Presentes.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1 text-xs text-slate-400">
          <span>Conquista</span>
          <select value={selectedAchId} onChange={e => setSelectedAchId(e.target.value)} className={inputCls}>
            <option value="">Selecione</option>
            {achievements.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>

        <label className="space-y-1 text-xs text-slate-400">
          <span>Tipo de recompensa</span>
          <select value={rewardType} onChange={e => setRewardType(e.target.value)} className={inputCls}>
            {REWARD_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>

        {rtInfo.needsAmount && (
          <label className="space-y-1 text-xs text-slate-400">
            <span>Quantidade</span>
            <input type="number" min={1} value={amount} onChange={e => setAmount(Number(e.target.value))} className={inputCls} />
          </label>
        )}

        {rtInfo.needsItem && (
          <label className="space-y-1 text-xs text-slate-400 sm:col-span-2">
            <span>Item da ZikaShop</span>
            <select value={itemId} onChange={e => setItemId(e.target.value)} className={inputCls}>
              <option value="">Selecione</option>
              {shopItems.map(i => <option key={i.id} value={i.id}>{i.name} ({i.type})</option>)}
            </select>
          </label>
        )}

        {rtInfo.needsTitle && (
          <label className="space-y-1 text-xs text-slate-400 sm:col-span-2">
            <span>Texto do título</span>
            <input value={titleText} onChange={e => setTitleText(e.target.value)}
              placeholder="Ex: Mestre da Virada" className={inputCls} />
          </label>
        )}

        <label className="flex items-center gap-2 text-xs text-slate-300 self-end pb-2">
          <input type="checkbox" checked={viaGift} onChange={e => setViaGift(e.target.checked)} className="accent-[#FFCB05]" />
          Entregar via Caixa de Presentes
        </label>
      </div>

      <Button type="button" disabled={!selectedAchId || pending} onClick={handleAdd}
        className="gap-1 bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
        <Plus size={14} /> Adicionar recompensa
      </Button>

      {/* Recompensas existentes */}
      {selectedAch && selectedAch.rewards.length > 0 && (
        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-xs font-semibold text-slate-400">Recompensas de "{selectedAch.name}":</p>
          {selectedAch.rewards.map(r => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-slate-900/40 px-3 py-2 text-sm">
              <span className="text-slate-300">{rewardLabel(r)}</span>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-500">{r.deliverViaGift ? "📦 Presente" : "⚡ Direto"}</span>
                <button type="button" disabled={pending} onClick={() => handleRemove(r.id)}
                  className="text-red-400 hover:bg-red-500/10 rounded p-1">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ver todas com recompensas */}
      {achievements.filter(a => a.rewards.length > 0).length > 0 && (
        <details className="border-t border-border pt-4">
          <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300">
            Ver todas as conquistas com recompensas configuradas
          </summary>
          <div className="mt-3 space-y-2">
            {achievements.filter(a => a.rewards.length > 0).map(a => (
              <div key={a.id} className="rounded-lg border border-border bg-slate-900/30 px-3 py-2">
                <p className="text-xs font-semibold text-slate-300 mb-1">{a.name}</p>
                {a.rewards.map(r => (
                  <p key={r.id} className="text-[11px] text-slate-500">→ {rewardLabel(r)}</p>
                ))}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
