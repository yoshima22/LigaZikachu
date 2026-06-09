/**
 * Diagnóstico: lista todos os mascotes de um jogador pelo displayName.
 * GET /api/admin/player-mascots?name=Erick
 * Acesso: sessão de admin logado no site (não precisa de CRON_SECRET)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/session";
import { isAdmin } from "@/lib/auth/permissions";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getAppSession();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const name = req.nextUrl.searchParams.get("name");
  if (!name) return NextResponse.json({ error: "Param ?name= required" }, { status: 400 });

  const player = await prisma.player.findFirst({
    where: { displayName: { contains: name, mode: "insensitive" } },
    select: { id: true, displayName: true },
  });

  if (!player) return NextResponse.json({ error: "Jogador não encontrado" }, { status: 404 });

  const mascots = await prisma.mascot.findMany({
    where: { playerId: player.id },
    select: {
      id: true, pokemonId: true, nickname: true, level: true,
      isFavorite: true, isEquipped: true, arenaState: true,
      bazarListed: true, mood: true, hatchedAt: true,
    },
    orderBy: [{ isFavorite: "desc" }, { isEquipped: "desc" }, { level: "desc" }],
  });

  return NextResponse.json({
    player: { id: player.id, displayName: player.displayName },
    total: mascots.length,
    mascots,
  });
}
