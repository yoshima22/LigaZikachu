/**
 * Diagnóstico raw de todos os mascotes e expedições de um jogador.
 * GET /api/admin/mascot-debug?player=Nakaima
 *
 * Também aceita ?nuke=<mascotId> para deletar TODAS as expedições
 * de um mascote e forçar estado totalmente limpo.
 * POST /api/admin/mascot-debug?nuke=<mascotId>
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

async function checkAdmin() {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  return role === Role.ADMIN || role === Role.SUPER_ADMIN;
}

export async function GET(req: NextRequest) {
  if (!(await checkAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const name = req.nextUrl.searchParams.get("player");
  if (!name) return NextResponse.json({ error: "?player= obrigatório" }, { status: 400 });

  const player = await prisma.player.findFirst({
    where: { displayName: { contains: name, mode: "insensitive" } },
    select: { id: true, displayName: true },
  });
  if (!player) return NextResponse.json({ error: "Jogador não encontrado" }, { status: 404 });

  const mascots = await prisma.mascot.findMany({
    where: { playerId: player.id },
    select: {
      id: true, pokemonId: true, nickname: true, level: true,
      isEquipped: true, isFavorite: true, isShiny: true,
      arenaState: true, bazarListed: true,
      injuredAt: true, restingUntil: true,
      mood: true, happiness: true,
      expeditions: {
        select: { id: true, status: true, startedAt: true, finishAt: true, rewardJson: true },
        orderBy: { startedAt: "desc" },
      },
      buffs: {
        where: { expiresAt: { gt: new Date() } },
        select: { id: true, type: true, expiresAt: true },
      },
    },
    orderBy: [{ isEquipped: "desc" }, { isFavorite: "desc" }, { level: "desc" }],
  });

  const now = new Date();

  return NextResponse.json({
    player,
    now: now.toISOString(),
    mascots: mascots.map(m => ({
      id: m.id,
      name: m.nickname ?? `Pokémon #${m.pokemonId}`,
      pokemonId: m.pokemonId,
      level: m.level,
      isEquipped: m.isEquipped,
      isFavorite: m.isFavorite,
      isShiny: m.isShiny,
      arenaState: m.arenaState,
      bazarListed: m.bazarListed,
      injuredAt: m.injuredAt,
      restingUntil: m.restingUntil,
      mood: m.mood,
      happiness: m.happiness,
      activeBuffs: m.buffs.length,
      expeditions: m.expeditions.map(e => ({
        id: e.id,
        status: e.status,
        startedAt: e.startedAt,
        finishAt: e.finishAt,
        readyToCollect: e.status === "ACTIVE" && e.finishAt <= now,
        minutesLeft: e.status === "ACTIVE" && e.finishAt > now
          ? Math.ceil((e.finishAt.getTime() - now.getTime()) / 60000)
          : null,
        rewardJson: e.rewardJson,
      })),
    })),
  });
}

/** POST ?nuke=<mascotId> — deleta TODAS as expedições e faz reset nuclear do estado */
export async function POST(req: NextRequest) {
  if (!(await checkAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const mascotId = req.nextUrl.searchParams.get("nuke");
  if (!mascotId) return NextResponse.json({ error: "?nuke=<mascotId> obrigatório" }, { status: 400 });

  const mascot = await prisma.mascot.findUnique({
    where: { id: mascotId },
    select: {
      id: true, pokemonId: true, nickname: true,
      expeditions: { select: { id: true, status: true } },
    },
  });
  if (!mascot) return NextResponse.json({ error: "Mascote não encontrado" }, { status: 404 });

  // Deleta TODAS as expedições (não só marca como CLAIMED — remove do DB)
  const deletedExps = await prisma.mascotExpedition.deleteMany({
    where: { mascotId },
  });

  // Deleta buffs expirados e limpa estado do mascote completamente
  await prisma.mascotBuff.deleteMany({
    where: { mascotId, expiresAt: { lt: new Date() } },
  });

  await prisma.mascot.update({
    where: { id: mascotId },
    data: {
      arenaState:   "FREE",
      isEquipped:   false,
      injuredAt:    null,
      restingUntil: null,
      bazarListed:  false,
    },
  });

  const name = mascot.nickname ?? `Pokémon #${mascot.pokemonId}`;
  console.log(`[mascot-debug] NUKE ${name} (${mascotId}): ${deletedExps.count} expedições deletadas`);

  return NextResponse.json({
    ok: true,
    mascotId,
    name,
    expeditionsDeleted: deletedExps.count,
    previousExpeditions: mascot.expeditions.map(e => ({ id: e.id, status: e.status })),
    message: `Estado do ${name} completamente resetado. Expedições deletadas permanentemente.`,
  });
}
