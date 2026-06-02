"use server";

import { requireAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { sendDeckReminderEmail } from "@/lib/email";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://liga-zikachu.vercel.app";

export async function triggerDeckReminder(dryRun = false): Promise<
  | { weeksChecked: number; emailsSent: number; errors: number; details: Array<{ email: string; week: string; status: string }> }
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
