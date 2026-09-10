"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setMascotRoutineV2Action, simulateRefugeV2Action, updateActiveBondV2Action } from "../actions";
import type { RefugeLocation } from "@/lib/mascot-bonds-v2";

export function RoutineSelect({ mascotId, value }: { mascotId: string; value: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      value={value}
      disabled={pending}
      onChange={(event) => {
        const next = event.target.value as RefugeLocation | "NONE";
        startTransition(async () => {
          const result = await setMascotRoutineV2Action(mascotId, next);
          if (result.error) toast.error(result.error);
          else toast.success(next === "NONE" ? "Rotina removida." : "Rotina atualizada.");
        });
      }}
      className="w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-fuchsia-400/50 disabled:opacity-50"
    >
      <option value="NONE">Sem rotina</option>
      <option value="GARDEN">🌱 Horta</option>
      <option value="TRAINING">🥊 Campo de Treino</option>
      <option value="REST">🌙 Descanso</option>
      <option value="YARD">✨ Pátio</option>
    </select>
  );
}

export function SimulateRefugeButton({ location }: { location: RefugeLocation }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => {
        const result = await simulateRefugeV2Action(location);
        if (result.error) toast.error(result.error);
        else toast.success(result.message ?? "Momento processado.");
      })}
      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
    >
      {pending ? "Processando..." : "Simular momento"}
    </button>
  );
}

export function BondV2Buttons({ relationId, active, protectedBond }: { relationId: string; active: boolean; protectedBond: boolean }) {
  const [pending, startTransition] = useTransition();
  function run(operation: "TOGGLE_ACTIVE" | "TOGGLE_PROTECTED") {
    startTransition(async () => {
      const result = await updateActiveBondV2Action(relationId, operation);
      if (result.error) toast.error(result.error);
      else toast.success("Laço atualizado.");
    });
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      <button disabled={pending} onClick={() => run("TOGGLE_ACTIVE")} className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-slate-300 hover:bg-white/5 disabled:opacity-50">
        {active ? "Adormecer" : "Reativar"}
      </button>
      <button disabled={pending} onClick={() => run("TOGGLE_PROTECTED")} className={`rounded-md border px-2 py-1 text-[10px] disabled:opacity-50 ${protectedBond ? "border-amber-400/40 bg-amber-400/10 text-amber-200" : "border-white/10 text-slate-300 hover:bg-white/5"}`}>
        {protectedBond ? "★ Protegido" : "☆ Proteger"}
      </button>
    </div>
  );
}
