import Link from "next/link";
import { MatchStatus } from "@prisma/client";
import { BookOpen, CheckCircle2, Swords, Trophy } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeGlobalRanking } from "@/lib/ranking";
import { isDeckRegistrationLocked } from "@/lib/decks";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EditProfileForm } from "./_components/edit-profile-form";

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.user) return null;

  const player = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      displayName: true,
      ptcglNick: true,
      avatarUrl: true,
      deckSubmissions: {
        orderBy: { submittedAt: "desc" },
        take: 20,
        select: {
          id: true,
          deckName: true,
          archetype: true,
          status: true,
          tournament: { select: { name: true, slug: true } },
          tournamentWeek: {
            select: {
              weekNumber: true,
              status: true,
              deckLockAt: true,
              lockAt: true,
              endDate: true
            }
          }
        }
      },
      playerBadges: {
        include: {
          badge: {
            include: {
              tournament: {
                select: {
                  name: true,
                  slug: true,
                  season: { select: { name: true } }
                }
              }
            }
          }
        },
        orderBy: { awardedAt: "desc" }
      }
    },
  });

  if (!player) {
    return (
      <div className="space-y-6">
        <h1 className="font-pixel text-base text-[#FFCB05]">Perfil</h1>
        <Card className="p-6">
          <p className="text-slate-400">Perfil de jogador nao encontrado.</p>
        </Card>
      </div>
    );
  }

  const [ranking, recentMatches, dreamTeam] = await Promise.all([
    computeGlobalRanking(),
    prisma.match.findMany({
      where: {
        OR: [{ playerAId: player.id }, { playerBId: player.id }],
        status: MatchStatus.CONFIRMED
      },
      orderBy: { playedAt: "desc" },
      take: 5,
      include: {
        playerA: { select: { id: true, displayName: true } },
        playerB: { select: { id: true, displayName: true } },
        tournamentWeek: {
          select: {
            weekNumber: true,
            tournament: { select: { name: true, slug: true } }
          }
        }
      }
    }),
    prisma.playerSticker.findMany({
      where: { playerId: player.id, isFavorite: true },
      include: { card: { select: { nationalId: true, displayName: true, imageUrl: true, rarity: true } } },
      orderBy: { firstObtained: "asc" },
      take: 6
    })
  ]);

  const myRanking = ranking.find((entry) => entry.playerId === player.id);
  const totalGames = (myRanking?.wins ?? 0) + (myRanking?.draws ?? 0) + (myRanking?.losses ?? 0);
  const recentDecks = player.deckSubmissions
    .filter((deck) => deck.tournamentWeek && isDeckRegistrationLocked(deck.tournamentWeek))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center gap-5 p-6">
        {player.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.avatarUrl}
            alt={player.displayName}
            className="h-20 w-20 rounded-2xl border-2 border-[#FFCB05]/30 object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FFCB05] to-[#FFD700] text-2xl font-bold text-[#1A1A2E]">
            {player.displayName.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-widest text-slate-500">Meu perfil</p>
          <h1 className="font-pixel text-base text-[#FFCB05]">{player.displayName}</h1>
          <p className="text-sm text-slate-400">{player.ptcglNick || "Sem nick do jogo"}</p>
          <p className="mt-2 text-xs text-slate-500">Esta e a sua pagina de perfil e edicao.</p>
        </div>
        <Link
          href={`/jogadores/${player.id}`}
          className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5 hover:text-white"
        >
          Ver como publico
        </Link>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Ranking Geral"
          value={myRanking ? `#${myRanking.position}` : "-"}
          icon={<Trophy size={20} />}
          highlight={myRanking?.position === 1}
        />
        <StatCard label="Pontos" value={myRanking?.points ?? 0} icon={<CheckCircle2 size={20} />} />
        <StatCard
          label="V / E / D"
          value={myRanking ? `${myRanking.wins} / ${myRanking.draws} / ${myRanking.losses}` : "0 / 0 / 0"}
          icon={<Swords size={20} />}
        />
        <StatCard label="Partidas" value={totalGames} icon={<BookOpen size={20} />} />
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-semibold text-white">Editar perfil e senha</h2>
        <EditProfileForm player={player} />
      </Card>

      {dreamTeam.length > 0 && (
        <Card className="p-6">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
            ⭐ Time dos Sonhos
          </h2>
          <p className="mb-4 text-xs text-slate-500">As {dreamTeam.length} figurinhas favoritas deste treinador.</p>
          <div className="flex flex-wrap gap-3">
            {dreamTeam.map((s) => (
              <div key={s.id} className="flex flex-col items-center gap-1 rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/5 p-2 w-20">
                {s.card.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.card.imageUrl} alt={s.card.displayName} className="h-14 w-14 object-contain" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-800 text-xs text-slate-500">
                    #{s.card.nationalId}
                  </div>
                )}
                <p className="text-center text-[10px] font-medium text-slate-300 leading-tight truncate w-full">{s.card.displayName}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-semibold text-white">Insignias</h2>
        {player.playerBadges.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma insignia atribuida ainda.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {player.playerBadges.map((playerBadge) => (
              <div
                key={playerBadge.id}
                className="flex items-center gap-3 rounded-2xl border border-[#FFCB05]/20 bg-[#FFCB05]/10 p-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={playerBadge.badge.imageUrl}
                  alt={playerBadge.badge.name}
                  className="h-14 w-14 rounded-xl object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{playerBadge.badge.name}</p>
                  <p className="truncate text-xs text-slate-400">{playerBadge.badge.tournament.name}</p>
                  <p className="text-xs text-[#FFCB05]">+3 pontos</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <Swords size={18} className="text-[#FFCB05]" /> Ultimas partidas
          </h2>
          {recentMatches.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma partida confirmada ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recentMatches.map((match) => {
                const opponent = match.playerAId === player.id ? match.playerB : match.playerA;
                const won = match.winnerPlayerId === player.id;
                const lost = match.loserPlayerId === player.id;
                return (
                  <li key={match.id}>
                    <Link
                      href={
                        match.tournamentWeek
                          ? `/torneios/${match.tournamentWeek.tournament.slug}/semanas/${match.tournamentWeek.weekNumber}/partidas`
                          : "/ranking"
                      }
                      className="flex items-center justify-between gap-3 py-3 text-sm hover:bg-white/[0.02]"
                    >
                      <div>
                        <p className="text-white">vs {opponent?.displayName ?? "BYE"}</p>
                        <p className="text-xs text-slate-500">
                          {match.tournamentWeek?.tournament.name ?? "Liga Zikachu"}
                          {match.tournamentWeek ? ` - Semana ${match.tournamentWeek.weekNumber}` : ""}
                        </p>
                      </div>
                      <StatusBadge
                        variant={won ? "success" : lost ? "danger" : "info"}
                        label={won ? "Vitoria" : lost ? "Derrota" : "Empate"}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <BookOpen size={18} className="text-[#FFCB05]" /> Decks recentes
          </h2>
          {recentDecks.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum deck liberado para historico ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recentDecks.map((deck) => (
                <li key={deck.id}>
                  <Link
                    href={
                      deck.tournament && deck.tournamentWeek
                        ? `/torneios/${deck.tournament.slug}/semanas/${deck.tournamentWeek.weekNumber}`
                        : "/torneios"
                    }
                    className="flex items-center justify-between gap-3 py-3 text-sm hover:bg-white/[0.02]"
                  >
                    <div>
                      <p className="text-white">{deck.deckName}</p>
                      <p className="text-xs text-slate-500">
                        {deck.tournament?.name ?? "Torneio"}
                        {deck.tournamentWeek ? ` - Semana ${deck.tournamentWeek.weekNumber}` : ""}
                        {deck.archetype ? ` - ${deck.archetype}` : ""}
                      </p>
                    </div>
                    <StatusBadge variant="info" label={deck.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
