"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Calendar, ChevronDown, ChevronUp, RotateCcw, Save,
  Star, X, Check, AlertTriangle, Plus, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import type { DayReward } from "@/app/(app)/passe-apoiador/schedule";
import { adminSaveSchedule, adminResetSchedule, adminGetSchedule } from "@/app/(app)/passe-apoiador/actions";

// ── Tipos de slot ─────────────────────────────────────────────────────────────

type SlotKind = "COINS" | "EGG" | "FOOD" | "SWEET" | "STICKER_PACK" | "SHOP_ITEM" | "ZIKALOOT";

type Slot =
  | { id: string; kind: "COINS"; amount: number }
  | { id: string; kind: "EGG"; eggType: "COMMON" | "SPECIAL" | "RARE"; qty: number }
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
  STICKER_PACK:{ label: "Pacote Figurinha", emoji: "🃏", color: "border-blue-500/30 bg-blue-950/10" },
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
    slots.push({ id: uid(), kind: "EGG", eggType: (reward.eggType as "COMMON" | "SPECIAL" | "RARE") ?? "COMMON", qty: reward.foodQty ?? 1 });

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

// ── Panel principal ───────────────────────────────────────────────────────────

interface ScheduleEntry { label: string; schedule: DayReward[]; isCustom: boolean; }

interface Props {
  // Todos os schedules conhecidos (label → {schedule, isCustom})
  allSchedules: ScheduleEntry[];
}

export function VipSchedulePanel({ allSchedules }: Props) {
  const [open, setOpen] = useState(false);
  const [activeLabel, setActiveLabel] = useState(allSchedules[0]?.label ?? "Passe Apoiador");
  const [scheduleMap, setScheduleMap] = useState<Record<string, DayReward[]>>(
    () => Object.fromEntries(allSchedules.map(s => [s.label, s.schedule]))
  );
  const [customMap, setCustomMap] = useState<Record<string, boolean>>(
    () => Object.fromEntries(allSchedules.map(s => [s.label, s.isCustom]))
  );
  const [dirtyMap, setDirtyMap] = useState<Record<string, boolean>>({});
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [loadPending, startLoad] = useTransition();
  const [savePending, startSave] = useTransition();
  const [resetPending, startReset] = useTransition();

  const schedule = scheduleMap[activeLabel] ?? allSchedules[0]?.schedule ?? [];
  const isCustom = customMap[activeLabel] ?? false;
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
      });
    }
  };

  const updateDay = (day: number, ds: DayState) => {
    setScheduleMap(prev => ({
      ...prev,
      [activeLabel]: (prev[activeLabel] ?? []).map(r => r.day === day ? dayStateToReward(day, ds) : r),
    }));
    setDirtyMap(prev => ({ ...prev, [activeLabel]: true }));
  };

  const handleSave = () => {
    startSave(async () => {
      const result = await adminSaveSchedule(schedule, activeLabel);
      if (result.ok) {
        toast.success(`Calendário "${activeLabel}" salvo!`);
        setDirtyMap(prev => ({ ...prev, [activeLabel]: false }));
        setCustomMap(prev => ({ ...prev, [activeLabel]: true }));
      } else {
        toast.error(result.error ?? "Erro ao salvar.");
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
            {allSchedules.map(s => (
              <button
                key={s.label}
                onClick={() => switchLabel(s.label)}
                disabled={loadPending}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors
                  ${activeLabel === s.label
                    ? "bg-purple-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700"}`}
              >
                {s.label}
                {dirtyMap[s.label] && <span className="ml-1 text-amber-400">•</span>}
              </button>
            ))}
          </div>

          {/* Toolbar */}
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
                <span className="text-[8px] text-slate-600">{reward.type === "COINS" ? "🪙" : reward.type === "EGG" ? "🥚" : reward.type === "STICKER_PACK" ? "🃏" : reward.type === "ZIKALOOT" ? "🎟️" : reward.type === "SHOP_ITEM" ? "📦" : reward.type === "FOOD" ? "🍖" : "🍬"}</span>
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
          <p className="text-xs text-slate-500 italic py-2">Nenhum item. Adicione pelo menos um abaixo.</p>
        )}

        {state.slots.map(slot => (
          <SlotEditor
            key={slot.id}
            slot={slot}
            onUpdate={(patch) => updateSlot(slot.id, patch)}
            onRemove={() => removeSlot(slot.id)}
            canRemove={state.slots.length > 1}
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

function SlotEditor({ slot, onUpdate, onRemove, canRemove }: {
  slot: Slot;
  onUpdate: (patch: Partial<Slot>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const meta = SLOT_META[slot.kind];

  return (
    <div className={`rounded-xl border p-3 ${meta.color}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span>{meta.emoji}</span>
          <span className="text-xs font-semibold text-slate-300">{meta.label}</span>
        </div>
        {canRemove && (
          <button onClick={onRemove} className="text-slate-500 hover:text-red-400 transition-colors">
            <Trash2 size={12} />
          </button>
        )}
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
                onChange={e => onUpdate({ eggType: e.target.value as "COMMON" | "SPECIAL" | "RARE" })}
                className="w-full rounded-lg border border-border bg-slate-950 px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-teal-400/50">
                <option value="COMMON">Comum</option>
                <option value="SPECIAL">Especial</option>
                <option value="RARE">Raro</option>
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
