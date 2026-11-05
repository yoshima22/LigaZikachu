import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/permissions";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getActiveRoom, getTurnServers, roomTopic, STUN_SERVERS } from "@/lib/quick-room";

export const runtime = "nodejs";

function sameSecret(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Relay (TURN) sob demanda. A conexão direta é o padrão e não custa nada; o relay só é pedido quando ela
 * falha, e só sai para: (1) membro logado na Liga, (2) quem informa o código de convite de um jogador ativo,
 * (3) quem informa o código livre do admin (env QUICK_ROOM_FREE_CODE). Os demais seguem sem relay.
 */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ip = clientIp(request.headers);
  const body = (await request.json().catch(() => ({}))) as { topic?: unknown; inviteCode?: unknown };
  const room = await getActiveRoom(code);
  if (!room || body.topic !== roomTopic(room)) return NextResponse.json({ error: "Sala inválida." }, { status: 404 });

  // Teto de relays por sala (protege o custo mesmo para quem tem permissão).
  if (!rateLimit(`room:turn:${room.code}`, 30, 60 * 60_000)) {
    return NextResponse.json({ error: "Limite de conexões reforçadas desta sala atingido. Tente mais tarde." }, { status: 429 });
  }

  let via: "login" | "convite" | "livre" | null = null;
  const user = await getSessionUser().catch(() => null);
  if (user) via = "login";

  if (!via) {
    const inviteCode = typeof body.inviteCode === "string" ? body.inviteCode.trim() : "";
    if (!inviteCode) return NextResponse.json({ error: "Informe um código de convite da Liga.", needsCode: true }, { status: 403 });
    // Código errado conta tentativa (6 dígitos dá para forçar sem este limite).
    if (!rateLimit(`room:turncode:${ip}`, 10, 10 * 60_000)) {
      return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos.", needsCode: true }, { status: 429 });
    }
    const freeCode = process.env.QUICK_ROOM_FREE_CODE;
    if (freeCode && freeCode.length >= 6 && sameSecret(inviteCode, freeCode)) {
      via = "livre";
    } else if (/^\d{6}$/.test(inviteCode)) {
      const owner = await prisma.player.findUnique({
        where: { inviteCode },
        select: { active: true, user: { select: { status: true } } },
      });
      if (owner?.active && owner.user.status === "ACTIVE") via = "convite";
    }
    if (!via) return NextResponse.json({ error: "Código inválido.", needsCode: true }, { status: 403 });
  }

  const turn = await getTurnServers();
  if (!turn) return NextResponse.json({ error: "Conexão reforçada indisponível no momento." }, { status: 503 });
  console.info("[quick-room] relay liberado", { room: room.code, via });
  return NextResponse.json({ iceServers: [...STUN_SERVERS, ...turn] });
}
