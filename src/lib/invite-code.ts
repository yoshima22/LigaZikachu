import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/** Gera um código de convite de 6 dígitos (000000–999999). */
export function generateInviteCode(): string {
  return Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
}

/** Gera um código de convite garantidamente único no banco. */
export async function generateUniqueInviteCode(db: Db): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const code = generateInviteCode();
    const existing = await db.player.findUnique({ where: { inviteCode: code }, select: { id: true } });
    if (!existing) return code;
  }
  throw new Error("Não foi possível gerar um código de convite único. Tente novamente.");
}

/** Garante que o jogador tenha um código de convite, criando um se faltar. */
export async function ensurePlayerInviteCode(db: Db, playerId: string): Promise<string> {
  const player = await db.player.findUnique({ where: { id: playerId }, select: { inviteCode: true } });
  if (player?.inviteCode) return player.inviteCode;
  const code = await generateUniqueInviteCode(db);
  await db.player.update({ where: { id: playerId }, data: { inviteCode: code } });
  return code;
}
