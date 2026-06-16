"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { COMBAT_ROLE_OPTIONS, normalizeCombatRole } from "@/lib/combat-roles";
import { setArenaTeamMemberCombatRoleAction } from "../actions";

export function CombatRoleSelect({
  teamId,
  mascotId,
  value,
}: {
  teamId: string;
  mascotId: string;
  value: string | null | undefined;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={normalizeCombatRole(value)}
      disabled={pending}
      onChange={(event) => {
        const next = event.target.value;
        startTransition(async () => {
          const result = await setArenaTeamMemberCombatRoleAction(teamId, mascotId, next);
          if (result.error) toast.error(result.error);
          else toast.success("Postura atualizada.");
        });
      }}
      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-1.5 py-1 text-[10px] font-semibold text-slate-300 outline-none hover:border-[#FFCB05]/50 disabled:opacity-50"
      title="Postura de combate"
    >
      {COMBAT_ROLE_OPTIONS.map((role) => (
        <option key={role.value} value={role.value}>
          {role.label}
        </option>
      ))}
    </select>
  );
}

