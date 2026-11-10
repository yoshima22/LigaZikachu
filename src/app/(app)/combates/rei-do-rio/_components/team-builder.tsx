"use client";

import { useMemo, useState } from "react";
import { ABILITY_CATEGORY_LIMIT, ABILITY_REDUCED_FACTOR, getAbilityInfo } from "@/lib/abilities";
import { ABILITY_CATEGORY_STYLE } from "@/lib/abilities/style";
import { COMBAT_ROLE_OPTIONS } from "@/lib/combat-roles";
import { autoBuild, PRESETS, type Preset } from "@/lib/rei-do-rio/auto-build";
import { SLOT_COUNT, SQUAD_SIZE, TEAM_SIZE } from "@/lib/rei-do-rio/config";
import { SWAP_PRESETS, abilityOf, describeSwap, emptyFormation, evaluateLineupAbilities, roleAllowedFor, slotSwapPct, validateFormation, type Formation, type MascotSnap } from "@/lib/rei-do-rio/team";
import { AbilityField, MascotHeading, StatBars, mascotName } from "./mascot-card";
import { Card, Empty, Pill, Sprite, Title, roleLabel } from "./rei-ui";

const SLOT_LABELS = ["Titular", "Reserva 1", "Reserva 2"];
type Sel = { from: "bench" | "slot"; id: string; slot?: number; idx?: number } | null;
type SortKey = "power" | "level" | "statForce" | "statAgility" | "statInstinct" | "statVitality" | "statCharisma";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "power", label: "Poder total" }, { key: "level", label: "Nível" }, { key: "statForce", label: "Força" }, { key: "statAgility", label: "Agilidade" },
  { key: "statInstinct", label: "Instinto" }, { key: "statVitality", label: "Vitalidade" }, { key: "statCharisma", label: "Carisma" },
];
const power = (m: MascotSnap) => m.statForce + m.statAgility + m.statInstinct + m.statVitality + m.statCharisma;
const abilityName = (f: Formation, m: MascotSnap) => getAbilityInfo(abilityOf(f, m))?.name ?? "sem habilidade";

