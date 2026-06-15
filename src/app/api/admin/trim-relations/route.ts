/**
 * Remove relações de mascotes que excedem o limite de 10 por mascote.
 *
 * GET  /api/admin/trim-relations   → dry-run: mostra quantas serão deletadas
 * POST /api/admin/trim-relations   → executa a limpeza
 *
 * Critério de retenção: top 10 por mascoteA ordenados por (relationshipScore DESC, updatedAt DESC)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const maxDuration = 60;

async function checkAdmin() {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  return role === Role.ADMIN || role === Role.SUPER_ADMIN;
}

async function findExcessIds() {
  // Busca todos os mascotAId que têm mais de 10 relações
  const counts = await prisma.mascotRelation.groupBy({
    by: ["mascotAId"],
    _count: { id: true },
    having: { id: { _count: { gt: 10 } } },
  });

  const toDelete: string[] = [];

  for (const { mascotAId } of counts) {
    // Pega os 10 primeiros a manter (score desc, updatedAt desc)
    const keep = await prisma.mascotRelation.findMany({
      where: { mascotAId },
      orderBy: [{ relationshipScore: "desc" }, { updatedAt: "desc" }],
      take: 10,
      select: { id: true },
    });
    const keepIds = new Set(keep.map(r => r.id));

    // Todos os outros são deletados
    const all = await prisma.mascotRelation.findMany({
      where: { mascotAId },
      select: { id: true },
    });
    for (const r of all) {
      if (!keepIds.has(r.id)) toDelete.push(r.id);
    }
  }

  return { toDelete, mascotCount: counts.length };
}

export async function GET() {
  if (!await checkAdmin()) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { toDelete, mascotCount } = await findExcessIds();
  return NextResponse.json({
    dry_run: true,
    mascots_above_limit: mascotCount,
    relations_to_delete: toDelete.length,
    message: `Faça POST nesta rota para deletar ${toDelete.length} relações excedentes de ${mascotCount} mascotes.`,
  });
}

export async function POST() {
  if (!await checkAdmin()) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { toDelete, mascotCount } = await findExcessIds();
  if (toDelete.length === 0) {
    return NextResponse.json({ deleted: 0, message: "Nenhuma relação excedente encontrada." });
  }

  const { count } = await prisma.mascotRelation.deleteMany({
    where: { id: { in: toDelete } },
  });

  return NextResponse.json({
    deleted: count,
    mascots_affected: mascotCount,
    message: `${count} relações deletadas de ${mascotCount} mascotes.`,
  });
}
