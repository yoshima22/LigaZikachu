"use client";

import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";

const RESETS = [
  {
    id: "album",
    label: "Resetar Álbum de todos",
    description: "Remove todas as figurinhas do álbum de todos os jogadores.",
    color: "amber"
  },
  {
    id: "inventory",
    label: "Resetar Inventário de todos",
    description: "Remove banners, molduras e tickets do inventário de todos os jogadores. Títulos são mantidos.",
    color: "amber"
  },
  {
    id: "wallets",
    label: "Resetar Carteiras de todos",
    description: "Zera o histórico de transações e restaura o saldo de todos para 200 ZC.",
    color: "red"
  },
];

export function GlobalResetPanel() {
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});

  const handleReset = async (id: string, label: string) => {
    const confirmed = window.confirm(
      `⚠️ ATENÇÃO\n\n"${label}" afeta TODOS OS JOGADORES e não pode ser desfeito.\n\nTem certeza que deseja continuar?`
    );
    if (!confirmed) return;

    // Segunda confirmação para resets destrutivos
    const double = window.confirm(`Confirmação final: resetar ${label.toLowerCase()}?`);
    if (!double) return;

    setLoading(id);
    setResults(prev => ({ ...prev, [id]: "" }));

    try {
      const res = await fetch(`/api/admin/reset-all?target=${id}`, { method: "POST" });
      const data = await res.json();
      setResults(prev => ({ ...prev, [id]: data.message ?? data.error ?? "Concluído." }));
    } catch {
      setResults(prev => ({ ...prev, [id]: "Erro de rede. Tente novamente." }));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle size={18} className="text-red-400 shrink-0" />
        <div>
          <h2 className="font-semibold text-red-400">Resets Globais</h2>
          <p className="text-xs text-slate-500">Afetam todos os jogadores. Requerem dupla confirmação.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {RESETS.map(({ id, label, description, color }) => (
          <div key={id} className={`rounded-xl border p-4 space-y-3 ${
            color === "red"
              ? "border-red-500/30 bg-red-500/5"
              : "border-amber-500/30 bg-amber-500/5"
          }`}>
            <div>
              <p className={`text-sm font-semibold ${color === "red" ? "text-red-400" : "text-amber-400"}`}>
                {label}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>
            </div>
            <button
              disabled={loading !== null}
              onClick={() => handleReset(id, label)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                color === "red"
                  ? "border-red-500/40 text-red-400 hover:bg-red-500/15"
                  : "border-amber-500/40 text-amber-400 hover:bg-amber-500/15"
              }`}
            >
              <Trash2 size={12} />
              {loading === id ? "Resetando…" : "Executar reset"}
            </button>
            {results[id] && (
              <p className={`text-[11px] ${results[id].startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>
                {results[id]}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
