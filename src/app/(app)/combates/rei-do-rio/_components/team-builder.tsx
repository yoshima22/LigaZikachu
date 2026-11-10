"use client";

import { useMemo, useState } from "react";
import { COMBAT_ROLE_OPTIONS } from "@/lib/combat-roles";
import { getPokemonName } from "@/lib/mascot-data";
import { autoBuild, PRESETS, type Preset } from "@/lib/rei-do-rio/auto-build";
import { SLOT_COUNT, SQUAD_SIZE, TEAM_SIZE } from "@/lib/rei-do-rio/config";
import { SWAP_PRESETS, describeSwap, emptyFormation, roleAllowedFor, slotSwapPct, validateFormation, type Formation, type MascotSnap } from "@/lib/rei-do-rio/team";
import { Card, Empty, Pill, Sprite, Title, roleLabel } from "./rei-ui";

const nameOf = (m: MascotSnap) => m.nickname || m.speciesNameOverride || getPokemonName(m.pokemonId);
const SLOT_LABELS = ["Titular", "Reserva 1", "Reserva 2"];

function Stats({ m }: { m: MascotSnap }) {
  const vals = [["F", m.statForce], ["A", m.statAgility], ["I", m.statInstinct], ["V", m.statVitality], ["C", m.statCharisma]] as const;
  const best = Math.max(...vals.map((v) => v[1]));
  return (
    <div className="flex gap-1 text-[9px] tabular-nums" aria-label="Atributos">
      {vals.map(([k, v]) => <span key={k} className={v === best ? "font-black text-amber-300" : "text-slate-500"}>{k}{v}</span>)}
    </div>
  );
}

type Sel = { from: "bench" | "slot"; id: string; slot?: number; idx?: number } | null;

