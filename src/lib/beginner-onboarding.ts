import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const BEGINNER_PASS_LABEL = "Passe Iniciante";
export const BEGINNER_PASS_DAYS = 7;
export const BEGINNER_WELCOME_MESSAGE = `Boas-vindas à Liga Zikachu! ⚡

Aqui você pode chocar ovos, cuidar dos mascotes, fazer expedições, montar equipes, enfrentar a Arena Z, negociar no Bazar e disputar torneios.

Comece pela página de Mascotes e coloque um ovo na incubadora. Você recebeu um Passe Iniciante com 7 dias de recompensas: visite a página do Passe Apoiador para resgatá-las e conhecer os passes especiais dos contribuintes.

Se tiver dúvidas, fale com o Professor Enguiça ou consulte o Manual. Nos vemos na Liga!`;

type DbClient = typeof prisma | Prisma.TransactionClient;

/**
 * Entrega idempotente do onboarding. Pode ser chamada em todo fluxo de criação
 * ou aprovação sem duplicar passe nem mensagem.
 */
export async function ensureBeginnerOnboarding(playerId: string, db: DbClient = prisma) {
  const now = new Date();
  const existingPass = await db.supporterPass.findFirst({
    where: { playerId, passLabel: BEGINNER_PASS_LABEL },
    select: { id: true },
  });
  if (!existingPass) {
    await db.supporterPass.create({
      data: {
        playerId,
        passLabel: BEGINNER_PASS_LABEL,
        startsAt: now,
        expiresAt: new Date(now.getTime() + BEGINNER_PASS_DAYS * 86_400_000),
        allowRetroactiveClaims: false,
      },
    });
  }

  const adminPlayer = await db.player.findFirst({
    where: { user: { role: { in: ["SUPER_ADMIN", "ADMIN"] } } },
    orderBy: { user: { createdAt: "asc" } },
    select: { id: true },
  });
  if (adminPlayer && adminPlayer.id !== playerId) {
    const existingMessage = await db.directMessage.findFirst({
      where: { senderId: adminPlayer.id, receiverId: playerId, content: BEGINNER_WELCOME_MESSAGE },
      select: { id: true },
    });
    if (!existingMessage) {
      await db.directMessage.create({
        data: { senderId: adminPlayer.id, receiverId: playerId, content: BEGINNER_WELCOME_MESSAGE },
      });
    }
  }

  return { passCreated: !existingPass };
}
