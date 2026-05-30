"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { BetConfig } from "@/lib/zikabet";
import { updateBetConfig } from "../actions";

export function BetConfigForm({ tournamentId, config }: { tournamentId: string; config: BetConfig }) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(config);

  const handle = () => {
    startTransition(async () => {
      try {
        const result = await updateBetConfig({ tournamentId, ...form });
        if (result.error) { toast.error(result.error); return; }
        toast.success("Configuração salva!");
      } catch { toast.error("Erro ao salvar configuração."); }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            className="accent-[#FFCB05]" />
          <span className="text-sm font-semibold text-white">ZikaBet habilitada</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer ml-6">
          <input type="checkbox" checked={form.allowBetOnSelf} onChange={(e) => setForm({ ...form, allowBetOnSelf: e.target.checked })}
            className="accent-[#FFCB05]" />
          <span className="text-sm text-slate-300">Permitir apostar na própria partida</span>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Aposta mínima (ZC)", key: "minBet" as const },
          { label: "Aposta máxima (ZC)", key: "maxBet" as const },
          { label: "Limite diário (ZC)", key: "maxDailyBet" as const }
        ].map(({ label, key }) => (
          <label key={key} className="space-y-1 text-xs text-slate-400">
            <span>{label}</span>
            <input type="number" min={1} value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
              className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
          </label>
        ))}
      </div>
      <Button type="button" disabled={pending} onClick={handle} className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
        Salvar configuração
      </Button>
    </div>
  );
}