export function TeamBuilder({
  pool, lockedIds, initial, mode, onSave, saving, extraActions,
}: {
  pool: MascotSnap[];
  /** Depois do fechamento só os 18 inscritos podem ser reorganizados. */
  lockedIds: Set<string> | null;
  initial: Formation | null;
  mode: "register" | "rest";
  onSave: (f: Formation) => void;
  saving?: boolean;
  extraActions?: React.ReactNode;
}) {
  const poolMap = useMemo(() => new Map(pool.map((m) => [m.id, m])), [pool]);
  const [f, setF] = useState<Formation>(() => initial ?? emptyFormation());
  const [sel, setSel] = useState<Sel>(null);
  const [q, setQ] = useState("");
  const [preset, setPreset] = useState<Preset>("BALANCED");
  const [notes, setNotes] = useState<string[]>([]);
  const [autoError, setAutoError] = useState<string[] | null>(null);

  const used = useMemo(() => new Set(f.slots.flatMap((s) => s.mascotIds)), [f]);
  const errors = useMemo(() => validateFormation(f, poolMap, lockedIds), [f, poolMap, lockedIds]);
  const bench = useMemo(() => {
    const term = q.trim().toLowerCase();
    return pool.filter((m) => !used.has(m.id) && (!term || nameOf(m).toLowerCase().includes(term))).slice(0, 80);
  }, [pool, used, q]);

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
        const from = (sel.slot === slot ? dst : src);
        const moving = from[sel.idx!];
        if (idx < dst.length) { const other = dst[idx]; dst[idx] = moving; from[sel.idx!] = other; }
        else { from.splice(sel.idx!, 1); dst.push(moving); }
      }
    });
    setSel(null);
  }
  const clearCell = (slot: number, idx: number) => update((d) => { d.slots[slot].mascotIds.splice(idx, 1); });
  const promote = (slot: number, idx: number) => update((d) => { const a = d.slots[slot].mascotIds; if (idx > 0) [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]; });

  function runAuto() {
    const r = autoBuild(pool, preset, "PRESERVE");
    if (!r.ok) { setAutoError([r.error, ...r.missing]); setNotes([]); return; }
    setAutoError(null); setF(r.formation); setNotes(r.explanation); setSel(null);
  }

  return (
    <div className="space-y-4">
      {mode === "register" && (
        <Card glow>
          <Title sub="Escolha um estilo e deixe a Liga montar 18 mascotes equilibrados — você ajusta o que quiser depois.">Montar minha equipe automaticamente</Title>
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
            <span className="text-[11px] text-slate-500">Só usa posturas que cada mascote realmente desbloqueou.</span>
          </div>
          {autoError && <div role="alert" className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{autoError.map((l) => <p key={l}>{l}</p>)}<p className="mt-1 text-xs text-red-300/80">Não criamos nem duplicamos mascotes para completar a equipe.</p></div>}
          {notes.length > 0 && <ul className="mt-3 space-y-0.5 rounded-xl bg-sky-950/40 p-3 text-xs text-sky-100/80">{notes.map((n) => <li key={n}>• {n}</li>)}</ul>}
        </Card>
      )}

      <Card>
        <Title sub="Defina, por slot, quando o mascote em campo dá lugar ao próximo da fila. A troca só acontece entre combates.">Troca por vida</Title>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Aplicar a todos os slots">
          <span className="text-[11px] text-slate-500">Aplicar a todos os slots:</span>
          {SWAP_PRESETS.map((p) => (
            <button key={p.pct} type="button" onClick={() => update((d) => { d.slots.forEach((sl) => { sl.swapBelowPct = p.pct; }); })} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${f.slots.every((sl) => slotSwapPct(f, sl) === p.pct) ? "border-amber-300 bg-amber-300/15 text-amber-200" : "border-slate-700 text-slate-400 hover:text-white"}`}>{p.label}</button>
          ))}
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {f.slots.map((slot, si) => (
          <Card key={si} className="!p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-black text-sky-200">Slot {si + 1}</span>
              <select aria-label={`Postura do slot ${si + 1}`} value={slot.role} onChange={(e) => update((d) => { d.slots[si].role = e.target.value; })} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-white">
                {COMBAT_ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <ol className="space-y-1.5">
              {Array.from({ length: SQUAD_SIZE }, (_, idx) => {
                const id = slot.mascotIds[idx];
                const m = id ? poolMap.get(id) : undefined;
                const blocked = m ? !roleAllowedFor(slot.role, m) : false;
                const selected = sel?.from === "slot" && sel.slot === si && sel.idx === idx;
                return (
                  <li key={idx}>
                    <div
                      draggable={!!m}
                      onDragStart={(e) => { if (m) { setSel({ from: "slot", id: m.id, slot: si, idx }); e.dataTransfer.setData("text/plain", m.id); } }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); place(si, idx); }}
                      className={`flex items-center gap-2 rounded-xl border p-1.5 ${selected ? "border-amber-300 bg-amber-300/10" : blocked ? "border-red-400/50 bg-red-500/5" : "border-slate-800 bg-slate-900/60"} ${idx === 0 ? "ring-1 ring-sky-300/20" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => (m ? setSel(selected ? null : { from: "slot", id: m.id, slot: si, idx }) : sel && place(si, idx))}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        aria-label={m ? `${SLOT_LABELS[idx]}: ${nameOf(m)}. Toque para selecionar e trocar.` : `${SLOT_LABELS[idx]} vazio. Toque para colocar o mascote selecionado.`}
                      >
                        {m ? <Sprite id={m.pokemonId} size={36} /> : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-dashed border-slate-700 text-slate-600">+</span>}
                        <span className="min-w-0 flex-1">
                          <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">{SLOT_LABELS[idx]}</span>
                          <span className="block truncate text-xs font-bold text-white">{m ? nameOf(m) : "Vazio"}{m && <span className="ml-1 font-normal text-slate-500">Nv {m.level}</span>}</span>
                          {m && <Stats m={m} />}
                        </span>
                      </button>
                      {m && blocked && <Pill tone="red" title="Este mascote não desbloqueou esta postura">🔒 {roleLabel(slot.role)}</Pill>}
                      <div className="flex flex-col">
                        {idx > 0 && m && <button type="button" onClick={() => promote(si, idx)} className="px-1 text-xs text-slate-400 hover:text-white" aria-label="Subir na fila">▲</button>}
                        {m && mode === "register" && <button type="button" onClick={() => clearCell(si, idx)} className="px-1 text-xs text-slate-600 hover:text-red-300" aria-label="Remover do slot">✕</button>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="mt-2 rounded-lg bg-slate-950/60 p-2">
              <div className="flex items-center justify-between"><label htmlFor={`swap-${si}`} className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Troca por vida</label><span className="text-[11px] font-black text-amber-200">{slotSwapPct(f, slot) === 0 ? "Até cair" : `HP ≤ ${slotSwapPct(f, slot)}%`}</span></div>
              <input id={`swap-${si}`} type="range" min={0} max={90} step={10} value={slotSwapPct(f, slot)} onChange={(e) => update((d) => { d.slots[si].swapBelowPct = Number(e.target.value) === 10 ? 10 : Number(e.target.value); })} className="mt-1 w-full accent-amber-300" aria-describedby={`swap-d-${si}`} />
              <p id={`swap-d-${si}`} className="mt-0.5 text-[10px] leading-snug text-slate-400">{describeSwap(slotSwapPct(f, slot))}</p>
            </div>
          </Card>
        ))}
      </div>

      {mode === "register" && (
        <Card>
          <Title sub={sel ? "Agora toque no slot de destino." : "Toque em um mascote e depois no lugar onde quer colocá-lo (ou arraste)."} right={<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar mascote…" className="w-40 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white" aria-label="Buscar na coleção" />}>
            Sua coleção <span className="text-xs font-normal text-slate-500">({pool.length} mascotes · {used.size}/{TEAM_SIZE} escolhidos)</span>
          </Title>
          {bench.length === 0 ? <Empty icon="🎒" title="Nada para mostrar">Todos os mascotes visíveis já estão na equipe ou a busca não encontrou nada.</Empty> : (
            <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
              {bench.map((m) => (
                <li key={m.id}>
                  <button
                    draggable onDragStart={(e) => { setSel({ from: "bench", id: m.id }); e.dataTransfer.setData("text/plain", m.id); }}
                    onClick={() => setSel(sel?.id === m.id ? null : { from: "bench", id: m.id })}
                    className={`flex w-full items-center gap-2 rounded-xl border p-1.5 text-left ${sel?.id === m.id ? "border-amber-300 bg-amber-300/10" : "border-slate-800 bg-slate-900/60 hover:border-sky-300/40"}`}
                  >
                    <Sprite id={m.pokemonId} size={32} />
                    <span className="min-w-0"><span className="block truncate text-xs font-bold text-white">{nameOf(m)}</span><Stats m={m} /></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card glow={errors.length === 0}>
        {errors.length === 0 ? (
          <p className="text-sm font-bold text-emerald-300">✓ Equipe válida: {TEAM_SIZE} mascotes diferentes em {SLOT_COUNT} slots.</p>
        ) : (
          <div role="alert"><p className="text-sm font-bold text-amber-200">Falta ajustar ({errors.length}):</p><ul className="mt-1 space-y-0.5 text-xs text-slate-300">{errors.slice(0, 8).map((e) => <li key={e}>• {e}</li>)}{errors.length > 8 && <li>…e mais {errors.length - 8}</li>}</ul></div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button disabled={errors.length > 0 || saving} onClick={() => onSave(f)} className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition enabled:hover:brightness-110 enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-40">
            {saving ? "Salvando…" : mode === "register" ? "Confirmar inscrição" : "Salvar formação do próximo dia"}
          </button>
          {mode === "register" && <button onClick={() => { setF(emptyFormation()); setNotes([]); }} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white">Limpar tudo</button>}
          {mode === "rest" && (
            <button onClick={runAuto} className="rounded-xl border border-sky-300/30 px-3 py-2 text-xs font-bold text-sky-200 hover:bg-sky-300/10">✨ Reorganizar automaticamente</button>
          )}
          {extraActions}
          {mode === "rest" && (
            <select aria-label="Estilo do montador" value={preset} onChange={(e) => setPreset(e.target.value as Preset)} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white">
              {(Object.keys(PRESETS) as Preset[]).map((p) => <option key={p} value={p}>{PRESETS[p].name}</option>)}
            </select>
          )}
        </div>
        {mode === "rest" && notes.length > 0 && <ul className="mt-2 space-y-0.5 text-xs text-sky-100/80">{notes.slice(0, 4).map((n) => <li key={n}>• {n}</li>)}</ul>}
      </Card>
    </div>
  );
}
