import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/permissions";
import { rateLimit } from "@/lib/rate-limit";

// Transmissão de tela do ZikaChat via Cloudflare Realtime SFU (mesmo provider da Zika TV).
// Só quem é da Liga (logado) ou informa o código de convite de um jogador ativo pode PUBLICAR;
// assistir exige apenas estar na sala e ter o "ticket" assinado que o publicador divulga na presença.

const TRACK_NAME = /^(video|audio)-[a-z0-9]{4,16}$/;
export const isSfuTrackName = (value: unknown): value is string => typeof value === "string" && TRACK_NAME.test(value);

export function signSfuTicket(room: { code: string; topicSecret: string }, sessionId: string, trackNames: string[]): string {
  return createHmac("sha256", room.topicSecret).update([room.code, sessionId, ...trackNames].join("|")).digest("hex");
}

export function verifySfuTicket(room: { code: string; topicSecret: string }, sessionId: string, trackNames: string[], ticket: unknown): boolean {
  if (typeof ticket !== "string") return false;
  const expected = Buffer.from(signSfuTicket(room, sessionId, trackNames));
  const given = Buffer.from(ticket);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export type SfuAccess = { ok: true; via: "login" | "convite" } | { ok: false; status: number; error: string; needsCode: boolean };

/** Login na Liga OU código de convite (6 dígitos) de um jogador ativo. Código errado conta tentativa por IP. */
export async function resolveSfuPublishAccess(inviteCode: unknown, ip: string): Promise<SfuAccess> {
  if (await getSessionUser().catch(() => null)) return { ok: true, via: "login" };
  const code = typeof inviteCode === "string" ? inviteCode.trim() : "";
  if (!code) return { ok: false, status: 403, error: "Informe o código de convite da sua conta para transmitir.", needsCode: true };
  if (!rateLimit(`room:sfucode:${ip}`, 10, 10 * 60_000)) return { ok: false, status: 429, error: "Muitas tentativas. Aguarde alguns minutos.", needsCode: true };
  if (/^\d{6}$/.test(code)) {
    const owner = await prisma.player.findUnique({ where: { inviteCode: code }, select: { active: true, user: { select: { status: true } } } });
    if (owner?.active && owner.user.status === "ACTIVE") return { ok: true, via: "convite" };
  }
  return { ok: false, status: 403, error: "Código de convite inválido.", needsCode: true };
}
