import { authorizeCompanion } from '@/lib/companion/authorize';
import { profileResponse } from '@/lib/companion/http';
import { prisma } from '@/lib/prisma';
export async function GET(request: Request) {
  return profileResponse(request, authorizeCompanion, async userId => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, player: { select: { displayName: true, avatarUrl: true } } } });
    return user ? { userId: user.id, displayName: user.player?.displayName ?? user.name, avatarUrl: user.player?.avatarUrl ?? null } : null;
  });
}
