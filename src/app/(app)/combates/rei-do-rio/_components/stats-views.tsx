"use client";

import { Fragment, useState } from "react";
import { fmtPts } from "@/lib/rei-do-rio/config";
import { CATEGORY_LABELS, type PointCategory } from "@/lib/rei-do-rio/scoring";
import { modifierPct, type StandRow } from "@/lib/rei-do-rio/standings";
import type { EditionView, MascotLite } from "@/lib/rei-do-rio/view";
import { CAT_COLORS, CAT_ORDER, Card, Empty, Pill, Sprite, StackBar, Title, roleLabel } from "./rei-ui";
import { Delta } from "./views";

type Cfg = EditionView["edition"]["cfg"];
type Breakdown = EditionView["breakdown"];

/** Texto determinístico que explica a posição de um jogador a partir dos pontos reais por categoria. */
export function explainRow(r: StandRow, bd: Breakdown[string] | undefined, cfg: Cfg): string[] {
  if (!bd) return [];
  const total = CAT_ORDER.reduce((a, k) => a + (bd.points[k] ?? 0), 0);
  if (total <= 0) return ["Ainda sem pontos: a classificação começa a se mover depois da primeira rodada."];
  const win = bd.points.win ?? 0;
  const fights = Math.max(1, r.wins + r.losses + r.draws);
  const budgetTotal = Object.values(cfg.budget).reduce((a, b) => a + b, 0);
  const lines = [
    `${fmtPts(total)} pontos em ${fights} combate${fights > 1 ? "s" : ""} (média de ${fmtPts(total / fights)} por combate). Só ${Math.round((win / total) * 100)}% vieram de vitórias (${fmtPts(win)} pts); o resto veio de dano, KOs, suporte e resistência.`,
  ];
  if (r.losses > r.wins) lines.push(`Mesmo com mais derrotas (${r.losses}) do que vitórias (${r.wins}), a equipe pontua por tudo o que faz em campo. Vencer vale ${Math.round((cfg.budget.win / budgetTotal) * 100)}% do orçamento de um combate — por isso a posição não segue a ordem de vitórias.`);
  const m = modifierPct(r, cfg);
  if (m < 0) lines.push(`Pressão do Trono ativa: ${r.winStreak} vitórias seguidas = ${m}% de Força, Instinto, Vitalidade e Carisma no próximo combate. Se perder, o efeito some.`);
  if (m > 0) lines.push(`Calor da Lareira ativo: ${r.lossStreak} derrotas seguidas = +${m}% de Força, Instinto, Vitalidade e Carisma no próximo combate. Se vencer ou empatar, o efeito some.`);
  if (r.byes > 0) lines.push(`${r.byes} folga${r.byes > 1 ? "s" : ""} (sem adversário): não dá nem tira pontos.`);
  if ((bd.points.leadership ?? 0) > 0) lines.push(`Permanência no topo rendeu ${fmtPts(bd.points.leadership)} pts (bônus pequeno e limitado, para nunca valer mais do que jogar bem).`);
  return lines;
}

