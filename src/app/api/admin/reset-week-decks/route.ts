/**
 * POST /api/admin/reset-week-decks?tournamentSlug=segunda-edicao&weekNumber=8
 * Remove todos os DeckSubmissions de uma semana específica e limpa as refs nas partidas.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET: aceita via browser (mesmo comportamento do POST)
export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tournamentSlug = searchParams.get("tournamentSlug");
  const weekNumber = parseInt(searchParams.get("weekNumber") ?? "0");

  if (!tournamentSlug || !weekNumber) {
    return NextResponse.json({ error: "Parâmetros obrigatórios: tournamentSlug, weekNumber" }, { status: 400 });
  }

  const week = await prisma.tournamentWeek.findFirst({
    where: { weekNumber, tournament: { slug: tournamentSlug } },
    select: { id: true }
  });

  if (!week) {
    return NextResponse.json({ error: `Semana ${weekNumber} do torneio '${tournamentSlug}' não encontrada.` }, { status: 404 });
  }

  // Limpa refs nas partidas
  await prisma.$transaction([
    prisma.match.updateMany({
      where: { tournamentWeekId: week.id },
      data: { playerADeckSubmissionId: null, playerBDeckSubmissionId: null }
    }),
    prisma.deckSubmission.deleteMany({
      where: { tournamentWeekId: week.id }
    })
  ]);

  const count = await prisma.deckSubmission.count({ where: { tournamentWeekId: week.id } });

  return NextResponse.json({
    success: true,
    message: `✓ Todos os decks da Semana ${weekNumber} de '${tournamentSlug}' foram removidos. Restantes: ${count}.`
  });
}
