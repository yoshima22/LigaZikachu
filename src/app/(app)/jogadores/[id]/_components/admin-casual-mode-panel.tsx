"use client";

import { useState } from "react";
import { toast } from "sonner";
import { setCasualModeAdminAction } from "../../actions";

interface AdminCasualModePanelProps {
  playerId: string;
  casualMode: boolean;
}

export function AdminCasualModePanel({ playerId, casualMode: initialCasualMode }: AdminCasualModePanelProps) {
  const [casualMode, setCasualMode] = useState(initialCasualMode);
  const [loading, setLoading] = useState(false);

  async function handleToggle(enabled: boolean) {
    setLoading(true);
    try {
      const result = await setCasualModeAdminAction(playerId, enabled);
      if (result.error) { toast.error(result.error); return; }
      setCasualMode(enabled);
      toast.success(enabled ? "Modo Casual ativado para este jogador." : "Modo Casual desativado para este jogador.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-sky-100">Modo Casual</h3>
        <p className="mt-1 text-xs leading-relaxed text-sky-100/70">
          Jogadores casuais ficam fora das Ligas Semanais, batalhas na Arena Z não movimentam cofres nem geram cooldown, e não podem participar do Desafio Sincronizado.
        </p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-slate-300">{casualMode ? "Modo Casual ativo" : "Modo Casual inativo"}</span>
        <button
          type="button"
          disabled={loading}
          onClick={() => handleToggle(!casualMode)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${casualMode ? "bg-sky-500" : "bg-slate-700"}`}
          aria-checked={casualMode}
          role="switch"
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${casualMode ? "translate-x-5" : "translate-x-0"}`}
          />
        </button>
      </div>
    </div>
  );
}
