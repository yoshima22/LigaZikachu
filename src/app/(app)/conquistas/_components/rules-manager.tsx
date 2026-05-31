"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addAchievementRule, removeAchievementRule } from "../actions";

// Todos os tipos de evento disponíveis
const EVENT_TYPES = [
  { value: "SHOP_ITEM_PURCHASED", label: "Comprou item no shop" },
  { value: "COINS_SPENT",         label: "Gastou ZikaCoins" },
  { value: "COINS_EARNED",        label: "Ganhou ZikaCoins" },
  { value: "LOOT_WON",            label: "Ganhou na ZikaLoot" },
  { value: "STICKER_PACK_OPENED", label: "Abriu pacote de figurinhas" },
  { value: "STICKER_RECEIVED",    label: "Recebeu figurinha de presente" },
  { value: "GIFT_SENT",           label: "Enviou presente para outro jogador" },
  { value: "GIFT_RECEIVED",       label: "Recebeu presente" },
  { value: "TITLE_EQUIPPED",      label: "Equipou um título" },
  { value: "BANNER_EQUIPPED",     label: "Equipou um banner" },
  { value: "FRAME_EQUIPPED",      label: "Equipou uma moldura" },
  { value: "PROFESSOR_USED",      label: "Usou o Professor Enguiça" },
  { value: "ALBUM_GENERATION_COMPLETED", label: "Completou uma geração do álbum" },
  { value: "MATCH_WIN",           label: "Venceu uma partida" },
  { value: "MATCH_LOSS",          label: "Perdeu uma partida" },
  { value: "DECK_SUBMITTED",      label: "Enviou decklist" },
  { value: "DAILY_LOGIN",         label: "Login diário" },
];

interface Rule {
  id: string;
  eventType: string;
  targetValue: number;
  metadataFilter?: Record<string, unknown> | null;
}

interface Achievement {
  id: string;
  name: string;
  type: string;
  rules: Rule[];
}

interface Props {
  achievements: Achievement[];
}

