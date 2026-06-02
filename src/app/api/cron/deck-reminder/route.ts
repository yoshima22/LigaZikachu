/**
 * Cron job — lembrete de envio de deck
 *
 * Disparado pelo Vercel Cron Jobs (vercel.json) diariamente às 12:00 UTC (09:00 BRT).
 * Também pode ser chamado manualmente via admin com o header Authorization correto.
 *
 * Lógica:
 *   1. Busca semanas de torneio cujo deckLockAt está entre AGORA e AGORA+24h
 *   2. Para cada semana, identifica jogadores com partidas pendentes e sem deck enviado
 *   3. Envia um e-mail de lembrete para cada jogador elegível
 *
 * Segurança: verifica Authorization: Bearer {CRON_SECRET}
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDeckReminderEmail } from "@/lib/email";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://liga-zikachu.vercel.app";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // bloqueia se não configurado
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now   = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  try {
    // Busca semanas com prazo de deck nas próximas 24 horas
    const weeks = await prisma.tournamentWeek.findMany({
      where: {
        requiresDeckSubmission: true,
        deckLockAt: { gt: now, lte: in24h },
        tournament: { status: "IN_PROGRESS" },
      },
      select: {
        id: true,
        weekNumber: true,
        label: true,
        deckLockAt: true,
        tournament: { select: { name: true, slug: true } },
        // Partidas pendentes (não confirmadas, não canceladas, não bye)
        matches: {
          where: {
            status: { notIn: ["CONFIRMED", "CANCELLED"] },
            isBye: false,
            playerBId: { not: null },
          },
          select: {
            id: true,
            scheduledAt: true,
            playerA: {
              select: {
                id: true,
                displayName: true,
                user: { select: { email: true } },
              },
            },
            playerB: {
              select: {
                id: true,
                displayName: true,
                user: { select: { email: true } },
              },
            },
          },
        },
        // IDs dos jogadores que já enviaram deck nesta semana
        deckSubmissions: {
          select: { playerId: true },
        },
      },
    });

    const results: Array<{ email: string; week: string; status: string }> = [];

    for (const week of weeks) {
      const submittedIds = new Set(week.deckSubmissions.map((d) => d.playerId));
      const weekLabel    = week.label ?? `Semana ${week.weekNumber}`;
      const deckLink     = `${APP_URL}/torneios/${week.tournament.slug}/semanas/${week.weekNumber}`;
      // Data de referência: deckLockAt da semana
      const matchDate = week.deckLockAt!;

      for (const match of week.matches) {
        const pairs = [
          { player: match.playerA, opponent: match.playerB },
          { player: match.playerB, opponent: match.playerA },
        ] as const;

        for (const { player, opponent } of pairs) {
          if (!player || !opponent) continue;
          if (submittedIds.has(player.id)) continue; // já enviou
          if (!player.user.email) continue;          // sem email cadastrado

          const { error } = await sendDeckReminderEmail({
            to:             player.user.email,
            playerName:     player.displayName,
            opponentName:   opponent.displayName,
            matchDate:      match.scheduledAt ?? matchDate,
            tournamentName: week.tournament.name,
            weekLabel,
            deckLink,
          });

          results.push({
            email:  player.user.email,
            week:   weekLabel,
            status: error ? `erro: ${error}` : "enviado",
          });
        }
      }
    }

    const sent   = results.filter((r) => r.status === "enviado").length;
    const errors = results.filter((r) => r.status !== "enviado").length;

    console.log(`[DeckReminder] ${sent} enviados, ${errors} erros`, results);

    return NextResponse.json({
      ok: true,
      weeksChecked: weeks.length,
      emailsSent:   sent,
      errors,
      details:      results,
    });
  } catch (err) {
    console.error("[DeckReminder] Erro:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
