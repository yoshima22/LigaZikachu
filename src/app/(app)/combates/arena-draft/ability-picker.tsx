"use client";

import {
  ABILITY_CATEGORIES, ABILITY_CATEGORY_LIMIT, ABILITY_REDUCED_FACTOR, describeAbility, describeAbilityAt, getAbilityInfo,
  getSpeciesAbilities, type Stats,
} from "@/lib/abilities";
import { ABILITY_CATEGORY_STYLE } from "@/lib/abilities/style";

/** Escolha da habilidade de um mascote do time (a oculta só aparece se estiver nas opções). */
export function AbilityPicker({
  speciesId, value, options, stats, onChange, lockedHidden = false,
}: {
  speciesId: number;
  value: string | null | undefined;
  options: string[];
  stats: Stats;
  onChange: (slug: string) => void;
  /** Padrão: a oculta existe mas ainda não foi liberada pelo TM. */
  lockedHidden?: boolean;
}) {
  const current = value && options.includes(value) ? value : options.find((s) => getAbilityInfo(s)?.hasEffect) ?? options[0] ?? null;
  const info = getAbilityInfo(current);
  const hidden = getSpeciesAbilities(speciesId).hidden;
  if (!info) return null;
  return (
    <div className="rounded-lg border border-violet-300/25 bg-violet-300/[.04] p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[9px] font-black uppercase tracking-wider text-violet-300">Habilidade</p>
        {info.category && <span className={`rounded border px-1 text-[8px] font-bold ${ABILITY_CATEGORY_STYLE[info.category]}`}>{info.category}</span>}
        {info.hasEffect && <span className="text-[9px] text-slate-500">{info.activations > 0 ? `${info.activations} ativações` : "passiva"} · {info.trigger}</span>}
      </div>
      {options.length > 1 ? (
        <select value={current ?? ""} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-900 p-2 text-[10px] font-bold text-violet-100">
          {options.map((slug) => (
            <option key={slug} value={slug}>
              {getAbilityInfo(slug)?.name ?? slug}{getAbilityInfo(slug)?.hasEffect ? "" : " (sem efeito)"}{slug === hidden ? " · oculta" : ""}
            </option>
          ))}
        </select>
      ) : (
        <p className="mt-1 text-xs font-bold text-violet-100">{info.name}</p>
      )}
      {info.dex && <p className="mt-1 text-[9px] text-slate-500">Na Pokédex: {info.dex}</p>}
      <p className="mt-0.5 text-[11px] leading-4 text-slate-300">{info.hasEffect ? describeAbilityAt(info, stats) : describeAbility(info)}</p>
      {info.hasEffect && <p className="mt-0.5 text-[9px] text-slate-500">Valor calculado com os status atuais; chega ao máximo com {info.scale ? "o atributo em 250" : "—"}.</p>}
      {lockedHidden && hidden && (
        <p className="mt-1 text-[9px] text-violet-200/70">A oculta ({getAbilityInfo(hidden)?.name}) é liberada com o TM dela (ZikaShop/Bazar).</p>
      )}
    </div>
  );
}

/** Resumo do time por categoria, com o aviso do limite que vale em campo. */
export function AbilityTeamSummary({ slugs }: { slugs: Array<string | null | undefined> }) {
  const counts = new Map<string, number>();
  for (const slug of slugs) {
    const info = getAbilityInfo(slug);
    if (info?.category) counts.set(info.category, (counts.get(info.category) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  return (
    <div className="mt-2 rounded-xl border border-violet-300/20 bg-violet-300/[.03] p-2.5">
      <p className="text-[9px] font-black uppercase tracking-wider text-violet-300">Habilidades do time por categoria</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {ABILITY_CATEGORIES.filter((c) => counts.has(c)).map((c) => {
          const n = counts.get(c)!;
          const limit = ABILITY_CATEGORY_LIMIT[c];
          return (
            <span key={c} className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${ABILITY_CATEGORY_STYLE[c]}`} title={`No máximo ${limit} ficam ligadas em campo`}>
              {c} {n}{n > limit ? ` (só ${limit} liga${limit > 1 ? "m" : ""} em campo)` : ""}
            </span>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
        Em campo (6 mascotes) cada categoria liga poucas habilidades: o 1º mascote da categoria usa 100%, o 2º usa {Math.round(ABILITY_REDUCED_FACTOR * 100)}% e os seguintes ficam desligados
        (Sobrevivência: só 1). A ordem dos slots em campo, que você ajusta a cada janela, decide quem fica ligado.
      </p>
    </div>
  );
}
