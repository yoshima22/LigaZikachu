/**
 * Correção única: jogadores com mais de 6 mascotes favoritos perdem visibilidade.
 * Este endpoint remove isFavorite dos excedentes (mantém os 6 de maior nível)
 * e os devolve ao banco (isFavorite: false).
 *
 * Executar uma vez:
 *   curl -X POST "https://seu-dominio.vercel.app/api/admin/fix-favorites" \
 *     -H "Authorization: Bearer <CRON_SECRET>"
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FAVORITES = 6;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Busca todos os mascotes favoritos agrupados por jogador
  const allFavorites = await prisma.mascot.findMany({
    where: { isFavorite: true },
    select: { id: true, playerId: true, level: true, isEquipped: true },
    orderBy: [{ level: "desc" }, { id: "asc" }],
  });

  // 2. Agrupa por playerId
  const byPlayer = new Map<string, typeof allFavorites>();
  for (const m of allFavorites) {
    const arr = byPlayer.get(m.playerId) ?? [];
    arr.push(m);
    byPlayer.set(m.playerId, arr);
  }

  // 3. Identifica os excedentes (posição > MAX_FAVORITES)
  const toUnfavorite: string[] = [];
  for (const [, mascots] of byPlayer) {
    if (mascots.length <= MAX_FAVORITES) continue;
    // Mantém: equipado primeiro, depois maiores níveis (já ordenado por level desc)
    const sorted = [...mascots].sort((a, b) => {
      if (a.isEquipped && !b.isEquipped) return -1;
      if (!a.isEquipped && b.isEquipped) return 1;
      return b.level - a.level;
    });
    const excess = sorted.slice(MAX_FAVORITES);
    toUnfavorite.push(...excess.map(m => m.id));
  }

  if (toUnfavorite.length === 0) {
    return NextResponse.json({ ok: true, fixed: 0, message: "Nenhum excedente encontrado." });
  }

  // 4. Remove isFavorite dos excedentes — voltam ao banco
  const result = await prisma.mascot.updateMany({
    where: { id: { in: toUnfavorite } },
    data: { isFavorite: false },
  });

  console.log(`[fix-favorites] Removido isFavorite de ${result.count} mascotes (${toUnfavorite.length} identificados).`);

  return NextResponse.json({
    ok: true,
    fixed: result.count,
    ids: toUnfavorite,
    playersAffected: [...byPlayer.entries()]
      .filter(([, m]) => m.length > MAX_FAVORITES)
      .map(([pid, m]) => ({ playerId: pid, totalFavorites: m.length, removed: m.length - MAX_FAVORITES })),
  });
}
