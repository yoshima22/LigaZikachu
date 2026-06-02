"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Zap, Search, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addAchievementRule, removeAchievementRule } from "../actions";

// Eventos disponíveis com descrição dos parâmetros
const EVENT_TYPES = [
  { value: "MATCH_WIN",                 label: "Venceu uma partida",              params: "targetValue: N vitórias. Filtro: nenhum." },
  { value: "MATCH_LOSS",                label: "Perdeu uma partida",              params: "targetValue: N derrotas. Filtro: nenhum." },
  { value: "DECK_SUBMITTED",            label: "Enviou decklist",                 params: "targetValue: N envios. Filtro: nenhum." },
  { value: "COINS_EARNED",              label: "Ganhou ZikaCoins",                params: "targetValue: total acumulado. Filtro: nenhum." },
  { value: "COINS_SPENT",               label: "Gastou ZikaCoins",                params: "targetValue: total gasto. Filtro: nenhum." },
  { value: "SHOP_ITEM_PURCHASED",       label: "Comprou item no shop",            params: "targetValue: N compras. Filtro: { type: 'FRAME' } ou { itemId: 'xxx' }." },
  { value: "LOOT_WON",                  label: "Ganhou na ZikaLoot",              params: "targetValue: N vitórias na loteria. Filtro: nenhum." },
  { value: "STICKER_PACK_OPENED",       label: "Abriu pacote de figurinhas",      params: "targetValue: N pacotes. Filtro: { generation: 1 }." },
  { value: "STICKER_RECEIVED",          label: "Recebeu figurinha",               params: "targetValue: N figurinhas recebidas. Filtro: { rarity: 'RARE' }." },
  { value: "GIFT_SENT",                 label: "Enviou presente para outro jogador", params: "targetValue: N presentes enviados. Filtro: nenhum." },
  { value: "GIFT_RECEIVED",             label: "Recebeu presente",                params: "targetValue: N presentes recebidos. Filtro: nenhum." },
  { value: "TITLE_EQUIPPED",            label: "Equipou um título",               params: "targetValue: 1 (apenas detecta). Filtro: { itemId: 'xxx' }." },
  { value: "BANNER_EQUIPPED",           label: "Equipou um banner",               params: "targetValue: 1. Filtro: { itemId: 'xxx' }." },
  { value: "FRAME_EQUIPPED",            label: "Equipou uma moldura",             params: "targetValue: 1. Filtro: { itemId: 'xxx' }." },
  { value: "PROFESSOR_USED",            label: "Usou o Professor Enguiça",        params: "targetValue: N conversas. Filtro: nenhum." },
  { value: "ALBUM_GENERATION_COMPLETED",label: "Completou uma geração do álbum", params: "targetValue: N gerações. Filtro: { generation: 1 }." },
  { value: "DAILY_LOGIN",               label: "Login diário consecutivo",        params: "targetValue: N dias seguidos. Filtro: nenhum." },
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
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);

  // Form state for adding a rule
  const [eventType, setEventType] = useState("MATCH_WIN");
  const [eventSearch, setEventSearch] = useState("");
  const [targetValue, setTargetValue] = useState(1);
  const [metaKey, setMetaKey] = useState("");
  const [metaValue, setMetaValue] = useState("");

  const automaticAchievements = achievements.filter(a => a.type === "AUTOMATIC");
  const filteredAchievements = automaticAchievements.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredEvents = EVENT_TYPES.filter(e =>
    e.label.toLowerCase().includes(eventSearch.toLowerCase()) ||
    e.value.toLowerCase().includes(eventSearch.toLowerCase())
  );

  const selectedEvent = EVENT_TYPES.find(e => e.value === eventType);

  const handleAdd = (achievementId: string) => {
    startTransition(async () => {
      try {
        const metadata = metaKey && metaValue
          ? { [metaKey]: isNaN(Number(metaValue)) ? metaValue : Number(metaValue) }
          : undefined;
        const result = await addAchievementRule({
          achievementId,
          eventType,
          targetValue,
          metadataFilter: metadata
        });
        if (result.error) { toast.error(result.error); return; }
        toast.success("Regra adicionada!");
        setMetaKey(""); setMetaValue(""); setEventSearch(""); setAddingTo(null);
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
          Crie uma conquista com tipo <strong className="text-slate-300">Automático</strong> para configurar regras de disparo.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-slate-950/50 p-5 space-y-4">
      <div>
        <h2 className="flex items-center gap-2 font-semibold text-slate-200">
          <Zap size={16} className="text-[#FFCB05]" /> Regras de Conquistas Automáticas
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Uma regra define qual evento e quantas ocorrências são necessárias para desbloquear automaticamente.
          Cada conquista pode ter múltiplas regras (todas precisam ser satisfeitas).
        </p>
      </div>

      {/* Busca por texto */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar conquista automática..."
          className="w-full rounded-lg border border-border bg-slate-900 pl-8 pr-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05] placeholder:text-slate-600"
        />
      </div>

      {/* Lista de conquistas automáticas */}
      <div className="space-y-2">
        {filteredAchievements.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-4">Nenhuma conquista encontrada.</p>
        )}
        {filteredAchievements.map(a => (
          <div key={a.id} className="rounded-xl border border-border bg-slate-900/40 overflow-hidden">
            {/* Header da conquista */}
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 hover:bg-slate-800/40 transition-colors"
              onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-slate-200 truncate">{a.name}</span>
                <span className="shrink-0 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                  {a.rules.length} regra{a.rules.length !== 1 ? "s" : ""}
                </span>
              </div>
              {expandedId === a.id ? <ChevronUp size={14} className="text-slate-500 shrink-0" /> : <ChevronDown size={14} className="text-slate-500 shrink-0" />}
            </button>

            {expandedId === a.id && (
              <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                {/* Regras existentes */}
                {a.rules.length > 0 ? (
                  <div className="space-y-1">
                    {a.rules.map(rule => (
                      <div key={rule.id} className="flex items-center justify-between rounded-lg border border-border bg-slate-950/60 px-3 py-2 text-xs">
                        <div className="min-w-0">
                          <span className="font-medium text-slate-200">{eventLabel(rule.eventType)}</span>
                          <span className="ml-2 text-[#FFCB05] font-bold">× {rule.targetValue}</span>
                          {rule.metadataFilter && Object.keys(rule.metadataFilter).length > 0 && (
                            <span className="ml-2 text-[10px] text-slate-500">
                              filtro: {JSON.stringify(rule.metadataFilter)}
                            </span>
                          )}
                        </div>
                        <button type="button" disabled={pending} onClick={() => handleRemove(rule.id)}
                          className="shrink-0 rounded-lg p-1.5 text-red-400 hover:bg-red-500/10 ml-2">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Nenhuma regra configurada ainda.</p>
                )}

                {/* Botão adicionar regra */}
                {addingTo !== a.id ? (
                  <button
                    type="button"
                    onClick={() => setAddingTo(a.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-slate-500 hover:border-[#FFCB05]/40 hover:text-[#FFCB05] transition-colors"
                  >
                    <Plus size={12} /> Adicionar regra
                  </button>
                ) : (
                  <div className="rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-4 space-y-3">
                    <p className="text-xs font-semibold text-[#FFCB05]">Nova regra para "{a.name}"</p>

                    {/* Busca de evento por texto */}
                    <label className="block space-y-1 text-xs text-slate-400">
                      <span>Evento disparador</span>
                      <div className="relative">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          value={eventSearch}
                          onChange={e => setEventSearch(e.target.value)}
                          placeholder="Buscar evento..."
                          className="w-full rounded-lg border border-border bg-slate-950 pl-8 pr-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05] placeholder:text-slate-600"
                        />
                      </div>
                      {/* Lista de eventos filtrada */}
                      <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-slate-950 divide-y divide-border/50">
                        {filteredEvents.map(e => (
                          <button
                            key={e.value}
                            type="button"
                            onClick={() => { setEventType(e.value); setEventSearch(e.label); }}
                            className={`w-full px-3 py-2 text-left text-xs transition-colors hover:bg-slate-800/60 ${
                              eventType === e.value ? "bg-[#FFCB05]/10 text-[#FFCB05]" : "text-slate-300"
                            }`}
                          >
                            <p className="font-medium">{e.label}</p>
                            <p className="text-[10px] text-slate-600 mt-0.5">{e.params}</p>
                          </button>
                        ))}
                        {filteredEvents.length === 0 && (
                          <p className="px-3 py-2 text-xs text-slate-500">Nenhum evento encontrado.</p>
                        )}
                      </div>
                    </label>

                    {/* Valor alvo */}
                    <label className="block space-y-1 text-xs text-slate-400">
                      <span>Quantidade necessária (targetValue)</span>
                      <input type="number" min={1} value={targetValue}
                        onChange={e => setTargetValue(parseInt(e.target.value) || 1)}
                        className={inputCls} />
                      {selectedEvent && (
                        <p className="text-[10px] text-slate-600">📋 {selectedEvent.params}</p>
                      )}
                    </label>

                    {/* Filtro de metadata */}
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="space-y-1 text-xs text-slate-400">
                        <span>Filtro: chave (opcional)</span>
                        <input value={metaKey} onChange={e => setMetaKey(e.target.value)}
                          placeholder="Ex: generation, rarity, itemId" className={inputCls} />
                      </label>
                      <label className="space-y-1 text-xs text-slate-400">
                        <span>Filtro: valor</span>
                        <input value={metaValue} onChange={e => setMetaValue(e.target.value)}
                          placeholder="Ex: 1, RARE, cuid123..." className={inputCls} />
                      </label>
                    </div>

                    <div className="flex gap-2">
                      <Button type="button" disabled={!eventType || pending} onClick={() => handleAdd(a.id)}
                        className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
                        <Plus size={14} className="mr-1" /> Adicionar regra
                      </Button>
                      <Button type="button" variant="outline" onClick={() => { setAddingTo(null); setEventSearch(""); }}>
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
