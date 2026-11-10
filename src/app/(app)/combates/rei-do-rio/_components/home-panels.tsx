"use client";

import { fmtPts } from "@/lib/rei-do-rio/config";
import { DAY_LABELS } from "@/lib/rei-do-rio/schedule";
import type { StandRow } from "@/lib/rei-do-rio/standings";
import type { EditionView, MatchRow } from "@/lib/rei-do-rio/view";
import { Avatar, Card, Empty, Ornament, Pill, Sprite, Title } from "./rei-ui";

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** Pódio com foto de perfil, coroa (1º) e medalhas (2º e 3º). */
export function Podium({ rows, avatars }: { rows: StandRow[]; avatars: EditionView["avatars"] }) {
  const top = rows.slice(0, 3);
  if (!top.length) return null;
  const medal = [
    { bg: "from-amber-200 to-amber-500", ring: "ring-amber-300", label: "1º" },
    { bg: "from-slate-100 to-slate-400", ring: "ring-slate-300", label: "2º" },
    { bg: "from-orange-300 to-orange-700", ring: "ring-orange-400", label: "3º" },
  ];
  return (
    <div className="grid grid-cols-3 items-end gap-2 sm:gap-3">
      {[1, 0, 2].map((i) => top[i] && (
        <div key={top[i].pid} className={`relative rounded-2xl border p-3 pt-4 text-center ${i === 0 ? "border-amber-300/50 bg-gradient-to-b from-amber-300/15 to-transparent pb-6 pt-8 sm:pt-9" : "border-sky-200/10 bg-slate-900/50"}`}>
          <div className="relative mx-auto w-fit">
            {i === 0 && <Ornament k="crown" size={38} className="absolute -top-8 left-1/2 z-10 -translate-x-1/2 sm:!h-12 sm:!w-12 sm:-top-10" />}
            <Avatar src={avatars[top[i].pid]} name={top[i].name} size={i === 0 ? 68 : 52} ring={medal[i].ring} />
            <span className={`absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-gradient-to-b text-[10px] font-black text-slate-900 shadow ring-2 ring-slate-950 ${medal[i].bg}`} aria-label={`${medal[i].label} lugar`}>{i + 1}</span>
          </div>
          <p className="mt-2 truncate text-sm font-black text-white">{top[i].name}</p>
          <p className="font-mono text-lg font-black text-amber-200">{fmtPts(top[i].score)}</p>
          <p className="text-[10px] text-slate-400">{top[i].wins}V · {top[i].losses}D · {top[i].draws}E</p>
        </div>
      ))}
    </div>
  );
}