export function TeamBuilder({
  pool, lockedIds, initial, mode, onSave, saving, extraActions, hpMult = 1,
}: {
  pool: MascotSnap[];
  /** Depois do fechamento só os 18 inscritos podem ser reorganizados. */
  lockedIds: Set<string> | null;
  initial: Formation | null;
  mode: "register" | "rest";
  onSave: (f: Formation) => void;
  saving?: boolean;
  extraActions?: React.ReactNode;
  /** Multiplicador de HP do evento (mostrado nas fichas). */
  hpMult?: number;
}) {
  const poolMap = useMemo(() => new Map(pool.map((m) => [m.id, m])), [pool]);
  const [f, setF] = useState<Formation>(() => initial ?? emptyFormation());
  const [sel, setSel] = useState<Sel>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("power");
  const [detail, setDetail] = useState(true);
  const [preset, setPreset] = useState<Preset>("BALANCED");
  const [notes, setNotes] = useState<string[]>([]);
  const [autoError, setAutoError] = useState<string[] | null>(null);

  const used = useMemo(() => new Set(f.slots.flatMap((s) => s.mascotIds)), [f]);
  const errors = useMemo(() => validateFormation(f, poolMap, lockedIds), [f, poolMap, lockedIds]);
  const bench = useMemo(() => {
    const term = q.trim().toLowerCase();
    const val = (m: MascotSnap) => (sort === "power" ? power(m) : m[sort]);
    return pool.filter((m) => !used.has(m.id) && (!term || mascotName(m).toLowerCase().includes(term))).sort((a, b) => val(b) - val(a)).slice(0, 60);
  }, [pool, used, q, sort]);
  const selMascot = sel ? poolMap.get(sel.id) : null;

  // Habilidades dos titulares (ordem dos slots): ligada, 70% ou desligada pelo limite da categoria.
  const titulars = f.slots.map((s) => (s.mascotIds[0] ? poolMap.get(s.mascotIds[0]) ?? null : null));
  const abilityStates = evaluateLineupAbilities(titulars.map((m) => (m ? abilityOf(f, m) : null)));

  const update = (fn: (draft: Formation) => void) => setF((prev) => { const d = structuredClone(prev); fn(d); return d; });

  function place(slot: number, idx: number) {
    if (!sel) return;
    update((d) => {
      const dst = d.slots[slot].mascotIds.filter(Boolean);
      d.slots[slot].mascotIds = dst;
      if (sel.from === "bench") {
        if (idx < dst.length) dst[idx] = sel.id; // quem estava ali volta para a coleção
        else dst.push(sel.id);
      } else {
        const src = d.slots[sel.slot!].mascotIds.filter(Boolean);
        d.slots[sel.slot!].mascotIds = sel.slot === slot ? dst : src;
        const from = sel.slot === slot ? dst : src;
        const moving = from[sel.idx!];
        if (idx < dst.length) { const other = dst[idx]; dst[idx] = moving; from[sel.idx!] = other; }
        else { from.splice(sel.idx!, 1); dst.push(moving); }
      }
    });
    setSel(null);
  }
  const clearCell = (slot: number, idx: number) => update((d) => { d.slots[slot].mascotIds.splice(idx, 1); });
  const promote = (slot: number, idx: number) => update((d) => { const a = d.slots[slot].mascotIds; if (idx > 0) [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]; });
  const setAbility = (id: string, slug: string) => update((d) => { d.abilities = { ...(d.abilities ?? {}), [id]: slug }; });

  function runAuto() {
    const r = autoBuild(pool, preset, "PRESERVE");
    if (!r.ok) { setAutoError([r.error, ...r.missing]); setNotes([]); return; }
    setAutoError(null); setF((prev) => ({ ...r.formation, abilities: prev.abilities })); setNotes(r.explanation); setSel(null);
  }
  function save() {
    // Só guarda a escolha de habilidade dos mascotes que estão na equipe.
    const ids = new Set(f.slots.flatMap((s) => s.mascotIds));
    const abilities = Object.fromEntries(Object.entries(f.abilities ?? {}).filter(([id]) => ids.has(id)));
    onSave({ ...f, abilities });
  }

  return (
    <div className="space-y-4">
      {mode === "register" && (
        <Card glow>
          <Title sub="Escolha um estilo e deixe a Liga montar 18 mascotes equilibrados — você ajusta tudo depois.">1. Monte automaticamente (ou do zero)</Title>
          <div className="grid gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Estilo da equipe">
            {(Object.keys(PRESETS) as Preset[]).map((p) => (
              <button key={p} role="radio" aria-checked={preset === p} onClick={() => setPreset(p)} className={`rounded-xl border p-3 text-left transition ${preset === p ? "border-amber-300 bg-amber-300/10" : "border-slate-700 hover:border-sky-300/40"}`}>
                <p className="text-sm font-black text-white">{PRESETS[p].name}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{PRESETS[p].desc}</p>
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={runAuto} className="rounded-xl bg-gradient-to-r from-amber-300 to-amber-400 px-4 py-2.5 text-sm font-black text-slate-900 shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-95">✨ Montar minha equipe automaticamente</button>
            <span className="text-[11px] text-slate-500">Só usa posturas que cada mascote realmente desbloqueou e a habilidade padrão de cada um.</span>
          </div>
          {autoError && <div role="alert" className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{autoError.map((l) => <p key={l}>{l}</p>)}<p className="mt-1 text-xs text-red-300/80">Não criamos nem duplicamos mascotes para completar a equipe.</p></div>}
          {notes.length > 0 && <ul className="mt-3 space-y-0.5 rounded-xl bg-sky-950/40 p-3 text-xs text-sky-100/80">{notes.map((n) => <li key={n}>• {n}</li>)}</ul>}
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Card>
            <Title sub="Quando o mascote em campo deve dar lugar ao próximo da fila. Só acontece entre combates." right={
              <button onClick={() => setDetail((v) => !v)} aria-pressed={detail} className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white">{detail ? "Ocultar detalhes das fichas" : "Mostrar detalhes das fichas"}</button>
            }>2. Ajuste os slots</Title>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Troca por vida em todos os slots">
              <span className="text-[11px] text-slate-500">Troca por vida em todos os slots:</span>
              {SWAP_PRESETS.map((p) => (
                <button key={p.pct} type="button" onClick={() => update((d) => { d.slots.forEach((sl) => { sl.swapBelowPct = p.pct; }); })} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${f.slots.every((sl) => slotSwapPct(f, sl) === p.pct) ? "border-amber-300 bg-amber-300/15 text-amber-200" : "border-slate-700 text-slate-400 hover:text-white"}`}>{p.label}</button>
              ))}
            </div>
          </Card>

          {sel && selMascot && (
            <div role="status" className="sticky top-2 z-20 flex items-center gap-3 rounded-2xl border border-amber-300/50 bg-slate-950/95 p-2.5 shadow-xl backdrop-blur">
              <Sprite id={selMascot.pokemonId} size={36} />
              <p className="min-w-0 flex-1 text-xs text-slate-200"><b className="text-amber-200">{mascotName(selMascot)}</b> selecionado — toque no lugar do time onde quer colocá-lo.</p>
              <button onClick={() => setSel(null)} className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs font-bold text-slate-200">Cancelar</button>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {f.slots.map((slot, si) => {
              const state = abilityStates[si];
              return (
                <Card key={si} className="!p-3">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-sky-400/15 text-sm font-black text-sky-200">{si + 1}</span>
                    <label className="flex min-w-0 flex-1 items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Postura
                      <select aria-label={`Postura do slot ${si + 1}`} value={slot.role} onChange={(e) => update((d) => { d.slots[si].role = e.target.value; })} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs font-bold normal-case tracking-normal text-white">
                        {COMBAT_ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                  </div>
                  <ol className="space-y-2">
                    {Array.from({ length: SQUAD_SIZE }, (_, idx) => {
                      const id = slot.mascotIds[idx];
                      const m = id ? poolMap.get(id) : undefined;
                      const blocked = m ? !roleAllowedFor(slot.role, m) : false;
                      const selected = sel?.from === "slot" && sel.slot === si && sel.idx === idx;
                      return (
                        <li key={idx}>
                          {m ? (
                            <div
                              draggable
                              onDragStart={(e) => { setSel({ from: "slot", id: m.id, slot: si, idx }); e.dataTransfer.setData("text/plain", m.id); }}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => { e.preventDefault(); place(si, idx); }}
                              className={`rounded-2xl border p-2.5 transition ${selected ? "border-amber-300 bg-amber-300/10" : blocked ? "border-red-400/60 bg-red-500/5" : sel ? "border-sky-300/40 bg-slate-900/70 hover:bg-sky-300/5" : "border-slate-800 bg-slate-900/60"} ${idx === 0 ? "ring-1 ring-sky-300/25" : ""}`}
                            >
                              <div className="flex items-start gap-2">
                                <button type="button" onClick={() => (sel && !selected ? place(si, idx) : setSel(selected ? null : { from: "slot", id: m.id, slot: si, idx }))} className="min-w-0 flex-1 text-left" aria-label={`${SLOT_LABELS[idx]}: ${mascotName(m)}. ${sel && !selected ? "Toque para trocar de lugar com o mascote selecionado." : "Toque para selecionar e mover."}`}>
                                  <p className={`mb-1 text-[10px] font-black uppercase tracking-wider ${idx === 0 ? "text-sky-300" : "text-slate-500"}`}>{SLOT_LABELS[idx]}{idx === 0 ? " · entra primeiro" : ""}</p>
                                  <MascotHeading m={m} hpMult={hpMult} />
                                </button>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                  {blocked && <Pill tone="red" title="Este mascote não desbloqueou esta postura">🔒 {roleLabel(slot.role)}</Pill>}
                                  <div className="flex gap-1">
                                    {idx > 0 && <button type="button" onClick={() => promote(si, idx)} className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:text-white" aria-label="Subir na fila">▲</button>}
                                    {mode === "register" && <button type="button" onClick={() => clearCell(si, idx)} className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-500 hover:text-red-300" aria-label="Remover do slot">✕</button>}
                                  </div>
                                </div>
                              </div>
                              {detail ? (
                                <div className="mt-2 space-y-2">
                                  <StatBars m={m} />
                                  <AbilityField m={m} f={f} onChange={(slug) => setAbility(m.id, slug)} state={idx === 0 ? state : null} />
                                </div>
                              ) : <p className="mt-1.5 text-[11px] text-violet-200/80">✨ {abilityName(f, m)}</p>}
                            </div>
                          ) : (
                            <button type="button" onClick={() => sel && place(si, idx)} className={`flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed p-4 text-xs font-bold transition ${sel ? "border-amber-300/60 bg-amber-300/5 text-amber-200" : "border-slate-700 text-slate-500"}`}>
                              ＋ {SLOT_LABELS[idx]} vazio{sel ? " — colocar aqui" : ""}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                  <div className="mt-3 rounded-xl bg-slate-950/60 p-2.5">
                    <div className="flex items-center justify-between"><label htmlFor={`swap-${si}`} className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Troca por vida</label><span className="text-xs font-black text-amber-200">{slotSwapPct(f, slot) === 0 ? "Até cair" : `HP ≤ ${slotSwapPct(f, slot)}%`}</span></div>
                    <input id={`swap-${si}`} type="range" min={0} max={90} step={10} value={slotSwapPct(f, slot)} onChange={(e) => update((d) => { d.slots[si].swapBelowPct = Number(e.target.value); })} className="mt-1 w-full accent-amber-300" aria-describedby={`swap-d-${si}`} />
                    <p id={`swap-d-${si}`} className="mt-0.5 text-[11px] leading-snug text-slate-400">{describeSwap(slotSwapPct(f, slot))}</p>
                  </div>
                </Card>
              );
            })}
          </div>

          {mode === "register" && (
            <Card>
              <Title sub={sel ? "Agora toque no lugar do time onde quer colocá-lo." : "Toque num mascote e depois no slot (ou arraste). A lista mostra os 60 primeiros do filtro."} right={
                <div className="flex flex-wrap gap-2">
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar mascote…" className="w-36 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white" aria-label="Buscar na coleção" />
                  <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Ordenar coleção" className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white">{SORTS.map((s) => <option key={s.key} value={s.key}>Ordenar: {s.label}</option>)}</select>
                </div>
              }>
                Sua coleção <span className="text-xs font-normal text-slate-500">({pool.length} mascotes · {used.size}/{TEAM_SIZE} escolhidos)</span>
              </Title>
              {bench.length === 0 ? <Empty orn="gift" title="Nada para mostrar">Todos os mascotes visíveis já estão na equipe ou a busca não encontrou nada.</Empty> : (
                <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {bench.map((m) => (
                    <li key={m.id}>
                      <button draggable onDragStart={(e) => { setSel({ from: "bench", id: m.id }); e.dataTransfer.setData("text/plain", m.id); }} onClick={() => setSel(sel?.id === m.id ? null : { from: "bench", id: m.id })}
                        className={`w-full rounded-2xl border p-2.5 text-left transition ${sel?.id === m.id ? "border-amber-300 bg-amber-300/10" : "border-slate-800 bg-slate-900/60 hover:border-sky-300/40"}`}>
                        <MascotHeading m={m} hpMult={hpMult} size={44} />
                        <div className="mt-2"><StatBars m={m} dense /></div>
                        <p className="mt-1.5 truncate text-[10px] text-violet-200/80">✨ {abilityName(f, m)}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>

        <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start" aria-label="Resumo da equipe">
          <Card glow={errors.length === 0}>
            <Title sub={`${used.size} de ${TEAM_SIZE} mascotes escolhidos`}>Resumo</Title>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-valuemin={0} aria-valuemax={TEAM_SIZE} aria-valuenow={used.size}><div className={`h-full rounded-full transition-all ${used.size === TEAM_SIZE ? "bg-emerald-400" : "bg-amber-300"}`} style={{ width: `${(used.size / TEAM_SIZE) * 100}%` }} /></div>
            {errors.length === 0 ? (
              <p className="mt-3 text-sm font-bold text-emerald-300">✓ Equipe válida: {TEAM_SIZE} mascotes diferentes em {SLOT_COUNT} slots.</p>
            ) : (
              <div role="alert" className="mt-3"><p className="text-sm font-bold text-amber-200">Falta ajustar ({errors.length}):</p><ul className="mt-1 space-y-0.5 text-xs text-slate-300">{errors.slice(0, 6).map((e) => <li key={e}>• {e}</li>)}{errors.length > 6 && <li>…e mais {errors.length - 6}</li>}</ul></div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button disabled={errors.length > 0 || saving} onClick={save} className="flex-1 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition enabled:hover:brightness-110 enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-40">
                {saving ? "Salvando…" : mode === "register" ? "Confirmar inscrição" : "Salvar formação do próximo dia"}
              </button>
              {mode === "register" && <button onClick={() => { setF(emptyFormation()); setNotes([]); }} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white">Limpar</button>}
            </div>
            {mode === "rest" && (
              <div className="mt-3 space-y-2">
                <div className="flex gap-2">
                  <select aria-label="Estilo do montador" value={preset} onChange={(e) => setPreset(e.target.value as Preset)} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white">{(Object.keys(PRESETS) as Preset[]).map((p) => <option key={p} value={p}>{PRESETS[p].name}</option>)}</select>
                  <button onClick={runAuto} className="rounded-xl border border-sky-300/30 px-3 py-2 text-xs font-bold text-sky-200 hover:bg-sky-300/10">✨ Reorganizar</button>
                </div>
                {notes.length > 0 && <ul className="space-y-0.5 text-xs text-sky-100/80">{notes.slice(0, 3).map((n) => <li key={n}>• {n}</li>)}</ul>}
                {extraActions && <div className="flex flex-wrap gap-2">{extraActions}</div>}
              </div>
            )}
          </Card>

          <Card>
            <Title orn="snowflake" sub="Quem entra em campo no 1º combate (os titulares).">Habilidades em campo</Title>
            <ul className="space-y-1.5">
              {f.slots.map((slot, i) => {
                const m = titulars[i]; const st = abilityStates[i];
                return (
                  <li key={i} className="flex items-center gap-2 rounded-lg bg-slate-900/60 px-2 py-1.5 text-xs">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sky-400/15 text-[10px] font-black text-sky-200">{i + 1}</span>
                    {m ? <Sprite id={m.pokemonId} size={26} /> : <span className="h-[26px] w-[26px]" />}
                    <span className="min-w-0 flex-1 truncate"><b className="text-white">{st ? st.name : "—"}</b></span>
                    {st && (st.state === "ACTIVE" ? <Pill tone="green">ligada</Pill> : st.state === "REDUCED" ? <Pill tone="gold" title={st.reason ?? ""}>70%</Pill> : st.state === "OFF" ? <Pill tone="red" title={st.reason ?? ""}>desligada</Pill> : null)}
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
              Em campo, cada categoria liga poucas habilidades: o 1º mascote da categoria usa 100%, o 2º usa {Math.round(ABILITY_REDUCED_FACTOR * 100)}% e os seguintes ficam desligados (Sobrevivência: só 1). A ordem dos slots decide quem fica ligado, e a regra é recalculada a cada combate quando uma reserva entra.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">{(Object.keys(ABILITY_CATEGORY_LIMIT) as (keyof typeof ABILITY_CATEGORY_LIMIT)[]).map((c) => <span key={c} className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${ABILITY_CATEGORY_STYLE[c]}`}>{c} · até {ABILITY_CATEGORY_LIMIT[c]}</span>)}</div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
