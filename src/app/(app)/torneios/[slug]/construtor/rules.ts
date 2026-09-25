// Núcleo puro/testável da regra do modo Construtor: dada a ordem das partidas do
// alvo, os decks já escolhidos por partida e a partida atual, resolve
// espera (Jogo 2 aguarda Jogo 1), decks usados e decks disponíveis.

export function computePickAvailability(
  orderedMatchIds: string[],
  currentMatchId: string,
  pickByMatch: Map<string, string>,
  deckIds: string[],
): { gameIndex: number; waiting: boolean; usedDeckIds: string[]; availableDeckIds: string[]; currentPick: string | null } {
  const gameIndex = orderedMatchIds.indexOf(currentMatchId);
  const previous = gameIndex > 0 ? orderedMatchIds.slice(0, gameIndex) : [];
  const waiting = previous.some((id) => !pickByMatch.has(id));
  const usedDeckIds = previous.map((id) => pickByMatch.get(id)).filter((id): id is string => Boolean(id));
  const availableDeckIds = deckIds.filter((id) => !usedDeckIds.includes(id));
  return { gameIndex, waiting, usedDeckIds, availableDeckIds, currentPick: pickByMatch.get(currentMatchId) ?? null };
}
