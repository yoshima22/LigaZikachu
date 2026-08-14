import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/permissions";
import { sendNotificationToUser } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await getAppSession();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({})) as { playerName?: string };
  const playerName = body.playerName?.trim().slice(0, 80);
  if (!playerName) {
    return NextResponse.json({ error: "Informe o nome do jogador." }, { status: 400 });
  }

  const players = await prisma.player.findMany({
    where: { displayName: { equals: playerName, mode: "insensitive" } },
    select: { displayName: true, userId: true },
    take: 2,
  });

  if (players.length !== 1) {
    return NextResponse.json(
      { error: players.length === 0 ? "Jogador não encontrado." : "Nome de jogador ambíguo." },
      { status: players.length === 0 ? 404 : 409 },
    );
  }

  const result = await sendNotificationToUser(players[0].userId, {
    title: "⚡ Teste da Liga Zikachu",
    body: "Notificação recebida! O aplicativo está conectado corretamente.",
    url: "/dashboard",
    data: { kind: "ADMIN_TEST" },
  });

  return NextResponse.json({ player: players[0].displayName, ...result });
}