export function ScoringExplainer({ cfg }: { cfg: Cfg }) {
  const b = cfg.budget;
  const total = b.damage + b.ko + b.support + b.resilience + b.win;
  const items: { k: PointCategory; v: number; d: string }[] = [
    { k: "damage", v: b.damage, d: "dano efetivo causado (o que passa do necessário para derrotar não conta)" },
    { k: "ko", v: b.ko, d: "KOs e assistências" },
    { k: "support", v: b.support, d: "cura efetiva, dano absorvido e bônus que ajudaram o time" },
    { k: "resilience", v: b.resilience, d: "tempo em campo e dano suportado" },
    { k: "win", v: b.win, d: "vencer o combate (empate vale metade)" },
  ];
  return (
    <Card glow>
      <Title sub="Leia isto antes de comparar posições.">Como a classificação funciona</Title>
      <ol className="space-y-1 text-sm text-slate-200">
        <li><b className="text-amber-200">1.</b> A posição vem dos <b>pontos totais</b> (soma dos seus 18 mascotes), <u>não</u> do número de vitórias.</li>
        <li><b className="text-amber-200">2.</b> Desempate: mais vitórias, depois mais dano causado.</li>
        <li><b className="text-amber-200">3.</b> Em cada combate a equipe pode somar até ~{total} pontos, repartidos assim:</li>
      </ol>
      <div className="mt-2"><StackBar parts={items.map((i) => ({ key: i.k, value: i.v }))} /></div>
      <ul className="mt-2 grid gap-1 sm:grid-cols-2">
        {items.map((i) => <li key={i.k} className="flex items-start gap-2 text-xs text-slate-300"><i className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: CAT_COLORS[i.k] }} /><span><b className="text-white">{CATEGORY_LABELS[i.k]} (até {i.v})</b> — {i.d}</span></li>)}
      </ul>
      <div className="mt-3 rounded-xl border border-sky-300/20 bg-sky-500/5 p-3 text-xs leading-relaxed text-sky-100/90">
        <p className="font-black text-sky-200">O que os pontos mudam no jogo</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li><b>Sua posição</b> e, na sexta às 21h, o título.</li>
          <li><b>Seus adversários:</b> o pareamento aproxima quem tem pontuação parecida.</li>
          <li><b>Bônus de topo:</b> estando entre os líderes, mascotes em campo que sobrevivem ganham até {cfg.leadershipCap} pontos extras por combate.</li>
          <li><b>Não mudam</b> atributos, HP nem a força dos seus mascotes. Os ajustes de combate vêm só de sequências: {cfg.pressure.minStreak} vitórias seguidas ativam a Pressão do Trono (de −{cfg.pressure.steps[1]}% até −{cfg.pressure.steps[cfg.pressure.steps.length - 1]}%) e {cfg.current.minStreak} derrotas seguidas ativam o Calor da Lareira (de +{cfg.current.steps[1]}% até +{cfg.current.steps[cfg.current.steps.length - 1]}%). Quebrou a sequência, o ajuste some.</li>
        </ul>
      </div>
      <div className="mt-3 rounded-xl border border-amber-300/30 bg-amber-300/5 p-3 text-xs leading-relaxed text-amber-100/90">
        <p className="font-black text-amber-200">Por que alguém com mais derrotas pode estar na frente?</p>
        <p className="mt-1">Vencer vale só {Math.round((b.win / total) * 100)}% do que um combate pode render. Uma equipe que perde, mas causa muito dano, faz KOs, cura e resiste, soma mais do que outra que vence por pouco e contribui menos. Quem enfrenta adversários fortes também perde mais — e pontua mesmo assim. Toque numa linha da tabela para ver, em números, de onde vêm os pontos de cada jogador.</p>
      </div>
    </Card>
  );
}