/** Líder de cada categoria da edição (top 3 mascotes), com o dono e a foto dele. */
export function HighlightsCard({ highlights, avatars }: { highlights: EditionView["highlights"]; avatars: EditionView["avatars"] }) {
  return (
    <Card>
      <Title orn="gift" sub="Os melhores mascotes desta edição em cada categoria.">Destaques da edição</Title>
      {highlights.length === 0 ? (
        <Empty orn="gift" title="Ainda sem destaques">Eles aparecem depois das primeiras batalhas.</Empty>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {highlights.map((h) => (
            <div key={h.key} className="rounded-xl border border-slate-800 bg-slate-900/50 p-2.5">
              <p className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-sky-200"><span aria-hidden>{h.icon}</span> {h.label}</p>
              <ol className="space-y-1">
                {h.top.map((t, i) => (
                  <li key={t.id} className={`flex items-center gap-2 rounded-lg px-1.5 py-1 ${i === 0 ? "bg-amber-300/10" : ""}`}>
                    <span className="w-3 text-center text-[10px] font-black text-slate-500">{i + 1}</span>
                    <Sprite id={t.pokemonId} size={i === 0 ? 38 : 30} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-white">{t.name}</p>
                      <p className="flex items-center gap-1 truncate text-[10px] text-slate-400"><Avatar src={avatars[t.pid]} name={t.owner} size={14} className="!ring-1" />{t.owner}</p>
                    </div>
                    <span className="font-mono text-xs font-black tabular-nums text-amber-200">{t.value.toLocaleString("pt-BR")}<span className="ml-0.5 text-[9px] font-normal text-slate-500">{i === 0 ? h.unit : ""}</span></span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function MatchLine({ m, meId, onReplay, avatars }: { m: MatchRow; meId?: string; onReplay: (id: string) => void; avatars: EditionView["avatars"] }) {
  if (m.bye) return <li className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs text-slate-400"><Avatar src={avatars[m.a]} name={m.aName} size={20} />{m.aName} <Pill>folga</Pill></li>;
  const mine = m.a === meId || m.b === meId;
  return (
    <li className={`flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${mine ? "bg-amber-300/10 ring-1 ring-amber-300/30" : "bg-slate-900/40"}`}>
      <Avatar src={avatars[m.a]} name={m.aName} size={22} />
      <span className={m.winner === "A" ? "font-black text-emerald-300" : "text-slate-300"}>{m.aName}</span>
      <span className="font-mono text-[11px] text-slate-500">{fmtPts(m.scoreA)} × {fmtPts(m.scoreB)}</span>
      <span className={m.winner === "B" ? "font-black text-emerald-300" : "text-slate-300"}>{m.bName}</span>
      <Avatar src={m.b ? avatars[m.b] : null} name={m.bName ?? "?"} size={22} />
      {m.winner === "DRAW" && <Pill>empate</Pill>}
      {m.exhausted && <Pill tone="red">{m.exhausted === "BOTH" ? "ambas sem mascotes" : `${m.exhausted === "A" ? m.aName : m.bName} sem mascotes`}</Pill>}
      {!m.exhausted && <button onClick={() => onReplay(m.id)} className="ml-auto rounded-md bg-sky-500/20 px-2 py-0.5 text-[11px] font-bold text-sky-200 hover:bg-sky-500/30">▶ Replay</button>}
    </li>
  );
}

/** Combates do dia: resultados das rodadas feitas, confrontos já definidos da próxima e "a definir" das demais. */
export function TodayCard({ today, meId, avatars, onReplay }: { today: NonNullable<EditionView["today"]>; meId?: string; avatars: EditionView["avatars"]; onReplay: (id: string) => void }) {
  const nextIdx = today.rounds.findIndex((r) => r.status !== "DONE");
  const lastDone = [...today.rounds].reverse().find((r) => r.status === "DONE")?.roundIndex;
  return (
    <Card>
      <Title orn="lantern" sub="Rodadas às 09h, 12h, 15h, 18h e 21h. Os confrontos de cada rodada saem da classificação logo após a anterior.">Combates de {DAY_LABELS[today.day]?.toLowerCase() ?? "hoje"}</Title>
      <div className="space-y-2">
        {today.rounds.map((r, i) => {
          const done = r.status === "DONE";
          const isNext = i === nextIdx;
          return (
            <details key={r.roundIndex} open={isNext || r.roundIndex === lastDone} className="group rounded-xl border border-slate-800 bg-slate-950/50">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-3 py-2">
                <span className="font-mono text-sm font-black text-white">{hhmm(r.at)}</span>
                <span className="text-[11px] text-slate-500">rodada {r.roundIndex}</span>
                {done ? <Pill tone="green">concluída · {r.matches?.filter((m) => !m.bye).length ?? 0} combates</Pill>
                  : isNext ? <Pill tone="gold">{r.pairs ? "próxima · confrontos definidos" : "próxima"}</Pill>
                  : <Pill>a definir após a rodada anterior</Pill>}
                <span className="ml-auto text-xs text-slate-500 transition group-open:rotate-90" aria-hidden>▸</span>
              </summary>
              <div className="px-3 pb-3">
                {done && r.matches && <ul className="space-y-1">{r.matches.map((m) => <MatchLine key={m.id} m={m} meId={meId} onReplay={onReplay} avatars={avatars} />)}</ul>}
                {!done && r.pairs && (
                  <ul className="space-y-1">
                    {r.pairs.map((p) => (
                      <li key={p.a} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${p.a === meId || p.b === meId ? "bg-amber-300/10 ring-1 ring-amber-300/30" : "bg-slate-900/40"}`}>
                        <Avatar src={avatars[p.a]} name={p.aName} size={22} /><span className="text-slate-200">{p.aName}</span>
                        <span className="text-slate-600">×</span>
                        {p.b ? <><span className="text-slate-200">{p.bName}</span><Avatar src={avatars[p.b]} name={p.bName ?? "?"} size={22} /></> : <Pill>folga</Pill>}
                      </li>
                    ))}
                  </ul>
                )}
                {!done && !r.pairs && <p className="text-xs text-slate-500">Os confrontos são definidos quando a rodada anterior termina, pela classificação daquele momento.</p>}
              </div>
            </details>
          );
        })}
      </div>
    </Card>
  );
}

/** Aviso de mínimo de participantes (preparação) e de edição cancelada. */
export function EditionNotice({ ed }: { ed: EditionView["edition"] }) {
  if (ed.phase === "CANCELED") {
    return (
      <Card className="!border-red-400/40">
        <Title orn="snowflake">Edição cancelada</Title>
        <p className="text-sm text-slate-300">{ed.canceledReason ?? `Não houve o mínimo de ${ed.minParticipants} inscritos.`} Nenhuma rodada foi disputada e nada foi cobrado ou perdido. Uma nova edição pode ser aberta.</p>
      </Card>
    );
  }
  if (ed.phase !== "PREPARATION") return null;
  const ok = ed.participantCount >= ed.minParticipants;
  return (
    <Card className={ok ? "!border-emerald-400/30" : "!border-amber-300/40"}>
      <div className="flex flex-wrap items-center gap-3">
        <div className={`grid h-11 w-11 place-items-center rounded-full text-sm font-black ${ok ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-300/15 text-amber-200"}`}>{ed.participantCount}/{ed.minParticipants}</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-white">{ok ? "Mínimo de inscritos garantido" : `Faltam ${ed.minParticipants - ed.participantCount} inscritos para o evento acontecer`}</p>
          <p className="text-xs text-slate-400">São necessários {ed.minParticipants} participantes às 21h de segunda; sem isso a edição da semana é cancelada.</p>
        </div>
      </div>
    </Card>
  );
}
