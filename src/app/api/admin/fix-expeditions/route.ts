/**
 * Diagnóstico e conserto de expedições travadas.
 *
 * GET  /api/admin/fix-expeditions?player=Nakaima        → relatório completo (dry-run)
 * POST /api/admin/fix-expeditions?player=Nakaima        → skip + claim com recompensa completa
 * POST /api/admin/fix-expeditions?player=Nakaima&force=1 → força status=CLAIMED direto no DB
 *                                                          (usa quando o claim normal falha)
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
  // Busca por nome exato primeiro, depois parcial
  const exact = await prisma.player.findFirst({
    where: { displayName: { equals: name, mode: "insensitive" } },
    select: { id: true, displayName: true },
  });
  if (exact) return exact;
  return prisma.player.findFirst({
    where: { displayName: { contains: name, mode: "insensitive" } },
    select: { id: true, displayName: true },
  });
}

async function getExpeditions(playerId: string, status?: string) {
  return prisma.mascotExpedition.findMany({
    where: {
      mascot: { playerId },
      ...(status ? { status: status as "ACTIVE" | "CLAIMED" } : {}),
    },
    select: {
      id: true,
      finishAt: true,
      startedAt: true,
      status: true,
      rewardJson: true,
      mascot: { select: { id: true, pokemonId: true, nickname: true, playerId: true } },
    },
    orderBy: { startedAt: "desc" },
    take: 50,
  });
}

/** GET — relatório completo: expedições ativas + últimas concluídas */
export async function GET(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "Unauthorized — faça login como admin" }, { status: 401 });
  }

  const name = req.nextUrl.searchParams.get("player");
  if (!name) return NextResponse.json({ error: "Parâmetro ?player= obrigatório" }, { status: 400 });

  const player = await findPlayer(name);
  if (!player) return NextResponse.json({ error: `Jogador "${name}" não encontrado` }, { status: 404 });

  const all = await getExpeditions(player.id);
  const now = new Date();

  const active  = all.filter(e => e.status === "ACTIVE");
  const claimed = all.filter(e => e.status === "CLAIMED").slice(0, 5);

  return NextResponse.json({
    dryRun: true,
    player: { id: player.id, displayName: player.displayName },
    activeExpeditions: active.length,
    active: active.map(e => ({
      id: e.id,
      mascotId: e.mascot.id,
      mascot: e.mascot.nickname ?? `Pokémon #${e.mascot.pokemonId}`,
      startedAt: e.startedAt,
      finishAt: e.finishAt,
      readyToCollect: e.finishAt <= now,
      minutesLeft: e.finishAt > now ? Math.ceil((e.finishAt.getTime() - now.getTime()) / 60000) : 0,
      rewardJson: e.rewardJson,
    })),
    recentClaimed: claimed.map(e => ({
      id: e.id,
      mascot: e.mascot.nickname ?? `Pokémon #${e.mascot.pokemonId}`,
      finishAt: e.finishAt,
      rewardJson: e.rewardJson,
    })),
    hint: active.length === 0
      ? "Nenhuma expedição ACTIVE encontrada. Se o jogador ainda vê expedições na tela, pode ser cache — mande-o dar F5."
      : active.some(e => e.finishAt > now)
        ? "Algumas expedições ainda não terminaram (minutesLeft > 0). Use POST para forçar mesmo assim."
        : "Todas prontas para coletar. Use POST para processar.",
  });
}

/** POST — aplica correção */
export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "Unauthorized — faça login como admin" }, { status: 401 });
  }

  const name  = req.nextUrl.searchParams.get("player");
  const force = req.nextUrl.searchParams.get("force") === "1";

  if (!name) return NextResponse.json({ error: "Parâmetro ?player= obrigatório" }, { status: 400 });

  const player = await findPlayer(name);
  if (!player) return NextResponse.json({ error: `Jogador "${name}" não encontrado` }, { status: 404 });

  const active = await getExpeditions(player.id, "ACTIVE");

  if (active.length === 0) {
    return NextResponse.json({
      ok: true,
      fixed: 0,
      message: `${player.displayName} não tem expedições ACTIVE. Se o problema persiste, peça para o jogador dar F5.`,
    });
  }

  // ── Modo force: marca CLAIMED direto sem rodar lógica de recompensa ───────
  if (force) {
    const ids = active.map(e => e.id);
    await prisma.mascotExpedition.updateMany({
      where: { id: { in: ids } },
      data: { status: "CLAIMED", rewardJson: { type: "NOTHING", forceClosed: true, adminNote: "fechado pelo admin sem recompensa por erro" } },
    });
    console.log(`[fix-expeditions] FORCE CLOSE: ${player.displayName} — ${ids.length} expedições.`);
    return NextResponse.json({
      ok: true,
      mode: "force",
      warning: "Expedições fechadas SEM recompensa (force=1). Use só como último recurso.",
      fixed: ids.length,
      ids,
    });
  }

  // ── Modo normal: skip + claim com recompensa ─────────────────────────────
  const results: { expeditionId: string; mascot: string; reward: unknown; error?: string }[] = [];

  for (const exp of active) {
    try {
      if (exp.finishAt > new Date()) {
        await skipExpedition(exp.id);
      }
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
    mode: "claim",
    player: { id: player.id, displayName: player.displayName },
    fixed,
    failed,
    results,
    nextStep: failed > 0
      ? "Houve erros no claim normal. Use POST?force=1 para forçar o fechamento (sem recompensa dos que falharam)."
      : undefined,
  });
}
