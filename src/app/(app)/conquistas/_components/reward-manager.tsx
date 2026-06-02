"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Gift, Search, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addAchievementReward, removeAchievementReward } from "../actions";

const REWARD_TYPES = [
  { value: "ZIKA_COINS",    label: "ZikaCoins",                        needsAmount: true,  needsItem: false, needsTitle: false },
  { value: "LOOT_TICKET",   label: "Ticket ZikaLoot",                  needsAmount: true,  needsItem: false, needsTitle: false },
  { value: "STICKER_PACK",  label: "Pacote de Figurinhas",             needsAmount: true,  needsItem: false, needsTitle: false },
  { value: "SHOP_ITEM",     label: "Item da ZikaShop (Banner/Moldura)",needsAmount: false, needsItem: true,  needsTitle: false },
  { value: "TITLE_TEXT",    label: "Título de Perfil (texto)",         needsAmount: false, needsItem: false, needsTitle: true  },
  { value: "BADGE",         label: "Insígnia Visual",                  needsAmount: false, needsItem: false, needsTitle: false },
];

interface Reward {
  id: string; rewardType: string; rewardAmount: number | null;
  rewardItemId: string | null; titleText: string | null; deliverViaGift: boolean;
}

interface Props {
  achievements: Array<{ id: string; name: string; rewards: Reward[] }>;
  shopItems: Array<{ id: string; name: string; type: string }>;
}

function rewardLabel(r: Reward, shopItems: Props["shopItems"]): string {
  switch (r.rewardType) {
    case "ZIKA_COINS":   return `🪙 ${r.rewardAmount} ZikaCoins`;
    case "LOOT_TICKET":  return `🎟️ ${r.rewardAmount ?? 1}x Ticket ZikaLoot`;
    case "STICKER_PACK": return `📦 ${r.rewardAmount ?? 1}x Pacote de Figurinhas`;
    case "SHOP_ITEM":    return `🎨 Item da Shop: ${shopItems.find(i => i.id === r.rewardItemId)?.name ?? r.rewardItemId}`;
    case "TITLE_TEXT":   return `🏷️ Título: "${r.titleText}"`;
    case "BADGE":        return "🏅 Insígnia Visual";
    default:             return r.rewardType;
  }
}

export function RewardManager({ achievements, shopItems }: Props) {
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);

  // Form state para adicionar recompensa
  const [rewardType, setRewardType] = useState("ZIKA_COINS");
  const [amount, setAmount] = useState(100);
  const [itemId, setItemId] = useState("");
  const [titleText, setTitleText] = useState("");
  const [viaGift, setViaGift] = useState(true);

  const rtInfo = REWARD_TYPES.find(r => r.value === rewardType) ?? REWARD_TYPES[0];
  const filtered = achievements.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = (achievementId: string) => {
    startTransition(async () => {
      try {
        const result = await addAchievementReward({
          achievementId,
          rewardType: rewardType as "ZIKA_COINS"|"LOOT_TICKET"|"STICKER_PACK"|"SHOP_ITEM"|"TITLE_TEXT"|"BADGE",
          rewardAmount: rtInfo.needsAmount ? amount : undefined,
          rewardItemId: rtInfo.needsItem && itemId ? itemId : undefined,
          titleText: rtInfo.needsTitle && titleText ? titleText : undefined,
          deliverViaGift: viaGift
        });
        if (result.error) { toast.error(result.error); return; }
        toast.success("Recompensa adicionada!");
        setAddingTo(null); setItemId(""); setTitleText("");
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

  const inputCls = "w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]";

  return (
    <div className="rounded-xl border border-border bg-slate-950/50 p-5 space-y-4">
      <div>
        <h2 className="flex items-center gap-2 font-semibold text-slate-200">
          <Gift size={16} className="text-[#FFCB05]" /> Recompensas das Conquistas
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          O que o jogador recebe ao desbloquear cada conquista. Recompensas vão para a Caixa de Presentes.
        </p>
      </div>

      {/* Busca por texto */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar conquista..."
          className="w-full rounded-lg border border-border bg-slate-900 pl-8 pr-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05] placeholder:text-slate-600"
        />
      </div>

      {/* Lista de conquistas */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-4">Nenhuma conquista encontrada.</p>
        )}
        {filtered.map(a => (
          <div key={a.id} className="rounded-xl border border-border bg-slate-900/40 overflow-hidden">
            {/* Header */}
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 hover:bg-slate-800/40 transition-colors"
              onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-slate-200 truncate">{a.name}</span>
                {a.rewards.length > 0 && (
                  <span className="shrink-0 rounded-full bg-[#FFCB05]/10 border border-[#FFCB05]/20 px-2 py-0.5 text-[10px] text-[#FFCB05]">
                    {a.rewards.length} recompensa{a.rewards.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {expandedId === a.id
                ? <ChevronUp size={14} className="text-slate-500 shrink-0" />
                : <ChevronDown size={14} className="text-slate-500 shrink-0" />}
            </button>

            {expandedId === a.id && (
              <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                {/* Recompensas existentes */}
                {a.rewards.length > 0 ? (
                  <div className="space-y-1">
                    {a.rewards.map(r => (
                      <div key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-slate-950/60 px-3 py-2 text-xs">
                        <span className="text-slate-300">{rewardLabel(r, shopItems)}</span>
                        <button type="button" disabled={pending} onClick={() => handleRemove(r.id)}
                          className="shrink-0 ml-2 rounded-lg p-1.5 text-red-400 hover:bg-red-500/10">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Nenhuma recompensa configurada.</p>
                )}

                {/* Botão adicionar */}
                {addingTo !== a.id ? (
                  <button
                    type="button"
                    onClick={() => setAddingTo(a.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-slate-500 hover:border-[#FFCB05]/40 hover:text-[#FFCB05] transition-colors"
                  >
                    <Plus size={12} /> Adicionar recompensa
                  </button>
                ) : (
                  <div className="rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-4 space-y-3">
                    <p className="text-xs font-semibold text-[#FFCB05]">Nova recompensa para "{a.name}"</p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <label className="space-y-1 text-xs text-slate-400">
                        <span>Tipo de recompensa</span>
                        <select value={rewardType} onChange={e => setRewardType(e.target.value)} className={inputCls}>
                          {REWARD_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </label>
                      {rtInfo.needsAmount && (
                        <label className="space-y-1 text-xs text-slate-400">
                          <span>Quantidade</span>
                          <input type="number" min={1} value={amount}
                            onChange={e => setAmount(Number(e.target.value))} className={inputCls} />
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
                      <label className="flex items-center gap-2 text-xs text-slate-300 self-end pb-1">
                        <input type="checkbox" checked={viaGift} onChange={e => setViaGift(e.target.checked)}
                          className="accent-[#FFCB05]" />
                        Entregar via Caixa de Presentes
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" disabled={pending} onClick={() => handleAdd(a.id)}
                        className="gap-1 bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
                        <Plus size={13} /> Adicionar
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setAddingTo(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
