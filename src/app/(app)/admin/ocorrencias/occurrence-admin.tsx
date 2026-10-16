"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { getPreferredSpriteUrl, getMascotImageRendering } from "@/lib/sprite-preferences";
import {
  OCCURRENCE_PHRASES,
  OCCURRENCE_RETURN_DEFAULT,
  OCCURRENCE_RETURN_PHRASES,
  OCCURRENCE_TAGS,
  OCCURRENCE_TAG_LABEL,
  renderOccurrenceText,
  type OccurrenceTag,
} from "@/lib/mascot-occurrence-phrases";
import {
  createOccurrencesAction,
  drawOccurrenceMascotsAction,
  listFilteredOccurrencePlayersAction,
  listOccurrenceMascotsAction,
  listOccurrencesAction,
  returnOccurrencesAction,
  searchOccurrencePlayersAction,
  type OccurrenceListRow,
  type OccurrenceMascotRow,
  type OccurrencePlayerRow,
} from "./actions";

const card = "rounded-2xl border border-border bg-slate-900/40 p-4";
const input = "rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]/60";
const btn = "rounded-lg border px-3 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40";
const btnGold = `${btn} border-[#FFCB05]/50 bg-[#FFCB05]/10 text-[#FFCB05] hover:bg-[#FFCB05]/20`;
const btnGhost = `${btn} border-border text-slate-300 hover:bg-white/5`;

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Agendada", ACTIVE: "Ativa", RETURNED: "Retornada (manual)", EXPIRED: "Encerrada (prazo)", CANCELLED: "Cancelada",
};

function Thumb({ pokemonId, isShiny, size = 44 }: { pokemonId: number; isShiny: boolean; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={getPreferredSpriteUrl(pokemonId, null, { shiny: isShiny })}
      alt=""
      width={size}
      height={size}
      style={{ imageRendering: getMascotImageRendering(pokemonId), width: size, height: size }}
      className="shrink-0 object-contain"
    />
  );
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

type PlanItem = { mascotId: string; tag: OccurrenceTag; message: string; returnMessage: string | null; startsAt: string | null; endsAt: string | null };

export function OccurrenceAdmin() {
  const [tab, setTab] = useState<"new" | "active" | "history">("new");
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500">Admin</p>
        <h1 className="font-pixel text-base text-[#FFCB05]">Ocorrências Misteriosas</h1>
        <p className="mt-1 max-w-3xl text-xs text-slate-400">
          Afasta mascotes temporariamente (como repouso), sem itens, recompensas ou perdas. O jogador vê um aviso e, no retorno, outro — sem explicação oficial.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {([["new", "Nova ocorrência"], ["active", "Ocorrências ativas"], ["history", "Histórico"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`${btn} ${tab === id ? "border-[#FFCB05]/60 bg-[#FFCB05]/15 text-[#FFCB05]" : "border-border text-slate-400 hover:bg-white/5"}`}>{label}</button>
        ))}
      </div>
      {tab === "new" && <NewOccurrenceWizard onCreated={() => setTab("active")} />}
      {tab === "active" && <OccurrenceList scope="active" />}
      {tab === "history" && <OccurrenceList scope="history" />}
    </div>
  );
}

// ── Nova ocorrência ──────────────────────────────────────────────────────────

