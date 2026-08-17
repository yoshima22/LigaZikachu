import { prisma } from "@/lib/prisma";

export type SpecStreamView = {
  id: string;
  matchLabel: string;
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
      select: { id: true, playerA: { select: { displayName: true } }, playerB: { select: { displayName: true } } },
    }),
    prisma.tournament.findMany({ where: { id: { in: tournamentIds } }, select: { id: true, name: true, slug: true } }),
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
  ]);

  const matchMap = new Map(matches.map((m) => [m.id, `${m.playerA?.displayName ?? "?"} vs ${m.playerB?.displayName ?? "Folga"}`]));
  const tourMap = new Map(tournaments.map((t) => [t.id, { name: t.name, slug: t.slug }]));
  const userMap = new Map(users.map((u) => [u.id, u.name ?? "—"]));

  return rows.map((r) => ({
    id: r.id,
    matchLabel: matchMap.get(r.matchId) ?? "Partida",
    tournamentName: tourMap.get(r.tournamentId)?.name ?? "Torneio",
    tournamentSlug: tourMap.get(r.tournamentId)?.slug ?? null,
    broadcasterName: userMap.get(r.broadcasterUserId) ?? "—",
    startedAt: r.startedAt ?? null,
  }));
}