export function StandingsTable({ rows, cfg, meId, breakdown }: { rows: StandRow[]; cfg: Cfg; meId?: string; breakdown?: Breakdown }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!rows.length) return <Empty title="Ninguém inscrito ainda">Quando as equipes forem reveladas a classificação aparece aqui.</Empty>;
  let inversions = 0;
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) if (rows[i].losses > rows[j].losses) inversions++;
  const topScore = Math.max(1, rows[0].score);
  return (
    <div>
      {inversions > 0 && breakdown && <p className="mb-2 rounded-lg bg-sky-500/10 px-3 py-1.5 text-[11px] text-sky-200">ℹ️ Em {inversions} comparações, quem está acima tem <b>mais derrotas</b>: a posição segue os pontos, não as vitórias. Toque numa linha para entender.</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <caption className="sr-only">Classificação geral</caption>
          <thead><tr className="text-left text-[10px] uppercase tracking-wider text-slate-500"><th className="py-2 pl-2">#</th><th>Jogador</th><th className="w-44">Pontos</th><th className="text-right">Pts/luta</th><th className="text-right">V·D·E</th><th className="text-right">Aprov.</th><th className="text-right">Sequência</th><th className="pr-2 text-right">Ajuste</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const mod = modifierPct(r, cfg);
              const fights = r.wins + r.losses + r.draws;
              const bd = breakdown?.[r.pid];
              const isOpen = open === r.pid;
              return (
                <Fragment key={r.pid}>
                  <tr onClick={() => bd && setOpen(isOpen ? null : r.pid)} className={`cursor-pointer border-t border-slate-800/70 hover:bg-slate-800/30 ${r.pid === meId ? "bg-amber-300/10" : r.rank === 1 ? "bg-amber-300/5" : ""}`} aria-expanded={isOpen}>
                    <td className="py-2 pl-2 font-black tabular-nums text-white">{r.rank}<span className="ml-1 text-[10px]"><Delta row={r} /></span></td>
                    <td className="font-bold text-white">{r.rank === 1 && <span aria-hidden>👑 </span>}{r.name}{r.isBot && <span className="ml-1 text-[10px] text-slate-500">teste</span>}{r.pid === meId && <span className="ml-1 text-[10px] text-amber-300">você</span>}</td>
                    <td><div className="flex items-center gap-2"><span className="w-14 text-right font-mono font-black tabular-nums text-amber-200">{fmtPts(r.score)}</span><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800"><span className="block h-full rounded-full bg-amber-300/80" style={{ width: `${(r.score / topScore) * 100}%` }} /></span></div></td>
                    <td className="text-right font-mono tabular-nums text-slate-300">{fights ? fmtPts(r.score / fights) : "–"}</td>
                    <td className="text-right tabular-nums"><span className="text-emerald-300">{r.wins}</span><span className="text-slate-600">·</span><span className="text-red-300">{r.losses}</span><span className="text-slate-600">·</span><span className="text-slate-400">{r.draws}</span></td>
                    <td className="text-right tabular-nums text-slate-300">{fights ? `${Math.round((r.wins / fights) * 100)}%` : "–"}</td>
                    <td className="text-right text-xs font-bold tabular-nums">{r.winStreak > 0 ? <span className="text-emerald-300">{r.winStreak}V seguidas</span> : r.lossStreak > 0 ? <span className="text-red-300">{r.lossStreak}D seguidas</span> : <span className="text-slate-600">–</span>}</td>
                    <td className="pr-2 text-right">
                      {mod < 0 ? <Pill tone="red" title={`Pressão do Trono: ${r.winStreak} vitórias seguidas reduzem Força, Instinto, Vitalidade e Carisma no próximo combate`}>👑 {mod}%</Pill> : mod > 0 ? <Pill tone="gold" title={`Calor da Lareira: ${r.lossStreak} derrotas seguidas aumentam Força, Instinto, Vitalidade e Carisma no próximo combate`}>🔥 +{mod}%</Pill> : <span className="text-slate-600">–</span>}
                    </td>
                  </tr>
                  {isOpen && bd && (
                    <tr className="bg-slate-900/60"><td colSpan={8} className="px-3 py-3">
                      <StackBar parts={CAT_ORDER.map((k) => ({ key: k, value: bd.points[k] ?? 0 }))} labels />
                      <ul className="mt-2 space-y-1 text-xs text-slate-300">{explainRow(r, bd, cfg).map((l) => <li key={l}>• {l}</li>)}</ul>
                    </td></tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type SortKey = "total" | "kos" | "damage" | "support" | "survival";
type MRow = EditionView["mascotRanking"][number];
const SORTS: { key: SortKey; label: string; val: (m: MRow) => number; fmt: (v: number) => string }[] = [
  { key: "total", label: "Pontos", val: (m) => m.total, fmt: fmtPts },
  { key: "kos", label: "KOs", val: (m) => m.kos + m.assists * 0.5, fmt: (v) => v.toFixed(1) },
  { key: "damage", label: "Dano", val: (m) => m.damageDealt, fmt: (v) => String(Math.round(v)) },
  { key: "support", label: "Suporte", val: (m) => m.healing + m.mitigated, fmt: (v) => String(Math.round(v)) },
  { key: "survival", label: "Sobrevivência", val: (m) => (m.matches ? m.survivedBattles / m.matches : 0), fmt: (v) => `${Math.round(v * 100)}%` },
];

export function MascotRanking({ rows, meId }: { rows: EditionView["mascotRanking"]; meId?: string }) {
  const [sort, setSort] = useState<SortKey>("total");
  if (!rows.length) return <Empty icon="🐾" title="Sem pontuação ainda">O ranking de mascotes nasce das contribuições reais em batalha.</Empty>;
  const s = SORTS.find((x) => x.key === sort)!;
  const list = [...rows].sort((a, b) => s.val(b) - s.val(a)).slice(0, 30);
  const best = Math.max(1e-9, s.val(list[0]));
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Ordenar por">
        {SORTS.map((x) => <button key={x.key} role="tab" aria-selected={sort === x.key} onClick={() => setSort(x.key)} className={`rounded-full px-3 py-1 text-xs font-bold ${sort === x.key ? "bg-amber-400 text-slate-900" : "bg-slate-800 text-slate-300 hover:text-white"}`}>{x.label}</button>)}
      </div>
      <ol className="space-y-1.5">
        {list.map((m, i) => (
          <li key={m.id} className={`rounded-xl border p-2.5 ${m.pid === meId ? "border-amber-300/40 bg-amber-300/5" : i < 3 ? "border-sky-300/20 bg-sky-950/30" : "border-slate-800 bg-slate-900/50"}`}>
            <div className="flex items-center gap-3">
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${i === 0 ? "bg-amber-400 text-slate-900" : i < 3 ? "bg-sky-400/30 text-sky-100" : "bg-slate-800 text-slate-400"}`}>{i + 1}</span>
              <Sprite id={m.pokemonId} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">{m.name} <span className="text-xs font-normal text-slate-500">· {m.owner}</span></p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-amber-300/80 transition-all duration-700" style={{ width: `${(s.val(m) / best) * 100}%` }} /></div>
              </div>
              <div className="text-right"><p className="font-mono text-lg font-black leading-none text-amber-200">{s.fmt(s.val(m))}</p><p className="text-[10px] text-slate-500">{s.label.toLowerCase()}</p></div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5 text-center sm:grid-cols-6">
              {([["KO", m.kos], ["Assist.", m.assists], ["Dano", Math.round(m.damageDealt)], ["Cura", m.healing], ["Absorv.", m.mitigated], ["Lutas", `${m.wins}V/${m.matches}`]] as [string, string | number][]).map(([l, v]) => (
                <div key={l} className="rounded-lg bg-slate-950/60 px-1 py-1"><p className="text-[9px] uppercase tracking-wider text-slate-500">{l}</p><p className="text-xs font-bold tabular-nums text-white">{v}</p></div>
              ))}
            </div>
            <div className="mt-2"><StackBar parts={CAT_ORDER.map((k) => ({ key: k, value: m.points[k] ?? 0 }))} thin /></div>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">{CAT_ORDER.map((k) => <span key={k} className="flex items-center gap-1 text-[10px] text-slate-400"><i className="h-2 w-2 rounded-full" style={{ background: CAT_COLORS[k] }} />{CATEGORY_LABELS[k]}</span>)}</div>
    </div>
  );
}

const SLOT_NAMES = ["Titular", "Reserva 1", "Reserva 2"];

/** Equipes dos adversários: slot, postura do dia, nome e nível. Nada de HP, atributos ou estratégia. */
export function TeamsGrid({ teams, meId, restDay }: { teams: EditionView["teams"]; meId?: string; restDay?: number | null }) {
  if (!teams.length) return <Empty icon="🔒" title="Equipes ainda secretas">As formações são reveladas aos demais jogadores às 21h de segunda, quando as inscrições fecham.</Empty>;
  const by = (list: MascotLite[]) => new Map(list.map((m) => [m.id, m]));
  const day = teams.find((t) => t.day)?.day;
  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-slate-900/60 px-3 py-2 text-xs text-slate-400">Formação {day ? `de ${["", "terça", "quarta", "quinta", "sexta"][day]}` : "do dia"}, já congelada. {restDay ? "As formações do próximo dia seguem ocultas até as 08h." : "A vida e o estado dos mascotes adversários não são revelados."}</p>
      <div className="grid gap-4 xl:grid-cols-2">
        {teams.map((t) => {
          const map = by(t.mascots);
          return (
            <Card key={t.pid} className={t.pid === meId ? "!border-amber-300/40" : ""}>
              <Title right={t.pid === meId ? <Pill tone="gold">Sua equipe</Pill> : undefined}>{t.name}{t.isBot && <span className="ml-2 text-xs font-normal text-slate-500">teste</span>}</Title>
              <div className="space-y-2">
                {t.formation.slots.map((s, i) => (
                  <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/50 p-2">
                    <div className="mb-1.5 flex items-center justify-between"><span className="text-[11px] font-black text-sky-200">Slot {i + 1}</span><Pill tone="blue">{roleLabel(s.role)}</Pill></div>
                    <ul className="grid grid-cols-3 gap-1.5">
                      {s.mascotIds.map((id, k) => {
                        const m = map.get(id);
                        if (!m) return <li key={id} />;
                        return (
                          <li key={id} className={`flex flex-col items-center rounded-lg border p-1.5 text-center ${k === 0 ? "border-sky-300/30 bg-sky-950/40" : "border-slate-800 bg-slate-950/50"}`}>
                            <Sprite id={m.pokemonId} size={k === 0 ? 52 : 44} />
                            <p className="mt-0.5 w-full truncate text-[11px] font-bold text-white" title={m.name}>{m.name}</p>
                            <p className="text-[10px] text-slate-400">Nv {m.level}</p>
                            <p className={`text-[9px] font-bold uppercase tracking-wider ${k === 0 ? "text-sky-300" : "text-slate-500"}`}>{SLOT_NAMES[k]}</p>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