function NewOccurrenceWizard({ onCreated }: { onCreated: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pending, startTransition] = useTransition();

  // Etapa 1
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [players, setPlayers] = useState<OccurrencePlayerRow[]>([]);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Map<string, string>>(new Map());

  // Etapa 2
  const [mascots, setMascots] = useState<OccurrenceMascotRow[]>([]);
  const [mode, setMode] = useState<"manual" | "random">("manual");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [frozen, setFrozen] = useState<OccurrenceMascotRow[]>([]);
  const [mQ, setMQ] = useState("");
  const [mMin, setMMin] = useState("");
  const [mMax, setMMax] = useState("");
  const [mAvail, setMAvail] = useState<"eligible" | "all">("eligible");
  const [mOwner, setMOwner] = useState("");
  const [rMin, setRMin] = useState("1");
  const [rMax, setRMax] = useState("100");
  const [rPer, setRPer] = useState("1");
  const [drawNote, setDrawNote] = useState<string | null>(null);

  // Etapa 3
  const [tag, setTag] = useState<OccurrenceTag>("MISSING");
  const [message, setMessage] = useState(OCCURRENCE_PHRASES.MISSING[0]);
  const [returnMessage, setReturnMessage] = useState("");
  const [indefinite, setIndefinite] = useState(false);
  const [durValue, setDurValue] = useState("6");
  const [durUnit, setDurUnit] = useState<"h" | "d">("h");
  const [scheduled, setScheduled] = useState(false);
  const [startsLocal, setStartsLocal] = useState("");
  const [showDeadline, setShowDeadline] = useState(true);
  const [results, setResults] = useState<Array<{ playerId: string; mascotId: string; ok: boolean; error?: string }> | null>(null);

  // Modo sortido: cada mascote recebe tag, frase, retorno, início e duração diferentes.
  const [mix, setMix] = useState(false);
  const [mixTags, setMixTags] = useState<Set<OccurrenceTag>>(new Set(OCCURRENCE_TAGS));
  const [mixOff, setMixOff] = useState<Set<string>>(new Set());
  const [mixReturns, setMixReturns] = useState<Set<number>>(new Set());
  const [spreadValue, setSpreadValue] = useState("6");
  const [spreadUnit, setSpreadUnit] = useState<"m" | "h" | "d">("h");
  const [durMaxValue, setDurMaxValue] = useState("24");
  const [plan, setPlan] = useState<PlanItem[]>([]);

  const load = useCallback((term: string, pg: number) => {
    startTransition(async () => {
      const res = await searchOccurrencePlayersAction({ q: term, page: pg });
      if (res.error) return void toast.error(res.error);
      setPlayers(res.players ?? []);
      setPages(res.pages ?? 1);
      setTotal(res.total ?? 0);
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q, page), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, page, load]);

  const toggleSelected = (p: { id: string; displayName: string }) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(p.id)) next.delete(p.id); else next.set(p.id, p.displayName);
      return next;
    });

  const selectAllFiltered = () =>
    startTransition(async () => {
      const res = await listFilteredOccurrencePlayersAction(q);
      if (res.error) return void toast.error(res.error);
      setSelected((prev) => {
        const next = new Map(prev);
        for (const p of res.players ?? []) next.set(p.id, p.displayName);
        return next;
      });
      toast.success(`${res.players?.length ?? 0} jogadores selecionados.`);
    });

  const goStep2 = () =>
    startTransition(async () => {
      const res = await listOccurrenceMascotsAction([...selected.keys()]);
      if (res.error) return void toast.error(res.error);
      setMascots(res.mascots ?? []);
      setPicked(new Set());
      setFrozen([]);
      setDrawNote(null);
      setStep(2);
    });

  const visibleMascots = useMemo(() => {
    const term = mQ.trim().toLowerCase();
    return mascots.filter((m) =>
      (mAvail === "all" || !m.reason) &&
      (!mOwner || m.playerId === mOwner) &&
      (!mMin || m.level >= Number(mMin)) &&
      (!mMax || m.level <= Number(mMax)) &&
      (!term || m.name.toLowerCase().includes(term) || String(m.pokemonId) === term || m.id.toLowerCase().includes(term)));
  }, [mascots, mQ, mAvail, mOwner, mMin, mMax]);

  const grouped = useMemo(() => {
    const map = new Map<string, OccurrenceMascotRow[]>();
    for (const m of visibleMascots) map.set(m.playerName, [...(map.get(m.playerName) ?? []), m]);
    return [...map.entries()];
  }, [visibleMascots]);

  const draw = () =>
    startTransition(async () => {
      const res = await drawOccurrenceMascotsAction({ playerIds: [...selected.keys()], minLevel: Number(rMin), maxLevel: Number(rMax), perPlayer: Number(rPer) });
      if (res.error) return void toast.error(res.error);
      setFrozen(res.mascots ?? []);
      setDrawNote(res.playersWithoutEligible?.length ? `Sem mascote elegível: ${res.playersWithoutEligible.join(", ")}.` : null);
    });

  const goStep3 = () => {
    const list = mode === "manual" ? mascots.filter((m) => picked.has(m.id) && !m.reason) : frozen;
    if (list.length === 0) return void toast.error("Nenhum mascote na lista.");
    setFrozen(list);
    setResults(null);
    setStep(3);
  };

  const onTagChange = (next: OccurrenceTag) => {
    setTag(next);
    setMessage(OCCURRENCE_PHRASES[next][0]);
  };

  const toggleSet = <T,>(setter: (fn: (prev: Set<T>) => Set<T>) => void, value: T) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });

  const generatePlan = () => {
    const tags = [...mixTags];
    if (tags.length === 0) return void toast.error("Marque ao menos uma tag.");
    if (scheduled && !startsLocal) return void toast.error("Escolha a data-base de início.");
    const unitMs = { m: 60_000, h: 3_600_000, d: 86_400_000 };
    const durUnitMs = durUnit === "h" ? 3_600_000 : 86_400_000;
    const durMin = Number(durValue) * durUnitMs;
    const durMax = Number(durMaxValue) * durUnitMs;
    if (!indefinite && !(durMin > 0 && durMax >= durMin)) return void toast.error("Duração: mínimo e máximo válidos (máx. ≥ mín.).");
    const spreadMs = Math.max(0, Number(spreadValue) * unitMs[spreadUnit]) || 0;
    const base = scheduled && startsLocal ? new Date(`${startsLocal}:00-03:00`).getTime() : Date.now();
    const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
    setPlan(frozen.map((m) => {
      const tag = pick(tags);
      const allowed = OCCURRENCE_PHRASES[tag].map((_, i) => i).filter((i) => !mixOff.has(`${tag}:${i}`));
      const idx = pick(allowed.length ? allowed : OCCURRENCE_PHRASES[tag].map((_, i) => i));
      const start = base + Math.floor(Math.random() * spreadMs);
      const dur = indefinite ? null : durMin + Math.floor(Math.random() * (durMax - durMin + 1));
      return {
        mascotId: m.id,
        tag,
        message: OCCURRENCE_PHRASES[tag][idx],
        returnMessage: mixReturns.size ? OCCURRENCE_RETURN_PHRASES[pick([...mixReturns])] : null,
        startsAt: scheduled || spreadMs > 0 ? new Date(start).toISOString() : null,
        endsAt: dur === null ? null : new Date(start + dur).toISOString(),
      };
    }));
  };

  const startsAtIso = scheduled && startsLocal ? new Date(`${startsLocal}:00-03:00`).toISOString() : null;
  const endsAtIso = useMemo(() => {
    if (indefinite) return null;
    const base = startsAtIso ? new Date(startsAtIso).getTime() : Date.now();
    const ms = Number(durValue) * (durUnit === "h" ? 3_600_000 : 86_400_000);
    return Number.isFinite(ms) && ms > 0 ? new Date(base + ms).toISOString() : null;
  }, [indefinite, durValue, durUnit, startsAtIso]);

  const confirm = () => {
    if (mix) {
      if (plan.length !== frozen.length || !frozen.every((m) => plan.some((p) => p.mascotId === m.id))) return void toast.error("Clique em “Sortear combinação” antes de confirmar.");
    } else {
      if (!indefinite && !endsAtIso) return void toast.error("Informe uma duração válida.");
      if (scheduled && !startsLocal) return void toast.error("Escolha a data de início.");
    }
    if (!window.confirm(`Afetar ${frozen.length} mascote(s) de ${new Set(frozen.map((m) => m.playerId)).size} jogador(es)? Os jogadores serão avisados.`)) return;
    startTransition(async () => {
      const res = await createOccurrencesAction({
        items: frozen.map((m) => {
          const p = mix ? plan.find((x) => x.mascotId === m.id)! : null;
          return {
            playerId: m.playerId,
            mascotId: m.id,
            tag: p ? p.tag : tag,
            message: p ? p.message : message,
            returnMessage: p ? p.returnMessage : returnMessage || null,
            startsAt: p ? p.startsAt : startsAtIso,
            endsAt: p ? p.endsAt : endsAtIso,
          };
        }),
        showDeadline,
      });
      if ("error" in res && res.error) return void toast.error(res.error);
      if ("results" in res && res.results) {
        setResults(res.results);
        const ok = res.results.filter((r) => r.ok).length;
        toast.success(`${ok}/${res.results.length} ocorrência(s) criada(s).`);
        if (ok === res.results.length) setTimeout(onCreated, 1200);
      }
    });
  };

  const nameOf = (id: string) => frozen.find((m) => m.id === id);

  return (
    <div className="space-y-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Etapa {step} de 3 — {step === 1 ? "Jogadores" : step === 2 ? "Mascotes" : "Configurar e revisar"}</p>

      {step === 1 && (
        <div className={card}>
          <div className="flex flex-wrap items-center gap-2">
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Buscar por nome, nick ou identificador" className={`${input} min-w-64 flex-1`} />
            <button onClick={selectAllFiltered} disabled={pending} className={btnGhost}>Selecionar todos os filtrados ({total})</button>
            <button onClick={() => setSelected(new Map())} className={btnGhost}>Limpar seleção</button>
          </div>
          <p className="mt-2 text-xs text-[#FFCB05]">{selected.size} jogador(es) selecionado(s)</p>
          <div className="mt-3 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border bg-slate-950/60 text-slate-400">
                <th className="w-8 p-2" /><th className="p-2 text-left">Jogador</th><th className="p-2 text-right">Mascotes</th><th className="p-2 text-right">Elegíveis</th>
              </tr></thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id} onClick={() => toggleSelected(p)} className="cursor-pointer border-b border-border/50 last:border-0 hover:bg-white/5">
                    <td className="p-2"><input type="checkbox" readOnly checked={selected.has(p.id)} className="accent-[#FFCB05]" /></td>
                    <td className="p-2 text-slate-200">{p.displayName}{p.nick && <span className="ml-2 text-slate-500">{p.nick}</span>}</td>
                    <td className="p-2 text-right text-slate-300">{p.total}</td>
                    <td className={`p-2 text-right ${p.eligible === 0 ? "text-rose-300" : "text-emerald-300"}`}>{p.eligible}</td>
                  </tr>
                ))}
                {players.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-500">Nenhum jogador encontrado.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className={btnGhost}>← Anterior</button>
              <span className="text-xs text-slate-500">{page + 1}/{pages}</span>
              <button disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className={btnGhost}>Próxima →</button>
            </div>
            <button disabled={selected.size === 0 || pending} onClick={goStep2} className={btnGold}>Continuar →</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div className={card}>
            <div className="flex flex-wrap items-center gap-2">
              {(["manual", "random"] as const).map((m) => (
                <button key={m} onClick={() => { setMode(m); setFrozen([]); }} className={`${btn} ${mode === m ? "border-[#FFCB05]/60 bg-[#FFCB05]/15 text-[#FFCB05]" : "border-border text-slate-400"}`}>
                  {m === "manual" ? "Seleção manual" : "Sorteio por jogador"}
                </button>
              ))}
              <span className="text-xs text-slate-500">{selected.size} jogador(es) · {mascots.length} mascotes</span>
            </div>
            {mode === "random" ? (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="text-[11px] text-slate-400">Nível mín.<input value={rMin} onChange={(e) => setRMin(e.target.value)} className={`${input} mt-1 block w-20`} /></label>
                <label className="text-[11px] text-slate-400">Nível máx.<input value={rMax} onChange={(e) => setRMax(e.target.value)} className={`${input} mt-1 block w-20`} /></label>
                <label className="text-[11px] text-slate-400">Por jogador<input value={rPer} onChange={(e) => setRPer(e.target.value)} className={`${input} mt-1 block w-20`} /></label>
                <button onClick={draw} disabled={pending} className={btnGold}>🎲 Sortear</button>
                <span className="text-[11px] text-slate-500">Só entram mascotes elegíveis. O sorteio vale até você continuar (lista congelada).</span>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input value={mQ} onChange={(e) => setMQ(e.target.value)} placeholder="Nome, nº da espécie ou ID" className={`${input} min-w-48`} />
                <input value={mMin} onChange={(e) => setMMin(e.target.value)} placeholder="Nv. mín." className={`${input} w-24`} />
                <input value={mMax} onChange={(e) => setMMax(e.target.value)} placeholder="Nv. máx." className={`${input} w-24`} />
                <select value={mOwner} onChange={(e) => setMOwner(e.target.value)} className={input}>
                  <option value="">Todos os proprietários</option>
                  {[...selected.entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
                <select value={mAvail} onChange={(e) => setMAvail(e.target.value as "eligible" | "all")} className={input}>
                  <option value="eligible">Só elegíveis</option><option value="all">Mostrar todos</option>
                </select>
                <button onClick={() => setPicked(new Set([...picked, ...visibleMascots.filter((m) => !m.reason).map((m) => m.id)]))} className={btnGhost}>Marcar visíveis</button>
                <button onClick={() => setPicked(new Set())} className={btnGhost}>Limpar</button>
                <span className="text-xs text-[#FFCB05]">{picked.size} marcado(s)</span>
              </div>
            )}
            {drawNote && <p className="mt-2 text-xs text-amber-300">{drawNote}</p>}
          </div>

          {mode === "manual" ? (
            <div className="space-y-3">
              {grouped.map(([owner, list]) => (
                <div key={owner} className={card}>
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">{owner} <span className="text-slate-600">({list.length})</span></p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((m) => (
                      <label key={m.id} className={`flex items-center gap-2 rounded-xl border p-2 ${m.reason ? "border-border/40 opacity-50" : picked.has(m.id) ? "cursor-pointer border-[#FFCB05]/60 bg-[#FFCB05]/10" : "cursor-pointer border-border hover:bg-white/5"}`}>
                        <input type="checkbox" disabled={Boolean(m.reason)} checked={picked.has(m.id)} onChange={() => setPicked((prev) => { const n = new Set(prev); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; })} className="accent-[#FFCB05]" />
                        <Thumb pokemonId={m.pokemonId} isShiny={m.isShiny} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-slate-100">{m.name}{m.isShiny && " ✨"}</p>
                          <p className="text-[10px] text-slate-500">Nv.{m.level} · #{m.pokemonId} · {m.state}</p>
                          <p className="truncate text-[9px] text-slate-600" title={m.id}>{m.id}</p>
                          {m.reason && <p className="text-[10px] font-semibold text-rose-300">🚫 {m.reason}</p>}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {grouped.length === 0 && <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-slate-500">Nenhum mascote com esses filtros.</p>}
            </div>
          ) : (
            frozen.length > 0 && <FrozenList list={frozen} />
          )}

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className={btnGhost}>← Voltar</button>
            <button onClick={goStep3} disabled={mode === "manual" ? picked.size === 0 : frozen.length === 0} className={btnGold}>Continuar →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <div className={`${card} space-y-3`}>
            <label className="flex items-center gap-2 rounded-lg border border-violet-400/30 bg-violet-500/5 px-3 py-2 text-xs font-semibold text-violet-200">
              <input type="checkbox" checked={mix} onChange={(e) => { setMix(e.target.checked); setPlan([]); }} className="accent-[#FFCB05]" />
              🎲 Sortido: cada mascote recebe tag, mensagem, horário e duração diferentes
            </label>
            {mix && (
              <div className="space-y-3">
                <div>
                  <p className="mb-1 text-[11px] text-slate-400">Tags que podem sair</p>
                  <div className="flex flex-wrap gap-2">
                    {OCCURRENCE_TAGS.map((t) => (
                      <button key={t} onClick={() => { toggleSet(setMixTags, t); setPlan([]); }} className={`${btn} ${mixTags.has(t) ? "border-violet-400/60 bg-violet-500/15 text-violet-200" : "border-border text-slate-500"}`}>{OCCURRENCE_TAG_LABEL[t]}</button>
                    ))}
                  </div>
                </div>
                {OCCURRENCE_TAGS.filter((t) => mixTags.has(t)).map((t) => (
                  <details key={t} className="rounded-lg border border-border/60 bg-slate-950/40 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-300">
                      Frases de {OCCURRENCE_TAG_LABEL[t]} ({OCCURRENCE_PHRASES[t].filter((_, i) => !mixOff.has(`${t}:${i}`)).length}/10)
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {OCCURRENCE_PHRASES[t].map((ph, i) => (
                        <li key={i}>
                          <label className="flex items-start gap-2 text-[11px] text-slate-400">
                            <input type="checkbox" checked={!mixOff.has(`${t}:${i}`)} onChange={() => { toggleSet(setMixOff, `${t}:${i}`); setPlan([]); }} className="mt-0.5 accent-[#FFCB05]" />
                            <span>{String(i + 1).padStart(2, "0")}. {ph}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
                <details className="rounded-lg border border-border/60 bg-slate-950/40 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-300">
                    Mensagens de retorno ({mixReturns.size === 0 ? "padrão para todos" : `${mixReturns.size} no sorteio`})
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {OCCURRENCE_RETURN_PHRASES.map((ph, i) => (
                      <li key={i}>
                        <label className="flex items-start gap-2 text-[11px] text-slate-400">
                          <input type="checkbox" checked={mixReturns.has(i)} onChange={() => { toggleSet(setMixReturns, i); setPlan([]); }} className="mt-0.5 accent-[#FFCB05]" />
                          <span>{String(i + 1).padStart(2, "0")}. {ph}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </details>
                <div className="flex flex-wrap items-end gap-3 text-xs text-slate-300">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={scheduled} onChange={(e) => { setScheduled(e.target.checked); setPlan([]); }} className="accent-[#FFCB05]" /> Data-base de início (BRT)</label>
                  {scheduled && <input type="datetime-local" value={startsLocal} onChange={(e) => { setStartsLocal(e.target.value); setPlan([]); }} className={input} />}
                  <label className="text-[11px] text-slate-400">Espalhar inícios em até
                    <span className="mt-1 flex gap-1">
                      <input value={spreadValue} onChange={(e) => { setSpreadValue(e.target.value); setPlan([]); }} className={`${input} w-20`} />
                      <select value={spreadUnit} onChange={(e) => { setSpreadUnit(e.target.value as "m" | "h" | "d"); setPlan([]); }} className={input}><option value="m">minutos</option><option value="h">horas</option><option value="d">dias</option></select>
                    </span>
                  </label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={indefinite} onChange={(e) => { setIndefinite(e.target.checked); setPlan([]); }} className="accent-[#FFCB05]" /> Duração indefinida</label>
                  {!indefinite && (
                    <label className="text-[11px] text-slate-400">Duração sorteada entre
                      <span className="mt-1 flex items-center gap-1">
                        <input value={durValue} onChange={(e) => { setDurValue(e.target.value); setPlan([]); }} className={`${input} w-16`} /> e
                        <input value={durMaxValue} onChange={(e) => { setDurMaxValue(e.target.value); setPlan([]); }} className={`${input} w-16`} />
                        <select value={durUnit} onChange={(e) => { setDurUnit(e.target.value as "h" | "d"); setPlan([]); }} className={input}><option value="h">horas</option><option value="d">dias</option></select>
                      </span>
                    </label>
                  )}
                  <label className="flex items-center gap-2"><input type="checkbox" checked={showDeadline} onChange={(e) => setShowDeadline(e.target.checked)} className="accent-[#FFCB05]" /> Mostrar prazo ao jogador</label>
                </div>
                <button onClick={generatePlan} className={btnGold}>🎲 {plan.length ? "Sortear de novo" : "Sortear combinação"}</button>
              </div>
            )}
            {!mix && (<>
            <div className="flex flex-wrap gap-2">
              {OCCURRENCE_TAGS.map((t) => (
                <button key={t} onClick={() => onTagChange(t)} className={`${btn} ${tag === t ? "border-violet-400/60 bg-violet-500/15 text-violet-200" : "border-border text-slate-400"}`}>{OCCURRENCE_TAG_LABEL[t]}</button>
              ))}
            </div>
            <label className="block text-[11px] text-slate-400">Frase pronta
              <select onChange={(e) => e.target.value !== "" && setMessage(OCCURRENCE_PHRASES[tag][Number(e.target.value)])} defaultValue="" className={`${input} mt-1 block w-full`}>
                <option value="">— escolher —</option>
                {OCCURRENCE_PHRASES[tag].map((p, i) => <option key={i} value={i}>{String(i + 1).padStart(2, "0")}. {p.slice(0, 110)}{p.length > 110 ? "…" : ""}</option>)}
              </select>
            </label>
            <label className="block text-[11px] text-slate-400">Texto ao jogador (use {"{mascote}"} para o nome)
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className={`${input} mt-1 block w-full`} />
            </label>
            <label className="block text-[11px] text-slate-400">Mensagem de retorno (opcional)
              <select onChange={(e) => e.target.value !== "" && setReturnMessage(OCCURRENCE_RETURN_PHRASES[Number(e.target.value)])} defaultValue="" className={`${input} mt-1 block w-full`}>
                <option value="">— padrão: {OCCURRENCE_RETURN_DEFAULT.slice(0, 60)}… —</option>
                {OCCURRENCE_RETURN_PHRASES.map((p, i) => <option key={i} value={i}>{String(i + 1).padStart(2, "0")}. {p.slice(0, 110)}{p.length > 110 ? "…" : ""}</option>)}
              </select>
              <textarea value={returnMessage} onChange={(e) => setReturnMessage(e.target.value)} rows={2} placeholder="Ou escreva uma mensagem personalizada" className={`${input} mt-1 block w-full`} />
            </label>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
              <label className="flex items-center gap-2"><input type="checkbox" checked={indefinite} onChange={(e) => setIndefinite(e.target.checked)} className="accent-[#FFCB05]" /> Duração indefinida</label>
              {!indefinite && (
                <span className="flex items-center gap-1">
                  <input value={durValue} onChange={(e) => setDurValue(e.target.value)} className={`${input} w-20`} />
                  <select value={durUnit} onChange={(e) => setDurUnit(e.target.value as "h" | "d")} className={input}><option value="h">horas</option><option value="d">dias</option></select>
                </span>
              )}
              <label className="flex items-center gap-2"><input type="checkbox" checked={scheduled} onChange={(e) => setScheduled(e.target.checked)} className="accent-[#FFCB05]" /> Agendar início (BRT)</label>
              {scheduled && <input type="datetime-local" value={startsLocal} onChange={(e) => setStartsLocal(e.target.value)} className={input} />}
              <label className="flex items-center gap-2"><input type="checkbox" checked={showDeadline} onChange={(e) => setShowDeadline(e.target.checked)} className="accent-[#FFCB05]" /> Mostrar prazo ao jogador</label>
            </div>
            </>)}
          </div>

          <div className={card}>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Revisão final — {frozen.length} mascote(s)</p>
            {mix ? (
              plan.length === 0 ? (
                <p className="mt-2 text-xs text-amber-300">Clique em “Sortear combinação” para ver exatamente o que cada mascote vai receber.</p>
              ) : (
                <div className="mt-2 max-h-96 overflow-auto rounded-xl border border-border">
                  <table className="w-full min-w-[720px] text-xs">
                    <thead><tr className="border-b border-border bg-slate-950/60 text-slate-400">
                      <th className="p-2 text-left">Mascote</th><th className="p-2 text-left">Tag</th><th className="p-2 text-left">Início</th><th className="p-2 text-left">Término</th><th className="p-2 text-left">Mensagem</th>
                    </tr></thead>
                    <tbody>
                      {frozen.map((m) => {
                        const p = plan.find((x) => x.mascotId === m.id);
                        if (!p) return null;
                        return (
                          <tr key={m.id} className="border-b border-border/50 align-top last:border-0">
                            <td className="p-2 text-slate-200">{m.name}<span className="block text-[10px] text-slate-500">{m.playerName}</span></td>
                            <td className="p-2 text-violet-200">{OCCURRENCE_TAG_LABEL[p.tag]}</td>
                            <td className="p-2 text-slate-400">{p.startsAt ? fmt(p.startsAt) : "imediato"}</td>
                            <td className="p-2 text-slate-400">{p.endsAt ? fmt(p.endsAt) : "indefinido"}</td>
                            <td className="p-2 text-[11px] italic text-slate-400">“{renderOccurrenceText(p.message, m.name)}”</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              <>
                <p className="mt-1 text-[11px] text-slate-500">
                  Tag: <b className="text-violet-200">{OCCURRENCE_TAG_LABEL[tag]}</b> · Início: {scheduled && startsLocal ? fmt(startsAtIso) : "imediato"} · Término: {indefinite ? "indefinido" : fmt(endsAtIso)} · Prazo {showDeadline ? "visível" : "oculto"}
                </p>
                <FrozenList list={frozen} />
                {frozen[0] && <p className="mt-3 rounded-lg border border-violet-400/20 bg-violet-500/5 p-3 text-xs italic text-slate-300">“{renderOccurrenceText(message, frozen[0].name)}”</p>}
              </>
            )}
          </div>

          {results && (
            <div className={card}>
              <p className="text-xs font-bold text-slate-300">Resultado por mascote</p>
              <ul className="mt-2 space-y-1 text-xs">
                {results.map((r) => (
                  <li key={r.mascotId} className={r.ok ? "text-emerald-300" : "text-rose-300"}>
                    {r.ok ? "✔" : "✖"} {nameOf(r.mascotId)?.playerName} · {nameOf(r.mascotId)?.name}{r.error ? ` — ${r.error}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} disabled={pending} className={btnGhost}>← Voltar</button>
            <button onClick={confirm} disabled={pending || Boolean(results)} className={btnGold}>{pending ? "Aplicando…" : "Confirmar e disparar"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function FrozenList({ list }: { list: OccurrenceMascotRow[] }) {
  return (
    <div className="mt-2 grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
      {list.map((m) => (
        <div key={m.id} className="flex items-center gap-2 rounded-xl border border-border bg-slate-950/50 p-2">
          <Thumb pokemonId={m.pokemonId} isShiny={m.isShiny} />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-slate-100">{m.name}</p>
            <p className="truncate text-[10px] text-slate-500">{m.playerName} · Nv.{m.level}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Ativas / histórico ───────────────────────────────────────────────────────

function OccurrenceList({ scope }: { scope: "active" | "history" }) {
  const [rows, setRows] = useState<OccurrenceListRow[]>([]);
  const [q, setQ] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      const res = await listOccurrencesAction({ scope, q });
      if (res.error) return void toast.error(res.error);
      setRows(res.rows ?? []);
      setSel(new Set());
    });
  }, [scope, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const visible = rows.filter((r) => (!tagFilter || r.tag === tagFilter) && (!statusFilter || r.status === statusFilter));
  const selectedRows = visible.filter((r) => sel.has(r.id));

  const doReturn = () =>
    startTransition(async () => {
      const res = await returnOccurrencesAction([...sel]);
      if ("error" in res && res.error) return void toast.error(res.error);
      const results = "results" in res ? res.results ?? [] : [];
      const ok = results.filter((r) => r.ok).length;
      toast[ok === results.length ? "success" : "warning"](`${ok}/${results.length} mascote(s) retornado(s).${ok < results.length ? " Algumas já estavam encerradas." : ""}`);
      setConfirming(false);
      load();
    });

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar jogador ou mascote" className={`${input} min-w-52`} />
        <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className={input}>
          <option value="">Todas as tags</option>
          {OCCURRENCE_TAGS.map((t) => <option key={t} value={t}>{OCCURRENCE_TAG_LABEL[t]}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={input}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).filter(([k]) => (scope === "active" ? ["SCHEDULED", "ACTIVE"] : ["RETURNED", "EXPIRED", "CANCELLED"]).includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={load} disabled={pending} className={btnGhost}>Atualizar</button>
        {scope === "active" && (
          <>
            <button onClick={() => setSel(new Set(visible.map((r) => r.id)))} className={btnGhost}>Selecionar visíveis</button>
            <button onClick={() => setConfirming(true)} disabled={sel.size === 0 || pending} className={btnGold}>↩ Retornar mascote(s) ({sel.size})</button>
          </>
        )}
      </div>

      {confirming && (
        <div className="mt-3 rounded-xl border border-sky-400/30 bg-sky-500/5 p-3">
          <p className="text-xs font-bold text-sky-200">Prévia da mensagem de retorno — {selectedRows.length} mascote(s)</p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-slate-300">
            {selectedRows.slice(0, 20).map((r) => (
              <li key={r.id}><b>{r.mascotName}</b> ({r.playerName}): “{r.returnMessage?.trim() ? r.returnMessage : renderOccurrenceText(OCCURRENCE_RETURN_DEFAULT, r.mascotName)}”</li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <button onClick={doReturn} disabled={pending} className={btnGold}>Confirmar retorno</button>
            <button onClick={() => setConfirming(false)} className={btnGhost}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="mt-3 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[820px] text-xs">
          <thead><tr className="border-b border-border bg-slate-950/60 text-slate-400">
            {scope === "active" && <th className="w-8 p-2" />}
            <th className="p-2 text-left">Mascote</th><th className="p-2 text-left">Jogador</th><th className="p-2 text-left">Tag</th>
            <th className="p-2 text-left">Início</th><th className="p-2 text-left">{scope === "active" ? "Término previsto" : "Encerrada em"}</th>
            <th className="p-2 text-left">Leitura</th><th className="p-2 text-left">Status</th><th className="p-2 text-left">Admin</th>
          </tr></thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className="border-b border-border/50 align-top last:border-0">
                {scope === "active" && (
                  <td className="p-2"><input type="checkbox" checked={sel.has(r.id)} onChange={() => setSel((prev) => { const n = new Set(prev); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} className="accent-[#FFCB05]" /></td>
                )}
                <td className="p-2"><div className="flex items-center gap-2"><Thumb pokemonId={r.pokemonId} isShiny={r.isShiny} size={36} /><span className="text-slate-100">{r.mascotName}<span className="block text-[10px] text-slate-500">Nv.{r.level}</span></span></div></td>
                <td className="p-2 text-slate-300">{r.playerName}</td>
                <td className="p-2 text-violet-200">{OCCURRENCE_TAG_LABEL[r.tag as OccurrenceTag]}</td>
                <td className="p-2 text-slate-400">{fmt(r.startsAt)}</td>
                <td className="p-2 text-slate-400">{scope === "active" ? (r.endsAt ? fmt(r.endsAt) : "indefinido") : fmt(r.endedAt)}</td>
                <td className="p-2 text-slate-400">{r.noticeRead ? "✔ aviso lido" : "aviso pendente"}{scope === "history" && <span className="block">{r.returnNoticeRead ? "✔ retorno lido" : "retorno pendente"}</span>}</td>
                <td className="p-2 text-slate-300">{STATUS_LABEL[r.status]}</td>
                <td className="p-2 text-slate-500">{r.adminName}</td>
              </tr>
            ))}
            {visible.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-slate-500">{pending ? "Carregando…" : "Nada por aqui."}</td></tr>}
          </tbody>
        </table>
      </div>
      {scope === "history" && visible.length > 0 && (
        <details className="mt-3 text-xs text-slate-400">
          <summary className="cursor-pointer">Textos enviados</summary>
          <ul className="mt-2 space-y-2">
            {visible.map((r) => (
              <li key={r.id}><b className="text-slate-200">{r.mascotName}</b> ({r.playerName})<br />Ocorrência: “{r.message}”<br />Retorno: “{r.returnMessage?.trim() ? r.returnMessage : renderOccurrenceText(OCCURRENCE_RETURN_DEFAULT, r.mascotName)}”</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
