import "server-only";
import { prisma } from "@/lib/prisma";
import { isValidRoomCode } from "@/lib/quick-room-code";

export { generateRoomCode, isValidRoomCode, roomLabel } from "@/lib/quick-room-code";

/** Sala sem batimento por este tempo é tratada como encerrada ("some quando todo mundo sai"). */
export const ROOM_IDLE_MS = 30 * 60_000;
/** Teto global de salas ativas: protege a cota gratuita de TURN/Realtime contra criação em massa. */
export const ROOM_GLOBAL_CAP = 200;
export const ROOM_MAX_PARTICIPANTS = 13;

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
