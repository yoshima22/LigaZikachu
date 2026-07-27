"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { LivePvpMove } from "@/lib/live-pvp-moves";
import type { LivePvpFighter } from "@/lib/live-pvp-engine";
import { loadLivePvpMovesAction, resolveLivePvpTurnAction } from "./actions";

type MascotOption = {
  id: string; pokemonId: number; name: string; ownerName: string; level: number; types: string[];
  statForce: number; statAgility: number; statCharisma: number; statInstinct: number; statVitality: number;
};

function toFighter(mascot: MascotOption): LivePvpFighter {
  const maxHp = Math.max(10, Math.round(55 + mascot.level * 6 + mascot.statVitality * 4));
  return { id: mascot.id, name: mascot.name, level: mascot.level, types: mascot.types, hp: maxHp, maxHp,
    force: mascot.statForce, agility: mascot.statAgility, charisma: mascot.statCharisma,
    instinct: mascot.statInstinct, vitality: mascot.statVitality };
}

function MoveBuilder({ moves, selected, onChange, label }: { moves: LivePvpMove[]; selected: number[]; onChange: (ids: number[]) => void; label: string }) {
  return <div className="rounded-xl border border-border bg-slate-950/60 p-3">
    <p className="mb-2 text-xs font-bold text-slate-200">{label}: escolha 4 golpes ({selected.length}/4)</p>
    <div className="max-h-64 space-y-1 overflow-y-auto pr-1">{moves.map(move => {
      const active = selected.includes(move.id);
      return <button key={move.id} type="button" onClick={() => onChange(active ? selected.filter(id => id !== move.id) : selected.length < 4 ? [...selected, move.id] : selected)}
        className={`flex w-full items-center justify-between rounded-lg border px-2 py-1.5 text-left text-[11px] ${active ? "border-[#FFCB05]/60 bg-[#FFCB05]/10" : "border-border/60 bg-slate-900"}`}>
        <span><strong className="text-slate-100">{move.name}</strong><span className="ml-2 text-slate-500">{move.type} · {move.damageClass}</span></span>
        <span className="text-slate-400">P{move.power ?? "—"} · {move.accuracy ?? "—"}%</span>
      </button>;
    })}</div>
  </div>;
}

