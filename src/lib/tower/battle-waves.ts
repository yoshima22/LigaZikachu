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

function finalHpById(
  lineup: readonly LeagueMascot[],
  log: LeagueBattleResult["log"],
): Record<string, number> {
  const hp = new Map(lineup.map((mascot) => [mascot.id, mascot.hp]));
  const maximum = new Map(lineup.map((mascot) => [mascot.id, mascot.hp]));
  for (const entry of log) {
    const current = hp.get(entry.targetId);
    if (current === undefined) continue;
    if (entry.action === "ATTACK")
      hp.set(entry.targetId, Math.max(0, current - Math.max(0, entry.damage)));
    else if (entry.action === "HEAL" && current > 0)
      hp.set(entry.targetId, Math.min(maximum.get(entry.targetId)!, current + Math.max(0, entry.damage)));
  }
  return Object.fromEntries(hp);
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
      input.reserves.length ? { reserveTeamA: input.reserves } : {});
  } finally {
    if (input.random) Math.random = previousRandom;
  }
  return {
    battle,
    hpByMascotId: finalHpById([...input.active, ...input.reserves], battle.log),
    enemyHpById: finalHpById(input.enemies, battle.log),
  };
}
