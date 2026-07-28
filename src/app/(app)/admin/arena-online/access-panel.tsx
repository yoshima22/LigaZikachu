"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { LivePvpAccessConfig } from "@/lib/live-pvp-access";
import { updateLivePvpAccessAction } from "./access-actions";

type PlayerAccessOption = { id: string; displayName: string; email: string };

export function LivePvpAccessPanel({
  initialConfig,
  players,
}: {
  initialConfig: LivePvpAccessConfig;
  players: PlayerAccessOption[];
}) {
  const [config, setConfig] = useState(initialConfig);
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();
  const visible = players.filter((player) =>
    `${player.displayName} ${player.email}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const update = (input: Parameters<typeof updateLivePvpAccessAction>[0]) =>
    startTransition(async () => {
      const result = await updateLivePvpAccessAction(input);
      if (result.ok) {
        setConfig(result.config);
        toast.success("Acesso à Arena Online atualizado.");
      }
    });
  return (
    <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-amber-300">
            Controle de publicação
          </p>
          <h2 className="font-bold text-white">Acesso à Arena Online</h2>
          <p className="mt-1 text-xs text-slate-400">
            Administradores sempre possuem acesso. Para os demais, o modo nasce
            desligado e invisível.
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => update({ enabledGlobally: !config.enabledGlobally })}
          className={`rounded-lg border px-4 py-2 text-xs font-bold ${config.enabledGlobally ? "border-red-500/40 bg-red-500/10 text-red-200" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"}`}
        >
          {config.enabledGlobally ? "Desligar para todos" : "Ligar para todos"}
        </button>
      </div>
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar jogador ou e-mail..."
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
        />
        <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">
          {visible.map((player) => {
            const allowed = config.allowedPlayerIds.includes(player.id);
            return (
              <div
                key={player.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-white">
                    {player.displayName}
                  </p>
                  <p className="truncate text-[10px] text-slate-500">
                    {player.email}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending || config.enabledGlobally}
                  onClick={() =>
                    update({ playerId: player.id, allowed: !allowed })
                  }
                  className={`rounded-md border px-3 py-1.5 text-[10px] font-bold disabled:opacity-40 ${allowed ? "border-red-500/40 text-red-300" : "border-cyan-500/40 text-cyan-300"}`}
                >
                  {allowed ? "Remover acesso" : "Liberar teste"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
