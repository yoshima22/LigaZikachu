import { z } from "zod";
import { MEGA_FORM_IDS } from "@/lib/mega-evolution";

export const ARENA_DRAFT_RULES = {
  teamSize: 12,
  statBudget: 4500,
  // Teto por status: a soma dos pontos distribuídos (acima dos 20 iniciais) de
  // um mesmo status, somando todos os mascotes, não pode passar de 900.
  perStatBudget: 900,
  baseStat: 20,
  maxMegas: 2,
  bansPerPlayer: 3,
  activeSize: 6,
  reserveSize: 3,
  strategyTurns: [20, 35, 45],
  strategySeconds: 180,
  reconnectSeconds: 90,
  minimumRankedMatches: 5,
} as const;

export const DRAFT_PERSONALITIES = [
  "LOYAL",
  "PROUD",
  "MISCHIEVOUS",
  "LAZY",
  "COMPETITIVE",
  "DRAMATIC",
  "PLAYFUL",
  "ELECTRIC",
  "TIMID",
  "CHAOTIC",
  "CURIOUS",
  "GLUTTON",
  "SERENE",
] as const;
export const DRAFT_POSTURES = [
  "DEFENDER",
  "ATTACKER",
  "FLANK",
  "GUARDIAN",
  "HEALER",
  "ENCOURAGER",
  "OPPORTUNIST",
  "DUELIST",
  "SABOTEUR",
  "SCOUT",
  "PROVOKER",
  "SPECIALIST",
  "SURVIVOR",
] as const;
export const DRAFT_STAT_KEYS = [
  "force",
  "agility",
  "charisma",
  "instinct",
  "vitality",
] as const;

export const arenaDraftPetSchema = z
  .object({
    id: z.string().min(1),
    slot: z.number().int().min(0).max(11),
    speciesId: z.number().int().positive(),
    isMega: z.boolean(),
    nickname: z.string().trim().max(18).optional(),
    personality: z.enum(DRAFT_PERSONALITIES),
    posture: z.enum(DRAFT_POSTURES),
    stats: z.object({
      force: z.number().int().min(20).max(250),
      agility: z.number().int().min(20).max(250),
      charisma: z.number().int().min(20).max(250),
      instinct: z.number().int().min(20).max(250),
      vitality: z.number().int().min(20).max(250),
    }),
  })
  .superRefine((pet, context) => {
    if (!MEGA_FORM_IDS.has(pet.speciesId)) return;
    for (const key of DRAFT_STAT_KEYS) {
      if (pet.stats[key] > 240)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["stats", key],
          message:
            "Formas Mega aceitam no máximo 240 antes do bônus de transformação.",
        });
    }
  });
export const arenaDraftPetsSchema = z.array(arenaDraftPetSchema).max(12);
export type ArenaDraftPet = z.infer<typeof arenaDraftPetSchema>;

export function validateArenaDraftPets(input: unknown) {
  const parsed = arenaDraftPetsSchema.safeParse(input);
  if (!parsed.success)
    return {
      valid: false,
      errors: ["Há mascotes com configuração inválida."],
      pets: [] as ArenaDraftPet[],
    };
  const pets = parsed.data.map((pet) => ({
    ...pet,
    isMega: MEGA_FORM_IDS.has(pet.speciesId),
  }));
  const errors: string[] = [];
  if (pets.length !== ARENA_DRAFT_RULES.teamSize)
    errors.push(`Preencha os ${ARENA_DRAFT_RULES.teamSize} slots.`);
  if (new Set(pets.map((pet) => pet.slot)).size !== pets.length)
    errors.push("Existem slots duplicados.");
  if (pets.filter((pet) => pet.isMega).length > ARENA_DRAFT_RULES.maxMegas)
    errors.push("O preset pode ter no máximo 2 Megas.");
  const finalTotal = pets.reduce(
    (teamTotal, pet) =>
      teamTotal + DRAFT_STAT_KEYS.reduce((sum, key) => sum + pet.stats[key], 0),
    0,
  );
  const baseTotal =
    pets.length * DRAFT_STAT_KEYS.length * ARENA_DRAFT_RULES.baseStat;
  const distributed = finalTotal - baseTotal;
  if (distributed > ARENA_DRAFT_RULES.statBudget)
    errors.push(
      `O time ultrapassou o limite: ${Math.max(0, distributed).toLocaleString("pt-BR")}/4.500 pontos além dos status iniciais.`,
    );
  // Teto por status (soma dos pontos distribuídos daquele status no time).
  for (const key of DRAFT_STAT_KEYS) {
    const column = pets.reduce(
      (sum, pet) => sum + (pet.stats[key] - ARENA_DRAFT_RULES.baseStat),
      0,
    );
    if (column > ARENA_DRAFT_RULES.perStatBudget)
      errors.push(
        `${DRAFT_STAT_LABELS[key]} ultrapassou ${ARENA_DRAFT_RULES.perStatBudget} pontos no time (${column.toLocaleString("pt-BR")}).`,
      );
  }
  return { valid: errors.length === 0, errors, pets };
}

export const DRAFT_STAT_LABELS: Record<(typeof DRAFT_STAT_KEYS)[number], string> =
  {
    force: "Força",
    agility: "Agilidade",
    charisma: "Carisma",
    instinct: "Instinto",
    vitality: "Vitalidade",
  };

export function publicDraftPet(pet: ArenaDraftPet) {
  return {
    id: pet.id,
    slot: pet.slot,
    speciesId: pet.speciesId,
    isMega: pet.isMega,
  };
}
