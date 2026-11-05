import "server-only";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { generateRoomCode, isValidRoomCode, roomLabel } from "@/lib/quick-room-code";
import { countActiveMedia, isPublicLiveEligible } from "@/lib/quick-room-public";

export { generateRoomCode, isValidRoomCode, roomLabel } from "@/lib/quick-room-code";

/** Sala sem batimento por este tempo é tratada como encerrada ("some quando todo mundo sai"). */
export const ROOM_IDLE_MS = 30 * 60_000;
/** Teto global de salas ativas: protege a cota gratuita de TURN/Realtime contra criação em massa. */
export const ROOM_GLOBAL_CAP = 200;
export const ROOM_MAX_PARTICIPANTS = 13;
export const ROOM_LEASE_IDLE_MS = 90_000;

type RoomVisibility = "UNLISTED" | "PUBLIC";
type LeaseMedia = { micOn?: boolean; cameraOn?: boolean; screenOn?: boolean };

function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
function cleanRoomTitle(value: unknown) { const title = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""; return title.slice(0, 72) || null; }
function cleanName(value: unknown) { const name = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""; return name.slice(0, 24) || "Visitante " + String(Math.floor(1000 + Math.random() * 9000)); }
function roomVisibility(value: unknown): RoomVisibility { return value === "PUBLIC" ? "PUBLIC" : "UNLISTED"; }
function activeLeaseCutoff(now = new Date()) { return new Date(now.getTime() - ROOM_LEASE_IDLE_MS); }

export type PublicQuickRoom = { code: string; title: string; participants: number; cameras: number; screens: number };

export async function createQuickRoom(input: { password?: string; title?: unknown; visibility?: unknown }) {
  const active = await prisma.quickRoom.count({ where: { lastActiveAt: { gt: new Date(Date.now() - ROOM_IDLE_MS) } } });
  if (active >= ROOM_GLOBAL_CAP) throw new Error("ROOM_CAPACITY_REACHED");
  const hostToken = randomBytes(24).toString("base64url");
  const room = await prisma.quickRoom.create({ data: { code: generateRoomCode(), topicSecret: randomBytes(16).toString("hex"), passwordHash: input.password || null, hostTokenHash: tokenHash(hostToken), title: cleanRoomTitle(input.title), visibility: roomVisibility(input.visibility), maxParticipants: ROOM_MAX_PARTICIPANTS }, select: { code: true, title: true, visibility: true } });
  return { ...room, hostToken };
}

export async function joinQuickRoom(input: { code: string; name?: unknown; passwordValid: boolean; hostToken?: string }) {
  const now = new Date(); const cutoff = activeLeaseCutoff(now);
  return prisma.$transaction(async (tx) => {
    await tx.quickRoomParticipantLease.deleteMany({ where: { lastSeenAt: { lt: cutoff } } });
    const room = await tx.quickRoom.findUnique({ where: { code: input.code } });
    if (!room) return { error: "NOT_FOUND" as const };
    if (!input.passwordValid) return { error: "PASSWORD" as const };
    const active = await tx.quickRoomParticipantLease.count({ where: { roomId: room.id, lastSeenAt: { gte: cutoff } } });
    if (active >= room.maxParticipants) return { error: "FULL" as const };
    const participantToken = randomBytes(24).toString("base64url");
    const isHost = Boolean(room.hostTokenHash && input.hostToken && tokenHash(input.hostToken) === room.hostTokenHash);
    const lease = await tx.quickRoomParticipantLease.create({ data: { roomId: room.id, tokenHash: tokenHash(participantToken), name: cleanName(input.name), isHost }, select: { id: true, name: true, isHost: true } });
    await tx.quickRoom.update({ where: { id: room.id }, data: { lastActiveAt: now, publicLastSeenAt: room.visibility === "PUBLIC" ? now : undefined } });
    return { room, lease, participantToken };
  }, { isolationLevel: "Serializable" });
}

export async function refreshQuickRoomLease(input: { code: string; participantToken: string; media?: LeaseMedia }) {
  const now = new Date(); const room = await getActiveRoom(input.code); if (!room) return null;
  const update = await prisma.quickRoomParticipantLease.updateMany({ where: { roomId: room.id, tokenHash: tokenHash(input.participantToken) }, data: { lastSeenAt: now, micOn: Boolean(input.media?.micOn), cameraOn: Boolean(input.media?.cameraOn), screenOn: Boolean(input.media?.screenOn) } });
  if (!update.count) return null;
  await prisma.quickRoom.update({ where: { id: room.id }, data: { lastActiveAt: now, publicLastSeenAt: room.visibility === "PUBLIC" ? now : undefined } });
  return room;
}

