"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createBondEventAction, resolveBondEventAction, updateBondBehaviorAction } from "../actions";
import { BOND_BEHAVIOR_LABEL, type BondBehavior, type BondOption } from "@/lib/mascot-bonds";

export function BehaviorSelect({ value }: { value: BondBehavior }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <select
      value={value}
      disabled={pending}
      onChange={(event) => {
        const next = event.target.value as BondBehavior;
        startTransition(async () => {
          const result = await updateBondBehaviorAction(next);
          if (result.error) toast.error(result.error);
          else {
            toast.success("Comportamento de lacos atualizado.");
            router.refresh();
          }
        });
      }}
      className="rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none"
    >
      {Object.entries(BOND_BEHAVIOR_LABEL).map(([key, label]) => (
        <option key={key} value={key}>{label}</option>
      ))}
    </select>
  );
}

export function CreateBondEventButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => {
        const result = await createBondEventAction();
        if (result.error) toast.error(result.error);
        else {
          toast.success("Um novo evento de laco apareceu.");
          router.refresh();
        }
      })}
      className="rounded-xl bg-[#FFCB05] px-4 py-2 text-sm font-bold text-slate-950 hover:bg-[#FFD700] disabled:opacity-50"
    >
      {pending ? "Criando..." : "Procurar evento de laco"}
    </button>
  );
}

export function ResolveBondOptionButton({ eventId, option, disabled }: { eventId: string; option: BondOption; disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const tone =
    option.type === "POSITIVE"
      ? "border-green-500/40 bg-green-500/10 text-green-200 hover:bg-green-500/20"
      : option.type === "AGGRESSIVE"
        ? "border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20"
        : "border-slate-600 bg-slate-900/60 text-slate-200 hover:bg-slate-800";
  return (
    <button
      type="button"
      disabled={pending || disabled}
      title={disabled ? option.blockedReason : undefined}
      onClick={() => startTransition(async () => {
        const result = await resolveBondEventAction(eventId, option.id);
        if (result.error) toast.error(result.error);
        else {
          toast.success("Escolha registrada. O laco mudou de verdade.");
          router.refresh();
        }
      })}
      className={`rounded-xl border px-3 py-2 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-45 ${tone}`}
    >
      <span className="block font-bold">{pending ? "Aplicando..." : option.label}</span>
      <span className="mt-1 block text-[10px] opacity-75">
        {option.type === "POSITIVE" ? "Positiva" : option.type === "AGGRESSIVE" ? "Rivalidade" : "Neutra"}
        {option.cost ? ` | Custo: ${option.cost.quantity} ${option.cost.kind === "FOOD" ? "Comida" : option.cost.kind === "SWEET" ? "Doce" : "ZC"}` : " | Sem custo"}
        {` | Relacao ${option.scoreDelta >= 0 ? "+" : ""}${option.scoreDelta}`}
      </span>
      {disabled && option.blockedReason && <span className="mt-1 block text-[10px] text-red-200">{option.blockedReason}</span>}
    </button>
  );
}
