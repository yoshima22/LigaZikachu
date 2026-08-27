"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requirePlatformAdmin } from "@/lib/auth/permissions";
import { uploadDataUrlAsset } from "@/lib/asset-storage";
import { prisma } from "@/lib/prisma";

export async function updateTournamentBadgeImage(raw: { badgeId: string; imageDataUrl: string }) {
  const admin = await requireAdmin();
  const badge = await prisma.leagueBadge.findUnique({
    where: { id: raw.badgeId },
    include: { tournament: { select: { slug: true } } },
  });
  if (!badge) return { error: "Insignia nao encontrada." };
  if (!raw.imageDataUrl.startsWith("data:image/")) return { error: "Selecione uma imagem valida." };

  const imageUrl = await uploadDataUrlAsset(raw.imageDataUrl, `tournaments/${badge.tournament.slug}/badges`, badge.name);
  await prisma.$transaction([
    prisma.leagueBadge.update({ where: { id: badge.id }, data: { imageUrl } }),
    prisma.auditLog.create({
      data: {
        actorUserId: admin.id,
        entityType: "leagueBadge",
        entityId: badge.id,
        action: "league_badge.image_updated",
        after: { imageUrl },
      },
    }),
  ]);
  revalidatePath(`/torneios/${badge.tournament.slug}`);
  revalidatePath(`/torneios/${badge.tournament.slug}/admin`);
  revalidatePath(`/torneios/${badge.tournament.slug}/desafios`);
  return { success: true, imageUrl };
}

export async function setTournamentBadgeOwner(raw: { badgeId: string; playerId: string; awarded: boolean }) {
  const admin = await requirePlatformAdmin();
  const badge = await prisma.leagueBadge.findUnique({
    where: { id: raw.badgeId },
    include: { tournament: { select: { slug: true } } },
  });
  if (!badge) return { error: "Insignia nao encontrada." };
  const player = await prisma.player.findUnique({ where: { id: raw.playerId }, select: { id: true, displayName: true } });
  if (!player) return { error: "Jogador nao encontrado." };

  if (raw.awarded) {
    await prisma.playerBadge.upsert({
      where: { badgeId_playerId: { badgeId: badge.id, playerId: player.id } },
      update: { awardedById: admin.id, awardedAt: new Date() },
      create: { badgeId: badge.id, playerId: player.id, awardedById: admin.id },
    });
  } else {
    await prisma.playerBadge.deleteMany({ where: { badgeId: badge.id, playerId: player.id } });
  }
  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id, entityType: "playerBadge", entityId: `${badge.id}:${player.id}`,
      action: raw.awarded ? "league_badge.awarded" : "league_badge.revoked",
      after: { badgeId: badge.id, playerId: player.id, playerName: player.displayName },
    },
  });
  revalidatePath(`/torneios/${badge.tournament.slug}/admin`);
  revalidatePath(`/torneios/${badge.tournament.slug}/ranking`);
  revalidatePath("/insignias");
  return { success: true };
}
