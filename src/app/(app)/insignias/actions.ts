"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

const createBadgeSchema = z.object({
  tournamentId: z.string().min(1, "Selecione um torneio."),
  name: z.string().trim().min(2, "Informe um nome para a insignia.").max(80),
  imageUrl: z
    .string()
    .min(1, "Carregue uma imagem para a insignia.")
    .max(1_200_000, "A imagem esta muito grande. Use uma imagem menor.")
    .refine(
      (value) => value.startsWith("data:image/") || value.startsWith("https://") || value.startsWith("http://"),
      "Use uma imagem valida."
    )
});

const badgePlayerSchema = z.object({
  badgeId: z.string().min(1),
  playerId: z.string().min(1, "Selecione um jogador.")
});

const badgeSchema = z.object({
  badgeId: z.string().min(1)
});

export async function createLeagueBadgeAction(
  input: z.infer<typeof createBadgeSchema>
): Promise<{ error?: string }> {
  try {
    const actor = await requireAdmin();
    const data = createBadgeSchema.parse(input);

    const tournament = await prisma.tournament.findUnique({
      where: { id: data.tournamentId },
      select: { id: true, name: true, slug: true, season: { select: { slug: true } } }
    });

    if (!tournament) return { error: "Torneio nao encontrado." };

    const badge = await prisma.leagueBadge.create({
      data: {
        tournamentId: tournament.id,
        name: data.name,
        imageUrl: data.imageUrl,
        createdById: actor.id
      }
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        entityType: "leagueBadge",
        entityId: badge.id,
        action: "league_badge.created",
        after: {
          name: badge.name,
          tournamentId: tournament.id,
          tournamentName: tournament.name
        }
      }
    });

    revalidateBadgePaths(tournament.slug, tournament.season?.slug);
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues.map((issue) => issue.message).join(", ") };
    }

    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function assignLeagueBadgeAction(
  input: z.infer<typeof badgePlayerSchema>
): Promise<{ error?: string }> {
  try {
    const actor = await requireAdmin();
    const data = badgePlayerSchema.parse(input);

    const [badge, player] = await Promise.all([
      prisma.leagueBadge.findUnique({
        where: { id: data.badgeId },
        include: { tournament: { select: { id: true, name: true, slug: true, season: { select: { slug: true } } } } }
      }),
      prisma.player.findUnique({
        where: { id: data.playerId },
        select: { id: true, displayName: true }
      })
    ]);

    if (!badge) return { error: "Insignia nao encontrada." };
    if (!player) return { error: "Jogador nao encontrado." };

    const previousOwners = await prisma.playerBadge.findMany({
      where: { badgeId: badge.id },
      include: { player: { select: { displayName: true } } }
    });

    const awarded = await prisma.$transaction(async (tx) => {
      await tx.playerBadge.deleteMany({
        where: {
          badgeId: badge.id,
          playerId: { not: player.id }
        }
      });

      return tx.playerBadge.upsert({
        where: {
          badgeId_playerId: {
            badgeId: badge.id,
            playerId: player.id
          }
        },
        update: {
          awardedById: actor.id,
          awardedAt: new Date()
        },
        create: {
          badgeId: badge.id,
          playerId: player.id,
          awardedById: actor.id
        }
      });
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        entityType: "playerBadge",
        entityId: awarded.id,
        action: previousOwners.length > 0 ? "league_badge.moved" : "league_badge.assigned",
        before: {
          owners: previousOwners.map((owner) => ({
            playerId: owner.playerId,
            playerName: owner.player.displayName
          }))
        },
        after: {
          badgeId: badge.id,
          badgeName: badge.name,
          playerId: player.id,
          playerName: player.displayName,
          tournamentId: badge.tournamentId
        }
      }
    });

    revalidateBadgePaths(badge.tournament.slug, badge.tournament.season?.slug, player.id);
    for (const owner of previousOwners) {
      revalidatePath(`/jogadores/${owner.playerId}`);
    }
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues.map((issue) => issue.message).join(", ") };
    }

    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function deleteLeagueBadgeAction(
  input: z.infer<typeof badgeSchema>
): Promise<{ error?: string }> {
  try {
    const actor = await requireAdmin();
    const { badgeId } = badgeSchema.parse(input);

    const badge = await prisma.leagueBadge.findUnique({
      where: { id: badgeId },
      include: {
        tournament: { select: { id: true, name: true, slug: true, season: { select: { slug: true } } } },
        owners: { include: { player: { select: { displayName: true } } } }
      }
    });

    if (!badge) return { error: "Insignia nao encontrada." };

    await prisma.$transaction([
      prisma.leagueBadge.delete({ where: { id: badge.id } }),
      prisma.auditLog.create({
        data: {
          actorUserId: actor.id,
          entityType: "leagueBadge",
          entityId: badge.id,
          action: "league_badge.deleted",
          before: {
            name: badge.name,
            tournamentId: badge.tournamentId,
            tournamentName: badge.tournament.name,
            owners: badge.owners.map((owner) => ({
              playerId: owner.playerId,
              playerName: owner.player.displayName
            }))
          }
        }
      })
    ]);

    revalidateBadgePaths(badge.tournament.slug, badge.tournament.season?.slug);
    for (const owner of badge.owners) {
      revalidatePath(`/jogadores/${owner.playerId}`);
    }
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues.map((issue) => issue.message).join(", ") };
    }

    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function removeLeagueBadgeAction(
  input: z.infer<typeof badgePlayerSchema>
): Promise<{ error?: string }> {
  try {
    const actor = await requireAdmin();
    const data = badgePlayerSchema.parse(input);

    const playerBadge = await prisma.playerBadge.findUnique({
      where: {
        badgeId_playerId: {
          badgeId: data.badgeId,
          playerId: data.playerId
        }
      },
      include: {
        player: { select: { id: true, displayName: true } },
        badge: {
          include: {
            tournament: { select: { id: true, name: true, slug: true, season: { select: { slug: true } } } }
          }
        }
      }
    });

    if (!playerBadge) return {};

    await prisma.$transaction([
      prisma.playerBadge.delete({ where: { id: playerBadge.id } }),
      prisma.auditLog.create({
        data: {
          actorUserId: actor.id,
          entityType: "playerBadge",
          entityId: playerBadge.id,
          action: "league_badge.removed",
          before: {
            badgeId: playerBadge.badgeId,
            badgeName: playerBadge.badge.name,
            playerId: playerBadge.playerId,
            playerName: playerBadge.player.displayName,
            tournamentId: playerBadge.badge.tournamentId
          }
        }
      })
    ]);

    revalidateBadgePaths(
      playerBadge.badge.tournament.slug,
      playerBadge.badge.tournament.season?.slug,
      playerBadge.playerId
    );
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues.map((issue) => issue.message).join(", ") };
    }

    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

function revalidateBadgePaths(tournamentSlug?: string, seasonSlug?: string, playerId?: string) {
  revalidatePath("/insignias");
  revalidatePath("/ranking");
  revalidatePath("/perfil");
  revalidatePath("/dashboard");

  if (tournamentSlug) {
    revalidatePath(`/torneios/${tournamentSlug}/ranking`);
  }

  if (seasonSlug) {
    revalidatePath(`/temporadas/${seasonSlug}/ranking`);
  }

  if (playerId) {
    revalidatePath(`/jogadores/${playerId}`);
  }
}
