"use client";

import { useState } from "react";
import { runLeagueCombat, toLeagueMascot } from "@/lib/league-combat";
import { LeagueBattleReplayModal } from "@/app/(app)/combates/liga-semanal/_components/league-battle-replay";

// Painel de admin: gera uma luta "fake" 6x6 com personalidades e posturas variadas
// para visualizar TODOS os efeitos (personalidade, resistência, proteção, etc.) no
// replay, com os chips coloridos. Não toca no banco — é só uma simulação local.

type Spec = { pk: number; pers: string; role: string };

const TEAM_A: Spec[] = [
  { pk: 6,   pers: "PROUD",       role: "ATTACKER" },   // +6% acima de 70% HP
  { pk: 94,  pers: "MISCHIEVOUS", role: "FLANK" },      // debuff no 1º ataque
  { pk: 149, pers: "DRAMATIC",    role: "ATTACKER" },   // sobrevive a golpe fatal
  { pk: 143, pers: "TIMID",       role: "DEFENDER" },   // -10% antes do 1º golpe
  { pk: 25,  pers: "ELECTRIC",    role: "SCOUT" },      // agilidade cedo
  { pk: 39,  pers: "PLAYFUL",     role: "ENCOURAGER" }, // buff de agilidade ao time
];
const TEAM_B: Spec[] = [
  { pk: 143, pers: "GLUTTON",     role: "GUARDIAN" },   // resiste a controle + protege
  { pk: 130, pers: "CHAOTIC",     role: "ATTACKER" },   // volatilidade
  { pk: 68,  pers: "COMPETITIVE", role: "DUELIST" },    // +7% vs mais forte
  { pk: 65,  pers: "CURIOUS",     role: "OPPORTUNIST" },// debuff com resistência
  { pk: 36,  pers: "SERENE",      role: "HEALER" },     // cura + resiste
  { pk: 112, pers: "LAZY",        role: "SURVIVOR" },   // -8% quando descansado
];

function buildTeam(specs: Spec[], ownerId: string) {
  return specs.map((s, i) => toLeagueMascot({
    id: `${ownerId}${i + 1}`, playerId: ownerId, pokemonId: s.pk, nickname: null, level: 60,
    statForce: 60 + (i * 7) % 40, statAgility: 55 + (i * 11) % 40, statInstinct: 50 + (i * 5) % 45,
    statVitality: 45 + (i * 9) % 40, statCharisma: 50 + (i * 3) % 40, personality: s.pers,
  }, i + 1, s.role));
}

export function CombatTestPanel() {
  const [battle, setBattle] = useState<ReturnType<typeof runLeagueCombat> | null>(null);

  const run = () => {
    const a = buildTeam(TEAM_A, "A");
    const b = buildTeam(TEAM_B, "B");
    setBattle(runLeagueCombat(a, b));
  };

  return (
    <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/10 p-4">
      <p className="text-sm font-black text-cyan-200">🧪 Teste de combate (efeitos de personalidade)</p>
      <p className="mt-1 text-[11px] text-slate-400">Gera uma luta 6×6 fictícia com todas as personalidades e posturas variadas. Abra o replay para ver os efeitos e os chips coloridos acontecendo. Não altera nada no banco.</p>
      <button onClick={run} className="mt-3 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-black text-slate-950 hover:bg-cyan-400">
        ▶ Rodar combate de teste
      </button>

      {battle && (
        <LeagueBattleReplayModal
          playerAName="Time A (teste)"
          playerBName="Time B (teste)"
          playerAId="A"
          winnerId={battle.winner === "A" ? "A" : battle.winner === "B" ? "B" : null}
          isDraw={battle.winner === "DRAW"}
          replay={battle.log}
          playerASurvivors={battle.teamASurvivors}
          playerBSurvivors={battle.teamBSurvivors}
          lineupA={battle.lineupA}
          lineupB={battle.lineupB}
          onFinish={() => setBattle(null)}
        />
      )}
    </div>
  );
}
