import { getArtillerySplashPct, getBloodthirstyLifeSteal, getCorrosiveWoundPct, getExecutorThreshold, getFortressStatPct, getStrategistAgilityPct, type CombatRole } from "./combat-roles";

export type TrainingStanceHitInput = {
  role: CombatRole; force: number; agility: number; vitality: number; instinct: number;
  currentHp: number; maxHp: number; damage: number; directAttackIndex: number; round: number; healingThisRound?: number;
};

/** Shared, deterministic resolution used by combat adapters after final direct damage. */
export function resolveTrainingStanceDirectHit(input: TrainingStanceHitInput) {
  let damage = input.damage;
  let heal = 0;
  let execute = false;
  let selfKo = false;
  let splashPct = 0;
  let woundPct = 0;
  let shield = 0;
  let fortressPct = 0;
  if (input.role === "EXECUTOR" && input.currentHp / Math.max(1, input.maxHp) <= getExecutorThreshold(input.force, input.agility)) { damage = input.currentHp; execute = true; }
  if (input.role === "BLOODTHIRSTY") heal = Math.min(Math.max(0, input.maxHp * 0.08 - (input.healingThisRound ?? 0)), damage * getBloodthirstyLifeSteal(input.force, input.vitality));
  if (input.role === "ARTILLERY" && input.directAttackIndex === 1) splashPct = getArtillerySplashPct(input.force, input.agility);
  if (input.role === "CORROSIVE") woundPct = getCorrosiveWoundPct(input.force, input.instinct);
  if (input.role === "UNSHAKABLE") shield = input.maxHp * 0.05;
  if (input.role === "FORTRESS") fortressPct = getFortressStatPct(input.vitality, input.instinct);
  if (input.role === "EXPLOSIVE" && input.directAttackIndex === 3) { damage += input.currentHp * 0.5; selfKo = true; }
  return { damage: Math.round(damage), heal: Math.floor(heal), execute, selfKo, splashPct, woundPct, shield: Math.round(shield), fortressPct, strategistAgilityPct: getStrategistAgilityPct(input.instinct, input.agility) };
}
