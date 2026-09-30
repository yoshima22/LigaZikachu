import { prisma } from "@/lib/prisma";

export type DeckSendRow = { id: string; name: string; sent: number };

/**
 * Quem já enviou deck no dia (público). Devolve apenas contagem por jogador —
 * nunca nome do deck, lista, arquétipo ou horário, para não revelar nada antes
 * do fechamento.
 * - Modo Construtor Misterioso: cada jogador registra 3 decks (ConstrutorDeck).
 * - Demais modos: DeckSubmission (rejeitados não contam; listas iguais contam 1).
 */
export async function loadDeckSendStatus(week: { id: string; mode: string }, tournamentId: string) {
  const isConstrutor = week.mode === "CONSTRUTOR_MISTERIOSO";
  const sentByPlayer = new Map<string, number>();
  const names = new Map<string, string>();

  if (isConstrutor) {
    const decks = await prisma.construtorDeck.groupBy({ by: ["playerId"], where: { tournamentWeekId: week.id }, _count: { _all: true } });
    for (const d of decks) sentByPlayer.set(d.playerId, d._count._all);
  } else {
    const subs = await prisma.deckSubmission.findMany({
      where: { tournamentWeekId: week.id, status: { not: "REJECTED" } },
      select: { playerId: true, deckList: true, player: { select: { displayName: true } } },
    });
    const lists = new Map<string, Set<string>>();
    for (const s of subs) {
      names.set(s.playerId, s.player.displayName);
      const set = lists.get(s.playerId) ?? new Set<string>();
      set.add(s.deckList.trim());
      lists.set(s.playerId, set);
    }
    for (const [playerId, set] of lists) sentByPlayer.set(playerId, set.size);
  }

  const registered = await prisma.tournamentRegistration.findMany({
    where: { tournamentId, status: { in: ["APPROVED", "PENDING"] } },
    select: { player: { select: { id: true, displayName: true } } },
  });
  const rows = new Map<string, DeckSendRow>();
  for (const r of registered) rows.set(r.player.id, { id: r.player.id, name: r.player.displayName, sent: sentByPlayer.get(r.player.id) ?? 0 });

  // Quem enviou mas não está na lista de inscritos ainda aparece.
  const missing = [...sentByPlayer.keys()].filter((id) => !rows.has(id));
  if (missing.length > 0) {
    const players = await prisma.player.findMany({ where: { id: { in: missing } }, select: { id: true, displayName: true } });
    for (const p of players) rows.set(p.id, { id: p.id, name: p.displayName, sent: sentByPlayer.get(p.id) ?? 0 });
  }

  const list = [...rows.values()].sort((a, b) => Number(b.sent > 0) - Number(a.sent > 0) || a.name.localeCompare(b.name, "pt-BR"));
  return { rows: list, sentCount: list.filter((r) => r.sent > 0).length, expectedPerPlayer: isConstrutor ? 3 : null };
}
