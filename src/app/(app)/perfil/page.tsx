import Link from "next/link";
import { MatchStatus } from "@prisma/client";
import { BookOpen, CheckCircle2, ExternalLink, Swords, Trophy } from "lucide-react";
import { POKEMON_TYPE_LABELS, POKEMON_TYPE_COLORS, POKEMON_TYPE_EMOJIS } from "@/lib/pokemon-types-data";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeGlobalRanking } from "@/lib/ranking";
import { isDeckRegistrationLocked } from "@/lib/decks";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EditProfileForm } from "./_components/edit-profile-form";

async function MeusDecksPreview({ playerId }: { playerId: string }) {
  const decks = await prisma.savedDeck.findMany({
    where: { playerId },
    orderBy: { updatedAt: "desc" },
    take: 3,
    select: { id: true, name: true, archetype: true, isPublic: true }
  });
  const total = await prisma.savedDeck.count({ where: { playerId } });
  if (total === 0) return null;

  return (
    <Card className="p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <BookOpen size={16} className="text-[#FFCB05]" /> Meus Decks
        </h2>
        <Link href="/perfil/meus-decks" className="flex items-center gap-1 text-xs text-[#FFCB05] hover:underline">
          Gerenciar todos ({total}) <ExternalLink size={11} />
        </Link>
      </div>
      <div className="space-y-2">
        {decks.map((d) => {
          const types = d.archetype ? d.archetype.split(",").map((t) => t.trim()).filter(Boolean) : [];
          return (
            <div key={d.id} className="flex items-center gap-3 rounded-lg border border-border bg-slate-900/40 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-200 flex items-center gap-1.5">
                  {d.name}
                  {!d.isPublic && <span className="text-[10px] text-slate-600">(privado)</span>}
                </p>
                {types.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {types.map((tv) => (
                      <span key={tv} className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${POKEMON_TYPE_COLORS[tv] ?? "bg-slate-700 text-slate-200"}`}>
                        {POKEMON_TYPE_EMOJIS[tv] ?? "●"} {POKEMON_TYPE_LABELS[tv] ?? tv}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

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
          tournament: { select: { name: true, slug: true, status: true } },
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

  const [ranking, recentMatches, dreamTeam, equippedItems] = await Promise.all([
    computeGlobalRanking(),
    prisma.match.findMany({
      where: {
        OR: [{ playerAId: player.id }, { playerBId: player.id }],
        status: MatchStatus.CONFIRMED,
        // Apenas partidas de torneios reais (não rascunho)
        tournamentWeek: { tournament: { status: { not: "DRAFT" } } }
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
    }),
    prisma.playerInventory.findMany({
      where: { playerId: player.id, equipped: true },
      include: { item: { select: { type: true, name: true, imageUrl: true } } }
    })
  ]);

  const equippedBanner = equippedItems.find((i) => i.item.type === "BANNER");
  const equippedFrame  = equippedItems.find((i) => i.item.type === "FRAME");
  const equippedTitle  = equippedItems.find((i) => i.item.type === "TITLE");

  const myRanking = ranking.find((entry) => entry.playerId === player.id);
  const totalGames = (myRanking?.wins ?? 0) + (myRanking?.draws ?? 0) + (myRanking?.losses ?? 0);
  const recentDecks = player.deckSubmissions
    .filter((deck) =>
      deck.tournamentWeek &&
      isDeckRegistrationLocked(deck.tournamentWeek) &&
      deck.tournament &&
      !["DRAFT"].includes(deck.tournament.status) &&
      deck.deckName &&
      deck.deckName.trim().length > 0
    )
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-border bg-slate-950">
        {equippedBanner?.item.imageUrl ? (
          <div className="relative h-32 w-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={equippedBanner.item.imageUrl} alt="Banner" className="h-full w-full object-cover object-center" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0f0f1a]/80" />
          </div>
        ) : (
          <div className="h-16 w-full bg-gradient-to-r from-[#1A1A2E] via-[#201d38] to-[#1A1A2E]" />
        )}
        <div className="px-5 pb-5">
          <div className="flex items-end gap-4 -mt-8">
            {/* Avatar com moldura real */}
            <div className="relative shrink-0">
              <div className="h-16 w-16 overflow-hidden rounded-2xl border-2 border-[#0f0f1a] bg-gradient-to-br from-[#FFCB05] to-[#FFD700] shadow-lg">
                {player.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={player.avatarUrl} alt={player.displayName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl font-bold text-[#1A1A2E]">
                    {player.displayName.charAt(0)}
                  </div>
                )}
              </div>
              {equippedFrame?.item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={equippedFrame.item.imageUrl} alt="Moldura" className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
              )}
              {equippedFrame && !equippedFrame.item.imageUrl && (
                <div className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-[#FFCB05]" />
              )}
            </div>
            {/* Card compacto de identidade */}
            <div className="mb-1 min-w-0 flex-1">
              <div className="inline-block rounded-xl border border-border/60 bg-slate-900/80 px-3 py-2 backdrop-blur-sm">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">Meu perfil</p>
                <h1 className="font-pixel text-sm text-[#FFCB05] leading-tight">{player.displayName}</h1>
                {equippedTitle && (
                  <p className="text-[11px] font-semibold text-[#FFCB05]/80">{equippedTitle.item.name}</p>
                )}
                <p className="text-xs text-slate-400">{player.ptcglNick || "Sem nick"}</p>
              </div>
            </div>
            <div className="mb-1 shrink-0">
              <Link href={`/jogadores/${player.id}`}
                className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5 hover:text-white">
                Ver público
              </Link>
            </div>
          </div>
        </div>
      </div>

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

        <MeusDecksPreview playerId={player.id} />

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