export async function leaveQuickRoom(code: string, participantToken: string) {
  const room = await getActiveRoom(code); if (!room) return false;
  return (await prisma.quickRoomParticipantLease.deleteMany({ where: { roomId: room.id, tokenHash: tokenHash(participantToken) } })).count > 0;
}

export async function manageQuickRoomAsHost(code: string, hostToken: string, action: "HIDE" | "END") {
  const room = await getActiveRoom(code);
  if (!room?.hostTokenHash || tokenHash(hostToken) !== room.hostTokenHash) return false;
  if (action === "END") {
    await prisma.$transaction([
      prisma.quickRoomParticipantLease.deleteMany({ where: { roomId: room.id } }),
      prisma.quickRoom.delete({ where: { id: room.id } }),
    ]);
    return true;
  }
  await prisma.quickRoom.update({ where: { id: room.id }, data: { visibility: "UNLISTED", publicLastSeenAt: null } });
  return true;
}

export async function reportQuickRoom(code: string, reason: "ABUSE" | "HARASSMENT" | "INAPPROPRIATE_CONTENT" | "OTHER", note?: string) {
  const room = await getActiveRoom(code);
  if (!room) return false;
  await prisma.quickRoomReport.create({ data: { roomId: room.id, reason, note: cleanRoomTitle(note) } });
  return true;
}

export async function listPublicQuickRooms(limit = 12): Promise<PublicQuickRoom[]> {
  const now = new Date(); const cutoff = activeLeaseCutoff(now);
  const rooms = await prisma.quickRoom.findMany({ where: { visibility: "PUBLIC", publicLastSeenAt: { gte: cutoff } }, orderBy: { publicLastSeenAt: "desc" }, take: Math.min(Math.max(limit, 1), 24), select: { code: true, title: true, visibility: true, publicLastSeenAt: true, participantLeases: { where: { lastSeenAt: { gte: cutoff } }, select: { cameraOn: true, screenOn: true } } } });
  return rooms.flatMap((room) => { const cameras = room.participantLeases.filter((lease) => lease.cameraOn).length; const screens = room.participantLeases.filter((lease) => lease.screenOn).length; const activeMedia = countActiveMedia(room.participantLeases); if (!isPublicLiveEligible({ visibility: room.visibility, activeParticipants: room.participantLeases.length, activeMedia, publicLastSeenAt: room.publicLastSeenAt }, now)) return []; return [{ code: room.code, title: room.title ?? roomLabel(room.code), participants: room.participantLeases.length, cameras, screens }]; });
}

/** Busca a sala; se estiver parada além do limite, apaga e devolve null. */
export async function getActiveRoom(code: string) {
  if (!isValidRoomCode(code)) return null;
  const room = await prisma.quickRoom.findUnique({ where: { code } });
  if (!room) return null;
  if (Date.now() - room.lastActiveAt.getTime() > ROOM_IDLE_MS) {
    await prisma.quickRoom.delete({ where: { id: room.id } }).catch(() => null);
    return null;
  }
  return room;
}

export function roomTopic(room: { code: string; topicSecret: string }): string {
  return `quickroom:${room.code}:${room.topicSecret}`;
}

/** Só STUN: gratuito e suficiente para a maioria das conexões (a conexão é direta entre os navegadores). */
export const STUN_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.cloudflare.com:3478" }];

/**
 * Credenciais TURN (relay) da Cloudflare, temporárias. Custam dinheiro, então só são pedidas quando a
 * conexão direta falha e só são entregues a quem tem permissão (ver /api/salas/[code]/turn).
 * Devolve null se o TURN não estiver configurado.
 */
export async function getTurnServers(): Promise<RTCIceServer[] | null> {
  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID;
  const token = process.env.CLOUDFLARE_TURN_API_TOKEN;
  if (!keyId || !token) return null;
  try {
    const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: 2 * 60 * 60 }),
      signal: AbortSignal.timeout(4_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { iceServers?: RTCIceServer[] };
    return data.iceServers?.length ? data.iceServers : null;
  } catch {
    return null;
  }
}
