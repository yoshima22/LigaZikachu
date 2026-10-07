// Habilidades passivas dos mascotes (vindas da Pokédex) adaptadas ao combate.
// Os dados vêm de data.generated.ts (gerado da planilha de balanceamento).
import { ABILITIES, ABILITY_EFFECTS, SPECIES_ABILITIES } from "./data.generated";
import { TYPE_LABELS_PT } from "@/lib/mascot-data";
import { COMBAT_ROLE_STAT_CAP } from "@/lib/combat-roles";
import { getMegaStoneForMegaPokemon } from "@/lib/mega-evolution";

export type AbilityCategory = "Dano" | "Defesa" | "Reflexo" | "Controle" | "Suporte" | "Sobrevivência";
export const ABILITY_CATEGORIES: readonly AbilityCategory[] = ["Dano", "Defesa", "Reflexo", "Controle", "Suporte", "Sobrevivência"];

/** Quantas habilidades da mesma categoria ficam ligadas por time (as seguintes são desligadas). */
export const ABILITY_CATEGORY_LIMIT: Record<AbilityCategory, number> = {
  Dano: 2, Defesa: 2, Reflexo: 2, Controle: 2, Suporte: 2, "Sobrevivência": 1,
};
/** O 2º mascote da categoria usa a habilidade com este fator do efeito. */
export const ABILITY_REDUCED_FACTOR = 0.7;
/** Atributo em que o efeito chega ao máximo (mesmo cap das posturas). */
export const ABILITY_STAT_CAP = COMBAT_ROLE_STAT_CAP;

export type StatKey = "force" | "agility" | "charisma" | "instinct" | "vitality";
export type Stats = Partial<Record<StatKey, number>>;
const STAT_BY_LABEL: Record<string, StatKey> = {
  "Força": "force", "Agilidade": "agility", "Carisma": "charisma", "Instinto": "instinct", "Vitalidade": "vitality",
};
export const STAT_LABEL: Record<StatKey, string> = {
  force: "Força", agility: "Agilidade", charisma: "Carisma", instinct: "Instinto", vitality: "Vitalidade",
};
const TYPE_BY_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(TYPE_LABELS_PT).map(([key, label]) => [label, key]),
);

export type AbilityInfo = {
  slug: string;
  name: string;
  hasEffect: boolean;
  effectCode: string | null;
  effectName: string | null;
  category: AbilityCategory | null;
  trigger: string | null;
  /** Ativações por luta (0 = passivo, sem consumir). */
  activations: number;
  scale: StatKey | null;
  /** Efeito mínimo e máximo como fração (0.2 = 20%); null quando o efeito não é percentual. */
  min: number | null;
  max: number | null;
  param: string | null;
  template: string | null;
};

const cache = new Map<string, AbilityInfo | null>();

export function getAbilityInfo(slug: string | null | undefined): AbilityInfo | null {
  if (!slug) return null;
  if (cache.has(slug)) return cache.get(slug)!;
  const def = ABILITIES[slug];
  let info: AbilityInfo | null = null;
  if (def) {
    const eff = def.effect ? ABILITY_EFFECTS[def.effect] : null;
    const o = def.o ?? {};
    const min = eff ? (o.min ?? eff.min) : null;
    const max = eff ? (o.max ?? eff.max) : null;
    info = {
      slug,
      name: def.name,
      hasEffect: Boolean(eff),
      effectCode: def.effect ?? null,
      effectName: eff?.name ?? null,
      category: (eff?.category as AbilityCategory | undefined) ?? null,
      trigger: eff?.trigger ?? null,
      activations: eff ? (o.activations ?? eff.activations) : 0,
      scale: eff?.scale ? (STAT_BY_LABEL[eff.scale] ?? null) : null,
      min: min == null ? null : min / 100,
      max: max == null ? null : max / 100,
      param: def.param ?? null,
      template: eff?.text ?? null,
    };
  }
  cache.set(slug, info);
  return info;
}

/** Tipos (em inglês, como o motor usa) citados no parâmetro da habilidade. */
export function abilityTypes(info: AbilityInfo): string[] {
  if (!info.param) return [];
  return Object.entries(TYPE_BY_LABEL).filter(([label]) => info.param!.includes(label)).map(([, key]) => key);
}

/** Atributo debuffável citado no parâmetro (Intimidate -> force etc.). */
export function abilityDebuffStat(info: AbilityInfo): "force" | "agility" | "instinct" | "vitality" | null {
  const key = info.param ? STAT_BY_LABEL[info.param] : undefined;
  return key && key !== "charisma" ? key : null;
}

