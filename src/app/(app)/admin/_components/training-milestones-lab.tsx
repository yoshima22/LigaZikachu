"use client";

import { useMemo, useState } from "react";
import { buildTrainingLabView } from "@/lib/training-milestones-lab-view";
import {
  evaluateTrainingEvent,
  TRAINING_STANCE_KEYS,
  TRAINING_STANCES,
  validateArenaTrainingCredit,
  type TrainingPersonality,
  type TrainingStanceKey,
} from "@/lib/training-milestones";

const personalities: Array<[TrainingPersonality, string]> = [
  ["LOYAL", "Leal"], ["PROUD", "Orgulhoso"], ["MISCHIEVOUS", "Travesso"], ["LAZY", "Preguiçoso"], ["COMPETITIVE", "Competitivo"], ["DRAMATIC", "Dramático"], ["PLAYFUL", "Brincalhão"], ["ELECTRIC", "Elétrico"], ["TIMID", "Tímido"], ["CHAOTIC", "Caótico"], ["CURIOUS", "Curioso"], ["GLUTTON", "Guloso"], ["SERENE", "Sereno"],
];

export function TrainingMilestonesLab() {
  const [stance, setStance] = useState<TrainingStanceKey>("EXECUTOR");
  const [personality, setPersonality] = useState<TrainingPersonality>("COMPETITIVE");
  const [seed, setSeed] = useState(7);
  const [focusA, setFocusA] = useState(125);
  const [focusB, setFocusB] = useState(125);
  const [eventResult, setEventResult] = useState<string | null>(null);
  const [arenaResult, setArenaResult] = useState<string | null>(null);
  const view = useMemo(() => buildTrainingLabView({ stance, personality, seed, focusA, focusB }), [stance, personality, seed, focusA, focusB]);

  function simulateProgress() {
    const objective = view.objectives.find((item) => item.type !== "ARENA_Z" && item.type !== "LEAGUE" && item.type !== "EXPEDITIONS") ?? view.objectives[0];
    const result = evaluateTrainingEvent({ ...view, objectives: [objective] }, { battleId: "admin-local", kos: 4, lowHpDirectAttacks: 3, survivedToNextRound: true, directAttacks: 5, damageUnits: 12, buffs: 4, heals: 4, protects: 3, debuffs: 4, superEffective: 5, ultraEffective: 3, resistedHits: 5, heavilyResistedHits: 3, focusChains: 2, survivedSequences: 2, thirdAttacks: 2, turnThree: 1, turnFive: 1 });
    setEventResult(`${objective.label} ${result.reason}`);
  }

  function simulateArena(valid: boolean) {
    const result = validateArenaTrainingCredit({
      sourceMode: valid ? "ARENA_Z_PVP" : "ARENA_DRAFT",
      ownerId: "admin-a", opponentOwnerId: valid ? "admin-b" : "admin-a",
      ownMascots: 2, opponentMascots: 2, resolvedActions: valid ? 6 : 4,
      selectedTrainingMascot: valid, pairLastCreditAt: valid ? null : new Date(), now: new Date(), ownerCreditsToday: 0,
    });
    setArenaResult(result.eligible ? "Arena-Z aprovada: o crédito de teste contaria para o foco selecionado." : `Arena-Z recusada: ${result.reasons.join(" ")}`);
  }

  return (
    <section className="rounded-2xl border border-amber-400/35 bg-amber-950/15 p-4 space-y-4">
      <div className="flex flex-wrap items-start gap-4">
        <img src="/items/marco-de-postura.png" alt="Marco de Postura" className="h-20 w-20 rounded-xl object-cover" />
        <div>
          <h2 className="text-sm font-black text-amber-200">🏳️ Laboratório — Marcos de Postura</h2>
          <p className="mt-1 max-w-3xl text-xs text-amber-50/70">{view.persistenceNotice}</p>
          <p className="mt-2 text-xs font-bold text-amber-100">Item simulado: {view.itemName}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-xs text-slate-300">Postura<select value={stance} onChange={(event) => setStance(event.target.value as TrainingStanceKey)} className="mt-1 block w-full rounded bg-slate-950 p-2 text-slate-100">{TRAINING_STANCE_KEYS.map((key) => <option key={key} value={key}>{TRAINING_STANCES[key].label}</option>)}</select></label>
        <label className="text-xs text-slate-300">Personalidade<select value={personality} onChange={(event) => setPersonality(event.target.value as TrainingPersonality)} className="mt-1 block w-full rounded bg-slate-950 p-2 text-slate-100">{personalities.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="text-xs text-slate-300">Seed da trilha<input type="number" value={seed} onChange={(event) => setSeed(Number(event.target.value) || 0)} className="mt-1 block w-full rounded bg-slate-950 p-2 text-slate-100" /></label>
        <label className="text-xs text-slate-300">{TRAINING_STANCES[stance].focus[0]}<input type="number" min="0" max="250" value={focusA} onChange={(event) => setFocusA(Number(event.target.value) || 0)} className="mt-1 block w-full rounded bg-slate-950 p-2 text-slate-100" /></label>
        <label className="text-xs text-slate-300">{TRAINING_STANCES[stance].focus[1]}<input type="number" min="0" max="250" value={focusB} onChange={(event) => setFocusB(Number(event.target.value) || 0)} className="mt-1 block w-full rounded bg-slate-950 p-2 text-slate-100" /></label>
        <div className="rounded bg-slate-950/70 p-2 text-xs text-cyan-200"><b>{view.focusLabel}</b><br />{view.effectPreview}</div>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3"><p className="text-xs font-bold text-slate-100">Efeito previsto</p><p className="mt-1 text-xs text-slate-400">{TRAINING_STANCES[stance].effect}</p></div>
      <ol className="space-y-2">{view.objectives.map((objective, index) => <li key={objective.id} className="rounded border border-slate-800 bg-slate-950/50 p-2 text-xs text-slate-300"><b className="text-amber-200">{index + 1}. {objective.target}</b> · {objective.label} <span className="text-slate-500">(máx. {objective.perBattleCap}/combate)</span></li>)}</ol>

      <div className="flex flex-wrap gap-2"><button onClick={simulateProgress} className="rounded bg-cyan-400 px-3 py-2 text-xs font-bold text-slate-950">Testar evento de combate</button><button onClick={() => simulateArena(true)} className="rounded border border-emerald-400/50 px-3 py-2 text-xs font-bold text-emerald-200">Testar Arena válida</button><button onClick={() => simulateArena(false)} className="rounded border border-red-400/50 px-3 py-2 text-xs font-bold text-red-200">Testar bloqueio Arena</button></div>
      {eventResult && <p className="rounded bg-cyan-950/40 p-2 text-xs text-cyan-100">Debug de evento: {eventResult}</p>}
      {arenaResult && <p className="rounded bg-slate-950/70 p-2 text-xs text-slate-200">Debug Arena-Z: {arenaResult}</p>}
    </section>
  );
}
