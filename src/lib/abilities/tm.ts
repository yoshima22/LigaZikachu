// TM de habilidade oculta: um item por habilidade oculta que tem efeito em combate.
// O item só funciona em mascotes cuja habilidade oculta é a do TM.
import { SPECIES_ABILITIES } from "./data.generated";
import { getAbilityInfo } from "./index";

export const ABILITY_TM_TYPE = "ABILITY_TM" as const;
export const ABILITY_TM_PRICE = 6500;
export const ABILITY_TM_IMAGE = "/items/ability-tm.svg";
/** Desconto máximo no Bazar (igual ao das Pedras de Mega). */
export const ABILITY_TM_MAX_DISCOUNT = 20;

export type AbilityTmDef = { abilityKey: string; name: string; pokemonIds: number[] };

let cached: AbilityTmDef[] | null = null;

/** Habilidades ocultas com efeito, com as espécies que precisam do TM (hidden fora da lista de comuns). */
export function getAbilityTmDefs(): AbilityTmDef[] {
  if (cached) return cached;
  const byAbility = new Map<string, number[]>();
  for (const [id, [normal, hidden]] of Object.entries(SPECIES_ABILITIES)) {
    if (!hidden || normal.includes(hidden)) continue;
    const info = getAbilityInfo(hidden);
    if (!info?.hasEffect) continue;
    (byAbility.get(hidden) ?? byAbility.set(hidden, []).get(hidden)!).push(Number(id));
  }
  cached = [...byAbility.entries()]
    .map(([abilityKey, pokemonIds]) => ({ abilityKey, name: getAbilityInfo(abilityKey)!.name, pokemonIds: pokemonIds.sort((a, b) => a - b) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return cached;
}

export function getAbilityTmDef(abilityKey: string) {
  return getAbilityTmDefs().find((tm) => tm.abilityKey === abilityKey) ?? null;
}

export function abilityTmItemName(abilityKey: string) {
  return `TM ${getAbilityInfo(abilityKey)?.name ?? abilityKey}`;
}

export function abilityTmMetadata(abilityKey: string) {
  return { kind: "ABILITY_TM", abilityKey } as const;
}

export function readAbilityTmKey(metadata: unknown): string | null {
  const m = metadata as { kind?: string; abilityKey?: string } | null | undefined;
  return m?.kind === "ABILITY_TM" && typeof m.abilityKey === "string" ? m.abilityKey : null;
}

/** O mascote pode aprender a oculta deste TM? (espécie compatível e ainda não desbloqueada) */
export function canLearnAbilityTm(args: { pokemonId: number; abilityKey: string; hiddenUnlocked: boolean }) {
  const tm = getAbilityTmDef(args.abilityKey);
  return Boolean(tm && tm.pokemonIds.includes(args.pokemonId) && !args.hiddenUnlocked);
}
