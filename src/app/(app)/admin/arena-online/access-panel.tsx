"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { LivePvpAccessConfig } from "@/lib/live-pvp-access";
import { TACTICAL_BIOMES, type TacticalBiomeId } from "@/lib/tactical-arena";
import {
  resetTerrainBattleRankingAction,
  updateLivePvpAccessAction,
  updateLivePvpBiomeImageAction,
} from "./access-actions";

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
  const [biomeImages, setBiomeImages] = useState(initialConfig.biomeImages);
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
        toast.success("Acesso à Batalha de Terreno atualizado.");
      }
    });
  const saveBiome = (biomeId: TacticalBiomeId, image: string) =>
    startTransition(async () => {
      try {
        const result = await updateLivePvpBiomeImageAction({ biomeId, image });
        setConfig(result.config);
        setBiomeImages(result.config.biomeImages);
        toast.success("Imagem do bioma atualizada.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Falha ao salvar imagem.",
        );
      }
    });
  const readBiomeFile = (biomeId: TacticalBiomeId, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem válida.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = String(reader.result ?? "");
      setBiomeImages((current) => ({ ...current, [biomeId]: image }));
    };
    reader.readAsDataURL(file);
  };
  const resetRanking = () => {
    if (
      !window.confirm(
        "Zerar todas as vitórias, derrotas e empates da Batalha de Terreno?",
      )
    )
      return;
    startTransition(async () => {
      try {
        const result = await resetTerrainBattleRankingAction();
        toast.success(
          `Ranking zerado. ${result.deletedEntries} registro(s) removido(s).`,
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Falha ao zerar ranking.",
        );
      }
    });
  };
  return (
    <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-amber-300">
            Controle de publicação
          </p>
          <h2 className="font-bold text-white">Acesso à Batalha de Terreno</h2>
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
                  {allowed ? "Remover acesso" : "Liberar acesso"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/25 bg-red-500/5 p-3">
        <div>
          <b className="text-sm text-white">Ranking do Beta</b>
          <p className="mt-1 text-[10px] text-slate-400">
            Partidas que envolvam ADMIN ou SUPER ADMIN não entram no ranking.
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={resetRanking}
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-200 disabled:opacity-40"
        >
          Resetar ranking
        </button>
      </div>
      <div className="mt-4 rounded-xl border border-emerald-500/20 bg-slate-950/70 p-3">
        <div className="mb-3">
          <b className="text-sm text-white">Texturas dos biomas</b>
          <p className="mt-1 text-[10px] text-slate-400">
            As imagens aparecem opacas sob as casas do grid. É possível enviar
            um arquivo ou cadastrar uma URL pública.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {TACTICAL_BIOMES.map((biome) => {
            const image = biomeImages[biome.id] ?? "";
            return (
              <div
                key={biome.id}
                className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900"
              >
                <div
                  className="relative h-24 bg-cover bg-center"
                  style={{
                    backgroundColor: biome.color,
                    backgroundImage: image
                      ? `linear-gradient(rgba(2,6,23,.62), rgba(2,6,23,.62)), url(${image})`
                      : undefined,
                  }}
                >
                  <b className="absolute bottom-2 left-3 text-xs text-white">
                    {biome.name}
                  </b>
                </div>
                <div className="space-y-2 p-3">
                  <input
                    value={image.startsWith("data:") ? "" : image}
                    onChange={(event) =>
                      setBiomeImages((current) => ({
                        ...current,
                        [biome.id]: event.target.value,
                      }))
                    }
                    placeholder="https://..."
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-[10px] text-white"
                  />
                  <div className="flex gap-2">
                    <label className="flex-1 cursor-pointer rounded border border-cyan-500/30 px-2 py-1.5 text-center text-[9px] font-bold text-cyan-200">
                      Escolher arquivo
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        onChange={(event) =>
                          readBiomeFile(biome.id, event.target.files?.[0])
                        }
                      />
                    </label>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => saveBiome(biome.id, image)}
                      className="rounded bg-emerald-500 px-3 py-1.5 text-[9px] font-black text-slate-950 disabled:opacity-40"
                    >
                      Salvar
                    </button>
                    {!!image && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => saveBiome(biome.id, "")}
                        className="rounded border border-red-500/30 px-2 py-1.5 text-[9px] text-red-300"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
