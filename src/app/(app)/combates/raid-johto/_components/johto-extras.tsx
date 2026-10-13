"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getPokemonName, getStaticSpriteUrl } from "@/lib/mascot-data";
import { COMBAT_ROLE_LABELS } from "@/lib/combat-roles";
import { PERSONALITY_LABEL } from "@/lib/mascot-data";
import type { JohtoBattlePayload, JohtoLeaderState, JohtoPendingReward, JohtoRecentFight } from "@/lib/johto-raid";
import { claimJohtoMascotAction, getJohtoReplayAction } from "../actions";
import { JohtoReplay } from "./johto-battle-view";

const fmt = (n: number) => n.toLocaleString("pt-BR");

function formatRemaining(ms: number) {
  if (ms <= 0) return "encerrado";
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400), h = Math.floor((total % 86400) / 3600), m = Math.floor((total % 3600) / 60), sec = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m ${pad(sec)}s` : `${pad(h)}h ${pad(m)}m ${pad(sec)}s`;
}

/** Contagem regressiva ao vivo até uma data (prazo do líder, fim do combo...). */
export function Countdown({ to, prefix = "", doneText = "encerrado" }: { to: string; prefix?: string; doneText?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (now === null) return <span suppressHydrationWarning>{prefix}…</span>;
  const left = new Date(to).getTime() - now;
  return <span className="tabular-nums">{left <= 0 ? doneText : `${prefix}${formatRemaining(left)}`}</span>;
}

/** Combo de ataque em grupo: +2% de status por treinador que atacou nos últimos 5 min (máx. +8%). */
export function ComboMeter({ stacks, bonusPct, nextDropAt }: { stacks: number; bonusPct: number; nextDropAt: string | null }) {
  return (
    <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-fuchsia-200">🔥 Combo de ataque em grupo</p>
        <p className="text-sm font-black text-white">{bonusPct > 0 ? `+${bonusPct}% em todos os status` : "sem bônus"}</p>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className={`rounded-lg border py-1 text-center text-[10px] font-black ${stacks >= n ? "border-fuchsia-400 bg-fuchsia-500/25 text-white" : "border-slate-800 bg-slate-950/60 text-slate-500"}`}>+{n * 2}%</div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-slate-400">
        {stacks > 0 && nextDropAt ? <>Cada treinador que atacou nos últimos 5 min soma +2%. O próximo degrau cai em <b className="text-fuchsia-200"><Countdown to={nextDropAt} /></b>.</> : "Ataque junto com outros treinadores (até 5 min de diferença) para ganhar +2% por treinador, até +8%. Sem ataques por 5 min, o bônus zera."}
      </p>
    </div>
  );
}
const TIER_LABEL: Record<string, string> = { TOP1: "🥇 1º em dano", TOP2: "🥈 2º em dano", TOP3: "🥉 3º em dano", PARTICIPANT: "Participação", FINAL_BLOW: "🎯 Golpe final" };

const TYPE_PT: Record<string, string> = {
  normal: "Normal", fire: "Fogo", water: "Água", electric: "Elétrico", grass: "Planta", ice: "Gelo", fighting: "Lutador", poison: "Veneno", ground: "Terra",
  flying: "Voador", psychic: "Psíquico", bug: "Inseto", rock: "Pedra", ghost: "Fantasma", dragon: "Dragão", dark: "Sombrio", steel: "Aço", fairy: "Fada",
};

/** Botão "Ver time": abre a UI com os 6 mascotes do líder (espécie, tipos, postura, personalidade e vida atual). */
export function LeaderTeamButton({ leader, compact = false }: { leader: Pick<JohtoLeaderState, "name" | "image" | "city" | "badge" | "mascots" | "hpCurrent" | "hpMax">; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`rounded-lg border border-[#FFCB05]/30 bg-[#FFCB05]/10 font-bold text-[#FFCB05] hover:bg-[#FFCB05]/20 ${compact ? "mt-1.5 w-full px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs"}`}>
        👥 Ver time
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3" onClick={() => setOpen(false)}>
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-[#FFCB05]/40 bg-[#07111f] p-5 text-slate-100 shadow-2xl shadow-black/80" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <img src={leader.image} alt="" className="h-16 w-16" style={{ imageRendering: "pixelated" }} />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FFCB05]">Time de {leader.name}</p>
                <h3 className="truncate text-xl font-black text-white">{leader.city} · {leader.badge}</h3>
                <p className="text-[11px] text-slate-300">Vida do líder: {fmt(leader.hpCurrent)} / {fmt(leader.hpMax)} (cada mascote tem 1/6)</p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-300 hover:text-white">Fechar</button>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {leader.mascots.map((m) => (
                <div key={m.slot} className={`flex items-center gap-3 rounded-2xl border p-3 ${m.defeated ? "border-red-400/40 bg-[#351b25]" : "border-slate-700 bg-[#111d31]"}`}>
                  <img src={getStaticSpriteUrl(m.pokemonId)} alt="" className={`h-16 w-16 shrink-0 object-contain ${m.defeated ? "opacity-30 grayscale" : ""}`} style={{ imageRendering: "pixelated" }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-white">{m.name}</p>
                    <div className="mt-0.5 flex flex-wrap gap-1 text-[9px] font-bold">
                      {m.types.map((t) => <span key={t} className="rounded-full bg-slate-700 px-1.5 py-0.5 text-slate-100">{TYPE_PT[t] ?? t}</span>)}
                      <span className="rounded-full bg-[#FFCB05]/20 px-1.5 py-0.5 text-[#FFE477]">{COMBAT_ROLE_LABELS[m.role as keyof typeof COMBAT_ROLE_LABELS] ?? m.role}</span>
                      {m.personality && <span className="rounded-full bg-fuchsia-500/25 px-1.5 py-0.5 text-fuchsia-100">{PERSONALITY_LABEL[m.personality] ?? m.personality}</span>}
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/50"><div className="h-full rounded-full bg-gradient-to-r from-red-600 via-orange-400 to-[#FFCB05]" style={{ width: `${m.hpMax > 0 ? Math.max(0, (m.hpCurrent / m.hpMax) * 100) : 0}%` }} /></div>
                    <p className="mt-0.5 text-[10px] font-medium text-slate-300">{m.defeated ? `Derrotado${m.defeatedByName ? ` por ${m.defeatedByName}` : ""}` : `${fmt(m.hpCurrent)} / ${fmt(m.hpMax)} HP`}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-slate-300">Na luta, o líder usa só os mascotes ainda de pé, com atributos equilibrados com o seu time. Os já derrotados ficam fora das próximas lutas.</p>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

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

/** Recompensas pendentes (e já resgatadas) com o seletor de mascote do líder. Regra: UM único mascote em toda a raid. */
export function JohtoRewardPicker({ rewards, choiceUsed }: { rewards: JohtoPendingReward[]; choiceUsed: { leaderName: string; pokemonId: number } | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [choice, setChoice] = useState<Record<string, number>>({});
  if (rewards.length === 0) return null;
  function claim(reward: JohtoPendingReward) {
    const pokemonId = choice[reward.id];
    if (!pokemonId) { toast.error("Escolha um mascote primeiro."); return; }
    const ok = window.confirm(
      `ATENÇÃO — ESCOLHA ÚNICA

Você está prestes a escolher ${getPokemonName(pokemonId)} (Nv.${reward.level}) de ${reward.leaderName}.

Você só pode escolher UM mascote em TODA a raid, de qualquer líder. Ao confirmar, você NÃO poderá escolher nenhum outro mascote, nem de líderes futuros. Esta escolha não pode ser desfeita.

Confirmar a escolha?`,
    );
    if (!ok) return;
    start(async () => {
      const result = await claimJohtoMascotAction(reward.id, pokemonId);
      (result.ok ? toast.success : toast.error)(result.message);
      router.refresh();
    });
  }
  return (
    <section className="space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
      <h2 className="text-lg font-bold text-white">🎁 Suas recompensas dos líderes</h2>
      <div className="rounded-xl border-2 border-amber-400/70 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
        <p className="text-sm font-black text-amber-300">⚠️ REGRA DO EVENTO: você só pode escolher UM mascote</p>
        <p>Durante toda a raid, <b>apenas um mascote</b> pode ser escolhido por jogador, <b>independente da faixa de nível</b> (pódio ou participação). Escolher um mascote significa <b>não poder escolher nenhum outro</b>, <b>nem de líderes futuros</b>. Exemplo: se você escolher um mascote do Falkner, não poderá escolher mais nenhum durante o evento. Vale para todos os jogadores e todos os líderes. <b>Escolha com sabedoria!</b></p>
        <p className="mt-1 text-amber-200/80">O ZC e o ovo especial de cada recompensa continuam sendo entregues normalmente. O mascote nasce de <b>ovo especial</b>: status sorteados e proporcionais ao nível da faixa, com <b>personalidade aleatória</b>.</p>
      </div>
      {choiceUsed && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-100">
          <img src={getStaticSpriteUrl(choiceUsed.pokemonId)} alt="" className="h-12 w-12 object-contain" style={{ imageRendering: "pixelated" }} />
          <p>Você já usou a sua escolha: <b>{getPokemonName(choiceUsed.pokemonId)}</b> ({choiceUsed.leaderName}). As demais recompensas não permitem outra escolha de mascote.</p>
        </div>
      )}
      {rewards.map((reward) => {
        const locked = !reward.claimed && Boolean(choiceUsed);
        return (
          <div key={reward.id} className={`rounded-xl border border-slate-800 bg-slate-950/60 p-3 ${locked ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-black text-white">{reward.leaderName} <span className="text-[11px] font-semibold text-emerald-300">· {TIER_LABEL[reward.tier] ?? (reward.tier.startsWith("TEST") ? "🧪 Teste (admin)" : reward.tier)}</span></p>
              <p className="text-[11px] text-slate-400">{fmt(reward.zc)} ZC {reward.egg ? "+ ovo especial " : ""}(já na conta) · mascote Nv.{reward.level}</p>
            </div>
            {reward.claimed ? (
              <p className="mt-2 flex items-center gap-2 text-xs text-emerald-200">
                {reward.chosenPokemonId && <img src={getStaticSpriteUrl(reward.chosenPokemonId)} alt="" className="h-9 w-9 object-contain" style={{ imageRendering: "pixelated" }} />}
                Você escolheu {reward.chosenPokemonId ? getPokemonName(reward.chosenPokemonId) : "um mascote"}.
              </p>
            ) : locked ? (
              <p className="mt-2 text-xs text-slate-400">🔒 Bloqueado: você já escolheu um mascote nesta raid (só é permitido UM em todo o evento).</p>
            ) : (
              <>
                <p className="mb-2 mt-2 text-[11px] text-amber-200">Escolha 1 dos 6 mascotes de {reward.leaderName} — lembre-se: <b>será o único mascote que você poderá escolher em toda a raid</b>.</p>
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
                  Escolher este mascote (Nv.{reward.level}) — escolha única
                </button>
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}
