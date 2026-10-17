"use server";

import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/auth/permissions";
import type { ReplayData } from "@/components/replay/replay-canvas";
import { buildModernReplay, type ReplayLineMon, type ReplayLogEntry } from "@/lib/replay-modern";

export type LeagueReplayOption = { id: string; label: string };

/** Jogos recentes da liga semanal que têm replay gravado. */
export async function listLeagueReplays(): Promise<LeagueReplayOption[]> {
  await requirePlatformAdmin();
  const matches = await prisma.weeklyMascotLeagueMatch.findMany({
    where: { status: "RESOLVED" },
    orderBy: { resolvedAt: "desc" },
    take: 80,
    select: {
      id: true, roundNumber: true, battleDate: true, battleSlot: true,
      playerAId: true, playerBId: true, winnerId: true,
      league: { select: { weekKey: true } },
    },
  });
  const ids = [...new Set(matches.flatMap((m) => [m.playerAId, m.playerBId].filter(Boolean) as string[]))];
  const players = await prisma.player.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true } });
  const nameOf = new Map(players.map((p) => [p.id, p.displayName ?? "?"]));
  return matches.map((m) => {
    const a = nameOf.get(m.playerAId) ?? "?";
    const b = m.playerBId ? nameOf.get(m.playerBId) ?? "?" : "BYE";
    return { id: m.id, label: `${m.league.weekKey} · R${m.roundNumber} S${m.battleSlot} · ${a} × ${b}` };
  });
}

/** Normaliza um jogo real (lineups + turnLog) para o formato animado do Lab. */
export async function getLeagueReplay(matchId: string): Promise<ReplayData | null> {
  await requirePlatformAdmin();
  const m = await prisma.weeklyMascotLeagueMatch.findUnique({
    where: { id: matchId },
    select: { resultJson: true, replayJson: true, winnerId: true, isDraw: true },
  });
  if (!m?.resultJson || !m?.replayJson) return null;
  const res = m.resultJson as { lineupA?: ReplayLineMon[]; lineupB?: ReplayLineMon[] };
  const lineupA = res.lineupA ?? [], lineupB = res.lineupB ?? [];
  if (lineupA.length === 0 || lineupB.length === 0) return null;
  const log = m.replayJson as ReplayLogEntry[];
  let winnerName: string | null = m.isDraw ? "Empate" : null;
  if (m.winnerId) {
    const p = await prisma.player.findUnique({ where: { id: m.winnerId }, select: { displayName: true } });
    winnerName = p?.displayName ?? null;
  }
  return buildModernReplay(lineupA, lineupB, log, { winnerName });
}
