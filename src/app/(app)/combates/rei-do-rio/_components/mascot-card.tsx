"use client";

import { useState } from "react";
import { recommendCombatRole } from "@/lib/combat-roles";
import { describeAbilityAt, getAbilityInfo, getSpeciesAbilities } from "@/lib/abilities";
import { ABILITY_CATEGORY_STYLE } from "@/lib/abilities/style";
import { getPokemonName } from "@/lib/mascot-data";
import { abilityOf, abilityOptionsOf, maxHpOf, type AbilityState, type Formation, type MascotSnap } from "@/lib/rei-do-rio/team";
import { Pill, Sprite, roleLabel } from "./rei-ui";

export const mascotName = (m: MascotSnap) => m.nickname || m.speciesNameOverride || getPokemonName(m.pokemonId);

const STATS = [
  { key: "statForce", label: "Força", short: "FOR", bar: "bg-red-400", text: "text-red-300" },
  { key: "statAgility", label: "Agilidade", short: "AGI", bar: "bg-sky-400", text: "text-sky-300" },
  { key: "statInstinct", label: "Instinto", short: "INS", bar: "bg-violet-400", text: "text-violet-300" },
  { key: "statVitality", label: "Vitalidade", short: "VIT", bar: "bg-emerald-400", text: "text-emerald-300" },
  { key: "statCharisma", label: "Carisma", short: "CAR", bar: "bg-pink-400", text: "text-pink-300" },
] as const;
const STAT_CAP = 250; // mesmo teto das posturas/habilidades

/** Cinco atributos com rótulo, valor e barra (o maior fica destacado). */
export function StatBars({ m, dense = false }: { m: MascotSnap; dense?: boolean }) {
  const best = Math.max(...STATS.map((s) => m[s.key]));
  return (
    <ul className={`grid grid-cols-5 gap-1.5 ${dense ? "" : "sm:gap-2"}`} aria-label="Atributos">
      {STATS.map((s) => {
        const v = m[s.key];
        return (
          <li key={s.key} title={`${s.label}: ${v}`} className="min-w-0 rounded-lg bg-slate-950/60 px-1.5 py-1 text-center">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{s.short}</p>
            <p className={`text-sm font-black tabular-nums leading-tight ${v === best ? s.text : "text-slate-200"}`}>{v}</p>
            <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${s.bar}`} style={{ width: `${Math.min(100, (v / STAT_CAP) * 100)}%` }} /></div>
          </li>
        );
      })}
    </ul>
  );
}

const bestRole = (m: MascotSnap) => recommendCombatRole({ statForce: m.statForce, statAgility: m.statAgility, statInstinct: m.statInstinct, statVitality: m.statVitality, statCharisma: m.statCharisma });

/** Nome, nível, HP no evento e a postura em que ele rende mais. */
export function MascotHeading({ m, hpMult, size = 52 }: { m: MascotSnap; hpMult: number; size?: number }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid shrink-0 place-items-center rounded-xl bg-slate-950/70 p-1"><Sprite id={m.pokemonId} size={size} /></span>
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-white">{mascotName(m)}</p>
        <p className="text-[11px] text-slate-400">Nv {m.level} · HP <b className="text-slate-200">{maxHpOf(m, hpMult)}</b></p>
        <p className="mt-0.5 text-[10px] text-slate-500">rende mais como <b className="text-sky-300">{roleLabel(bestRole(m))}</b></p>
      </div>
    </div>
  );
}

/** Seletor da habilidade do mascote (padrão = a dele; troca livre entre as que ele pode usar). */
export function AbilityField({ m, f, onChange, state, readOnly = false }: { m: MascotSnap; f: Pick<Formation, "abilities">; onChange?: (slug: string) => void; state?: AbilityState | null; readOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const options = abilityOptionsOf(m);
  const current = abilityOf(f, m);
  const info = getAbilityInfo(current);
  const hidden = getSpeciesAbilities(m.pokemonId).hidden;
  if (!info) return <p className="rounded-lg bg-slate-950/50 px-2 py-1.5 text-[11px] text-slate-500">Sem habilidade</p>;
  const stats = { force: m.statForce, agility: m.statAgility, charisma: m.statCharisma, instinct: m.statInstinct, vitality: m.statVitality };
  const off = state?.state === "OFF";
  return (
    <div className={`rounded-lg border p-2 ${off ? "border-slate-700 bg-slate-950/40 opacity-80" : "border-violet-300/25 bg-violet-300/[.05]"}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[9px] font-black uppercase tracking-wider text-violet-300">Habilidade</span>
        {info.category && <span className={`rounded border px-1 text-[9px] font-bold ${ABILITY_CATEGORY_STYLE[info.category]}`}>{info.category}</span>}
        {state?.state === "REDUCED" && <Pill tone="gold" title={state.reason ?? ""}>70% do efeito</Pill>}
        {off && <Pill tone="red" title={state?.reason ?? ""}>desligada em campo</Pill>}
        {!info.hasEffect && <Pill>sem efeito em combate</Pill>}
      </div>
      {!readOnly && options.length > 1 ? (
        <select value={current ?? ""} onChange={(e) => onChange?.(e.target.value)} aria-label={`Habilidade de ${mascotName(m)}`} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs font-bold text-violet-100">
          {options.map((slug) => <option key={slug} value={slug}>{getAbilityInfo(slug)?.name ?? slug}{getAbilityInfo(slug)?.hasEffect ? "" : " (sem efeito)"}{slug === hidden ? " · oculta" : ""}</option>)}
        </select>
      ) : <p className="mt-1.5 text-xs font-black text-violet-100">{info.name}</p>}
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-1 text-[10px] font-bold text-violet-300 hover:underline">{open ? "▾ ocultar o que faz" : "▸ ver o que faz"}</button>
      {open && (
        <div className="mt-1 space-y-1">
          <p className="text-[11px] leading-snug text-slate-300">{info.hasEffect ? describeAbilityAt(info, stats) : "Esta habilidade não tem efeito em combate nesta versão."}</p>
          {info.hasEffect && <p className="text-[10px] text-slate-500">{info.activations > 0 ? `${info.activations} ativação(ões) por luta` : "passiva"} · {info.trigger}</p>}
          {hidden && !m.hiddenUnlocked && !options.includes(hidden) && <p className="text-[10px] text-violet-200/70">A habilidade oculta ({getAbilityInfo(hidden)?.name}) é liberada com o TM dela (ZikaShop/Bazar).</p>}
        </div>
      )}
    </div>
  );
}
