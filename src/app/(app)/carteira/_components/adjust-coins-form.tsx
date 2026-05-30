"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adjustCoins } from "../actions";

export function AdjustCoinsForm({
  players
}: {
  players: { id: string; displayName: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ playerId: "", amount: 0, description: "" });

  const handle = () => {
    if (!form.playerId || form.amount === 0) {
      toast.error("Selecione um jogador e informe o valor.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await adjustCoins(form.playerId, form.amount, form.description);
        if (result.error) { toast.error(result.error); return; }
        toast.success("Saldo ajustado com sucesso!");
        setForm({ playerId: "", amount: 0, description: "" });
      } catch { toast.error("Erro ao ajustar saldo."); }
    });
  };

  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_120px_1fr_auto]">
      <label className="space-y-1 text-xs text-slate-400">
        <span>Jogador</span>
        <select
          value={form.playerId}
          onChange={(e) => setForm({ ...form, playerId: e.target.value })}
          className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]"
        >
          <option value="">Selecione</option>
          {players.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-xs text-slate-400">
        <span>Valor (+ ou -)</span>
        <input
          type="number"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
          className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]"
        />
      </label>
      <label className="space-y-1 text-xs text-slate-400">
        <span>Motivo</span>
        <input
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Ex: Bônus de participação"
          className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]"
        />
      </label>
      <div className="flex items-end">
        <Button
          type="button"
          disabled={pending}
          onClick={handle}
          className="w-full bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]"
        >
          Aplicar
        </Button>
      </div>
    </div>
  );
}
