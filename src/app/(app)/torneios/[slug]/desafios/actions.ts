"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAdmin } from "@/lib/auth/permissions";
import { ChallengeStatus, ChallengeType } from "@prisma/client";
import { parseChallengeConfig } from "./config";

// ─── Anúncio ─────────────────────────────────────────────────────────────────

export async function updateTournamentAnnouncement(
  tournamentId: string,
  announcement: string
): Promise<{ error?: string }> {
  try {
    const actor = await getSessionUser();
    if (!actor) return { error: "Não autenticado." };

    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) return { error: "Torneio não encontrado." };

    const canManage =
      actor.role === "ADMIN" || actor.role === "SUPER_ADMIN" || tournament.createdById === actor.id;
    if (!canManage) return { error: "Sem permissão." };

    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { announcement: announcement.trim() || null }
    });

    revalidatePath(`/torneios/${tournament.slug}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ─── Config de Desafios ───────────────────────────────────────────────────────

const challengeConfigSchema = z.object({
  tournamentId: z.string().min(1),
  badgeChallenge: z.boolean(),
  freeChallenge: z.boolean(),
  pointsPerBadge: z.number().int().min(1).max(20),
  pointsToChallenge: z.number().int().min(1).max(20),
  challengerPenalty: z.number().int().min(0).max(20),
  maxChallengesReceivedPerWeek: z.number().int().min(1).max(10)
});

export async function updateChallengeConfig(
  raw: z.infer<typeof challengeConfigSchema>
): Promise<{ error?: string }> {
  try {
    const actor = await getSessionUser();
    if (!actor) return { error: "Não autenticado." };
    const data = challengeConfigSchema.parse(raw);

    const tournament = await prisma.tournament.findUnique({ where: { id: data.tournamentId } });
    if (!tournament) return { error: "Torneio não encontrado." };
    const canManage =
      actor.role === "ADMIN" || actor.role === "SUPER_ADMIN" || tournament.createdById === actor.id;
    if (!canManage) return { error: "Sem permissão." };

    const { tournamentId, ...config } = data;
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { challengeConfig: config }
    });

    revalidatePath(`/torneios/${tournament.slug}/desafios`);
    revalidatePath(`/torneios/${tournament.slug}/admin`);
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0].message };
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ─── Progresso de Insígnias ───────────────────────────────────────────────────

export async function setBadgeProgress(
  badgeId: string,
  playerId: string,
  points: number,
  notes?: string
): Promise<{ error?: string }> {
  try {
    await requireAdmin();

    await prisma.badgeProgress.upsert({
      where: { badgeId_playerId: { badgeId, playerId } },
      update: { points, notes: notes ?? null },
      create: { badgeId, playerId, points, notes: notes ?? null }
    });

    const badge = await prisma.leagueBadge.findUnique({
      where: { id: badgeId },
      select: { tournament: { select: { slug: true } } }
    });
    if (badge) revalidatePath(`/torneios/${badge.tournament.slug}/desafios`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ─── Criar Desafio ────────────────────────────────────────────────────────────

const createChallengeSchema = z.object({
  tournamentId: z.string().min(1),
  challengedId: z.string().min(1),
  type: z.nativeEnum(ChallengeType),
  badgeId: z.string().optional(),
  tournamentWeekId: z.string().optional(),
  reason: z.string().trim().min(3, "Motivo obrigatório.").max(500)
});

export async function createChallenge(
  raw: z.infer<typeof createChallengeSchema>
): Promise<{ error?: string }> {
  try {
    const actor = await getSessionUser();
    if (!actor) return { error: "Não autenticado." };
    const data = createChallengeSchema.parse(raw);

    const [tournament, player] = await Promise.all([
      prisma.tournament.findUnique({
        where: { id: data.tournamentId },
        select: { id: true, slug: true, seasonId: true, challengeConfig: true }
      }),
      prisma.player.findUnique({ where: { userId: actor.id }, select: { id: true } })
    ]);

    if (!tournament) return { error: "Torneio não encontrado." };
    if (!player) return { error: "Jogador não encontrado." };

    const config = parseChallengeConfig(tournament.challengeConfig);

    if (data.type === ChallengeType.BADGE && !config.badgeChallenge)
      return { error: "Desafio por insígnia não está habilitado neste torneio." };
    if (data.type === ChallengeType.FREE && !config.freeChallenge)
      return { error: "Desafio livre não está habilitado neste torneio." };

    // Verificar limite de desafios recebidos na semana
    if (data.tournamentWeekId) {
      const receivedThisWeek = await prisma.challenge.count({
        where: {
          tournamentId: data.tournamentId,
          challengedId: data.challengedId,
          tournamentWeekId: data.tournamentWeekId,
          status: { in: [ChallengeStatus.OPEN, ChallengeStatus.UNDER_REVIEW, ChallengeStatus.ACCEPTED] }
        }
      });
      if (receivedThisWeek >= config.maxChallengesReceivedPerWeek)
        return { error: "Este jogador já atingiu o limite de desafios recebidos nesta semana." };
    }

    // Para Desafio por Insígnia: verificar pontuação mínima
    if (data.type === ChallengeType.BADGE && data.badgeId) {
      const progress = await prisma.badgeProgress.findUnique({
        where: { badgeId_playerId: { badgeId: data.badgeId, playerId: player.id } }
      });
      if (!progress || progress.points < config.pointsToChallenge)
        return {
          error: `Você precisa de ao menos ${config.pointsToChallenge} pontos nesta insígnia para desafiar. Você tem ${progress?.points ?? 0}.`
        };
    }

    await prisma.challenge.create({
      data: {
        type: data.type,
        tournamentId: data.tournamentId,
        seasonId: tournament.seasonId ?? undefined,
        tournamentWeekId: data.tournamentWeekId ?? undefined,
        badgeId: data.badgeId ?? undefined,
        challengerId: player.id,
        challengedId: data.challengedId,
        openedById: actor.id,
        status: ChallengeStatus.OPEN,
        reason: data.reason
      }
    });

    revalidatePath(`/torneios/${tournament.slug}/desafios`);
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0].message };
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ─── Responder (admin aprovar/rejeitar) ──────────────────────────────────────

export async function respondToChallenge(
  challengeId: string,
  accept: boolean,
  notes?: string
): Promise<{ error?: string }> {
  try {
    const actor = await requireAdmin();

    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: { tournament: { select: { slug: true } } }
    });
    if (!challenge) return { error: "Desafio não encontrado." };
    if (challenge.status !== ChallengeStatus.OPEN && challenge.status !== ChallengeStatus.UNDER_REVIEW)
      return { error: "Este desafio não pode ser respondido no estado atual." };

    await prisma.challenge.update({
      where: { id: challengeId },
      data: {
        status: accept ? ChallengeStatus.ACCEPTED : ChallengeStatus.REJECTED,
        resolvedById: actor.id,
        resolvedAt: accept ? undefined : new Date(),
        resolutionNotes: notes ?? null
      }
    });

    if (challenge.tournament?.slug)
      revalidatePath(`/torneios/${challenge.tournament.slug}/desafios`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ─── Resolver desafio após partida ────────────────────────────────────────────

const resolveSchema = z.object({
  challengeId: z.string().min(1),
  challengerWon: z.boolean(),
  matchId: z.string().optional(),
  notes: z.string().trim().max(500).optional()
});

export async function resolveChallenge(
  raw: z.infer<typeof resolveSchema>
): Promise<{ error?: string }> {
  try {
    const actor = await requireAdmin();
    const data = resolveSchema.parse(raw);

    const challenge = await prisma.challenge.findUnique({
      where: { id: data.challengeId },
      include: {
        tournament: { select: { slug: true, challengeConfig: true } }
      }
    });
    if (!challenge) return { error: "Desafio não encontrado." };
    if (challenge.status !== ChallengeStatus.ACCEPTED)
      return { error: "O desafio precisa estar aprovado para ser resolvido." };

    const config = parseChallengeConfig(challenge.tournament?.challengeConfig);

    await prisma.$transaction(async (tx) => {
      await tx.challenge.update({
        where: { id: data.challengeId },
        data: {
          status: data.challengerWon ? ChallengeStatus.RESOLVED : ChallengeStatus.REJECTED,
          matchId: data.matchId ?? null,
          resolvedById: actor.id,
          resolvedAt: new Date(),
          resolutionNotes: data.notes ?? null
        }
      });

      // Se desafiante perdeu: status REJECTED já faz o ranking aplicar -2pts via computeTournamentRanking

      // Se desafiante ganhou e era desafio por insígnia: transferir insígnia automaticamente
      if (data.challengerWon && challenge.type === ChallengeType.BADGE && challenge.badgeId) {
        // Remover insígnia do dono atual
        await tx.playerBadge.deleteMany({
          where: { badgeId: challenge.badgeId, NOT: { playerId: challenge.challengerId } }
        });
        // Dar insígnia ao desafiante
        await tx.playerBadge.upsert({
          where: { badgeId_playerId: { badgeId: challenge.badgeId, playerId: challenge.challengerId } },
          update: { awardedById: actor.id, awardedAt: new Date() },
          create: {
            badgeId: challenge.badgeId,
            playerId: challenge.challengerId,
            awardedById: actor.id
          }
        });
      }
    });

    if (challenge.tournament?.slug)
      revalidatePath(`/torneios/${challenge.tournament.slug}/desafios`);
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0].message };
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ─── Cancelar desafio ─────────────────────────────────────────────────────────

export async function deleteChallenge(challengeId: string): Promise<{ error?: string }> {
  try {
    const actor = await getSessionUser();
    if (!actor) return { error: "Não autenticado." };

    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
        challenger: { select: { userId: true } },
        tournament: { select: { slug: true } }
      }
    });
    if (!challenge) return { error: "Desafio não encontrado." };

    const isOwner = challenge.challenger.userId === actor.id;
    const isAdminUser = actor.role === "ADMIN" || actor.role === "SUPER_ADMIN";
    if (!isOwner && !isAdminUser) return { error: "Sem permissão." };

    const deletable = [ChallengeStatus.OPEN, ChallengeStatus.UNDER_REVIEW];
    if (!deletable.includes(challenge.status as ChallengeStatus))
      return { error: "Só é possível excluir desafios abertos ou em análise." };

    await prisma.challenge.delete({ where: { id: challengeId } });

    if (challenge.tournament?.slug)
      revalidatePath(`/torneios/${challenge.tournament.slug}/desafios`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
