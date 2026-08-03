"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/permissions";
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
