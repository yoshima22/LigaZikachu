import { runLeagueCombat, type LeagueBattleResult, type LeagueMascot } from "@/lib/league-combat";

type TowerBattleInput = {
  active: LeagueMascot[];
  reserves: LeagueMascot[];
  enemies: LeagueMascot[];
  /** Apenas para simulação offline e testes. Não usar em requisições concorrentes. */
  random?: () => number;
};

/** Recebe apenas os mascotes dos treinadores presentes na sala. */
export function selectTowerBattleWaves(
  profile: "SOLO" | "GROUP" | null,
  balanceVersion: number | null,
  entries: readonly { fighter: LeagueMascot; formationSlot: number | null }[],
): { active: LeagueMascot[]; reserves: LeagueMascot[] } {
  if (profile === "SOLO" && balanceVersion === 2) {
    const ordered = [...entries].sort((a, b) => (a.formationSlot ?? 0) - (b.formationSlot ?? 0));
    return {
      active: ordered.filter((entry) => entry.formationSlot === 1 || entry.formationSlot === 2).map((entry) => entry.fighter),
      reserves: ordered.filter((entry) => entry.formationSlot === 3 || entry.formationSlot === 4).map((entry) => entry.fighter),
    };
  }
  return { active: entries.filter((entry) => entry.fighter.hp > 0).map((entry) => entry.fighter), reserves: [] };
}

/** Reserves do Solo não alteram a média antes de realmente entrar no encontro. */
export function towerEncounterLevel(active: readonly LeagueMascot[]): number {
  const living = active.filter((mascot) => mascot.hp > 0);
  if (!living.length) throw new Error("Nenhum mascote ativo apto para dimensionar o encontro.");
  return Math.max(1, Math.round(living.reduce((sum, mascot) => sum + mascot.level, 0) / living.length));
}

export function resolveTowerBattle(input: TowerBattleInput): {
  battle: LeagueBattleResult;
  hpByMascotId: Record<string, number>;
  enemyHpById: Record<string, number>;
} {
  const all = [...input.active, ...input.reserves, ...input.enemies];
  if (new Set(all.map((mascot) => mascot.id)).size !== all.length)
    throw new Error("Mascote repetido no encontro da Torre.");
  const previousRandom = Math.random;
  if (input.random) Math.random = input.random;
  let battle: LeagueBattleResult;
  try {
    battle = runLeagueCombat(input.active, input.enemies, null, [], [],
      { includeFinalHp: true, ...(input.reserves.length ? { reserveTeamA: input.reserves } : {}) });
  } finally {
    if (input.random) Math.random = previousRandom;
  }
  const finalHp = battle.finalHpById;
  if (!finalHp) throw new Error("Resultado de HP do combate indisponível.");
  return {
    battle,
    hpByMascotId: Object.fromEntries([...input.active, ...input.reserves].map((mascot) =>
      [mascot.id, finalHp[mascot.id] ?? mascot.hp])),
    enemyHpById: Object.fromEntries(input.enemies.map((mascot) =>
      [mascot.id, finalHp[mascot.id] ?? mascot.hp])),
  };
}
