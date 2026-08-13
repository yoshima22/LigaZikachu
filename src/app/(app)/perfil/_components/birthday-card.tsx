"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { setBirthDateAction } from "../actions";

export function BirthdayCard({ birthDate }: { birthDate: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  const alreadySet = Boolean(birthDate);
  const display = birthDate
    ? new Date(birthDate).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

  const save = () => {
    if (!value) return toast.error("Escolha sua data de aniversário.");
    if (!confirm("Confirmar sua data de aniversário? Ela NÃO poderá ser alterada depois.")) return;
    startTransition(async () => {
      const res = await setBirthDateAction(value);
      if (!res.ok) toast.error(res.error ?? "Não foi possível salvar.");
      else {
        toast.success("Data de aniversário salva! 🎂");
        router.refresh();
      }
    });
  };

  return (
    <Card className="p-6">
      <h2 className="mb-1 text-sm font-semibold text-white">🎂 Data de aniversário</h2>
      {alreadySet ? (
        <>
          <p className="mb-3 text-xs text-slate-500">Sua data de aniversário já foi definida e <strong>não pode ser alterada</strong>.</p>
          <span className="inline-block rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-4 py-2 text-lg font-bold tracking-wide text-[#FFCB05]">
            {display}
          </span>
          <p className="mt-2 text-[11px] text-slate-500">No seu aniversário, abra o jogo para girar a roleta de presentes! 🎁</p>
        </>
      ) : (
        <>
          <p className="mb-3 text-xs text-amber-300/80">
            ⚠️ Preencha com cuidado: depois de salvar, a data <strong>não poderá ser alterada</strong>. No dia do seu aniversário você ganha uma roleta de presentes.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-11 rounded-xl border border-border bg-slate-950/60 px-3 text-sm text-white outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={save}
              disabled={pending || !value}
              className="rounded-xl bg-[#FFCB05] px-4 py-2.5 text-sm font-bold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-40"
            >
              {pending ? "Salvando..." : "Salvar aniversário"}
            </button>
          </div>
        </>
      )}
    </Card>
  );
}
