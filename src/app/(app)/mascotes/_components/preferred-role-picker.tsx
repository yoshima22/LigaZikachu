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

  return (
    <div className="flex items-center gap-1">
      <span className="text-[9px] text-slate-500">Postura:</span>
      <select
        value={value}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 rounded-md border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300 outline-none hover:border-[#FFCB05]/50 disabled:opacity-50"
        title="Postura de combate levada ao equipar em equipes (Liga Semanal, Arena Z, Desafio Sincronizado)"
      >
        <option value="">Auto ({getCombatRoleLabel(recommended)})</option>
        {COMBAT_ROLE_OPTIONS.map((role) => (
          <option key={role.value} value={role.value}>{role.label}</option>
        ))}
      </select>
      <CombatRoleHelpButton role={value || recommended} stats={{ ...stats }} mode="GENERAL" className="h-5 w-5" />
    </div>
  );
}
