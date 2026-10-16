import {
  ABILITY_CATEGORIES,
  ABILITY_CATEGORY_LIMIT,
  ABILITY_REDUCED_FACTOR,
  describeAbility,
  describeAbilityAt,
  evaluateTeamAbilities,
  getAbilityInfo,
  type AbilitySlotState,
  type Stats,
} from "@/lib/abilities";
import { ABILITY_CATEGORY_STYLE } from "@/lib/abilities/style";
import { getSpriteUrl } from "@/lib/mascot-data";

const STATE_STYLE: Record<AbilitySlotState, { label: string; cls: string }> = {
  ACTIVE: { label: "100% ligada", cls: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300" },
  REDUCED: { label: "70% reduzida", cls: "border-amber-400/40 bg-amber-500/10 text-amber-300" },
  OFF: { label: "desligada", cls: "border-rose-400/40 bg-rose-500/10 text-rose-300 line-through" },
  NONE: { label: "sem efeito", cls: "border-slate-500/40 bg-slate-500/10 text-slate-400" },
};

/** Nome da habilidade + categoria + estado (ligada/reduzida/desligada) no slot atual. */
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

export type LineupMascot = {
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
};

/** Ordem dos slots no time e o que ela faz com cada habilidade (limite por categoria). */
export function AbilityLineupPanel({
  mascots, onMove, onChangeAbility, locked = false,
}: {
  mascots: LineupMascot[];
  onMove?: (index: number, delta: number) => void;
  onChangeAbility?: (id: string, slug: string) => void;
  locked?: boolean;
}) {
  const slots = evaluateTeamAbilities(mascots.map((m) => m.ability));
  const warnings = mascots
    .map((m, i) => ({ m, i, slot: slots[i] }))
    .filter(({ slot }) => slot.state === "OFF" || slot.state === "REDUCED");
  const usage = ABILITY_CATEGORIES.map((category) => {
    const used = mascots.filter((m, i) => getAbilityInfo(m.ability)?.category === category && slots[i].state !== "NONE").length;
    return { category, used, limit: ABILITY_CATEGORY_LIMIT[category] };
  }).filter((u) => u.used > 0);

  return (
    <div className="rounded-2xl border border-fuchsia-300/25 bg-fuchsia-300/[.04] p-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-300">✨ Habilidades por slot</p>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
        A <b>ordem do time</b> decide quanto cada habilidade rende. Dentro de cada categoria: o <b>1º</b> mascote usa a habilidade com{" "}
        <b className="text-emerald-300">100%</b> do efeito, o <b>2º</b> com <b className="text-amber-300">{Math.round(ABILITY_REDUCED_FACTOR * 100)}%</b> e do{" "}
        <b>3º em diante</b> ela fica <b className="text-rose-300">desligada</b>. <b>Sobrevivência</b>: só o 1º vale. Mude a posição para escolher quem fica ligado.
        A habilidade oculta só vale se o mascote usou o TM.{onChangeAbility && " Escolha outra habilidade no seletor de cada slot; ao criar a equipe ela passa a ser a preferida do mascote."}
      </p>

      {usage.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {usage.map(({ category, used, limit }) => (
            <span key={category} className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${ABILITY_CATEGORY_STYLE[category]}`}>
              {category}: {used} no time{used > limit ? ` (limite ${limit})` : ""}
            </span>
          ))}
        </div>
      )}

      {mascots.length === 0 ? (
        <p className="mt-2 text-[11px] text-slate-500">Selecione mascotes para ver as habilidades em cada slot.</p>
      ) : (
        <ol className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {mascots.map((m, index) => {
            const info = getAbilityInfo(m.ability);
            const slot = slots[index];
            const factor = slot.factor;
            return (
              <li key={m.id} className="flex items-start gap-2 rounded-xl border border-white/10 bg-slate-950/60 p-2">
                <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-300/15 text-[10px] font-black text-cyan-200">{index + 1}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getSpriteUrl(m.pokemonId)} alt="" className="h-9 w-9 shrink-0 object-contain [image-rendering:pixelated]" />
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-[11px] text-white">{m.name}</b>
                  {onChangeAbility && m.options && m.options.length > 1 && (
                    <select
                      value={m.ability ?? ""}
                      onChange={(e) => onChangeAbility(m.id, e.target.value)}
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
                        <AbilityStateChip slug={m.ability} state={slot.state} reason={slot.reason} />
                      </div>
                      {info.hasEffect && (
                        <p className="mt-0.5 text-[10px] leading-snug text-slate-400">
                          {factor > 0
                            ? m.stats
                              ? describeAbilityAt(info, m.stats, factor)
                              : describeAbility(info)
                            : "Neste slot a habilidade não entra em ação."}
                        </p>
                      )}
                      {slot.reason && <p className="mt-0.5 text-[10px] text-amber-200/90">⚠ {slot.reason}</p>}
                    </>
                  ) : (
                    <p className="text-[10px] text-slate-500">Sem habilidade com efeito.</p>
                  )}
                </div>
                {onMove && (
                  <div className="flex shrink-0 flex-col">
                    <button type="button" disabled={locked || index === 0} onClick={() => onMove(index, -1)} aria-label="Subir"
                      className="rounded px-1.5 text-[11px] leading-none text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-25">▲</button>
                    <button type="button" disabled={locked || index === mascots.length - 1} onClick={() => onMove(index, 1)} aria-label="Descer"
                      className="rounded px-1.5 text-[11px] leading-none text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-25">▼</button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {warnings.length > 0 && (
        <p className="mt-2 text-[10px] text-amber-200/90">
          Dica: troque a ordem para que as habilidades mais importantes fiquem no 1º slot da categoria.
        </p>
      )}
    </div>
  );
}
