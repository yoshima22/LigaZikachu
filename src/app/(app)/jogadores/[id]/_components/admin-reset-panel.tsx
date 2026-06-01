"use client";

import { useState } from "react";
import {
  resetPlayerAlbum,
  resetPlayerDecks,
  resetPlayerAchievements,
  resetPlayerBadges,
  resetPlayerTutorials
} from "../../actions";

interface AdminResetPanelProps {
  playerId: string;
  userId: string;
}

export function AdminResetPanel({ playerId, userId }: AdminResetPanelProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleReset(
    label: string,
    action: () => Promise<{ error?: string }>
  ) {
    const confirmed = window.confirm(
      `Tem certeza que deseja resetar ${label} deste jogador? Esta ação não pode ser desfeita.`
    );
    if (!confirmed) return;

    setLoading(label);
    setMessage(null);
    const result = await action();
    setLoading(null);
    if (result.error) {
      setMessage(`Erro ao resetar ${label}: ${result.error}`);
    } else {
      setMessage(`${label} resetado com sucesso.`);
    }
  }

  const resets = [
    { label: "álbum",      action: () => resetPlayerAlbum(playerId) },
    { label: "decks",      action: () => resetPlayerDecks(playerId) },
    { label: "conquistas", action: () => resetPlayerAchievements(playerId) },
    { label: "insígnias",  action: () => resetPlayerBadges(playerId) },
  ];

  return (
    <div className="space-y-4">
      {/* Resets de dados */}
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-red-400">Reset de Dados (Admin)</h3>
        <div className="flex flex-wrap gap-2">
          {resets.map(({ label, action }) => (
            <button
              key={label}
              disabled={loading !== null}
              onClick={() => handleReset(label, action)}
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading === label ? "Resetando..." : `Reset ${label}`}
            </button>
          ))}
        </div>
        {message && !message.includes("tutorial") && (
          <p className={`text-xs ${message.startsWith("Erro") ? "text-red-400" : "text-green-400"}`}>
            {message}
          </p>
        )}
      </div>

      {/* Reset de tutorial — separado para ficar claro que é para debug */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
        <h3 className="text-sm font-semibold text-amber-400">Tutorial (Debug)</h3>
        <p className="text-xs text-slate-500">
          Apaga o progresso de onboarding. O usuário verá os tutoriais novamente no próximo acesso.
        </p>
        <button
          disabled={loading === "tutorials"}
          onClick={() => handleReset("tutorials", () => resetPlayerTutorials(userId))}
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading === "tutorials" ? "Resetando..." : "🔄 Resetar tutoriais"}
        </button>
        {message && message.includes("tutorial") && (
          <p className={`text-xs ${message.startsWith("Erro") ? "text-red-400" : "text-green-400"}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
