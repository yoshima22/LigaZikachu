import { authorizeCompanion } from '@/lib/companion/authorize';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const identity = await authorizeCompanion(request);
  if (!identity) return new Response(null, { status: 404 });
  const user = await prisma.user.findUnique({ where: { id: identity.userId }, select: { id: true, name: true, player: { select: { displayName: true, avatarUrl: true } } } });
  if (!user) return new Response(null, { status: 404 });
  return Response.json({ userId: user.id, displayName: user.player?.displayName ?? user.name, avatarUrl: user.player?.avatarUrl ?? null }, { headers: { 'Cache-Control': 'no-store' } });
}