export function ArenaOnlineLab({ mascots }: { mascots: MascotOption[] }) {
  const [pending, startTransition] = useTransition();
  const [idA, setIdA] = useState(mascots[0]?.id ?? "");
  const [idB, setIdB] = useState(mascots[1]?.id ?? mascots[0]?.id ?? "");
  const [movesA, setMovesA] = useState<LivePvpMove[]>([]); const [movesB, setMovesB] = useState<LivePvpMove[]>([]);
  const [setA, setSetA] = useState<number[]>([]); const [setB, setSetB] = useState<number[]>([]);
  const [fighterA, setFighterA] = useState<LivePvpFighter | null>(null); const [fighterB, setFighterB] = useState<LivePvpFighter | null>(null);
  const [choiceA, setChoiceA] = useState<number | null>(null); const [choiceB, setChoiceB] = useState<number | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const mascotA = useMemo(() => mascots.find(m => m.id === idA), [mascots, idA]);
  const mascotB = useMemo(() => mascots.find(m => m.id === idB), [mascots, idB]);
  const selectedMovesA = movesA.filter(m => setA.includes(m.id)); const selectedMovesB = movesB.filter(m => setB.includes(m.id));

  const load = () => startTransition(async () => {
    if (!mascotA || !mascotB || mascotA.id === mascotB.id) { toast.error("Escolha dois mascotes diferentes."); return; }
    const [a, b] = await Promise.all([loadLivePvpMovesAction(mascotA.pokemonId, mascotA.level), loadLivePvpMovesAction(mascotB.pokemonId, mascotB.level)]);
    if (a.error || b.error || !a.moves || !b.moves) { toast.error(a.error ?? b.error ?? "Falha ao carregar golpes."); return; }
    setMovesA(a.moves); setMovesB(b.moves); setSetA([]); setSetB([]); setFighterA(null); setFighterB(null); setLogs([]);
  });
  const start = () => { if (!mascotA || !mascotB || setA.length !== 4 || setB.length !== 4) return toast.error("Escolha exatamente quatro golpes para cada mascote."); setFighterA(toFighter(mascotA)); setFighterB(toFighter(mascotB)); setLogs(["A batalha de laboratório começou."]); };
  const turn = () => startTransition(async () => {
    if (!fighterA || !fighterB || choiceA == null || choiceB == null) { toast.error("Escolha um golpe para cada lado."); return; }
    const moveA = selectedMovesA.find(m => m.id === choiceA); const moveB = selectedMovesB.find(m => m.id === choiceB); if (!moveA || !moveB) return;
    const result = await resolveLivePvpTurnAction({ fighterA, fighterB, moveA, moveB }); setFighterA(result.fighterA); setFighterB(result.fighterB); setLogs(old => [...old, ...result.events]); setChoiceA(null); setChoiceB(null);
    if (result.winner) toast.success(`${result.winner === "A" ? result.fighterA.name : result.fighterB.name} venceu!`);
  });

  return <div className="space-y-5"><div><p className="text-xs uppercase tracking-widest text-purple-300">Laboratório admin local</p><h1 className="font-pixel text-lg text-[#FFCB05]">Arena Online</h1><p className="mt-2 text-sm text-slate-400">Protótipo isolado: não concede recompensas nem altera os mascotes reais.</p></div>
    <div className="grid gap-3 md:grid-cols-2">{[[idA,setIdA,"Jogador A"],[idB,setIdB,"Jogador B"]].map(([value,setter,label]) => <label key={String(label)} className="text-xs text-slate-400">{String(label)}<select value={String(value)} onChange={e => (setter as (v:string)=>void)(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-slate-950 p-3 text-slate-100">{mascots.map(m => <option key={m.id} value={m.id}>{m.ownerName} — {m.name} Nv.{m.level}</option>)}</select></label>)}</div>
    <button onClick={load} disabled={pending} className="rounded-xl bg-purple-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Carregar golpes legais</button>
    {movesA.length > 0 && <><div className="grid gap-3 lg:grid-cols-2"><MoveBuilder moves={movesA} selected={setA} onChange={setSetA} label={mascotA?.name ?? "A"}/><MoveBuilder moves={movesB} selected={setB} onChange={setSetB} label={mascotB?.name ?? "B"}/></div><button onClick={start} className="w-full rounded-xl bg-[#FFCB05] px-4 py-2 font-bold text-slate-950">Iniciar batalha de teste</button></>}
    {fighterA && fighterB && <div className="grid gap-4 lg:grid-cols-[1fr_1fr_0.9fr]"><FightBox fighter={fighterA} moves={selectedMovesA} choice={choiceA} setChoice={setChoiceA}/><FightBox fighter={fighterB} moves={selectedMovesB} choice={choiceB} setChoice={setChoiceB}/><div className="rounded-xl border border-border bg-slate-950 p-3"><p className="mb-2 text-xs font-bold text-white">Log</p><div className="max-h-72 space-y-1 overflow-y-auto text-[11px] text-slate-400">{logs.map((log,i)=><p key={i}>{log}</p>)}</div><button onClick={turn} disabled={pending || fighterA.hp<=0 || fighterB.hp<=0} className="mt-3 w-full rounded-lg bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-40">Resolver turno</button></div></div>}
  </div>;
}

function FightBox({ fighter, moves, choice, setChoice }: { fighter: LivePvpFighter; moves: LivePvpMove[]; choice: number|null; setChoice:(id:number)=>void }) { const pct=Math.round(fighter.hp/fighter.maxHp*100); return <div className="rounded-xl border border-border bg-slate-950/70 p-4"><div className="flex justify-between"><strong>{fighter.name}</strong><span className="text-xs">{fighter.hp}/{fighter.maxHp} HP</span></div><div className="my-2 h-2 overflow-hidden rounded bg-slate-800"><div className="h-full bg-emerald-400" style={{width:`${pct}%`}}/></div><div className="grid gap-2">{moves.map(m=><button key={m.id} onClick={()=>setChoice(m.id)} className={`rounded-lg border p-2 text-left text-xs ${choice===m.id?"border-cyan-400 bg-cyan-400/10":"border-border"}`}><strong>{m.name}</strong><span className="ml-2 text-slate-500">Poder {m.power??"—"} · PP {m.pp}</span></button>)}</div></div>; }
