import { prisma } from "@/lib/prisma";

export type SpecStreamView = {
  id: string;
  matchLabel: string;       // "Jogador 1 Vs Jogador 2"
  weekTitle: string;        // "Semana 3" ou o rótulo do dia/semana
  title: string;            // "Torneio - Semana - A Vs B"
  tournamentName: string;
  tournamentSlug: string | null;
  broadcasterName: string;
  startedAt: Date | null;
};

// Resolve nomes de partida (A vs B), torneio e broadcaster para exibição.
// As referências são texto simples no SpecStream (sem relação), então buscamos
// os nomes em lote aqui.
export async function enrichSpecStreams(
  rows: Array<{ id: string; matchId: string; tournamentId: string; broadcasterUserId: string; startedAt?: Date | null }>,
): Promise<SpecStreamView[]> {
  if (rows.length === 0) return [];
  const matchIds = [...new Set(rows.map((r) => r.matchId))];
  const tournamentIds = [...new Set(rows.map((r) => r.tournamentId))];
  const userIds = [...new Set(rows.map((r) => r.broadcasterUserId))];

  const [matches, tournaments, users] = await Promise.all([
    prisma.match.findMany({
      where: { id: { in: matchIds } },
      select: {
        id: true,
        playerA: { select: { displayName: true } },
        playerB: { select: { displayName: true } },
        tournamentWeek: { select: { label: true, weekNumber: true } },
      },
    }),
    prisma.tournament.findMany({ where: { id: { in: tournamentIds } }, select: { id: true, name: true, slug: true } }),
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
  ]);

  const matchMap = new Map(matches.map((m) => [m.id, {
    label: `${m.playerA?.displayName ?? "?"} Vs ${m.playerB?.displayName ?? "Folga"}`,
    weekTitle: m.tournamentWeek?.label?.trim()
      || (typeof m.tournamentWeek?.weekNumber === "number" ? `Semana ${m.tournamentWeek.weekNumber}` : "Rodada"),
  }]));
  const tourMap = new Map(tournaments.map((t) => [t.id, { name: t.name, slug: t.slug }]));
  const userMap = new Map(users.map((u) => [u.id, u.name ?? "—"]));

  return rows.map((r) => {
    const m = matchMap.get(r.matchId);
    const matchLabel = m?.label ?? "Partida";
    const weekTitle = m?.weekTitle ?? "Rodada";
    const tournamentName = tourMap.get(r.tournamentId)?.name ?? "Torneio";
    return {
      id: r.id,
      matchLabel,
      weekTitle,
      title: `${tournamentName} - ${weekTitle} - ${matchLabel}`,
      tournamentName,
      tournamentSlug: tourMap.get(r.tournamentId)?.slug ?? null,
      broadcasterName: userMap.get(r.broadcasterUserId) ?? "—",
      startedAt: r.startedAt ?? null,
    };
  });
}