export function RulesManager({ achievements }: Props) {
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState("");
  const [eventType, setEventType] = useState("SHOP_ITEM_PURCHASED");
  const [targetValue, setTargetValue] = useState(1);
  const [metaKey, setMetaKey] = useState("");
  const [metaValue, setMetaValue] = useState("");

  const automaticAchievements = achievements.filter(a => a.type === "AUTOMATIC");
  const selected = automaticAchievements.find(a => a.id === selectedId);

  const handleAdd = () => {
    if (!selectedId) { toast.error("Selecione uma conquista automática."); return; }
    startTransition(async () => {
      try {
        const metadata = metaKey && metaValue
          ? { [metaKey]: isNaN(Number(metaValue)) ? metaValue : Number(metaValue) }
          : undefined;
        const result = await addAchievementRule({
          achievementId: selectedId,
          eventType,
          targetValue,
          metadataFilter: metadata
        });
        if (result.error) { toast.error(result.error); return; }
        toast.success("Regra adicionada!");
        setMetaKey(""); setMetaValue("");
      } catch { toast.error("Erro ao adicionar regra."); }
    });
  };

  const handleRemove = (ruleId: string) => {
    startTransition(async () => {
      try {
        const result = await removeAchievementRule(ruleId);
        if (result.error) { toast.error(result.error); return; }
        toast.success("Regra removida.");
      } catch { toast.error("Erro."); }
    });
  };

  const eventLabel = (type: string) =>
    EVENT_TYPES.find(e => e.value === type)?.label ?? type;

  const inputCls = "w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]";

  if (automaticAchievements.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-slate-950/50 p-5">
        <h2 className="flex items-center gap-2 font-semibold text-slate-200 mb-2">
          <Zap size={16} className="text-[#FFCB05]" /> Regras de Conquistas Automáticas
        </h2>
        <p className="text-sm text-slate-500">
          Não há conquistas do tipo <strong className="text-slate-300">AUTOMATIC</strong> cadastradas ainda.
          Crie uma conquista com tipo "Automático" para configurar regras.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-slate-950/50 p-5 space-y-5">
      <div>
        <h2 className="flex items-center gap-2 font-semibold text-slate-200">
          <Zap size={16} className="text-[#FFCB05]" /> Regras de Conquistas Automáticas
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Define qual evento e quantas vezes precisam acontecer para desbloquear automaticamente.
          Exemplo: "Abrir 5 pacotes de figurinhas" = evento STICKER_PACK_OPENED, valor 5.
        </p>
      </div>

      {/* Seletor de conquista */}
      <label className="space-y-1 text-xs text-slate-400 block">
        <span>Conquista automática</span>
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className={inputCls}>
          <option value="">Selecione</option>
          {automaticAchievements.map(a => (
            <option key={a.id} value={a.id}>{a.name} ({a.rules.length} regra{a.rules.length !== 1 ? "s" : ""})</option>
          ))}
        </select>
      </label>

      {/* Regras atuais */}
      {selected && selected.rules.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400">Regras atuais de "{selected.name}":</p>
          {selected.rules.map(rule => (
            <div key={rule.id} className="flex items-center justify-between rounded-lg border border-border bg-slate-900/40 px-3 py-2 text-sm">
              <div>
                <span className="font-medium text-slate-200">{eventLabel(rule.eventType)}</span>
                <span className="ml-2 text-[#FFCB05] font-bold">× {rule.targetValue}</span>
                {rule.metadataFilter && Object.keys(rule.metadataFilter).length > 0 && (
                  <span className="ml-2 text-[10px] text-slate-500">
                    filtro: {JSON.stringify(rule.metadataFilter)}
                  </span>
                )}
              </div>
              <button type="button" disabled={pending} onClick={() => handleRemove(rule.id)}
                className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Adicionar nova regra */}
      {selectedId && (
        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-xs font-semibold text-slate-400">Adicionar regra:</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-1 text-xs text-slate-400">
              <span>Evento que dispara</span>
              <select value={eventType} onChange={e => setEventType(e.target.value)} className={inputCls}>
                {EVENT_TYPES.map(e => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-slate-400">
              <span>Quantas vezes (acumulado)</span>
              <input type="number" min={1} max={9999} value={targetValue}
                onChange={e => setTargetValue(Number(e.target.value))} className={inputCls} />
            </label>
            <div className="space-y-1 text-xs text-slate-400">
              <span>Filtro por metadata (opcional)</span>
              <div className="flex gap-2">
                <input value={metaKey} onChange={e => setMetaKey(e.target.value)}
                  placeholder="chave" className="flex-1 rounded-lg border border-border bg-slate-950 px-2 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
                <span className="self-center text-slate-600">:</span>
                <input value={metaValue} onChange={e => setMetaValue(e.target.value)}
                  placeholder="valor" className="flex-1 rounded-lg border border-border bg-slate-950 px-2 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
              </div>
              <p className="text-[10px] text-slate-600">Ex: generation:1 para Gen 1 apenas</p>
            </div>
          </div>
          <Button type="button" disabled={pending} onClick={handleAdd}
            className="gap-1 bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
            <Plus size={14} /> Adicionar regra
          </Button>
        </div>
      )}

      {/* Exemplos */}
      <details className="border-t border-border pt-4">
        <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300">
          📖 Ver exemplos de regras
        </summary>
        <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
          {[
            { name: "Mão Furada", event: "COINS_SPENT", value: 1000, meta: null },
            { name: "Compre 3 pacotes da Gen 1", event: "STICKER_PACK_OPENED", value: 3, meta: "generation:1" },
            { name: "Primeiro Presente", event: "GIFT_SENT", value: 1, meta: null },
            { name: "Colecionador", event: "ALBUM_GENERATION_COMPLETED", value: 1, meta: null },
            { name: "Presença Confirmada (7 dias)", event: "DAILY_LOGIN", value: 7, meta: null },
            { name: "Sortudo Oficial", event: "LOOT_WON", value: 1, meta: null },
          ].map(ex => (
            <div key={ex.name} className="rounded-lg border border-border bg-slate-900/30 p-2">
              <p className="font-semibold text-slate-300">{ex.name}</p>
              <p>{eventLabel(ex.event)} × {ex.value}</p>
              {ex.meta && <p className="text-slate-600">filtro: {ex.meta}</p>}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
