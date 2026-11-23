"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/permissions";
import { getAbilityInfo } from "./index";
import { ABILITY_FEEDBACK_MAX_COMMENT, ABILITY_VERDICT_KEYS, type AbilityVerdict } from "./feedback";

async function currentPlayerId() {
  const user = await getSessionUser();
  if (!user) return null;
  const p = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
  return p?.id ?? null;
}

/** Voto atual do jogador nesta habilidade (para pré-preencher a janelinha). */
export async function getMyAbilityFeedbackAction(slug: string): Promise<{ verdict: AbilityVerdict; comment: string } | null> {
  const playerId = await currentPlayerId();
  if (!playerId || !getAbilityInfo(slug)) return null;
  const r = await prisma.abilityFeedback.findUnique({ where: { playerId_abilitySlug: { playerId, abilitySlug: slug } } });
  return r ? { verdict: r.verdict as AbilityVerdict, comment: r.comment ?? "" } : null;
}

/** Registra (ou troca) o voto do jogador. Um voto por habilidade. */
export async function submitAbilityFeedbackAction(input: { slug: string; verdict: string; comment?: string }): Promise<{ ok: boolean; error?: string }> {
  try {
    const playerId = await currentPlayerId();
    if (!playerId) return { ok: false, error: "Entre na sua conta para opinar." };
    if (!getAbilityInfo(input.slug)) return { ok: false, error: "Habilidade desconhecida." };
    if (!ABILITY_VERDICT_KEYS.includes(input.verdict as AbilityVerdict)) return { ok: false, error: "Escolha uma opção." };
    const comment = (input.comment ?? "").trim().slice(0, ABILITY_FEEDBACK_MAX_COMMENT) || null;
    await prisma.abilityFeedback.upsert({
      where: { playerId_abilitySlug: { playerId, abilitySlug: input.slug } },
      create: { playerId, abilitySlug: input.slug, verdict: input.verdict, comment },
      update: { verdict: input.verdict, comment },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao enviar." };
  }
}
