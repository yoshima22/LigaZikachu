"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/permissions";

const modifierSchema = z.object({
  key: z.string().min(2).max(64).regex(/^[A-Z0-9_]+$/, "Use apenas letras maiúsculas, números e _"),
  name: z.string().min(2).max(80),
  description: z.string().min(5).max(300),
  effectType: z.enum(["NONE", "STAT_BOOST"]),
  effectStat: z.string().optional(),
  effectValue: z.coerce.number().min(0).max(2).default(0),
});

export async function createModifierAction(formData: FormData): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const raw = Object.fromEntries(formData.entries());
    const data = modifierSchema.parse(raw);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const effectJson: any = data.effectType === "STAT_BOOST" && data.effectStat
      ? { type: "STAT_BOOST", targetStat: data.effectStat, value: data.effectValue }
      : undefined;

    await prisma.syncEventModifier.create({
      data: { key: data.key, name: data.name, description: data.description, effectJson, active: true },
    });

    revalidatePath("/desafio-sincronizado");
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.errors[0]?.message ?? "Dados inválidos." };
    return { error: err instanceof Error ? err.message : "Erro ao criar modificador." };
  }
}

export async function toggleModifierAction(id: string, active: boolean): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await prisma.syncEventModifier.update({ where: { id }, data: { active } });
    revalidatePath("/desafio-sincronizado");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro." };
  }
}

export async function deleteModifierAction(id: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await prisma.syncEventModifier.delete({ where: { id } });
    revalidatePath("/desafio-sincronizado");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao deletar modificador." };
  }
}
