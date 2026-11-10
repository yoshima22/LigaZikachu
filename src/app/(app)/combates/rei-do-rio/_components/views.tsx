"use client";

import { fmtPts } from "@/lib/rei-do-rio/config";
import type { StandRow } from "@/lib/rei-do-rio/standings";
import type { DayState, Formation, MascotSnap } from "@/lib/rei-do-rio/team";
import type { EditionView } from "@/lib/rei-do-rio/view";
import { getPokemonName } from "@/lib/mascot-data";
import { getAbilityInfo } from "@/lib/abilities";
import { abilityOf } from "@/lib/rei-do-rio/team";
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
                        {getAbilityInfo(abilityOf(formation, m)) && <p className="truncate text-[10px] text-violet-200/80">✨ {getAbilityInfo(abilityOf(formation, m))!.name}</p>}
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

export function Delta({ row }: { row: StandRow }) {
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
