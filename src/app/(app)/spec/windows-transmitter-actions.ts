"use server";

import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/session";

const PAIR_TTL_MS = 10 * 60_000;

export async function createWindowsTransmitterPairingAction(streamId: string) {
  const session = await getAppSession();
  if (!session?.user?.id) return { error: "Não autenticado." };
  const stream = await prisma.specStream.findUnique({ where: { id: streamId }, select: { broadcasterUserId: true, status: true } });
  if (!stream || stream.broadcasterUserId !== session.user.id || !["PREPARING", "LIVE"].includes(stream.status)) return { error: "Transmissão indisponível." };
  const code = randomBytes(5).toString("hex").toUpperCase();
  await prisma.specSignal.deleteMany({ where: { streamId, fromUserId: session.user.id, kind: { in: ["WIN_PAIR", "WIN_CONNECTED"] } } });
  await prisma.specSignal.create({ data: { streamId, fromUserId: session.user.id, toUserId: code, kind: "WIN_PAIR", payload: { expiresAt: new Date(Date.now() + PAIR_TTL_MS).toISOString() } as Prisma.InputJsonValue } });
  return { code, expiresAt: Date.now() + PAIR_TTL_MS };
}

export async function getWindowsTransmitterPairingStateAction(streamId: string) {
  const session = await getAppSession();
  if (!session?.user?.id) return { connected: false };
  const row = await prisma.specSignal.findFirst({ where: { streamId, fromUserId: session.user.id, kind: "WIN_CONNECTED", createdAt: { gte: new Date(Date.now() - PAIR_TTL_MS) } }, orderBy: { seq: "desc" }, select: { payload: true } });
  const payload = row?.payload as { deviceName?: string; processName?: string } | null;
  return { connected: Boolean(row), deviceName: payload?.deviceName, processName: payload?.processName };
}
