"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Calendar, ChevronDown, ChevronUp, Edit2, RotateCcw, Save,
  Star, X, Check, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import type { DayReward } from "@/app/(app)/passe-apoiador/schedule";
import { adminSaveSchedule, adminResetSchedule } from "@/app/(app)/passe-apoiador/actions";

const REWARD_TYPES = [
  { value: "COINS",       label: "ZikaCoins",       emoji: "🪙" },
  { value: "EGG",         label: "Ovo",             emoji: "🥚" },
  { value: "FOOD",        label: "Comida Mascote",  emoji: "🍖" },
  { value: "SWEET",       label: "Doce Mascote",    emoji: "🍬" },
  { value: "STICKER_PACK",label: "Pacote Figurinha",emoji: "🃏" },
  { value: "SHOP_ITEM",   label: "Item do Shop",    emoji: "📦" },
  { value: "ZIKALOOT",    label: "Ticket ZikaLoot", emoji: "🎟️" },
] as const;

const EGG_TYPES = ["COMMON", "SPECIAL", "RARE"];

interface Props {
  initialSchedule: DayReward[];
  isCustom: boolean;
}

export function VipSchedulePanel({ initialSchedule, isCustom }: Props) {
  const [open, setOpen] = useState(false);
  const [schedule, setSchedule] = useState<DayReward[]>(initialSchedule);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [savePending, startSave] = useTransition();
  const [resetPending, startReset] = useTransition();

  const updateDay = (day: number, patch: Partial<DayReward>) => {
    setSchedule(prev => prev.map(r => r.day === day ? { ...r, ...patch } : r));
    setDirty(true);
  };

  const handleSave = () => {
    startSave(async () => {
      const result = await adminSaveSchedule(schedule);
      if (result.ok) {
        toast.success("Calendário salvo com sucesso!");
        setDirty(false);
      } else {
        toast.error(result.error ?? "Erro ao salvar.");
      }
    });
  };

  const handleReset = () => {
    if (!confirm("Resetar para os prêmios padrão? Isso apaga a configuração customizada.")) return;
    startReset(async () => {
      const result = await adminResetSchedule();
      if (result.ok) {
        toast.success("Calendário resetado para o padrão.");
        setDirty(false);
        // Recarrega a página para puxar o fallback do servidor
        window.location.reload();
      } else {
        toast.error(result.error ?? "Erro ao resetar.");
      }
    });
  };

  const editingReward = editingDay !== null ? schedule.find(r => r.day === editingDay) ?? null : null;

  return (
    <Card>
      <button
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-3">
          <Calendar size={18} className="text-purple-400" />
          <CardTitle className="text-base">Calendário de Prêmios VIP</CardTitle>
          {isCustom && (
            <span className="rounded-full bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 text-xs text-purple-300 font-semibold">
              Customizado
            </span>
          )}
          {dirty && (
            <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-xs text-amber-300 font-semibold flex items-center gap-1">
              <AlertTriangle size={10} /> Não salvo
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>

      {open && (
        <div className="mt-6 space-y-5">
          {/* Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-xs text-slate-400">
              Clique em qualquer dia para editar o prêmio. As alterações só ficam ativas após salvar.
            </p>
            <div className="flex items-center gap-2">
              {isCustom && (
                <Button
                  onClick={handleReset}
                  disabled={resetPending}
                  variant="ghost"
                  className="gap-2 text-xs text-slate-400 hover:text-red-400 h-8"
                >
                  <RotateCcw size={12} />
                  {resetPending ? "Resetando..." : "Resetar padrão"}
                </Button>
              )}
              <Button
                onClick={handleSave}
                disabled={savePending || !dirty}
                className="gap-2 text-xs h-8 bg-purple-600 hover:bg-purple-500 text-white"
              >
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
                    : "border-border bg-slate-900/50 hover:border-purple-400/40 hover:bg-purple-950/10"
                  }
                  ${reward.isMilestone ? "ring-1 ring-purple-500/20" : ""}
                `}
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
                <Edit2 size={8} className="text-slate-600" />
              </button>
            ))}
          </div>

          {/* Editor inline do dia selecionado */}
          {editingReward && (
            <DayEditor
              reward={editingReward}
              onChange={(patch) => updateDay(editingReward.day, patch)}
              onClose={() => setEditingDay(null)}
            />
          )}
        </div>
      )}
    </Card>
  );
}

// ── Editor de um dia ──────────────────────────────────────────────────────────

function DayEditor({
  reward,
  onChange,
  onClose,
}: {
  reward: DayReward;
  onChange: (patch: Partial<DayReward>) => void;
  onClose: () => void;
}) {
  const typeInfo = REWARD_TYPES.find(t => t.value === reward.type);

  return (
    <div className="rounded-2xl border border-purple-400/20 bg-purple-950/10 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{reward.emoji}</span>
          <div>
            <p className="text-sm font-semibold text-white">Editando Dia {reward.day}</p>
            <p className="text-xs text-slate-400">{typeInfo?.label}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Emoji */}
        <Field label="Emoji">
          <input
            type="text"
            value={reward.emoji}
            onChange={e => onChange({ emoji: e.target.value })}
            className="w-full rounded-lg border border-border bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-400/50"
            placeholder="🎁"
            maxLength={4}
          />
        </Field>

        {/* Label */}
        <Field label="Descrição" className="sm:col-span-2">
          <input
            type="text"
            value={reward.label}
            onChange={e => onChange({ label: e.target.value })}
            className="w-full rounded-lg border border-border bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-400/50"
            placeholder="Ex: 200 ZikaCoins + Ovo"
          />
        </Field>

        {/* Tipo */}
        <Field label="Tipo de recompensa">
          <select
            value={reward.type}
            onChange={e => onChange({ type: e.target.value as DayReward["type"] })}
            className="w-full rounded-lg border border-border bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-400/50"
          >
            {REWARD_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
            ))}
          </select>
        </Field>

        {/* Milestone */}
        <Field label="Marco especial (anel roxo)">
          <label className="flex items-center gap-2 cursor-pointer h-10">
            <div
              onClick={() => onChange({ isMilestone: !reward.isMilestone })}
              className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 cursor-pointer
                ${reward.isMilestone ? "bg-purple-500" : "bg-slate-700"}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${reward.isMilestone ? "translate-x-5" : ""}`} />
            </div>
            <span className="text-sm text-slate-300">{reward.isMilestone ? "Sim" : "Não"}</span>
          </label>
        </Field>

        {/* ZikaCoins */}
        <Field label="ZikaCoins (adicional)">
          <input
            type="number"
            min={0}
            value={reward.coins ?? 0}
            onChange={e => onChange({ coins: Number(e.target.value) || undefined })}
            className="w-full rounded-lg border border-border bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-400/50"
            placeholder="0"
          />
        </Field>

        {/* Campos condicionais por tipo */}
        {(reward.type === "EGG") && (
          <Field label="Tipo de ovo">
            <select
              value={reward.eggType ?? "COMMON"}
              onChange={e => onChange({ eggType: e.target.value })}
              className="w-full rounded-lg border border-border bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-400/50"
            >
              {EGG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        )}

        {(reward.type === "EGG") && (
          <Field label="Quantidade de ovos">
            <input
              type="number" min={1} max={10}
              value={reward.foodQty ?? 1}
              onChange={e => onChange({ foodQty: Number(e.target.value) })}
              className="w-full rounded-lg border border-border bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-400/50"
            />
          </Field>
        )}

        {(reward.type === "FOOD" || reward.type === "SWEET") && (
          <>
            <Field label="Tipo de comida">
              <select
                value={reward.foodType ?? reward.type}
                onChange={e => onChange({ foodType: e.target.value })}
                className="w-full rounded-lg border border-border bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-400/50"
              >
                <option value="FOOD">Comida normal</option>
                <option value="SWEET">Doce / Guloseima</option>
              </select>
            </Field>
            <Field label="Quantidade">
              <input
                type="number" min={1} max={20}
                value={reward.foodQty ?? 1}
                onChange={e => onChange({ foodQty: Number(e.target.value) })}
                className="w-full rounded-lg border border-border bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-400/50"
              />
            </Field>
          </>
        )}

        {reward.type === "STICKER_PACK" && (
          <Field label="Nome do pacote" className="sm:col-span-2">
            <input
              type="text"
              value={reward.packName ?? ""}
              onChange={e => onChange({ packName: e.target.value })}
              className="w-full rounded-lg border border-border bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-400/50"
              placeholder="Ex: Pacote Deluxe"
            />
          </Field>
        )}

        {(reward.type === "SHOP_ITEM" || reward.type === "STICKER_PACK") && (
          <Field label="Item do Shop (nome)" className={reward.type === "SHOP_ITEM" ? "sm:col-span-2" : ""}>
            <input
              type="text"
              value={reward.shopItemName ?? ""}
              onChange={e => onChange({ shopItemName: e.target.value || undefined })}
              className="w-full rounded-lg border border-border bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-400/50"
              placeholder={reward.type === "STICKER_PACK" ? "Opcional: item extra" : "Ex: Política de Fraqueza"}
            />
          </Field>
        )}

        {reward.type === "ZIKALOOT" && (
          <Field label="Ticket especial?">
            <label className="flex items-center gap-2 cursor-pointer h-10">
              <div
                onClick={() => onChange({ zikalootSpecial: !reward.zikalootSpecial })}
                className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 cursor-pointer
                  ${reward.zikalootSpecial ? "bg-yellow-500" : "bg-slate-700"}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${reward.zikalootSpecial ? "translate-x-5" : ""}`} />
              </div>
              <span className="text-sm text-slate-300">{reward.zikalootSpecial ? "Especial" : "Normal"}</span>
            </label>
          </Field>
        )}
      </div>

      {/* Preview */}
      <div className="rounded-xl border border-border bg-slate-900/50 px-4 py-3 flex items-center gap-3 text-sm">
        <Check size={14} className="text-green-400 shrink-0" />
        <span className="text-slate-400">Preview: </span>
        <span className="text-lg">{reward.emoji}</span>
        <span className="text-slate-200 font-medium">{reward.label}</span>
        {reward.coins ? <span className="text-yellow-400 text-xs">+{reward.coins} 🪙</span> : null}
        {reward.isMilestone && <span className="text-purple-400 text-xs">⭐ Marco</span>}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="text-xs font-medium text-slate-400 uppercase tracking-widest">{label}</label>
      {children}
    </div>
  );
}
