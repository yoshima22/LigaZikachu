"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Calendar, ChevronDown, ChevronUp, RotateCcw, Save,
  Star, X, Check, AlertTriangle, Plus, Trash2, UserPlus, Clock, CheckCircle2, UserMinus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import type { DayReward } from "@/app/(app)/passe-apoiador/schedule";
import {
  adminSaveSchedule, adminResetSchedule, adminGetSchedule,
  adminGrantVip, adminGrantVipToAll, adminSetRetroactiveClaims, adminRevokeVip,
  adminSetPassScheduleRetroactive, adminCreatePassSchedule, adminSavePassDisplayConfig,
} from "@/app/(app)/passe-apoiador/actions";

// ── Tipos de slot ─────────────────────────────────────────────────────────────

type SlotKind = "COINS" | "EGG" | "FOOD" | "SWEET" | "STICKER_PACK" | "SHOP_ITEM" | "ZIKALOOT";

type Slot =
  | { id: string; kind: "COINS"; amount: number }
  | { id: string; kind: "EGG"; eggType: "COMMON" | "SPECIAL" | "RARE" | "LAB"; qty: number }
  | { id: string; kind: "FOOD"; qty: number }
  | { id: string; kind: "SWEET"; qty: number }
  | { id: string; kind: "STICKER_PACK"; packName: string }
  | { id: string; kind: "SHOP_ITEM"; itemName: string }
  | { id: string; kind: "ZIKALOOT"; special: boolean };

const SLOT_META: Record<SlotKind, { label: string; emoji: string; color: string }> = {
  COINS:       { label: "ZikaCoins",        emoji: "🪙", color: "border-yellow-500/30 bg-yellow-950/10" },
  EGG:         { label: "Ovo de Mascote",   emoji: "🥚", color: "border-teal-500/30 bg-teal-950/10" },
  FOOD:        { label: "Comida de Mascote",emoji: "🍖", color: "border-orange-500/30 bg-orange-950/10" },
  SWEET:       { label: "Doce de Mascote",  emoji: "🍬", color: "border-pink-500/30 bg-pink-950/10" },
  STICKER_PACK:{ label: "Pacote Figurinha", emoji: "🎴", color: "border-blue-500/30 bg-blue-950/10" },
  SHOP_ITEM:   { label: "Item do Shop",     emoji: "📦", color: "border-purple-500/30 bg-purple-950/10" },
  ZIKALOOT:    { label: "Ticket ZikaLoot",  emoji: "🎟️", color: "border-green-500/30 bg-green-950/10" },
};

let _slotCounter = 0;
function uid() { return `slot-${++_slotCounter}-${Math.random().toString(36).slice(2)}`; }

// ── Conversão DayReward ↔ Slots ───────────────────────────────────────────────

function rewardToSlots(reward: DayReward): Slot[] {
  const slots: Slot[] = [];

  if (reward.coins && reward.coins > 0)
    slots.push({ id: uid(), kind: "COINS", amount: reward.coins });

  if (reward.eggType || reward.type === "EGG")
    slots.push({ id: uid(), kind: "EGG", eggType: (reward.eggType as "COMMON" | "SPECIAL" | "RARE" | "LAB") ?? "COMMON", qty: reward.foodQty ?? 1 });

  if ((reward.foodType === "FOOD" || reward.type === "FOOD") && !reward.eggType)
    slots.push({ id: uid(), kind: "FOOD", qty: reward.foodQty ?? 1 });

  if (reward.foodType === "SWEET" || reward.type === "SWEET")
    slots.push({ id: uid(), kind: "SWEET", qty: reward.foodQty ?? 1 });

  if (reward.type === "STICKER_PACK" && reward.packName)
    slots.push({ id: uid(), kind: "STICKER_PACK", packName: reward.packName });

  if (reward.shopItemName)
    slots.push({ id: uid(), kind: "SHOP_ITEM", itemName: reward.shopItemName });

  if (reward.type === "ZIKALOOT")
    slots.push({ id: uid(), kind: "ZIKALOOT", special: reward.zikalootSpecial ?? false });

  return slots.length > 0 ? slots : [{ id: uid(), kind: "COINS", amount: 0 }];
}

function slotsToReward(day: number, emoji: string, label: string, isMilestone: boolean, slots: Slot[]): DayReward {
  const coins  = slots.find(s => s.kind === "COINS") as Extract<Slot, { kind: "COINS" }> | undefined;
  const egg    = slots.find(s => s.kind === "EGG") as Extract<Slot, { kind: "EGG" }> | undefined;
  const food   = slots.find(s => s.kind === "FOOD") as Extract<Slot, { kind: "FOOD" }> | undefined;
  const sweet  = slots.find(s => s.kind === "SWEET") as Extract<Slot, { kind: "SWEET" }> | undefined;
  const pack   = slots.find(s => s.kind === "STICKER_PACK") as Extract<Slot, { kind: "STICKER_PACK" }> | undefined;
  const shop   = slots.find(s => s.kind === "SHOP_ITEM") as Extract<Slot, { kind: "SHOP_ITEM" }> | undefined;
  const loot   = slots.find(s => s.kind === "ZIKALOOT") as Extract<Slot, { kind: "ZIKALOOT" }> | undefined;

  // Tipo primário por prioridade
  const type: DayReward["type"] =
    pack  ? "STICKER_PACK" :
    loot  ? "ZIKALOOT" :
    shop  ? "SHOP_ITEM" :
    egg   ? "EGG" :
    food  ? "FOOD" :
    sweet ? "SWEET" : "COINS";

  const foodQty = egg?.qty ?? food?.qty ?? sweet?.qty;
  const foodType = food ? "FOOD" : sweet ? "SWEET" : undefined;

  return {
    day,
    emoji,
    label,
    isMilestone: isMilestone || undefined,
    type,
    coins: coins?.amount || undefined,
    eggType: egg?.eggType,
    foodQty: foodQty ?? undefined,
    foodType: foodType ?? (egg && (food || sweet) ? (food ? "FOOD" : "SWEET") : undefined),
    packName: pack?.packName,
    shopItemName: shop?.itemName,
    zikalootSpecial: loot?.special || undefined,
  };
}

