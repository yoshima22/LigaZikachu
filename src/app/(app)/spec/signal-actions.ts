"use server";

import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/session";
import { getSpecConfig } from "@/lib/spec/config";
import { Prisma } from "@prisma/client";

// Sinalização WebRTC ponto-a-ponto para o modo P2P mesh. Só o aperto de mão
// (SDP não-trickle, com candidatos ICE embutidos) passa por aqui. A mídia flui
// direto entre navegadores. As linhas são efêmeras.

type SignalKind = "JOIN" | "OFFER" | "ANSWER" | "BYE";

export async function sendSpecSignalAction(
  streamId: string, toUserId: string, kind: SignalKind, payload?: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getAppSession();
  if (!session?.user?.id) return { ok: false, error: "Não autenticado." };
  const config = await getSpecConfig();
  if (!config.enabled) return { ok: false, error: "Modo SPEC desativado." };
  if (!["JOIN", "OFFER", "ANSWER", "BYE"].includes(kind)) return { ok: false, error: "Sinal inválido." };

  await prisma.specSignal.create({
    data: {
      streamId,
      fromUserId: session.user.id,
      toUserId,
      kind,
      payload: (payload ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    },
  }).catch(() => null);
  return { ok: true };
}

export async function pollSpecSignalsAction(
  streamId: string, cursor = 0,
): Promise<{ cursor: number; signals: Array<{ seq: number; fromUserId: string; kind: string; payload: unknown }> }> {
  const session = await getAppSession();
  if (!session?.user?.id) return { cursor, signals: [] };

  const rows = await prisma.specSignal.findMany({
    where: { streamId, toUserId: session.user.id, seq: { gt: cursor } },
    orderBy: { seq: "asc" },
    take: 50,
    select: { seq: true, fromUserId: true, kind: true, payload: true },
  }).catch(() => []);

  const nextCursor = rows.length ? rows[rows.length - 1].seq : cursor;
  return { cursor: nextCursor, signals: rows.map((r) => ({ seq: r.seq, fromUserId: r.fromUserId, kind: r.kind, payload: r.payload })) };
}
