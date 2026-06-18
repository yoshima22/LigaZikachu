import type { Prisma } from "@prisma/client";

const RANDOM_GENERATION_TYPES = new Set(["RANDOM_GENERATION_STAT_BOOST", "GENERATION_STAT_BOOST"]);

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
