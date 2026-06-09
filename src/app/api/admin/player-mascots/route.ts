/**
 * Diagnóstico: lista todos os mascotes de um jogador pelo displayName.
 * GET /api/admin/player-mascots?name=Erick
 * Header: Authorization: Bearer <CRON_SECRET>
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const name = req.nextUrl.searchParams.get("name");
  if (!name) return NextResponse.json({ error: "Param ?name= required" }, { status: 400 });

  const player = await prisma.player.findFirst({
    where: { displayName: { contains: name, mode: "insensitive" } },
    select: { id: true, displayName: true, userId: true },
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
