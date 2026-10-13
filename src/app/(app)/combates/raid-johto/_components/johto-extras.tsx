"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getPokemonName, getStaticSpriteUrl } from "@/lib/mascot-data";
import type { JohtoBattlePayload, JohtoPendingReward, JohtoRecentFight } from "@/lib/johto-raid";
import { claimJohtoMascotAction, getJohtoReplayAction } from "../actions";
import { JohtoReplay } from "./johto-battle-view";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const TIER_LABEL: Record<string, string> = { TOP1: "🥇 1º em dano", TOP2: "🥈 2º em dano", TOP3: "🥉 3º em dano", PARTICIPANT: "Participação", FINAL_BLOW: "🎯 Golpe final" };

/** Últimos 20 combates do servidor, com replay sob demanda. */
export function JohtoReplayList({ fights }: { fights: JohtoRecentFight[] }) {
  const [battle, setBattle] = useState<JohtoBattlePayload | null>(null);
  const [pending, start] = useTransition();
  function open(id: string) {
    start(async () => {
      const replay = await getJohtoReplayAction(id);
      if (!replay) { toast.error("Replay indisponível."); return; }
      setBattle(replay);
    });
  }
  if (fights.length === 0) return <p className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">Os combates aparecem aqui assim que alguém atacar.</p>;
  return (
    <>
      <div className="space-y-1.5">
        {fights.map((fight) => (
          <div key={fight.id} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs">
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${fight.win ? "bg-emerald-500/20 text-emerald-200" : "bg-red-500/15 text-red-200"}`}>{fight.win ? "VITÓRIA" : "DERROTA"}</span>
            <span className="min-w-0 flex-1 truncate text-slate-200"><b className="text-white">{fight.playerName}</b> → {fight.leaderName}</span>
            <span className="font-black text-amber-300">{fmt(fight.damage)}</span>
            <button disabled={pending} onClick={() => open(fight.id)} className="rounded-lg border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-2 py-1 text-[10px] font-bold text-[#FFCB05] hover:bg-[#FFCB05]/20 disabled:opacity-50">▶ Replay</button>
          </div>
        ))}
      </div>
      {battle && <JohtoReplay battle={battle} onClose={() => setBattle(null)} />}
    </>
  );
}

/** Recompensas pendentes (e já resgatadas) com o seletor de mascote do líder. */
export function JohtoRewardPicker({ rewards }: { rewards: JohtoPendingReward[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [choice, setChoice] = useState<Record<string, number>>({});
  if (rewards.length === 0) return null;
  function claim(reward: JohtoPendingReward) {
    const pokemonId = choice[reward.id];
    if (!pokemonId) { toast.error("Escolha um mascote primeiro."); return; }
    if (!window.confirm(`Receber ${getPokemonName(pokemonId)} no nível ${reward.level}? A escolha não pode ser trocada.`)) return;
    start(async () => {
      const result = await claimJohtoMascotAction(reward.id, pokemonId);
      (result.ok ? toast.success : toast.error)(result.message);
      router.refresh();
    });
  }
  return (
    <section className="space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
      <h2 className="text-lg font-bold text-white">🎁 Suas recompensas dos líderes</h2>
      {rewards.map((reward) => (
        <div key={reward.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-black text-white">{reward.leaderName} <span className="text-[11px] font-semibold text-emerald-300">· {TIER_LABEL[reward.tier] ?? reward.tier}</span></p>
            <p className="text-[11px] text-slate-400">{fmt(reward.zc)} ZC {reward.egg ? "+ ovo especial " : ""}(já na conta) · mascote Nv.{reward.level}</p>
          </div>
          {reward.claimed ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-emerald-200">
              {reward.chosenPokemonId && <img src={getStaticSpriteUrl(reward.chosenPokemonId)} alt="" className="h-9 w-9 object-contain" style={{ imageRendering: "pixelated" }} />}
              Você escolheu {reward.chosenPokemonId ? getPokemonName(reward.chosenPokemonId) : "um mascote"}.
            </p>
          ) : (
            <>
              <p className="mb-2 mt-2 text-[11px] text-slate-400">Escolha 1 dos 6 mascotes de {reward.leaderName}:</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {reward.options.map((pokemonId) => (
                  <button key={pokemonId} type="button" onClick={() => setChoice((c) => ({ ...c, [reward.id]: pokemonId }))}
                    className={`rounded-xl border p-2 text-center transition ${choice[reward.id] === pokemonId ? "border-[#FFCB05] bg-[#FFCB05]/15" : "border-slate-800 bg-slate-900/60 hover:border-slate-600"}`}>
                    <img src={getStaticSpriteUrl(pokemonId)} alt="" className="mx-auto h-14 w-14 object-contain" style={{ imageRendering: "pixelated" }} />
                    <p className="mt-1 truncate text-[10px] font-bold text-white">{getPokemonName(pokemonId)}</p>
                  </button>
                ))}
              </div>
              <button disabled={pending || !choice[reward.id]} onClick={() => claim(reward)} className="mt-3 rounded-xl bg-[#FFCB05] px-4 py-2 text-xs font-black text-slate-950 hover:brightness-110 disabled:opacity-50">
                Receber mascote Nv.{reward.level}
              </button>
            </>
          )}
        </div>
      ))}
    </section>
  );
}
