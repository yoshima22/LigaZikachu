import {
  AchievementCategory,
  AchievementRarity,
  AchievementScope,
  AchievementType,
} from "@prisma/client";
import { z } from "zod";

export const createAchievementSchema = z.object({
  key: z.string().trim().min(2).max(80).regex(/^[a-z0-9_]+$/, "Use apenas letras minúsculas, números e _"),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  iconUrl: z.string().url().optional().or(z.literal("")),
  type: z.nativeEnum(AchievementType),
  rarity: z.nativeEnum(AchievementRarity),
  category: z.nativeEnum(AchievementCategory),
  scope: z.nativeEnum(AchievementScope),
  isSecret: z.boolean().default(false),
  isRepeatable: z.boolean().default(false),
  suggestedPoints: z.number().int().min(0).max(100).optional(),
  seasonId: z.string().optional(),
});

// A chave identifica a conquista e não é editável no painel. Registros legados
// podem usá-la em maiúsculas, então ela só é validada na criação.
export const updateAchievementSchema = createAchievementSchema.omit({ key: true });

export type CreateAchievementInput = z.infer<typeof createAchievementSchema>;
export type UpdateAchievementInput = z.infer<typeof updateAchievementSchema>;
