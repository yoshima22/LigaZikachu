import { publishLeagueTicker } from "@/lib/league-ticker";

type MatchAnnouncement = {
  id: string;
  playerA: { displayName: string };
  playerB: { displayName: string } | null;
  roundLabel: string | null;
  tournamentWeek: { weekNumber: number; tournament: { slug: string; name: string } } | null;
};

function matchHref(match: MatchAnnouncement) {
  return match.tournamentWeek
    ? `/torneios/${match.tournamentWeek.tournament.slug}/semanas/${match.tournamentWeek.weekNumber}/partidas`
    : "/torneios";
}

export async function announceTournamentResult(
  match: MatchAnnouncement,
  winnerId: string,
  playerAId: string,
  kind: "REGISTERED" | "CORRECTED",
) {
  const winner = winnerId === playerAId ? match.playerA.displayName : match.playerB?.displayName ?? "Vencedor";
  const loser = winnerId === playerAId ? match.playerB?.displayName ?? "Adversário" : match.playerA.displayName;
  const tournament = match.tournamentWeek?.tournament.name ?? "o torneio";
  const round = match.roundLabel ? ` · ${match.roundLabel}` : "";
  return publishLeagueTicker({
    type: kind === "CORRECTED" ? "TOURNAMENT_RESULT_CORRECTED" : "TOURNAMENT_RESULT",
    eventKey: `tournament:${match.id}:${kind.toLowerCase()}:${kind === "CORRECTED" ? winnerId : "initial"}`,
    message: kind === "CORRECTED"
      ? `🛠️ O Professor Enguiça conferiu a papelada: o resultado de ${winner} contra ${loser} em ${tournament}${round} foi corrigido. A classificação já considera a revisão.`
      : `🏆 Resultado registrado em ${tournament}${round}: ${winner} venceu ${loser}. O Professor Enguiça já colocou a prancheta para trabalhar!`,
    href: matchHref(match),
    priority: kind === "CORRECTED" ? 5 : 2,
    ttlHours: 18,
  });
}

export async function announceTournamentDispute(match: MatchAnnouncement) {
  const tournament = match.tournamentWeek?.tournament.name ?? "o torneio";
  return publishLeagueTicker({
    type: "TOURNAMENT_RESULT_REVIEW",
    eventKey: `tournament:${match.id}:review`,
    message: `📋 Atenção na mesa do juiz: o resultado de ${match.playerA.displayName} contra ${match.playerB?.displayName ?? "Adversário"} em ${tournament} precisa de correção. O Professor Enguiça está revisando o registro.`,
    href: matchHref(match),
    priority: 6,
    ttlHours: 18,
  });
}
