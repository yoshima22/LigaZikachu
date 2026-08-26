"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/permissions";

// Marca o aviso (versão) como lido pelo jogador logado. Enquanto não confirmar,
// o modal reaparece; depois some até a próxima versão de aviso.
export async function acknowledgeNoticeAction(version: number): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  if (!user) return { ok: false };
  const v = Number.isFinite(version) ? Math.floor(version) : 0;
  await prisma.player.updateMany({
    where: { userId: user.id, lastAckedNoticeVersion: { lt: v } },
    data: { lastAckedNoticeVersion: v },
  });
  return { ok: true };
}