/** Valor do efeito (fração) para os atributos do mascote, com o fator de redução do time. */
export function abilityValue(info: AbilityInfo, stats: Stats, factor = 1): number {
  if (info.min == null || info.max == null) return 0;
  const stat = info.scale ? (stats[info.scale] ?? 0) : 0;
  const ratio = Math.min(1, Math.max(0, stat) / ABILITY_STAT_CAP);
  return (info.min + (info.max - info.min) * ratio) * factor;
}

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

/** Descrição em português com o intervalo do efeito. */
export function describeAbility(info: AbilityInfo): string {
  if (!info.hasEffect || !info.template) return "Sem efeito em combate nesta versão.";
  const rng = info.min != null && info.max != null ? `de ${pct(info.min)} a ${pct(info.max)}` : "";
  return info.template.replace("{rng}", rng).replace("{T}", info.param ?? "").replace("{S}", info.param ?? "");
}

/** Descrição com o valor atual dos atributos do mascote. */
export function describeAbilityAt(info: AbilityInfo, stats: Stats, factor = 1): string {
  if (!info.hasEffect || !info.template) return describeAbility(info);
  if (info.min == null || info.max == null) return describeAbility(info);
  const v = abilityValue(info, stats, factor);
  return info.template.replace("{rng}", pct(v)).replace("{T}", info.param ?? "").replace("{S}", info.param ?? "");
}

// ── Mascotes e espécies ───────────────────────────────────────────────────────

export type SpeciesAbilities = { normal: string[]; hidden: string | null };

function baseSpeciesId(pokemonId: number) {
  if (pokemonId >= 201001 && pokemonId < 201100) return 201; // Unown
  if (pokemonId >= 666001 && pokemonId < 666100) return 666; // Vivillon
  return pokemonId;
}

export function getSpeciesAbilities(pokemonId: number): SpeciesAbilities {
  let entry = SPECIES_ABILITIES[pokemonId] ?? SPECIES_ABILITIES[baseSpeciesId(pokemonId)];
  // Mega sem habilidade própria usa a da forma anterior à mega.
  if (!entry || (entry[0].length === 0 && !entry[1])) {
    const stone = getMegaStoneForMegaPokemon(pokemonId);
    if (stone) entry = SPECIES_ABILITIES[stone.compatiblePokemonId];
  }
  return entry ? { normal: entry[0], hidden: entry[1] } : { normal: [], hidden: null };
}

export type AbilityMode = "REAL" | "CUSTOM";

/** Habilidades que o mascote pode usar agora (a oculta só com o TM no modo Padrão). */
export function availableAbilities(pokemonId: number, hiddenUnlocked: boolean, mode: AbilityMode = "REAL"): string[] {
  const sp = getSpeciesAbilities(pokemonId);
  const list = [...sp.normal];
  if (sp.hidden && (mode === "CUSTOM" || hiddenUnlocked) && !list.includes(sp.hidden)) list.push(sp.hidden);
  return list;
}

/** Habilidade em uso: a escolhida (se disponível) ou a primeira com efeito em combate. */
export function resolveAbilitySlug(args: {
  pokemonId: number; choice?: string | null; hiddenUnlocked?: boolean; mode?: AbilityMode;
}): string | null {
  const list = availableAbilities(args.pokemonId, Boolean(args.hiddenUnlocked), args.mode ?? "REAL");
  if (args.choice && list.includes(args.choice)) return args.choice;
  return list.find((slug) => getAbilityInfo(slug)?.hasEffect) ?? list[0] ?? null;
}

// ── Limite por categoria no time ──────────────────────────────────────────────

export type AbilitySlotState = "ACTIVE" | "REDUCED" | "OFF" | "NONE";
export type AbilitySlot = { state: AbilitySlotState; factor: number; reason: string | null };

/**
 * Estado de cada habilidade no time em campo, na ordem dos slots: dentro do limite
 * da categoria vale 100%; o 2º usa o efeito reduzido; o excedente fica desligado.
 */
export function evaluateTeamAbilities(slugs: Array<string | null>): AbilitySlot[] {
  const seen: Record<string, number> = {};
  return slugs.map((slug) => {
    const info = getAbilityInfo(slug);
    if (!info || !info.hasEffect || !info.category) return { state: "NONE", factor: 0, reason: null };
    const index = (seen[info.category] = (seen[info.category] ?? 0) + 1);
    const limit = ABILITY_CATEGORY_LIMIT[info.category];
    if (index > limit) {
      return { state: "OFF", factor: 0, reason: `Limite de ${limit} habilidade${limit > 1 ? "s" : ""} de ${info.category} no time` };
    }
    if (index === 2) {
      return { state: "REDUCED", factor: ABILITY_REDUCED_FACTOR, reason: `2º de ${info.category} no time: efeito em ${Math.round(ABILITY_REDUCED_FACTOR * 100)}%` };
    }
    return { state: "ACTIVE", factor: 1, reason: null };
  });
}
