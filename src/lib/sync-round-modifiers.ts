import type { Prisma } from "@prisma/client";

const RANDOM_GENERATION_TYPES = new Set(["RANDOM_GENERATION_STAT_BOOST", "GENERATION_STAT_BOOST"]);
const COMBAT_TYPES = ["normal", "fire", "water", "grass", "electric", "ice", "fighting", "poison", "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy"];

export function pokemonGeneration(pokemonId: number): number {
  if (pokemonId <= 151) return 1;
  if (pokemonId <= 251) return 2;
  if (pokemonId <= 386) return 3;
  if (pokemonId <= 493) return 4;
  if (pokemonId <= 649) return 5;
  if (pokemonId <= 721) return 6;
  if (pokemonId <= 809) return 7;
  if (pokemonId <= 905) return 8;
  return 9;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function shouldMaterializeGenerationModifier(modifier: {
  key: string;
  effectJson: Prisma.JsonValue | null;
}) {
  if (modifier.key === "GERACAO_SORTEADA") return true;
  if (!isRecord(modifier.effectJson)) return false;
  return RANDOM_GENERATION_TYPES.has(String(modifier.effectJson.type));
}

export async function materializeRoundModifier(
  tx: Prisma.TransactionClient,
  modifierId: string | null,
  roundId: string,
): Promise<string | null> {
  if (!modifierId) return null;

  const modifier = await tx.syncEventModifier.findUnique({
    where: { id: modifierId },
    select: { id: true, key: true, name: true, description: true, effectJson: true },
  });
  if (!modifier) return null;
  if (isRecord(modifier.effectJson) && modifier.effectJson.type === "RANDOM_TYPE_MODIFIER") {
    const existing = await tx.syncEventModifier.findUnique({ where: { key: `${modifier.key}_ROUND_${roundId}` }, select: { id: true } });
    if (existing) return existing.id;
    const boostType = COMBAT_TYPES[Math.floor(Math.random() * COMBAT_TYPES.length)];
    const penaltyPool = COMBAT_TYPES.filter((type) => type !== boostType);
    const penaltyType = penaltyPool[Math.floor(Math.random() * penaltyPool.length)];
    const boost = typeof modifier.effectJson.boost === "number" ? modifier.effectJson.boost : 0.2;
    const penalty = typeof modifier.effectJson.penalty === "number" ? modifier.effectJson.penalty : 0.2;
    const created = await tx.syncEventModifier.create({
      data: {
        key: `${modifier.key}_ROUND_${roundId}`,
        name: modifier.name,
        description: `${modifier.description} Tipo fortalecido: ${boostType}. Tipo enfraquecido: ${penaltyType}.`,
        effectJson: { ...modifier.effectJson, type: "TYPE_MODIFIER", boostType, penaltyType, boost, penalty },
        active: false,
      },
      select: { id: true },
    });
    return created.id;
  }
  if (!shouldMaterializeGenerationModifier(modifier)) return modifier.id;

  const existing = await tx.syncEventModifier.findUnique({
    where: { key: `${modifier.key}_ROUND_${roundId}` },
    select: { id: true },
  });
  if (existing) return existing.id;

  const baseEffect = isRecord(modifier.effectJson) ? modifier.effectJson : {};
  const selectedGeneration =
    typeof baseEffect.selectedGeneration === "number"
      ? baseEffect.selectedGeneration
      : Math.floor(Math.random() * 9) + 1;
  const value = typeof baseEffect.value === "number" ? baseEffect.value : 30;

  const roundModifier = await tx.syncEventModifier.create({
    data: {
      key: `${modifier.key}_ROUND_${roundId}`,
      name: modifier.name,
      description: `${modifier.description} Geração selecionada: ${selectedGeneration}.`,
      effectJson: {
        ...baseEffect,
        type: "GENERATION_STAT_BOOST",
        selectedGeneration,
        value,
      },
      active: false,
    },
    select: { id: true },
  });

  return roundModifier.id;
}
