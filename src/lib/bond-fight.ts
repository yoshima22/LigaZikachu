// Brigas do Refúgio: combate 1v1 real entre dois mascotes rivais, reusando o
// motor oficial da Liga. Puramente compute — NÃO grava HP/dano/lesão (sem
// punição de repouso). Devolve o log completo para replay futuro + narrativa.
import { toLeagueMascot, runLeagueCombat } from "@/lib/league-combat";

export type FightMascotInput = {
  id: string; playerId: string; pokemonId: number; nickname: string | null; level: number;
  statForce: number; statAgility: number; statInstinct: number; statVitality: number; statCharisma: number;
  speciesNameOverride?: string | null; primaryTypeOverride?: string | null; secondaryTypeOverride?: string | null;
  personality?: string | null; diseasedAt?: Date | string | null; preferredCombatRole?: string | null;
};

export type RefugeFightResult = {
  winner: "A" | "B" | "DRAW";
  winnerId: string | null;
  loserId: string | null;
  rounds: number;
  aName: string;
  bName: string;
  /** Snapshot para o replay gráfico (mesmo formato da Liga). */
  replay: { log: unknown; lineupA: unknown; lineupB: unknown; rounds: number };
};

export function runRefugeFight(a: FightMascotInput, b: FightMascotInput): RefugeFightResult {
  const fa = toLeagueMascot(a, 1, a.preferredCombatRole ?? null);
  const fb = toLeagueMascot(b, 1, b.preferredCombatRole ?? null);
  const result = runLeagueCombat([fa], [fb]);
  const winner = result.winner === "A" ? "A" : result.winner === "B" ? "B" : "DRAW";
  const winnerId = winner === "A" ? a.id : winner === "B" ? b.id : null;
  const loserId = winnerId ? (winnerId === a.id ? b.id : a.id) : null;
  return {
    winner, winnerId, loserId, rounds: result.rounds, aName: fa.name, bName: fb.name,
    replay: { log: result.log, lineupA: result.lineupA, lineupB: result.lineupB, rounds: result.rounds },
  };
}

/** Narrativa curta de vitória/derrota da briga. */
export function fightNarrative(fight: RefugeFightResult, locationLabel: string): string {
  if (fight.winner === "DRAW" || !fight.winnerId) {
    return `A tensão entre ${fight.aName} e ${fight.bName} virou briga no ${locationLabel}. Depois de ${fight.rounds} rodada(s), nenhum dos dois aceitou recuar — ficou tudo em aberto para a próxima.`;
  }
  const winnerName = fight.winner === "A" ? fight.aName : fight.bName;
  const loserName = fight.winner === "A" ? fight.bName : fight.aName;
  return `A rivalidade entre ${fight.aName} e ${fight.bName} explodiu numa briga no ${locationLabel}. Depois de ${fight.rounds} rodada(s), ${winnerName} levou a melhor sobre ${loserName} — e a conta ficou marcada.`;
}
