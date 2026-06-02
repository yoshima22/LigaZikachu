"use server";

import { requireAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { sendDeckReminderEmail } from "@/lib/email";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://liga-zikachu.vercel.app";

export async function triggerDeckReminder(dryRun = false): Promise<
  | { weeksChecked: number; emailsSent: number; simulated: number; errors: number; details: Array<{ email: string; week: string; status: string }>; dryRun: boolean }
  | { error: string }
> {
  try {
    await requireAdmin();

    const now   = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const weeks = await prisma.tournamentWeek.findMany({
      where: {
        deckLockAt: { gt: now, lte: in24h },
        tournament: { status: "IN_PROGRESS", requiresDeckSubmission: true },
      },
      select: {
        id: true,
        weekNumber: true,
        label: true,
        deckLockAt: true,
        tournament: { select: { name: true, slug: true } },
        matches: {
          where: {
            status: { notIn: ["CONFIRMED", "CANCELED"] },
            isBye: false,
            playerBId: { not: null },
          },
          select: {
            id: true,
            scheduledAt: true,
            playerA: { select: { id: true, displayName: true, user: { select: { email: true } } } },
            playerB: { select: { id: true, displayName: true, user: { select: { email: true } } } },
          },
        },
        deckSubmissions: { select: { playerId: true } },
      },
    });

    const details: Array<{ email: string; week: string; status: string }> = [];

    for (const week of weeks) {
      const submittedIds = new Set(week.deckSubmissions.map((d) => d.playerId));
      const weekLabel    = week.label ?? `Semana ${week.weekNumber}`;
      const deckLink     = `${APP_URL}/torneios/${week.tournament.slug}/semanas/${week.weekNumber}`;
      const matchDate    = week.deckLockAt!;

      for (const match of week.matches) {
        const pairs = [
          { player: match.playerA, opponent: match.playerB },
          { player: match.playerB, opponent: match.playerA },
        ] as const;

        for (const { player, opponent } of pairs) {
          if (!player || !opponent) continue;
          if (submittedIds.has(player.id)) continue;
          if (!player.user.email) continue;

          if (dryRun) {
            details.push({ email: player.user.email, week: weekLabel, status: "simulado" });
            continue;
          }

          const { error } = await sendDeckReminderEmail({
            to:             player.user.email,
            playerName:     player.displayName,
            opponentName:   opponent.displayName,
            matchDate:      match.scheduledAt ?? matchDate,
            tournamentName: week.tournament.name,
            weekLabel,
            deckLink,
          });

          details.push({
            email:  player.user.email,
            week:   weekLabel,
            status: error ? `erro: ${error}` : "enviado",
          });
        }
      }
    }

    return {
      weeksChecked: weeks.length,
      emailsSent:   dryRun ? 0 : details.filter((d) => d.status === "enviado").length,
      simulated:    dryRun ? details.length : 0,
      errors:       details.filter((d) => d.status.startsWith("erro")).length,
      details,
      dryRun,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ── Envio de teste para um jogador específico ─────────────────────────────────

export async function sendTestDeckReminder(
  playerId: string
): Promise<{ ok: boolean; to: string; usedRealMatch: boolean; error?: string }> {
  try {
    await requireAdmin();

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        displayName: true,
        user: { select: { email: true } },
      },
    });
    if (!player)            return { ok: false, to: "", usedRealMatch: false, error: "Jogador não encontrado." };
    if (!player.user.email) return { ok: false, to: "", usedRealMatch: false, error: "Este jogador não tem e-mail cadastrado." };

    const now   = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // Tenta encontrar uma partida real pendente do jogador nas próximas 48h
    const realMatch = await prisma.match.findFirst({
      where: {
        OR: [{ playerAId: playerId }, { playerBId: playerId }],
        status: { notIn: ["CONFIRMED", "CANCELED"] },
        isBye: false,
        playerBId: { not: null },
        tournamentWeekId: { not: null },
      },
      include: {
        playerA:        { select: { id: true, displayName: true } },
        playerB:        { select: { id: true, displayName: true } },
        tournamentWeek: {
          select: {
            weekNumber: true, label: true, deckLockAt: true,
            tournament: { select: { name: true, slug: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    let emailParams: Parameters<typeof sendDeckReminderEmail>[0];
    let usedRealMatch = false;

    if (realMatch?.tournamentWeek) {
      const week     = realMatch.tournamentWeek;
      const opponent = realMatch.playerAId === playerId ? realMatch.playerB : realMatch.playerA;
      usedRealMatch  = true;
      emailParams    = {
        to:             player.user.email,
        playerName:     player.displayName,
        opponentName:   opponent?.displayName ?? "Adversário",
        matchDate:      realMatch.scheduledAt ?? week.deckLockAt ?? in48h,
        tournamentName: week.tournament.name,
        weekLabel:      week.label ?? `Semana ${week.weekNumber}`,
        deckLink:       `${APP_URL}/torneios/${week.tournament.slug}/semanas/${week.weekNumber}`,
      };
    } else {
      // Sem partida real — usa dados de exemplo para testar o template
      const anyTournament = await prisma.tournament.findFirst({
        where: { status: "IN_PROGRESS" },
        select: { name: true, slug: true },
      });
      emailParams = {
        to:             player.user.email,
        playerName:     player.displayName,
        opponentName:   "Adversário de Teste",
        matchDate:      new Date(now.getTime() + 6 * 60 * 60 * 1000),
        tournamentName: anyTournament?.name ?? "Liga Zikachu",
        weekLabel:      "Semana de Teste",
        deckLink:       anyTournament
          ? `${APP_URL}/torneios/${anyTournament.slug}`
          : `${APP_URL}/torneios`,
      };
    }

    const { error } = await sendDeckReminderEmail(emailParams);
    if (error) return { ok: false, to: player.user.email, usedRealMatch, error };

    return { ok: true, to: player.user.email, usedRealMatch };
  } catch (err) {
    return { ok: false, to: "", usedRealMatch: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