// ── Estado local para um dia (slots + meta) ───────────────────────────────────

type DayState = {
  emoji: string;
  label: string;
  isMilestone: boolean;
  slots: Slot[];
};

function rewardToDayState(r: DayReward): DayState {
  return { emoji: r.emoji, label: r.label, isMilestone: r.isMilestone ?? false, slots: rewardToSlots(r) };
}

function dayStateToReward(day: number, ds: DayState): DayReward {
  return slotsToReward(day, ds.emoji, ds.label, ds.isMilestone, ds.slots);
}

// ── Painel principal ──────────────────────────────────────────────────────────

interface ScheduleEntry {
  label: string;
  schedule: DayReward[];
  isCustom: boolean;
  allowRetroactiveClaims: boolean;
  displayTitle: string;
  description: string;
  flavorText: string;
}

interface ActiveVip {
  passId: string;
  displayName: string;
  passLabel: string;
  daysRemaining: number;
  claimedDays: number;
  totalDays: number;
  expiresAt: Date;
  allowRetroactiveClaims: boolean;
}

interface Player { id: string; displayName: string; }

interface Props {
  allSchedules: ScheduleEntry[];
  players: Player[];
  activeVips: ActiveVip[];
}

export function VipSchedulePanel({ allSchedules, players, activeVips }: Props) {
  const [open, setOpen] = useState(false);
  const [activeLabel, setActiveLabel] = useState(allSchedules[0]?.label ?? "Passe Apoiador");
  const [scheduleMap, setScheduleMap] = useState<Record<string, DayReward[]>>(
    () => Object.fromEntries(allSchedules.map(s => [s.label, s.schedule]))
  );
  const [customMap, setCustomMap] = useState<Record<string, boolean>>(
    () => Object.fromEntries(allSchedules.map(s => [s.label, s.isCustom]))
  );
  const [retroConfigMap, setRetroConfigMap] = useState<Record<string, boolean>>(
    () => Object.fromEntries(allSchedules.map(s => [s.label, s.allowRetroactiveClaims]))
  );
  const [displayMap, setDisplayMap] = useState<Record<string, { displayTitle: string; description: string; flavorText: string }>>(
    () => Object.fromEntries(allSchedules.map(s => [s.label, {
      displayTitle: s.displayTitle,
      description: s.description,
      flavorText: s.flavorText,
    }]))
  );
  const [dirtyMap, setDirtyMap] = useState<Record<string, boolean>>({});
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadPending, startLoad] = useTransition();
  const [savePending, startSave] = useTransition();
  const [resetPending, startReset] = useTransition();
  const [grantPending, startGrant] = useTransition();
  const [grantAllPending, startGrantAll] = useTransition();
  const [retroConfigPending, startRetroConfig] = useTransition();
  const [displayPending, startDisplay] = useTransition();
  const [retroPassPending, startRetroPass] = useTransition();
  const [retroPassLoadingId, setRetroPassLoadingId] = useState<string | null>(null);
  const [revokePending, startRevoke] = useTransition();
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokedPassIds, setRevokedPassIds] = useState<Set<string>>(new Set());
  const [vipRetroMap, setVipRetroMap] = useState<Record<string, boolean>>(
    () => Object.fromEntries(activeVips.map(v => [v.passId, v.allowRetroactiveClaims]))
  );
  const [createTypePending, startCreateType] = useTransition();
  const dirtyRef = useRef(dirtyMap);
  dirtyRef.current = dirtyMap;

  const [showCreateTypeForm, setShowCreateTypeForm] = useState(false);
  const [newPassLabel, setNewPassLabel] = useState("");

  // Form de criação de passe
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [durationDays, setDurationDays] = useState(30);
  const [startDay, setStartDay] = useState(1);
  const [skipExistingPasses, setSkipExistingPasses] = useState(true);
  const [showGrantForm, setShowGrantForm] = useState(false);

  // Sincroniza props → state quando o servidor retorna dados atualizados,
  // mas só para labels que não têm edições locais pendentes.
  useEffect(() => {
    setScheduleMap(prev => {
      const next = { ...prev };
      for (const s of allSchedules) {
        if (!dirtyRef.current[s.label]) next[s.label] = s.schedule;
      }
      return next;
    });
    setCustomMap(prev => {
      const next = { ...prev };
      for (const s of allSchedules) {
        if (!dirtyRef.current[s.label]) next[s.label] = s.isCustom;
      }
      return next;
    });
    setRetroConfigMap(prev => {
      const next = { ...prev };
      for (const s of allSchedules) {
        if (!dirtyRef.current[s.label]) next[s.label] = s.allowRetroactiveClaims;
      }
      return next;
    });
    setDisplayMap(prev => {
      const next = { ...prev };
      for (const s of allSchedules) {
        next[s.label] = {
          displayTitle: s.displayTitle,
          description: s.description,
          flavorText: s.flavorText,
        };
      }
      return next;
    });
    setVipRetroMap(prev => ({ ...Object.fromEntries(activeVips.map(v => [v.passId, v.allowRetroactiveClaims])), ...prev }));
  }, [allSchedules, activeVips]);

  const schedule = scheduleMap[activeLabel] ?? allSchedules[0]?.schedule ?? [];
  const isCustom = customMap[activeLabel] ?? false;
  const passRetroDefault = retroConfigMap[activeLabel] ?? false;
  const passDisplay = displayMap[activeLabel] ?? {
    displayTitle: activeLabel,
    description: activeLabel,
    flavorText: "Uma recompensa especial da Liga Zikachu.",
  };
  const dirty = dirtyMap[activeLabel] ?? false;

  const switchLabel = (label: string) => {
    setEditingDay(null);
    setActiveLabel(label);
    // Se o schedule para esse label ainda não foi carregado, busca do servidor
    if (!scheduleMap[label]) {
      startLoad(async () => {
        const result = await adminGetSchedule(label);
        setScheduleMap(prev => ({ ...prev, [label]: result.schedule }));
        setCustomMap(prev => ({ ...prev, [label]: result.isCustom }));
        setRetroConfigMap(prev => ({ ...prev, [label]: result.allowRetroactiveClaims }));
        setDisplayMap(prev => ({
          ...prev,
          [label]: {
            displayTitle: result.displayTitle,
            description: result.description,
            flavorText: result.flavorText,
          },
        }));
      });
    }
  };

  const updateDisplayField = (field: "displayTitle" | "description" | "flavorText", value: string) => {
    setDisplayMap(prev => ({
      ...prev,
      [activeLabel]: {
        ...(prev[activeLabel] ?? passDisplay),
        [field]: value,
      },
    }));
  };

  const updateDay = (day: number, ds: DayState) => {
    setScheduleMap(prev => ({
      ...prev,
      [activeLabel]: (prev[activeLabel] ?? []).map(r => r.day === day ? dayStateToReward(day, ds) : r),
    }));
    setDirtyMap(prev => ({ ...prev, [activeLabel]: true }));
  };

  const handleSave = () => {
    setSaveError(null);
    startSave(async () => {
      try {
        const result = await adminSaveSchedule(schedule, activeLabel);
        if (result.ok) {
          toast.success(`Calendário "${activeLabel}" salvo!`);
          setDirtyMap(prev => ({ ...prev, [activeLabel]: false }));
          setCustomMap(prev => ({ ...prev, [activeLabel]: true }));
          setSaveError(null);
        } else {
          const msg = result.error ?? "Erro ao salvar.";
          toast.error(msg);
          setSaveError(msg);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro inesperado ao salvar.";
        toast.error(msg);
        setSaveError(msg);
      }
    });
  };

  const labelVips = activeVips
    .filter(v => v.passLabel === activeLabel && !revokedPassIds.has(v.passId))
    .map(v => ({ ...v, allowRetroactiveClaims: vipRetroMap[v.passId] ?? v.allowRetroactiveClaims }));

  const handleCreatePassType = () => {
    const label = newPassLabel.trim();
    if (!label) { toast.error("Digite o nome do novo passe."); return; }
    startCreateType(async () => {
      const result = await adminCreatePassSchedule(label, activeLabel);
      if (result.ok && result.label && result.schedule) {
        setScheduleMap(prev => ({ ...prev, [result.label!]: result.schedule! }));
        setCustomMap(prev => ({ ...prev, [result.label!]: true }));
        setRetroConfigMap(prev => ({ ...prev, [result.label!]: result.allowRetroactiveClaims ?? false }));
        setDisplayMap(prev => ({
          ...prev,
          [result.label!]: {
            displayTitle: result.label!,
            description: result.label!,
            flavorText: "Uma recompensa especial da Liga Zikachu.",
          },
        }));
        setActiveLabel(result.label);
        setNewPassLabel("");
        setShowCreateTypeForm(false);
        toast.success(`Tipo de passe "${result.label}" criado.`);
      } else {
        toast.error(result.error ?? "Erro ao criar tipo de passe.");
      }
    });
  };

  const handleGrantForLabel = () => {
    if (!selectedPlayerId) { toast.error("Selecione um jogador."); return; }
    startGrant(async () => {
      const result = await adminGrantVip({
        playerId: selectedPlayerId,
        days: durationDays,
        startDay: startDay > 1 ? startDay : undefined,
        passLabel: activeLabel,
      });
      if (result.ok) {
        toast.success(`${activeLabel} concedido!${startDay > 1 ? ` Iniciado no dia ${startDay}.` : ""}`);
        setSelectedPlayerId("");
        setStartDay(1);
        setShowGrantForm(false);
      } else {
        toast.error(result.error ?? "Erro ao conceder passe.");
      }
    });
  };

  const handleGrantForAll = () => {
    const mode = skipExistingPasses
      ? "Quem ja tiver este passe ativo sera ignorado."
      : "Isso pode criar um novo passe mesmo para quem ja tem um ativo.";
    if (!confirm(`Conceder "${activeLabel}" de ${durationDays} dia(s) para todos os jogadores ativos?\n\n${mode}`)) return;
    startGrantAll(async () => {
      const result = await adminGrantVipToAll({
        days: durationDays,
        startDay: startDay > 1 ? startDay : undefined,
        passLabel: activeLabel,
        skipExisting: skipExistingPasses,
      });
      if (result.ok) {
        toast.success(`${activeLabel}: ${result.granted} criado(s), ${result.skipped} ignorado(s).`);
        setShowGrantForm(false);
      } else {
        toast.error(result.error ?? "Erro ao conceder passe para todos.");
      }
    });
  };

  const handleRevokeVip = (passId: string, name: string) => {
    if (!confirm(`Remover o passe de ${name}? O jogador perde o acesso às recompensas restantes e o título VIP é retirado do inventário.`)) return;
    setRevokingId(passId);
    startRevoke(async () => {
      const result = await adminRevokeVip(passId);
      setRevokingId(null);
      if (result.ok) {
        setRevokedPassIds(prev => new Set(prev).add(passId));
        toast.success(`Passe de ${name} removido.`);
      } else {
        toast.error(result.error ?? "Erro ao remover passe.");
      }
    });
  };

  const handleToggleRetroDefault = () => {
    const next = !passRetroDefault;
    startRetroConfig(async () => {
      const result = await adminSetPassScheduleRetroactive(activeLabel, next);
      if (result.ok) {
        setRetroConfigMap(prev => ({ ...prev, [activeLabel]: next }));
        setCustomMap(prev => ({ ...prev, [activeLabel]: true }));
        toast.success(next ? `Novos passes "${activeLabel}" serão retroativos.` : `Novos passes "${activeLabel}" não serão retroativos.`);
      } else {
        toast.error(result.error ?? "Erro ao alterar.");
      }
    });
  };

  const handleToggleRetroPass = (passId: string, allow: boolean) => {
    setRetroPassLoadingId(passId);
    startRetroPass(async () => {
      const result = await adminSetRetroactiveClaims(passId, allow);
      setRetroPassLoadingId(null);
      if (result.ok) {
        setVipRetroMap(prev => ({ ...prev, [passId]: allow }));
        toast.success(allow ? "Retroativo ativado para este passe." : "Retroativo desativado para este passe.");
      } else {
        toast.error(result.error ?? "Erro ao alterar passe.");
      }
    });
  };

  const handleSaveDisplay = () => {
    startDisplay(async () => {
      const result = await adminSavePassDisplayConfig(activeLabel, passDisplay);
      if (result.ok) {
        toast.success(`Textos de "${activeLabel}" salvos.`);
      } else {
        toast.error(result.error ?? "Erro ao salvar textos do passe.");
      }
    });
  };

  const handleReset = () => {
    if (!confirm(`Resetar "${activeLabel}" para os prêmios padrão?`)) return;
    startReset(async () => {
      const result = await adminResetSchedule(activeLabel);
      if (result.ok) {
        toast.success("Resetado para o padrão.");
        setDirtyMap(prev => ({ ...prev, [activeLabel]: false }));
        setCustomMap(prev => ({ ...prev, [activeLabel]: false }));
        // Recarrega o schedule padrão desse label
        const fresh = await adminGetSchedule(activeLabel);
        setScheduleMap(prev => ({ ...prev, [activeLabel]: fresh.schedule }));
        setRetroConfigMap(prev => ({ ...prev, [activeLabel]: fresh.allowRetroactiveClaims }));
        setDisplayMap(prev => ({
          ...prev,
          [activeLabel]: {
            displayTitle: fresh.displayTitle,
            description: fresh.description,
            flavorText: fresh.flavorText,
          },
        }));
      } else {
        toast.error(result.error ?? "Erro ao resetar.");
      }
    });
  };

  const editingReward = editingDay !== null ? schedule.find(r => r.day === editingDay) ?? null : null;

  const anyDirty = Object.values(dirtyMap).some(Boolean);

  return (
    <Card className="relative z-10">
      <button className="flex w-full items-center justify-between text-left" onClick={() => setOpen(v => !v)}>
        <div className="flex items-center gap-3">
          <Calendar size={18} className="text-purple-400" />
          <CardTitle className="text-base">Calendário de Prêmios VIP</CardTitle>
          {isCustom && (
            <span className="rounded-full bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 text-xs text-purple-300 font-semibold">
              Customizado
            </span>
          )}
          {anyDirty && (
            <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-xs text-amber-300 font-semibold flex items-center gap-1">
              <AlertTriangle size={10} /> Não salvo
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>

      {open && (
        <div className="mt-6 space-y-5">
          {/* Seletor de tipo de passe */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 uppercase tracking-widest">Tipo de passe:</span>
            {Object.keys(scheduleMap).map(label => (
              <button
                key={label}
                onClick={() => switchLabel(label)}
                disabled={loadPending}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors
                  ${activeLabel === label
                    ? "bg-purple-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700"}`}
              >
                {label}
                {dirtyMap[label] && <span className="ml-1 text-amber-400">*</span>}
              </button>
            ))}
            <Button
              onClick={() => setShowCreateTypeForm(v => !v)}
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 rounded-full border border-purple-500/30 px-3 text-xs text-purple-300 hover:bg-purple-500/10"
            >
              <Plus size={11} />
              Novo tipo
            </Button>
          </div>

          {showCreateTypeForm && (
            <div className="rounded-xl border border-purple-500/20 bg-slate-950/60 p-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-56 flex-1 space-y-1">
                  <label className="text-xs font-medium uppercase tracking-widest text-slate-500">Nome do novo passe</label>
                  <input
                    value={newPassLabel}
                    onChange={e => setNewPassLabel(e.target.value)}
                    placeholder="Ex: Passe Mestre"
                    className="w-full rounded-lg border border-border bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-purple-400/50 focus:outline-none"
                  />
                </div>
                <Button
                  onClick={handleCreatePassType}
                  disabled={createTypePending || !newPassLabel.trim()}
                  className="h-9 gap-2 bg-purple-600 text-xs text-white hover:bg-purple-500"
                >
                  <Plus size={13} />
                  {createTypePending ? "Criando..." : `Criar copiando ${activeLabel}`}
                </Button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                O novo tipo copia o calendário e a regra de retroativo do passe selecionado.
              </p>
            </div>
          )}

          {/* ── Gestão de passes deste tipo ── */}
          <div className="rounded-xl border border-yellow-500/15 bg-yellow-950/10 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-yellow-300 uppercase tracking-widest">Textos exibidos no passe</p>
                <p className="text-[11px] text-slate-500">
                  Ajusta o nome, a descrição curta e a frase que aparecem para o jogador neste tipo de passe.
                </p>
              </div>
              <Button
                onClick={handleSaveDisplay}
                disabled={displayPending}
                variant="outline"
                className="h-8 gap-2 border-yellow-500/30 bg-yellow-500/10 text-xs text-yellow-200 hover:bg-yellow-500/20"
              >
                <Save size={12} />
                {displayPending ? "Salvando..." : "Salvar textos"}
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Nome exibido</span>
                <input
                  value={passDisplay.displayTitle}
                  onChange={e => updateDisplayField("displayTitle", e.target.value)}
                  maxLength={80}
                  placeholder="Ex: Passe da Trapaça"
                  className="w-full rounded-lg border border-border bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-yellow-400/50 focus:outline-none"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Descrição curta</span>
                <input
                  value={passDisplay.description}
                  onChange={e => updateDisplayField("description", e.target.value)}
                  maxLength={160}
                  placeholder="Ex: Passe especial do evento"
                  className="w-full rounded-lg border border-border bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-yellow-400/50 focus:outline-none"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Frase do passe</span>
                <input
                  value={passDisplay.flavorText}
                  onChange={e => updateDisplayField("flavorText", e.target.value)}
                  maxLength={220}
                  placeholder="Ex: A Ordem deixou algo para trás..."
                  className="w-full rounded-lg border border-border bg-slate-900 px-3 py-2 text-sm italic text-slate-200 focus:border-yellow-400/50 focus:outline-none"
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-purple-500/10 bg-purple-950/10 p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs font-semibold text-purple-300 uppercase tracking-widest">
                Passes ativos — {activeLabel}
                {labelVips.length > 0 && (
                  <span className="ml-2 rounded-full bg-purple-500/20 px-2 py-0.5 text-purple-200 normal-case font-normal">
                    {labelVips.length} ativo{labelVips.length > 1 ? "s" : ""}
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleToggleRetroDefault}
                  disabled={retroConfigPending}
                  variant="ghost"
                  size="sm"
                  className={`gap-1.5 text-xs h-8 px-3 border ${passRetroDefault ? "text-green-400 border-green-500/30 hover:bg-green-500/10" : "text-slate-400 border-border hover:text-slate-200 hover:bg-slate-700/50"}`}
                  title="Define se os novos passes deste tipo permitem resgatar dias anteriores automaticamente."
                >
                  <RotateCcw size={11} />
                  {retroConfigPending ? "..." : passRetroDefault ? "Novos retroativos: ON" : "Novos retroativos: OFF"}
                </Button>
                <Button
                  onClick={() => setShowGrantForm(v => !v)}
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs h-8 px-3 border border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
                >
                  <UserPlus size={11} />
                  Conceder passe
                </Button>
              </div>
            </div>

            {/* Form de criação */}
            {showGrantForm && (
              <div className="space-y-3 pt-2 border-t border-purple-500/10">
                <div className="flex flex-wrap gap-3">
                  <select
                    value={selectedPlayerId}
                    onChange={e => setSelectedPlayerId(e.target.value)}
                    className="rounded-lg border border-border bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-400/50 flex-1 min-w-48"
                  >
                    <option value="">Selecionar jogador...</option>
                    {players.map(p => (
                      <option key={p.id} value={p.id}>{p.displayName}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-400 whitespace-nowrap">Dias:</label>
                    <input type="number" min={1} max={365} value={durationDays}
                      onChange={e => setDurationDays(Number(e.target.value))}
                      className="w-20 rounded-lg border border-border bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-400/50" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-400 whitespace-nowrap">Iniciar dia:</label>
                    <input type="number" min={1} max={30} value={startDay}
                      onChange={e => setStartDay(Math.max(1, Math.min(30, Number(e.target.value))))}
                      className="w-16 rounded-lg border border-border bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-400/50" />
                  </div>
                  <Button onClick={handleGrantForLabel} disabled={grantPending || !selectedPlayerId}
                    className="gap-2 bg-purple-600 hover:bg-purple-500 text-white text-xs h-9">
                    <UserPlus size={13} />
                    {grantPending ? "Criando..." : "Confirmar"}
                  </Button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-purple-500/20 bg-slate-950/60 px-3 py-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-200">Adicionar este passe para todos os jogadores ativos</p>
                    <p className="text-[11px] text-slate-500">
                      Usa o tipo <strong className="text-purple-300">{activeLabel}</strong>, a duração acima e o mesmo calendário de recompensas.
                    </p>
                    <label className="flex items-center gap-2 text-xs text-slate-400">
                      <input
                        type="checkbox"
                        checked={skipExistingPasses}
                        onChange={e => setSkipExistingPasses(e.target.checked)}
                        className="h-4 w-4 rounded border-border bg-slate-900 accent-purple-500"
                      />
                      Pular jogadores que ja possuem este passe ativo
                    </label>
                  </div>
                  <Button
                    onClick={handleGrantForAll}
                    disabled={grantAllPending}
                    variant="outline"
                    className="gap-2 border-yellow-500/40 bg-yellow-500/10 text-xs text-yellow-200 hover:bg-yellow-500/20"
                  >
                    <UserPlus size={13} />
                    {grantAllPending ? "Adicionando..." : "Adicionar para todos"}
                  </Button>
                </div>
              </div>
            )}

            {/* Lista de passes ativos deste tipo */}
            {labelVips.length > 0 && (
              <div className="space-y-1.5">
                {labelVips.map(vip => (
                  <div key={vip.passId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 bg-slate-900/50 px-3 py-2">
                    <div className="flex items-center gap-2 text-xs">
                      <Star size={11} className="text-yellow-400 shrink-0" />
                      <span className="font-semibold text-slate-200">{vip.displayName}</span>
                      <span className="flex items-center gap-1 text-slate-500"><Clock size={9} />{vip.daysRemaining}d</span>
                      <span className="flex items-center gap-1 text-slate-500"><CheckCircle2 size={9} />{Math.min(vip.claimedDays, vip.totalDays)}/{vip.totalDays}</span>
                      {vip.allowRetroactiveClaims && (
                        <span className="rounded-full bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 text-[9px] text-green-400">↩ retroativo</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        onClick={() => handleToggleRetroPass(vip.passId, !vip.allowRetroactiveClaims)}
                        disabled={retroPassPending && retroPassLoadingId === vip.passId}
                        variant="ghost"
                        size="sm"
                        className={`h-7 gap-1.5 border px-2 text-[10px] ${vip.allowRetroactiveClaims ? "border-green-500/30 text-green-400 hover:bg-green-500/10" : "border-border text-slate-400 hover:bg-slate-800 hover:text-slate-200"}`}
                        title="Altera retroatividade apenas deste passe ativo."
                      >
                        <RotateCcw size={10} />
                        {retroPassPending && retroPassLoadingId === vip.passId ? "..." : vip.allowRetroactiveClaims ? "Retroativo ON" : "Retroativo OFF"}
                      </Button>
                      <Button
                        onClick={() => handleRevokeVip(vip.passId, vip.displayName)}
                        disabled={revokePending && revokingId === vip.passId}
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 border border-red-500/30 px-2 text-[10px] text-red-400 hover:bg-red-500/10"
                        title="Remove este passe do jogador (revoga o VIP)."
                      >
                        <UserMinus size={10} />
                        {revokePending && revokingId === vip.passId ? "..." : "Remover"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {labelVips.length === 0 && (
              <p className="text-xs text-slate-600">Nenhum jogador com este passe ativo.</p>
            )}
          </div>

          {/* Toolbar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-xs text-slate-400">
                Editando: <strong className="text-purple-300">{activeLabel}</strong>. Clique em um dia para editar os slots. Salve para ativar.
              </p>
              <div className="flex items-center gap-2">
                {isCustom && (
                  <Button onClick={handleReset} disabled={resetPending} variant="ghost"
                    className="gap-2 text-xs text-slate-400 hover:text-red-400 h-8">
                    <RotateCcw size={12} />
                    {resetPending ? "Resetando..." : "Resetar padrão"}
                  </Button>
                )}
                <Button onClick={handleSave} disabled={savePending || !dirty}
                  className="gap-2 text-xs h-8 bg-purple-600 hover:bg-purple-500 text-white">
                  <Save size={12} />
                  {savePending ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>
            </div>
            {saveError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                <AlertTriangle size={12} className="shrink-0" />
                <span>Erro ao salvar: {saveError}</span>
                <button onClick={() => setSaveError(null)} className="ml-auto text-red-400/60 hover:text-red-400"><X size={12} /></button>
              </div>
            )}
          </div>

          {/* Grid de dias */}
          <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-10 gap-2">
            {schedule.map((reward) => (
              <button
                key={reward.day}
                onClick={() => setEditingDay(editingDay === reward.day ? null : reward.day)}
                className={`relative rounded-xl border p-2 flex flex-col items-center gap-1 transition-colors text-center
                  ${editingDay === reward.day
                    ? "border-purple-400/60 bg-purple-950/30 ring-1 ring-purple-400/30"
                    : "border-border bg-slate-900/50 hover:border-purple-400/40 hover:bg-purple-950/10"}
                  ${reward.isMilestone ? "ring-1 ring-purple-500/20" : ""}`}
                title={`Dia ${reward.day}: ${reward.label}`}
              >
                <span className={`text-[10px] font-bold ${editingDay === reward.day ? "text-purple-400" : "text-slate-500"}`}>
                  {reward.day}
                </span>
                <span className="text-lg leading-none">{reward.emoji}</span>
                {reward.isMilestone && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full flex items-center justify-center">
                    <Star size={6} className="text-white" fill="white" />
                  </div>
                )}
                <span className="text-[8px] text-slate-600">{reward.type === "COINS" ? "🪙" : reward.type === "EGG" ? "🥚" : reward.type === "STICKER_PACK" ? "🎴" : reward.type === "ZIKALOOT" ? "🎟️" : reward.type === "SHOP_ITEM" ? "📦" : reward.type === "FOOD" ? "🍖" : "🍬"}</span>
              </button>
            ))}
          </div>

          {/* Editor inline */}
          {editingReward && (
            <DayEditor
              reward={editingReward}
              onChange={(ds) => updateDay(editingReward.day, ds)}
              onClose={() => setEditingDay(null)}
            />
          )}
        </div>
      )}
    </Card>
  );
}

// ── Editor de um dia ──────────────────────────────────────────────────────────

function DayEditor({ reward, onChange, onClose }: {
  reward: DayReward;
  onChange: (ds: DayState) => void;
  onClose: () => void;
}) {
  const [state, setState] = useState<DayState>(() => rewardToDayState(reward));
  const [showAdd, setShowAdd] = useState(false);

  const update = (patch: Partial<DayState>) => {
    const next = { ...state, ...patch };
    setState(next);
    onChange(next);
  };

  const updateSlot = (id: string, patch: Partial<Slot>) => {
    const next = { ...state, slots: state.slots.map(s => s.id === id ? { ...s, ...patch } as Slot : s) };
    setState(next);
    onChange(next);
  };

  const removeSlot = (id: string) => {
    const next = { ...state, slots: state.slots.filter(s => s.id !== id) };
    setState(next);
    onChange(next);
  };

  const addSlot = (kind: SlotKind) => {
    setShowAdd(false);
    const defaults: Record<SlotKind, Slot> = {
      COINS:        { id: uid(), kind: "COINS", amount: 500 },
      EGG:          { id: uid(), kind: "EGG", eggType: "COMMON", qty: 1 },
      FOOD:         { id: uid(), kind: "FOOD", qty: 1 },
      SWEET:        { id: uid(), kind: "SWEET", qty: 1 },
      STICKER_PACK: { id: uid(), kind: "STICKER_PACK", packName: "Pacote Comum" },
      SHOP_ITEM:    { id: uid(), kind: "SHOP_ITEM", itemName: "" },
      ZIKALOOT:     { id: uid(), kind: "ZIKALOOT", special: false },
    };
    const next = { ...state, slots: [...state.slots, defaults[kind]] };
    setState(next);
    onChange(next);
  };

  // Kinds já presentes (para desabilitar duplicatas onde faz sentido)
  const presentKinds = new Set(state.slots.map(s => s.kind));

  return (
    <div className="relative z-20 rounded-2xl border border-purple-400/20 bg-purple-950/10 p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{state.emoji}</span>
          <div>
            <p className="text-sm font-semibold text-white">Editando Dia {reward.day}</p>
            <p className="text-xs text-slate-400">{state.slots.length} recompensa{state.slots.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={16} /></button>
      </div>

      {/* Campos de metadata do dia */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-widest">Emoji</label>
          <input type="text" value={state.emoji} maxLength={4}
            onChange={e => update({ emoji: e.target.value })}
            className="w-full rounded-lg border border-border bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-400/50" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-widest">Descrição (label)</label>
          <input type="text" value={state.label}
            onChange={e => update({ label: e.target.value })}
            className="w-full rounded-lg border border-border bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-400/50"
            placeholder="Ex: 400 ZikaCoins + Ovo Comum" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-widest">Marco (anel roxo)</label>
          <label className="flex items-center gap-2 cursor-pointer h-10">
            <div onClick={() => update({ isMilestone: !state.isMilestone })}
              className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 cursor-pointer ${state.isMilestone ? "bg-purple-500" : "bg-slate-700"}`}>
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${state.isMilestone ? "translate-x-5" : ""}`} />
            </div>
            <span className="text-sm text-slate-300">{state.isMilestone ? "⭐ Marco" : "Normal"}</span>
          </label>
        </div>
      </div>

      {/* Lista de slots */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Itens da recompensa</p>

        {state.slots.length === 0 && (
          <p className="text-xs text-amber-400/80 italic py-2">Nenhum item. Adicione pelo menos um antes de salvar.</p>
        )}

        {state.slots.map(slot => (
          <SlotEditor
            key={slot.id}
            slot={slot}
            onUpdate={(patch) => updateSlot(slot.id, patch)}
            onRemove={() => removeSlot(slot.id)}
          />
        ))}
      </div>

      {/* Adicionar slot */}
      <div className="relative">
        <Button type="button" variant="outline" onClick={() => setShowAdd(v => !v)}
          className="gap-2 text-xs h-8 border-dashed border-slate-600 text-slate-400 hover:text-slate-200 hover:border-purple-400/50">
          <Plus size={12} />
          Adicionar recompensa
        </Button>

        {showAdd && (
          <div className="absolute top-10 left-0 z-50 rounded-xl border border-border bg-slate-900 shadow-2xl p-2 grid grid-cols-2 gap-1 w-64">
            {(Object.entries(SLOT_META) as [SlotKind, typeof SLOT_META[SlotKind]][]).map(([kind, meta]) => {
              const alreadyHas = presentKinds.has(kind);
              const blockedByEgg = kind === "FOOD" && (presentKinds.has("EGG"));
              const blockedByFood = kind === "EGG" && (presentKinds.has("FOOD") || presentKinds.has("SWEET"));
              const disabled = (alreadyHas && !["SHOP_ITEM"].includes(kind)) || blockedByEgg || blockedByFood;
              return (
                <button key={kind} disabled={disabled} onClick={() => addSlot(kind)}
                  className={`rounded-lg px-3 py-2 text-left text-xs transition-colors
                    ${disabled
                      ? "opacity-30 cursor-not-allowed text-slate-500"
                      : "hover:bg-slate-800 text-slate-200"}`}>
                  <span className="mr-1">{meta.emoji}</span>{meta.label}
                  {alreadyHas && <span className="ml-1 text-slate-600">✓</span>}
                </button>
              );
            })}
            <button onClick={() => setShowAdd(false)}
              className="col-span-2 rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800 text-center">
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="rounded-xl border border-border bg-slate-900/50 px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
        <Check size={14} className="text-green-400 shrink-0" />
        <span className="text-slate-400">Preview:</span>
        <span className="text-lg">{state.emoji}</span>
        <span className="text-slate-200 font-medium">{state.label}</span>
        {state.isMilestone && <span className="text-purple-400 text-xs">⭐ Marco</span>}
        <span className="text-slate-500 text-xs">
          [{state.slots.map(s => `${SLOT_META[s.kind].emoji} ${s.kind}`).join(", ")}]
        </span>
      </div>
    </div>
  );
}

// ── Editor de um slot individual ──────────────────────────────────────────────

function SlotEditor({ slot, onUpdate, onRemove }: {
  slot: Slot;
  onUpdate: (patch: Partial<Slot>) => void;
  onRemove: () => void;
}) {
  const meta = SLOT_META[slot.kind];

  return (
    <div className={`rounded-xl border p-3 ${meta.color}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span>{meta.emoji}</span>
          <span className="text-xs font-semibold text-slate-300">{meta.label}</span>
        </div>
        <button onClick={onRemove} title="Remover este item" className="text-slate-500 hover:text-red-400 transition-colors">
          <Trash2 size={12} />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {slot.kind === "COINS" && (
          <div className="col-span-2 sm:col-span-3 space-y-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-widest">Quantidade</label>
            <input type="number" min={0} max={99999} step={50}
              value={slot.amount}
              onChange={e => onUpdate({ amount: Number(e.target.value) || 0 })}
              className="w-full rounded-lg border border-border bg-slate-950 px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-yellow-400/50" />
          </div>
        )}

        {slot.kind === "EGG" && (
          <>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 uppercase tracking-widest">Tipo de ovo</label>
              <select value={slot.eggType}
                onChange={e => onUpdate({ eggType: e.target.value as "COMMON" | "SPECIAL" | "RARE" | "LAB" })}
                className="w-full rounded-lg border border-border bg-slate-950 px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-teal-400/50">
                <option value="COMMON">Comum</option>
                <option value="SPECIAL">Especial</option>
                <option value="RARE">Raro</option>
                <option value="LAB">Laboratório</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 uppercase tracking-widest">Quantidade</label>
              <input type="number" min={1} max={10}
                value={slot.qty}
                onChange={e => onUpdate({ qty: Math.max(1, Number(e.target.value) || 1) })}
                className="w-full rounded-lg border border-border bg-slate-950 px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-teal-400/50" />
            </div>
          </>
        )}

        {(slot.kind === "FOOD" || slot.kind === "SWEET") && (
          <div className="col-span-2 sm:col-span-3 space-y-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-widest">Quantidade</label>
            <input type="number" min={1} max={20}
              value={slot.qty}
              onChange={e => onUpdate({ qty: Math.max(1, Number(e.target.value) || 1) })}
              className="w-full rounded-lg border border-border bg-slate-950 px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-orange-400/50" />
          </div>
        )}

        {slot.kind === "STICKER_PACK" && (
          <div className="col-span-2 sm:col-span-3 space-y-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-widest">Nome do pacote</label>
            <input type="text" value={slot.packName}
              onChange={e => onUpdate({ packName: e.target.value })}
              className="w-full rounded-lg border border-border bg-slate-950 px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-400/50"
              placeholder="Ex: Pacote Deluxe" />
          </div>
        )}

        {slot.kind === "SHOP_ITEM" && (
          <div className="col-span-2 sm:col-span-3 space-y-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-widest">Nome do item no Shop</label>
            <input type="text" value={slot.itemName}
              onChange={e => onUpdate({ itemName: e.target.value })}
              className="w-full rounded-lg border border-border bg-slate-950 px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-purple-400/50"
              placeholder="Ex: Política de Fraqueza" />
          </div>
        )}

        {slot.kind === "ZIKALOOT" && (
          <div className="col-span-2 sm:col-span-3 space-y-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-widest">Tipo</label>
            <label className="flex items-center gap-2 cursor-pointer h-9">
              <div onClick={() => onUpdate({ special: !slot.special })}
                className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 cursor-pointer ${slot.special ? "bg-yellow-500" : "bg-slate-700"}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${slot.special ? "translate-x-5" : ""}`} />
              </div>
              <span className="text-sm text-slate-300">{slot.special ? "⭐ Especial" : "Normal"}</span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
