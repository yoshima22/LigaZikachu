"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { COMBAT_ROLE_OPTIONS, getCombatRoleLabel, recommendCombatRole } from "@/lib/combat-roles";
import { CombatRoleHelpButton } from "@/components/combat-role-help";
import { setMascotPreferredCombatRoleAction } from "../actions";

type Stats = {
  statForce: number; statAgility: number; statVitality: number; statInstinct: number; statCharisma: number;
};

export function PreferredRolePicker({
  mascotId,
  initial,
  stats,
}: {
  mascotId: string;
  initial: string | null | undefined;
  stats: Stats;
}) {
  const [value, setValue] = useState<string>(initial ?? "");
  const [pending, startTransition] = useTransition();
  const recommended = recommendCombatRole(stats);

  const onChange = (next: string) => {
    const previous = value;
    setValue(next); // otimista
    startTransition(async () => {
      const res = await setMascotPreferredCombatRoleAction(mascotId, next);
      if (!res.ok) {
        setValue(previous);
        toast.error(res.error ?? "Não foi possível salvar a postura.");
      } else {
        toast.success(next ? `Postura salva: ${getCombatRoleLabel(next)}.` : "Postura voltou para Auto (recomendada).");
      }
    });
  };

  const custom = Boolean(value);

  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 transition-colors ${
        custom ? "border-[#FFCB05]/40 bg-[#FFCB05]/5" : "border-slate-700/60 bg-slate-900/50"
      }`}
      title="Postura de combate levada ao equipar em equipes (Liga Semanal, Arena Z, Arena PvP, Desafio Sincronizado)"
    >
      <span className="shrink-0 text-[11px]" aria-hidden>⚔️</span>
      <div className="flex min-w-0 flex-1 flex-col leading-none">
        <span className="text-[8px] font-semibold uppercase tracking-wide text-slate-500">
          Postura {custom ? "salva" : "· automática"}
        </span>
        <select
          value={value}
          disabled={pending}
          onChange={(e) => onChange(e.target.value)}
          className={`mt-0.5 w-full min-w-0 cursor-pointer rounded-md border bg-slate-950 px-1.5 py-1 text-[11px] font-bold outline-none transition-colors disabled:opacity-50 ${
            custom ? "border-[#FFCB05]/50 text-[#FFCB05] hover:border-[#FFCB05]" : "border-slate-700 text-slate-200 hover:border-[#FFCB05]/50"
          }`}
        >
          <option value="">✨ Auto — {getCombatRoleLabel(recommended)}</option>
          {COMBAT_ROLE_OPTIONS.map((role) => (
            <option key={role.value} value={role.value}>{role.label}</option>
          ))}
        </select>
      </div>
      <CombatRoleHelpButton role={value || recommended} stats={{ ...stats }} mode="GENERAL" className="h-6 w-6 shrink-0" />
    </div>
  );
}
