// Luta do Rei do Rio no motor Arena (runArenaCombat): o único que executa as habilidades passivas.
// Módulo separado porque arena-z.ts importa código de servidor; o núcleo puro/testes usam o motor da liga.
import { runArenaCombat, type ArenaCombatRuntime, type ArenaMascot } from "@/lib/arena-z";
import type { LeagueMascot } from "@/lib/league-combat";
import { hashStr } from "@/lib/league-pairing";
import type { FightFn } from "./engine";

const toArena = (m: LeagueMascot): ArenaMascot => ({
  id: m.id, ownerId: m.ownerId, pokemonId: m.pokemonId, types: m.types, name: m.name, level: m.level,
  force: m.force, agility: m.agility, instinct: m.instinct, vitality: m.vitality, charisma: m.charisma,
  happiness: 50, hp: m.hp, combatRole: m.combatRole, personality: m.personality ?? null,
});

/** Mesma assinatura do motor da liga; HP inicial via runtime.hp, semente nativa e limite de rodadas. */
export const arenaFight: FightFn = (a, b, startHp, seed, extras) => {
  const abilities = extras?.abilities ? { ...extras.abilities.A, ...extras.abilities.B } : undefined;
  const r = runArenaCombat(a.map(toArena), b.map(toArena), {
    seed: hashStr(seed) || 1,
    runtime: { hp: Object.fromEntries(startHp) } as unknown as ArenaCombatRuntime,
    ...(extras?.maxRounds ? { maxRounds: extras.maxRounds } : {}),
    ...(abilities && Object.keys(abilities).length ? { abilities } : {}),
  });
  return {
    log: r.log,
    finalHp: r.runtime.hp,
    rounds: Math.max(1, r.runtime.round - 1),
    winner: r.result === "ATTACKER_WIN" ? "A" : r.result === "DEFENDER_WIN" ? "B" : "DRAW",
  };
};
