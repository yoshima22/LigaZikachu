"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adjustCoinsForAll } from "../actions";

export function BulkCoinsForm({ playerCount, totalCount }: { playerCount: number; totalCount: number }) {
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");
  const [includeAdmins, setIncludeAdmins] = useState(false);

  const handle = () => {
    if (amount <= 0) {
      toast.error("Informe um valor positivo de ZC.");
      return;
    }
    if (!confirm(`Enviar ${amount.toLocaleString("pt-BR")} ZC para TODOS os jogadores${includeAdmins ? " (incluindo admins)" : ""}? Esta ação não pode ser desfeita facilmente.`)) {
      return;
    }
    startTransition(async () => {
      try {
        const result = await adjustCoinsForAll(amount, description, includeAdmins);
        if (result.error) { toast.error(result.error); return; }
        toast.success(`${amount.toLocaleString("pt-BR")} ZC enviados para ${result.credited} jogador(es)!`);
        setAmount(0);
        setDescription("");
      } catch { toast.error("Erro ao enviar ZC em massa."); }
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[140px_1fr_auto]">
        <label className="space-y-1 text-xs text-slate-400">
          <span>Valor por jogador</span>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]"
          />
        </label>
        <label className="space-y-1 text-xs text-slate-400">
          <span>Motivo</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Bônus de evento da Liga"
            className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]"
          />
        </label>
        <div className="flex items-end">
          <Button
            type="button"
            disabled={pending}
            onClick={handle}
            className="w-full gap-2 bg-[#7AC74C] text-[#1A1A2E] hover:bg-[#8fd960]"
          >
            <Users size={15} />
            {pending ? "Enviando..." : "Enviar a todos"}
          </Button>
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-400">
        <input
          type="checkbox"
          checked={includeAdmins}
          onChange={(e) => setIncludeAdmins(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-border bg-slate-950 accent-[#FFCB05]"
        />
        <span>Incluir contas de admin no envio</span>
      </label>
      <p className="text-[11px] text-slate-500">
        {(() => {
          const recipients = includeAdmins ? totalCount : playerCount;
          return (
            <>
              Serão creditados para {recipients} {includeAdmins ? "usuário(s)" : "jogador(es)"}.
              {amount > 0 && ` Total: ${(amount * recipients).toLocaleString("pt-BR")} ZC distribuídos.`}
            </>
          );
        })()}
      </p>
    </div>
  );
}
