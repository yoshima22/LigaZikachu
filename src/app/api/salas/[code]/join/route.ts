import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getActiveRoom, joinQuickRoom, roomLabel, roomTopic, STUN_SERVERS } from "@/lib/quick-room";

export const runtime = "nodejs";

/**
 * Entrar na sala: confere a senha (se houver) e devolve o tópico secreto do canal em tempo real
 * e os servidores ICE. Quem não passa aqui não sabe em qual canal escutar.
 */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!rateLimit(`room:join:${clientIp(request.headers)}:${code}`, 20, 10 * 60_000)) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }
  const room = await getActiveRoom(code);
  if (!room) return NextResponse.json({ error: "Sala não encontrada ou encerrada." }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { password?: unknown; name?: unknown; hostToken?: unknown };
  const password = typeof body.password === "string" ? body.password : "";
  const joined = await joinQuickRoom({ code, name: body.name, hostToken: typeof body.hostToken === "string" ? body.hostToken : undefined, passwordValid: !room.passwordHash || Boolean(password) && await verifyPassword(password, room.passwordHash) });
  if ("error" in joined) return NextResponse.json({ error: joined.error === "FULL" ? "Sala cheia." : joined.error === "PASSWORD" ? "Senha incorreta." : "Sala não encontrada ou encerrada." }, { status: joined.error === "FULL" ? 409 : joined.error === "PASSWORD" ? 403 : 404 });
  return NextResponse.json({
    topic: roomTopic(room),
    maxParticipants: room.maxParticipants,
    label: roomLabel(room.code),
    // Chave publishable/anon do Supabase (pública por natureza, protegida por RLS). Entregue em tempo de execução
    // para não depender de variável NEXT_PUBLIC_ embutida no build.
    realtime: {
      url: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
      key: process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null,
    },
    iceServers: STUN_SERVERS,
    participantId: joined.lease.id,
    participantToken: joined.participantToken,
    isHost: joined.lease.isHost,
  });
}
