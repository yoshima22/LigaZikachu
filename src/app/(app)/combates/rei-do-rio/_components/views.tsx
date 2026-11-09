"use client";

import { fmtPts, PT } from "@/lib/rei-do-rio/config";
import { modifierPct } from "@/lib/rei-do-rio/standings";
import type { StandRow } from "@/lib/rei-do-rio/standings";
import type { DayState, Formation, MascotSnap } from "@/lib/rei-do-rio/team";
import type { EditionView, MascotLite } from "@/lib/rei-do-rio/view";
import { getPokemonName } from "@/lib/mascot-data";
import { Card, Empty, HpBar, Pill, Sprite, Title, roleLabel } from "./rei-ui";

const nm = (m: MascotSnap) => m.nickname || m.speciesNameOverride || getPokemonName(m.pokemonId);

/** Seis posições: ativo, reservas, derrotados, feridos e quem assume no próximo combate. */
export function FormationBoard({ formation, state, roster }: { formation: Formation; state: DayState | null; roster: MascotSnap[] }) {
  const by = new Map(roster.map((m) => [m.id, m]));
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {formation.slots.map((slot, i) => {
        const active = state?.active[i] ?? slot.mascotIds[0];
        const queue = slot.mascotIds;
        const exhausted = !!state && queue.every((id) => state.mascots[id]?.dead);
        const nextId = state ? queue.find((id) => id !== active && !state.mascots[id]?.dead) : queue[1];
        return (
          <Card key={i} className={`!p-3 ${exhausted ? "opacity-70" : ""}`}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-black text-sky-200">Slot {i + 1}</span>
              <Pill tone={exhausted ? "red" : "blue"}>{roleLabel(slot.role)}</Pill>
            </div>
            {exhausted && <p className="mb-2 rounded-lg bg-red-500/10 px-2 py-1 text-[11px] font-bold text-red-300">Slot esgotado — fica vazio até o descanso</p>}
            <ul className="space-y-1.5">
              {queue.map((id, idx) => {
                const m = by.get(id);
                const st = state?.mascots[id];
                if (!m) return null;
                const isActive = id === active && !st?.dead;
                const wounded = !!st && !st.dead && st.hp / st.max < 0.4;
                return (
                  <li key={id} className={`rounded-xl border p-1.5 ${isActive ? "border-amber-300/60 bg-amber-300/10" : "border-slate-800 bg-slate-900/50"} ${st?.dead ? "opacity-60" : ""}`}>
                    <div className="flex items-center gap-2">
                      <Sprite id={m.pokemonId} size={34} dim={st?.dead} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-bold text-white">{nm(m)}</span>
                          {isActive && <Pill tone="gold">Em campo</Pill>}
                          {!isActive && id === nextId && !st?.dead && <Pill tone="green">Próximo</Pill>}
                          {st?.dead && <Pill tone="red">Derrotado</Pill>}
                          {wounded && <Pill tone="red">Ferido</Pill>}
                          {!isActive && !st?.dead && id !== nextId && <Pill>{idx === 0 ? "Titular" : "Reserva"}</Pill>}
                        </div>
                        {st && <><HpBar hp={st.hp} max={st.max} dead={st.dead} /><p className="mt-0.5 text-[10px] tabular-nums text-slate-500">{st.dead ? "0" : st.hp}/{st.max} HP</p></>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

function Delta({ row }: { row: StandRow }) {
  if (row.prevRank === null || row.prevRank === row.rank) return <span className="text-slate-600" aria-label="Sem variação">–</span>;
  const up = row.rank < row.prevRank;
  return <span className={up ? "text-emerald-400" : "text-red-400"} aria-label={up ? "Subiu" : "Caiu"}>{up ? "▲" : "▼"}{Math.abs(row.prevRank - row.rank)}</span>;
}

export function Podium({ rows }: { rows: StandRow[] }) {
  const top = rows.slice(0, 3);
  if (!top.length) return null;
  const crown = ["👑", "🥈", "🥉"];
  return (
    <div className="grid grid-cols-3 items-end gap-2">
      {[1, 0, 2].map((i) => top[i] && (
        <div key={top[i].pid} className={`rounded-2xl border p-3 text-center ${i === 0 ? "border-amber-300/50 bg-gradient-to-b from-amber-300/15 to-transparent pb-6" : "border-sky-200/10 bg-slate-900/50"}`}>
          <p className={i === 0 ? "text-3xl" : "text-xl"} aria-hidden>{crown[i]}</p>
          <p className="mt-1 truncate text-sm font-black text-white">{top[i].name}</p>
          <p className="font-mono text-lg font-black text-amber-200">{fmtPts(top[i].score)}</p>
          <p className="text-[10px] text-slate-400">{top[i].wins}V · {top[i].losses}D · {top[i].draws}E</p>
        </div>
      ))}
    </div>
  );
}

export function StandingsTable({ rows, cfg, meId }: { rows: StandRow[]; cfg: EditionView["edition"]["cfg"]; meId?: string }) {
  if (!rows.length) return <Empty title="Ninguém inscrito ainda">Quando as equipes forem reveladas a classificação aparece aqui.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <caption className="sr-only">Classificação geral</caption>
        <thead><tr className="text-left text-[10px] uppercase tracking-wider text-slate-500"><th className="py-2 pl-2">#</th><th>Jogador</th><th className="text-right">Pontos</th><th className="text-right">V</th><th className="text-right">D</th><th className="text-right">E</th><th className="text-right">Folgas</th><th className="pr-2 text-right">Equilíbrio</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const mod = modifierPct(r, cfg);
            return (
              <tr key={r.pid} className={`border-t border-slate-800/70 ${r.pid === meId ? "bg-amber-300/10" : r.rank === 1 ? "bg-amber-300/5" : ""}`}>
                <td className="py-2 pl-2 font-black tabular-nums text-white">{r.rank}<span className="ml-1 text-[10px]"><Delta row={r} /></span></td>
                <td className="font-bold text-white">{r.rank === 1 && <span aria-hidden>👑 </span>}{r.name}{r.isBot && <span className="ml-1 text-[10px] text-slate-500">teste</span>}</td>
                <td className="text-right font-mono font-black tabular-nums text-amber-200">{fmtPts(r.score)}</td>
                <td className="text-right tabular-nums text-emerald-300">{r.wins}</td><td className="text-right tabular-nums text-red-300">{r.losses}</td><td className="text-right tabular-nums text-slate-400">{r.draws}</td><td className="text-right tabular-nums text-slate-500">{r.byes}</td>
                <td className="pr-2 text-right">
                  {mod < 0 ? <Pill tone="red" title="Pressão do Trono: redução temporária no combate">👑 {mod}%</Pill> : mod > 0 ? <Pill tone="blue" title="Corrente Favorável: bônus temporário no combate">❄ +{mod}%</Pill> : <span className="text-slate-600">–</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function MascotRanking({ rows, meId }: { rows: EditionView["mascotRanking"]; meId?: string }) {
  if (!rows.length) return <Empty icon="🐾" title="Sem pontuação ainda">O ranking de mascotes nasce das contribuições reais em batalha.</Empty>;
  return (
    <ol className="space-y-1.5">
      {rows.slice(0, 30).map((m, i) => (
        <li key={m.id} className={`flex items-center gap-3 rounded-xl border p-2 ${m.pid === meId ? "border-amber-300/40 bg-amber-300/5" : "border-slate-800 bg-slate-900/50"}`}>
          <span className="w-6 text-center text-sm font-black tabular-nums text-slate-400">{i + 1}</span>
          <Sprite id={m.pokemonId} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-white">{m.name} <span className="text-xs font-normal text-slate-500">· {m.owner}</span></p>
            <p className="text-[11px] text-slate-400">{m.kos} KO · {m.assists} assist. · {Math.round(m.damageDealt)} dano · {m.healing} cura · {m.mitigated} mitigado · {m.matches} lutas</p>
          </div>
          <div className="text-right"><p className="font-mono text-base font-black text-amber-200">{fmtPts(m.total)}</p><p className="text-[10px] text-slate-500">{m.wins}V</p></div>
        </li>
      ))}
    </ol>
  );
}

export function TeamsGrid({ teams, meId }: { teams: EditionView["teams"]; meId?: string }) {
  if (!teams.length) return <Empty icon="🔒" title="Equipes ainda secretas">As formações são reveladas aos demais jogadores às 21h de segunda, quando as inscrições fecham.</Empty>;
  const by = (list: MascotLite[]) => new Map(list.map((m) => [m.id, m]));
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {teams.map((t) => {
        const map = by(t.mascots);
        return (
          <Card key={t.pid} className={t.pid === meId ? "border-amber-300/40" : ""}>
            <Title right={<Pill tone={t.formation.strategy === "KEEP" ? "slate" : "green"}>{t.formation.strategy === "KEEP" ? "Mantém sobreviventes" : "Preserva feridos"}</Pill>}>{t.name}{t.isBot && <span className="ml-2 text-xs font-normal text-slate-500">teste</span>}</Title>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {t.formation.slots.map((s, i) => (
                <div key={i} className="rounded-xl bg-slate-900/60 p-2">
                  <p className="mb-1 text-[10px] font-bold uppercase text-sky-300/80">{i + 1} · {roleLabel(s.role)}</p>
                  <div className="flex -space-x-1">{s.mascotIds.map((id, k) => { const m = map.get(id); return m ? <span key={id} title={`${m.name} (${k === 0 ? "titular" : `reserva ${k}`})`} className={k === 0 ? "z-10" : "opacity-70"}><Sprite id={m.pokemonId} size={k === 0 ? 40 : 30} /></span> : null; })}</div>
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export const PTS = PT;
