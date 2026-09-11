"use client";
import { useMemo, useState } from "react";
type Pet = {
  id: string;
  name: string;
  sprite: string;
  types: string[];
  isMega: boolean;
  personality: string;
  posture: string;
  stats: Record<string, number>;
  banned: boolean;
  picked: boolean;
  metrics: {
    damageDealt: number;
    damageReceived: number;
    healing: number;
    kos: number;
    actions: number;
  } | null;
};
type Event = {
  turn: number;
  actorId?: string;
  actorName: string;
  targetName: string;
  action: string;
  damage: number;
  effect?: string;
  targetHpAfter?: number;
};
const STAT_LABELS: Record<string, string> = {
  force: "Força",
  agility: "Agilidade",
  charisma: "Carisma",
  instinct: "Instinto",
  vitality: "Vitalidade",
};
export function ArenaDraftReplay({
  matchId,
  playerA,
  playerB,
  winner,
  finishedAt,
  teamA,
  teamB,
  events,
  strategyHistory,
  rounds,
}: {
  matchId: string;
  playerA: string;
  playerB: string;
  winner: "A" | "B" | null;
  finishedAt: string;
  teamA: Pet[];
  teamB: Pet[];
  events: Event[];
  strategyHistory: Array<{
    checkpoint: number;
    activeA: string[];
    activeB: string[];
  }>;
  rounds: number;
}) {
  const [filter, setFilter] = useState<"ALL" | "KO" | "STRATEGY">("ALL");
  const shown = useMemo(
    () =>
      filter === "KO"
        ? events.filter((e) => e.targetHpAfter === 0)
        : filter === "STRATEGY"
          ? []
          : events,
    [events, filter],
  );
  return (
    <>
      <header className="overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[radial-gradient(circle_at_top,rgba(34,211,238,.14),transparent_42%),#050916] p-6 sm:p-9">
        <p className="text-[10px] font-black uppercase tracking-[.25em] text-cyan-300">
          Arena Draft · Resultado oficial
        </p>
        <div className="mt-5 grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
          <Player name={playerA} won={winner === "A"} />
          <div className="text-center text-2xl font-black text-slate-500">
            VS
          </div>
          <Player name={playerB} won={winner === "B"} right />
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-3 text-[10px] text-slate-400">
          <span>{new Date(finishedAt).toLocaleString("pt-BR")}</span>
          <span>·</span>
          <span>{rounds} ações</span>
          <span>·</span>
          <span>ID {matchId.slice(-8)}</span>
        </div>
      </header>
      <div className="grid gap-5 xl:grid-cols-2">
        <Team title={playerA} pets={teamA} />
        <Team title={playerB} pets={teamB} />
      </div>
      <section className="rounded-3xl border border-white/10 bg-slate-950/75 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-300">
              Linha do tempo
            </p>
            <h2 className="text-xl font-black text-white">
              Draft, decisões e combate
            </h2>
          </div>
          <div className="flex gap-2">
            {(["ALL", "KO", "STRATEGY"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setFilter(v)}
                className={`rounded-lg px-3 py-2 text-[10px] font-bold ${filter === v ? "bg-cyan-300 text-slate-950" : "bg-white/5 text-slate-300"}`}
              >
                {v === "ALL" ? "Todos" : v === "KO" ? "KOs" : "Estratégias"}
              </button>
            ))}
          </div>
        </div>
        {filter === "STRATEGY" ? (
          <div className="mt-4 space-y-2">
            {strategyHistory.length ? (
              strategyHistory.map((s) => (
                <div
                  key={s.checkpoint}
                  className="rounded-xl border border-fuchsia-300/15 bg-fuchsia-300/5 p-4 text-xs text-slate-300"
                >
                  <b className="text-fuchsia-200">Turno {s.checkpoint}</b> ·
                  decisões simultâneas reveladas · {s.activeA.length} ×{" "}
                  {s.activeB.length} posições registradas
                </div>
              ))
            ) : (
              <Empty text="Nenhuma janela estratégica foi alcançada." />
            )}
          </div>
        ) : (
          <div className="mt-4 max-h-[620px] space-y-2 overflow-y-auto pr-2">
            {shown.length ? (
              shown.map((e, i) => (
                <div
                  key={`${e.turn}-${i}`}
                  className={`rounded-xl border p-3 ${e.targetHpAfter === 0 ? "border-rose-400/30 bg-rose-400/5" : "border-white/5 bg-white/[.02]"}`}
                >
                  <p className="text-[9px] font-black uppercase text-slate-500">
                    Ação {e.turn} · {e.action}
                    {e.targetHpAfter === 0 ? " · KO" : ""}
                  </p>
                  <p className="text-xs text-slate-200">
                    <b>{e.actorName}</b> → {e.targetName} · {e.damage}{" "}
                    {e.action === "HEAL" ? "HP" : "dano"}
                  </p>
                  {e.effect && (
                    <p className="mt-1 text-[10px] text-fuchsia-200">
                      {e.effect}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <Empty text="Nenhum evento neste filtro." />
            )}
          </div>
        )}
      </section>
    </>
  );
}
function Player({
  name,
  won,
  right = false,
}: {
  name: string;
  won: boolean;
  right?: boolean;
}) {
  return (
    <div className={right ? "text-right" : ""}>
      <p className="text-2xl font-black text-white">{name}</p>
      <span
        className={`mt-1 inline-block rounded-full px-3 py-1 text-[10px] font-black ${won ? "bg-emerald-300 text-emerald-950" : "bg-white/5 text-slate-400"}`}
      >
        {won ? "VITÓRIA" : "PARTICIPANTE"}
      </span>
    </div>
  );
}
function Team({ title, pets }: { title: string; pets: Pet[] }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/75 p-4">
      <h2 className="font-black text-white">Equipe de {title}</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {pets.map((p) => (
          <article
            key={p.id}
            className={`rounded-2xl border p-3 ${p.banned ? "border-rose-400/20 opacity-45" : "border-white/10"}`}
          >
            <div className="flex gap-3">
              <img src={p.sprite} alt="" className="h-14 w-14 object-contain" />
              <div className="min-w-0">
                <b className="block truncate text-sm text-white">
                  {p.name}{" "}
                  {p.isMega && <span className="text-fuchsia-300">· Mega</span>}
                </b>
                <p className="text-[9px] text-slate-500">
                  {p.types.join(" · ")} ·{" "}
                  {p.banned ? "Banido" : p.picked ? "Titular inicial" : "Banco"}
                </p>
                <p className="mt-1 text-[9px] text-cyan-200">
                  {p.personality} · {p.posture}
                </p>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-5 gap-1">
              {Object.entries(p.stats).map(([k, v]) => (
                <span
                  key={k}
                  className="rounded bg-white/[.03] p-1 text-center text-[8px] text-slate-400"
                >
                  <b className="block text-[7px] text-slate-600">
                    {STAT_LABELS[k] ?? k}
                  </b>
                  {v}
                </span>
              ))}
            </div>
            {p.metrics && (
              <p className="mt-2 text-[9px] text-slate-400">
                {p.metrics.kos} KO · {p.metrics.damageDealt} dano ·{" "}
                {p.metrics.healing} cura
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-xs text-slate-500">
      {text}
    </p>
  );
}
