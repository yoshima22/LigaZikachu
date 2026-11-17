"use client";

import { useState } from "react";
import {
  ABILITY_CATEGORIES,
  ABILITY_CATEGORY_LIMIT,
  ABILITY_REDUCED_FACTOR,
  abilityValue,
  describeAbility,
  describeAbilityAt,
  evaluateTeamAbilities,
  getAbilityInfo,
  type AbilitySlot,
  type AbilitySlotState,
  type Stats,
} from "@/lib/abilities";
import { ABILITY_CATEGORY_STYLE } from "@/lib/abilities/style";
import { getSpriteUrl } from "@/lib/mascot-data";
import { KeywordText } from "@/components/keyword-text";

const STATE_STYLE: Record<AbilitySlotState, { label: string; cls: string }> = {
  ACTIVE: { label: "100% ligada", cls: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300" },
  REDUCED: { label: "70% reduzida", cls: "border-amber-400/40 bg-amber-500/10 text-amber-300" },
  OFF: { label: "desligada", cls: "border-rose-400/40 bg-rose-500/10 text-rose-300 line-through" },
  NONE: { label: "sem efeito", cls: "border-slate-500/40 bg-slate-500/10 text-slate-400" },
};

/** Nome da habilidade + categoria + estado (ligada/reduzida/desligada) no ponto atual da lista. */
export function AbilityStateChip({
  slug, state, reason, compact = false,
}: { slug?: string | null; state?: AbilitySlotState; reason?: string | null; compact?: boolean }) {
  const info = getAbilityInfo(slug);
  if (!info) return null;
  const st = state ? STATE_STYLE[state] : null;
  return (
    <span
      className="mt-0.5 flex flex-wrap items-center justify-center gap-1"
      title={`${info.name}: ${describeAbility(info)}${reason ? `\n${reason}` : ""}`}
    >
      <span className={`font-bold text-fuchsia-200 ${compact ? "text-[8px]" : "text-[10px]"}`}>✨ {info.name}</span>
      {!compact && info.category && (
        <span className={`rounded border px-1 text-[8px] font-bold ${ABILITY_CATEGORY_STYLE[info.category]}`}>{info.category}</span>
      )}
      {st && <span className={`rounded border px-1 font-black ${compact ? "text-[7px]" : "text-[8px]"} ${st.cls}`}>{st.label}</span>}
    </span>
  );
}

export type AllocMascot = {
  id: string;
  name: string;
  pokemonId: number;
  /** Slug da habilidade em uso (já resolvida: escolha, TM e padrão). */
  ability: string | null;
  stats?: Stats;
  /** Habilidades que o mascote pode usar; com mais de uma, aparece o seletor. */
  options?: string[];
  /** Habilidade salva como preferida no mascote (marcada no seletor). */
  preferred?: string | null;
  /** Posição do mascote no time (só informativa/debug). */
  slot?: number;
  /** false = reserva: aparece na lista, mas não entra na conta das categorias. */
  inField?: boolean;
};

/**
 * Montagem de habilidades, padrão de TODOS os modos: a lista está em ORDEM DE PRIORIDADE (do topo
 * para baixo) e independe da posição do mascote no time. Dentro de cada categoria, o 1º da lista
 * usa 100% do efeito, o 2º usa 70% e do 3º em diante a habilidade fica desligada (Sobrevivência: só o 1º).
 * `mascots` já vem ordenado; mover/arrastar chama `onReorder` com os ids na nova ordem.
 */
export function AbilityAllocator({
  mascots, onReorder, onChangeAbility, locked = false, note, debug = false,
}: {
  mascots: AllocMascot[];
  onReorder?: (ids: string[]) => void;
  onChangeAbility?: (id: string, slug: string) => void;
  locked?: boolean;
  note?: string;
  /** Só para a conta admin: mostra a tabela e o JSON da montagem. */
  debug?: boolean;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const fieldIdx = mascots.map((m, i) => (m.inField === false ? -1 : i)).filter((i) => i >= 0);
  const fieldSlots = evaluateTeamAbilities(fieldIdx.map((i) => mascots[i].ability));
  const slots: Array<AbilitySlot | null> = mascots.map((_, i) => {
    const k = fieldIdx.indexOf(i);
    return k < 0 ? null : fieldSlots[k];
  });
  const usage = ABILITY_CATEGORIES.map((category) => {
    const used = fieldIdx.filter((i) => getAbilityInfo(mascots[i].ability)?.category === category && slots[i]?.state !== "NONE").length;
    return { category, used, limit: ABILITY_CATEGORY_LIMIT[category] };
  }).filter((u) => u.used > 0);
  const ids = mascots.map((m) => m.id);
  const move = (from: number, to: number) => {
    if (!onReorder || locked || to < 0 || to >= ids.length || from === to) return;
    const next = [...ids];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onReorder(next);
  };

  return (
    <div className="rounded-2xl border border-fuchsia-300/25 bg-fuchsia-300/[.04] p-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-300">✨ Montagem de habilidades</p>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
        A lista abaixo é a <b>ordem de prioridade</b> das habilidades — <b>não depende</b> da posição do mascote no time.
        Dentro de cada categoria, o <b>1º da lista</b> usa <b className="text-emerald-300">100%</b> do efeito, o <b>2º</b>{" "}
        <b className="text-amber-300">{Math.round(ABILITY_REDUCED_FACTOR * 100)}%</b> e do <b>3º em diante</b> a habilidade fica{" "}
        <b className="text-rose-300">desligada</b> (<b>Sobrevivência</b>: só o 1º). Arraste ou use ▲▼ para decidir quem fica ligado.
        A habilidade oculta só vale se o mascote usou o TM.{note ? ` ${note}` : ""}
      </p>

      {usage.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {usage.map(({ category, used, limit }) => (
            <span key={category} className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${ABILITY_CATEGORY_STYLE[category]}`}>
              {category}: {used} no time{used > limit ? ` (só ${limit} liga${limit > 1 ? "m" : ""})` : ""}
            </span>
          ))}
        </div>
      )}

      {mascots.length === 0 ? (
        <p className="mt-2 text-[11px] text-slate-500">Selecione mascotes para montar as habilidades.</p>
      ) : (
        <ol className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {mascots.map((m, index) => {
            const info = getAbilityInfo(m.ability);
            const slot = slots[index];
            const reserve = slot === null;
            return (
              <li
                key={m.id}
                draggable={Boolean(onReorder) && !locked}
                onDragStart={() => setDragId(m.id)}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => { if (dragId && dragId !== m.id) e.preventDefault(); }}
                onDrop={() => { if (dragId) move(ids.indexOf(dragId), index); setDragId(null); }}
                className={`flex items-start gap-2 rounded-xl border bg-slate-950/60 p-2 ${dragId === m.id ? "border-fuchsia-400/60 opacity-60" : "border-white/10"} ${reserve ? "opacity-70" : ""}`}
              >
                <span className="mt-1 grid h-5 w-5 shrink-0 cursor-grab place-items-center rounded-full bg-fuchsia-300/15 text-[10px] font-black text-fuchsia-200" title="Prioridade">{index + 1}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img loading="lazy" decoding="async" src={getSpriteUrl(m.pokemonId)} alt="" className="h-9 w-9 shrink-0 object-contain [image-rendering:pixelated]" />
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-[11px] text-white">{m.name}{reserve && <span className="ml-1 text-[9px] font-semibold text-slate-500">reserva</span>}</b>
                  {onChangeAbility && m.options && m.options.length > 1 && (
                    <select
                      value={m.ability ?? ""}
                      disabled={locked}
                      onChange={(e) => onChangeAbility(m.id, e.target.value)}
                      aria-label={`Habilidade de ${m.name}`}
                      className="mt-0.5 w-full rounded border border-fuchsia-400/30 bg-slate-900 px-1 py-0.5 text-[10px] text-fuchsia-100"
                    >
                      {m.options.map((slug) => {
                        const opt = getAbilityInfo(slug);
                        return (
                          <option key={slug} value={slug}>
                            {opt?.name ?? slug}{opt && !opt.hasEffect ? " (sem efeito)" : ""}{slug === m.preferred ? " ★ preferida" : ""}
                          </option>
                        );
                      })}
                    </select>
                  )}
                  {info ? (
                    <>
                      <div className="flex justify-start">
                        <AbilityStateChip slug={m.ability} state={slot?.state} reason={slot?.reason} />
                      </div>
                      {info.hasEffect && (
                        <p className="mt-0.5 text-[10px] leading-snug text-slate-400">
                          <KeywordText text={reserve
                            ? describeAbility(info)
                            : slot.factor > 0
                              ? m.stats ? describeAbilityAt(info, m.stats, slot.factor) : describeAbility(info)
                              : "Neste ponto da lista a habilidade não entra em ação."} />
                        </p>
                      )}
                      {slot?.reason && <p className="mt-0.5 text-[10px] text-amber-200/90">⚠ {slot.reason}</p>}
                    </>
                  ) : (
                    <p className="text-[10px] text-slate-500">Sem habilidade com efeito.</p>
                  )}
                </div>
                {onReorder && (
                  <div className="flex shrink-0 flex-col">
                    <button type="button" disabled={locked || index === 0} onClick={() => move(index, index - 1)} aria-label="Subir prioridade"
                      className="rounded px-1.5 text-[11px] leading-none text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-25">▲</button>
                    <button type="button" disabled={locked || index === mascots.length - 1} onClick={() => move(index, index + 1)} aria-label="Descer prioridade"
                      className="rounded px-1.5 text-[11px] leading-none text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-25">▼</button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {debug && <AbilityDebug mascots={mascots} slots={slots} />}
    </div>
  );
}

/** Debug da montagem (admin): prioridade, slot, estado calculado e o lineup que vai para o motor. */
function AbilityDebug({ mascots, slots }: { mascots: AllocMascot[]; slots: Array<AbilitySlot | null> }) {
  const lineup = Object.fromEntries(
    mascots.flatMap((m, i) => {
      const s = slots[i];
      return s && s.factor > 0 && m.ability ? [[m.id, { slug: m.ability, factor: s.factor }]] : [];
    }),
  );
  return (
    <details className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/[.04] p-2">
      <summary className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-amber-300">🛠 Debug da montagem (admin)</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[10px] text-slate-300">
          <thead className="text-slate-500">
            <tr><th className="pr-2">Prior.</th><th className="pr-2">Slot</th><th className="pr-2">Mascote</th><th className="pr-2">Habilidade</th><th className="pr-2">Categoria</th><th className="pr-2">Estado</th><th className="pr-2">Fator</th><th>Valor</th></tr>
          </thead>
          <tbody>
            {mascots.map((m, i) => {
              const info = getAbilityInfo(m.ability);
              const slot = slots[i];
              const val = info && m.stats && slot ? abilityValue(info, m.stats, slot.factor) : null;
              return (
                <tr key={m.id} className="border-t border-white/5">
                  <td className="pr-2">{i + 1}</td>
                  <td className="pr-2">{m.slot != null ? m.slot + 1 : "—"}</td>
                  <td className="pr-2">{m.name}</td>
                  <td className="pr-2">{m.ability ?? "—"}</td>
                  <td className="pr-2">{info?.category ?? "—"}</td>
                  <td className="pr-2">{slot ? slot.state : "RESERVA"}</td>
                  <td className="pr-2">{slot ? slot.factor : "—"}</td>
                  <td>{val == null ? "—" : `${Math.round(val * 1000) / 10}%`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <pre className="mt-2 max-h-48 overflow-auto rounded bg-black/40 p-2 text-[9px] text-amber-100/80">{JSON.stringify({ order: mascots.map((m) => m.id), lineup }, null, 1)}</pre>
    </details>
  );
}
