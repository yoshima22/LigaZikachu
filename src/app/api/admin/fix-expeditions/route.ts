/**
 * Força a conclusão de expedições travadas sem perda de recompensa.
 *
 * GET  /api/admin/fix-expeditions?player=Nakaima  → relatório (dry-run)
 * POST /api/admin/fix-expeditions?player=Nakaima  → aplica
 *
 * Acesso: sessão de admin logado no site.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Role } from "@prisma/client";
import { skipExpedition, claimExpedition } from "@/lib/mascot";

export const runtime = "nodejs";
export const maxDuration = 60;

async function checkAdmin() {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  return role === Role.ADMIN || role === Role.SUPER_ADMIN;
}

async function findPlayer(name: string) {
  return prisma.player.findFirst({
    where: { displayName: { contains: name, mode: "insensitive" } },
    select: { id: true, displayName: true },
  });
}

async function getActiveExpeditions(playerId: string) {
  return prisma.mascotExpedition.findMany({
    where: { status: "ACTIVE", mascot: { playerId } },
    select: {
      id: true,
      finishAt: true,
      startedAt: true,
      rewardJson: true,
      mascot: { select: { id: true, pokemonId: true, nickname: true } },
    },
    orderBy: { startedAt: "asc" },
  });
}

/** GET — dry-run: mostra as expedições sem mexer em nada */
export async function GET(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "Unauthorized — faça login como admin" }, { status: 401 });
  }

  const name = req.nextUrl.searchParams.get("player");
  if (!name) return NextResponse.json({ error: "Parâmetro ?player= obrigatório" }, { status: 400 });

  const player = await findPlayer(name);
  if (!player) return NextResponse.json({ error: `Jogador "${name}" não encontrado` }, { status: 404 });

  const expeditions = await getActiveExpeditions(player.id);
  const now = new Date();

  return NextResponse.json({
    dryRun: true,
    player: { id: player.id, displayName: player.displayName },
    activeExpeditions: expeditions.length,
    expeditions: expeditions.map(e => ({
      id: e.id,
      mascot: e.mascot.nickname ?? `Pokémon #${e.mascot.pokemonId}`,
      startedAt: e.startedAt,
      finishAt: e.finishAt,
      alreadyDone: e.finishAt <= now,
      rewardJson: e.rewardJson,
    })),
  });
}

/** POST — aplica: força skip + claim em todas as expedições ACTIVE */
export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "Unauthorized — faça login como admin" }, { status: 401 });
  }

  const name = req.nextUrl.searchParams.get("player");
  if (!name) return NextResponse.json({ error: "Parâmetro ?player= obrigatório" }, { status: 400 });

  const player = await findPlayer(name);
  if (!player) return NextResponse.json({ error: `Jogador "${name}" não encontrado` }, { status: 404 });

  const expeditions = await getActiveExpeditions(player.id);
  if (expeditions.length === 0) {
    return NextResponse.json({
      ok: true,
      fixed: 0,
      message: `${player.displayName} não tem expedições ativas travadas.`,
    });
  }

  const results: { expeditionId: string; mascot: string; reward: unknown; error?: string }[] = [];

  for (const exp of expeditions) {
    try {
      // 1. Força finishAt para 1s atrás (se ainda não terminou)
      if (exp.finishAt > new Date()) {
        await skipExpedition(exp.id);
      }

      // 2. Coleta a recompensa normalmente — toda lógica de EXP, itens, eggs permanece intacta
      const { reward } = await claimExpedition(player.id, exp.id);

      results.push({
        expeditionId: exp.id,
        mascot: exp.mascot.nickname ?? `Pokémon #${exp.mascot.pokemonId}`,
        reward,
      });
    } catch (err) {
      results.push({
        expeditionId: exp.id,
        mascot: exp.mascot.nickname ?? `Pokémon #${exp.mascot.pokemonId}`,
        reward: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const fixed  = results.filter(r => !r.error).length;
  const failed = results.filter(r =>  r.error).length;

  console.log(`[fix-expeditions] ${player.displayName}: ${fixed} concluídas, ${failed} falhas.`);

  return NextResponse.json({
    ok: failed === 0,
    player: { id: player.id, displayName: player.displayName },
    fixed,
    failed,
    results,
  });
}
