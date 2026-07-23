import { prisma } from "@/lib/prisma";

/**
 * Removes expired passes from active account state without deleting their
 * claims or audit history.
 */
export async function deactivateExpiredSupporterPasses(now = new Date()): Promise<number> {
  const result = await prisma.supporterPass.updateMany({
    where: {
      active: true,
      expiresAt: { lte: now },
    },
    data: { active: false },
  });

  return result.count;
}
