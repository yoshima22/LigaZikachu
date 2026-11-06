import { authorizeCompanion } from '@/lib/companion/authorize';
import { performAction, type ActionStore } from '@/lib/companion/actions';
import { claimExpedition } from '@/lib/mascot';
import { prisma } from '@/lib/prisma';
export const runtime = 'nodejs';

const store: ActionStore = {
  event: (deviceId, id) => prisma.companionEvent.findFirst({ where: { id: BigInt(id), deviceId }, select: { type: true, dedupeKey: true, actions: true } }),
  reserve: async (deviceId, id, action) => {
    const inserted = await prisma.$queryRaw<{ result: 'PENDING' }[]>`INSERT INTO "companion_action_audit" ("deviceId", "eventId", "actionId", "result") VALUES (${deviceId}, ${BigInt(id)}, ${action}, 'PENDING') ON CONFLICT DO NOTHING RETURNING "result"`;
    if (inserted.length) return null;
    const rows = await prisma.$queryRaw<{ result: 'PENDING' | 'SUCCESS' | 'STALE' | 'FAILED' }[]>`SELECT "result" FROM "companion_action_audit" WHERE "deviceId" = ${deviceId} AND "eventId" = ${BigInt(id)} AND "actionId" = ${action}`;
    return rows[0]?.result ?? 'PENDING';
  },
  finish: async (deviceId, id, action, result) => { await prisma.$executeRaw`UPDATE "companion_action_audit" SET "result" = ${result}, "updatedAt" = CURRENT_TIMESTAMP WHERE "deviceId" = ${deviceId} AND "eventId" = ${BigInt(id)} AND "actionId" = ${action}`; },
  collect: async (userId, id) => {
    const expedition = await prisma.mascotExpedition.findFirst({ where: { id, status: 'ACTIVE', finishAt: { lte: new Date() }, mascot: { player: { userId } } }, select: { mascot: { select: { playerId: true } }, rewardJson: true } });
    if (!expedition || ['VACATION', 'TRAINING'].includes(String((expedition.rewardJson as Record<string, unknown> | null)?.mode))) return false;
    await claimExpedition(expedition.mascot.playerId, id);
    return true;
  },
};
export async function POST(request: Request) {
  const identity = await authorizeCompanion(request);
  if (!identity) return new Response(null, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return new Response(null, { status: 400 }); }
  if (!body || typeof body !== 'object') return new Response(null, { status: 400 });
  const { eventId, actionId, confirmed } = body as Record<string, unknown>;
  if (typeof eventId !== 'string' || typeof actionId !== 'string') return new Response(null, { status: 400 });
  const result = await performAction(identity, eventId, actionId, confirmed === true, store);
  if (result === 'NOT_FOUND') return new Response(null, { status: 404 });
  return Response.json({ result }, { status: result === 'PENDING' ? 202 : result === 'SUCCESS' ? 200 : 409, headers: { 'Cache-Control': 'no-store' } });
}

