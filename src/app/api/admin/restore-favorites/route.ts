/**
 * Restaura visibilidade: jogadores com 0 favoritos/equipados têm
 * os 6 mascotes de maior nível marcados como favoritos.
 *
 * GET /api/admin/restore-favorites          → apenas relatório (dry-run)
 * POST /api/admin/restore-favorites         → aplica a correção
 * POST /api/admin/restore-favorites?player=Erick  → só para um jogador
 *
 * Acesso: sessão de admin logado no site.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FAVORITES = 6;

async function checkAdmin() {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  return role === Role.ADMIN || role === Role.SUPER_ADMIN;
}

/** GET — dry-run: mostra quem seria afetado sem alterar nada */
export async function GET(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "Unauthorized — faça login como admin" }, { status: 401 });
  }

  const playerName = req.nextUrl.searchParams.get("player");

  // Busca todos os mascotes de uma vez (ou só do jogador especificado)
  const playerFilter = playerName
    ? { displayName: { contains: playerName, mode: "insensitive" as const } }
    : undefined;

  const players = await prisma.player.findMany({
    where: playerFilter,
    select: {
      id: true,
      displayName: true,
      mascots: {
        select: { id: true, level: true, isFavorite: true, isEquipped: true },
        orderBy: { level: "desc" },
      },
    },
  });

  const affected = players
    .filter(p => {
      const hasFeatured = p.mascots.some(m => m.isFavorite || m.isEquipped);
      return !hasFeatured && p.mascots.length > 0;
    })
    .map(p => ({
      playerId: p.id,
      displayName: p.displayName,
      totalMascots: p.mascots.length,
      wouldFavorite: p.mascots.slice(0, MAX_FAVORITES).map(m => m.id),
    }));

  return NextResponse.json({
    dryRun: true,
    affectedPlayers: affected.length,
    players: affected,
  });
}

/** POST — aplica a correção */
export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "Unauthorized — faça login como admin" }, { status: 401 });
  }

  const playerName = req.nextUrl.searchParams.get("player");

  const playerFilter = playerName
    ? { displayName: { contains: playerName, mode: "insensitive" as const } }
    : undefined;

  const players = await prisma.player.findMany({
    where: playerFilter,
    select: {
      id: true,
      displayName: true,
      mascots: {
        select: { id: true, level: true, isFavorite: true, isEquipped: true },
        orderBy: { level: "desc" },
      },
    },
  });

  const toFix = players.filter(p => {
    const hasFeatured = p.mascots.some(m => m.isFavorite || m.isEquipped);
    return !hasFeatured && p.mascots.length > 0;
  });

  if (toFix.length === 0) {
    return NextResponse.json({
      ok: true,
      fixed: 0,
      message: playerName
        ? `Jogador "${playerName}" não precisa de correção (já tem favoritos ou não tem mascotes).`
        : "Nenhum jogador precisa de correção.",
    });
  }

  const results = [];
  for (const p of toFix) {
    const top6 = p.mascots.slice(0, MAX_FAVORITES).map(m => m.id);
    await prisma.mascot.updateMany({
      where: { id: { in: top6 } },
      data: { isFavorite: true },
    });
    results.push({
      playerId: p.id,
      displayName: p.displayName,
      totalMascots: p.mascots.length,
      favorited: top6.length,
      mascotIds: top6,
    });
  }

  console.log(`[restore-favorites] Marcou favoritos para ${results.length} jogadores.`);

  return NextResponse.json({
    ok: true,
    fixed: results.length,
    players: results,
  });
}
