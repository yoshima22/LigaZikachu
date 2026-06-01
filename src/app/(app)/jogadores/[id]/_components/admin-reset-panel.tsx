"use client";

import { useState } from "react";
import {
  resetPlayerAlbum,
  resetPlayerDecks,
  resetPlayerAchievements,
  resetPlayerBadges
} from "../../actions";

interface AdminResetPanelProps {
  playerId: string;
}

export function AdminResetPanel({ playerId }: AdminResetPanelProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleReset(
    label: string,
    action: (id: string) => Promise<{ error?: string }>
  ) {
    const confirmed = window.confirm(
      `Tem certeza que deseja resetar ${label} deste jogador? Esta ação não pode ser desfeita.`
    );
    if (!confirmed) return;

    setLoading(label);
    setMessage(null);
    const result = await action(playerId);
    setLoading(null);
    if (result.error) {
      setMessage(`Erro ao resetar ${label}: ${result.error}`);
    } else {
      setMessage(`${label} resetado com sucesso.`);
    }
  }

  const resets = [
    { label: "álbum", action: resetPlayerAlbum },
    { label: "decks salvos", action: resetPlayerDecks },
    { label: "conquistas", action: resetPlayerAchievements },
    { label: "insígnias", action: resetPlayerBadges }
  ];

  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-red-400">Ações de Reset (Admin)</h3>
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
      {message && (
        <p className={`text-xs ${message.startsWith("Erro") ? "text-red-400" : "text-green-400"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
