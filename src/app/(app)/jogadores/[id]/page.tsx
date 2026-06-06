import { notFound } from "next/navigation";
import Link from "next/link";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth/permissions";
import { computePlayerRanking } from "@/lib/ranking";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardTitle } from "@/components/ui/card";
import { Trophy, Swords, CheckCircle2, Package, BookOpen, User, ChevronLeft, Coins } from "lucide-react";
import { POKEMON_TYPE_LABELS, POKEMON_TYPE_COLORS, POKEMON_TYPE_EMOJIS } from "@/lib/pokemon-types-data";
import { MatchStatus, SeasonStatus } from "@prisma/client";
import { PlayerBadgeAdminActions } from "./_components/player-badge-admin-actions";
import { AdminResetPanel } from "./_components/admin-reset-panel";
import { GrantItemPanel } from "./_components/grant-item-panel";
import { RarityShimmer } from "@/components/ui/rarity-shimmer";
import { TitleDisplay } from "@/components/ui/title-display";
import type { TitleRarity, TitleTheme } from "@/components/ui/title-display";
import { CopyDeckButton } from "@/components/ui/copy-deck-button";
import { MascotProfileCard } from "./_components/mascot-profile-card";
import { PublicMascotGallery } from "./_components/public-mascot-gallery";

export default async function PlayerDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id: playerId }, session] = await Promise.all([params, getAppSession()]);
  if (!session?.user) return null;

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      user: {
        select: { id: true, email: true, image: true, status: true, role: true, name: true }
      },
      seasonEntries: {
        where: { isActive: true },
        include: { season: { select: { id: true, name: true, status: true } } }
      },
      deckSubmissions: {
        orderBy: { submittedAt: "desc" },
        take: 10,
        select: {
          id: true, deckName: true, status: true, submittedAt: true, isLate: true,
          tournament: { select: { name: true, slug: true, status: true } },
          tournamentWeek: { select: { weekNumber: true, status: true, deckLockAt: true, lockAt: true, endDate: true } }
        }
      },
      playerAchievements: {
        include: { achievement: { select: { name: true, description: true, icon: true } } }
      },
      playerBadges: {
        include: {
          badge: {
            include: {
              tournament: {
                select: {
                  name: true,
                  season: { select: { name: true } }
                }
              }
            }
          }
        },
        orderBy: { awardedAt: "desc" }
      }
    }
  });

  if (!player) notFound();

  const activeSeason = player.seasonEntries.find((sp) => sp.season.status === SeasonStatus.ACTIVE);
  const isSelf = session.user.id === player.userId;
  const isAdminUser = isAdmin(session.user.role);

  const [ranking, recentMatches, codesCount, allPlayers, dreamTeam, equippedItems, highlightedAchievements, publicDecks, shopItems, ownedInventory] = await Promise.all([
    activeSeason ? computePlayerRanking(activeSeason.seasonId) : [],
    prisma.match.findMany({
      where: {
        OR: [{ playerAId: playerId }, { playerBId: playerId }],
        status: MatchStatus.CONFIRMED,
        tournamentWeek: { tournament: { status: { not: "DRAFT" } } }
      },
      orderBy: { playedAt: "desc" },
      take: 10,
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
    isSelf || isAdminUser
      ? prisma.codeDistribution.count({
          where: {
            playerId,
            ...(activeSeason ? { seasonId: activeSeason.seasonId } : {}),
            status: { not: "REVOKED" }
          }
        })
      : 0,
    isAdminUser
      ? prisma.player.findMany({
          select: { id: true, displayName: true },
          orderBy: { displayName: "asc" }
        })
      : [],
    prisma.playerSticker.findMany({
      where: { playerId, isFavorite: true },
      include: { card: { select: { nationalId: true, displayName: true, imageUrl: true, rarity: true } } },
      orderBy: { firstObtained: "asc" },
      take: 6
    }).catch(() => [] as { id: string; card: { nationalId: number; displayName: string; imageUrl: string | null; rarity: string } }[]),
    prisma.playerInventory.findMany({
      where: { playerId, equipped: true },
      include: { item: { select: { type: true, name: true, imageUrl: true, metadata: true, rarity: true, theme: true, flavorText: true, entranceEffect: true } } }
    }).catch(() => [] as { id: string; item: { type: string; name: string; imageUrl: string | null; metadata: unknown; rarity: string; theme: string; flavorText: string | null; entranceEffect: string | null } }[]),
    prisma.playerAchievement.findMany({
      where: { playerId, isHighlighted: true },
      include: { achievement: { select: { name: true, rarity: true, iconUrl: true, description: true } } },
      orderBy: { awardedAt: "desc" }
    }).catch(() => [] as Array<{ id: string; achievement: { name: string; rarity: string; iconUrl: string | null; description: string | null } }>),
    prisma.savedDeck.findMany({
      where: { playerId, isPublic: true },
      select: { id: true, name: true, archetype: true, deckList: true, updatedAt: true },
      orderBy: { updatedAt: "desc" }
    }).catch(() => [] as { id: string; name: string; archetype: string | null; deckList: string; updatedAt: Date }[]),
    isAdminUser
      ? prisma.shopItem.findMany({
          // Admin vê todos os itens (ativos e desabilitados) para poder conceder
          select: { id: true, name: true, type: true, rarity: true, active: true },
          orderBy: [{ type: "asc" }, { active: "desc" }, { rarity: "asc" }, { name: "asc" }]
        })
      : [],
    isAdminUser
      ? prisma.playerInventory.findMany({
          where: { playerId },
          select: { itemId: true }
        })
      : [],
  ]);

  // Mascote equipado — dados completos para o card do perfil
  const [equippedMascot, publicMascots] = await Promise.all([
    prisma.mascot.findFirst({
      where: { playerId, isEquipped: true },
      select: {
        id: true, pokemonId: true, nickname: true, level: true, exp: true,
        happiness: true, mood: true, personality: true, isEquipped: true,
        statForce: true, statAgility: true, statCharisma: true,
        statInstinct: true, statVitality: true,
        battleWins: true, battleLosses: true,
        hatchedAt: true, lastInteractedAt: true, lastFedAt: true,
        events: { orderBy: { createdAt: "desc" }, take: 15 },
        expeditions: { where: { status: "ACTIVE" }, take: 1, select: { id: true, finishAt: true, status: true, rewardJson: true } },
        relationsAsA: {
          include: {
            mascotB: {
              select: {
                id: true, pokemonId: true, nickname: true,
                player: { select: { displayName: true } }
              }
            }
          }
        }
      }
    }).catch(() => null),
    prisma.mascot.findMany({
      where: { playerId },
      select: {
        id: true, pokemonId: true, nickname: true, level: true, exp: true,
        mood: true, happiness: true, personality: true, isEquipped: true, isFavorite: true,
        statForce: true, statAgility: true, statCharisma: true, statInstinct: true, statVitality: true,
        battleWins: true, battleLosses: true,
        expeditions: { where: { status: "ACTIVE" }, take: 1, select: { id: true, finishAt: true, status: true, rewardJson: true } },
        relationsAsA: {
          include: {
            mascotB: {
              select: {
                id: true, pokemonId: true, nickname: true,
                player: { select: { displayName: true } }
              }
            }
          }
        },
      },
      orderBy: [{ isFavorite: "desc" }, { isEquipped: "desc" }, { level: "desc" }, { hatchedAt: "desc" }],
      take: 500,
    }).catch(() => [] as Array<never>),
  ]);

  const equippedBanner = equippedItems.find((i) => i.item.type === "BANNER");
  const equippedFrame  = equippedItems.find((i) => i.item.type === "FRAME");
  const equippedTitle  = equippedItems.find((i) => i.item.type === "TITLE");

  const myEntry = (ranking as Awaited<ReturnType<typeof computePlayerRanking>>).find(
    (r) => r.playerId === playerId
  );

  const winRate =
    myEntry && myEntry.wins + myEntry.losses + myEntry.draws > 0
      ? Math.round((myEntry.wins / (myEntry.wins + myEntry.losses + myEntry.draws)) * 100)
      : null;

  function statusBadge() {
    const map = {
      ACTIVE: { variant: "active" as const, label: "Ativo" },
      PENDING_APPROVAL: { variant: "pending" as const, label: "Pendente" },
      SUSPENDED: { variant: "suspended" as const, label: "Suspenso" },
      REJECTED: { variant: "rejected" as const, label: "Rejeitado" }
    };
    return map[player!.user.status] ?? { variant: "draft" as const, label: player!.user.status };
  }

  const badge = statusBadge();

  return (
    <div className="space-y-8">
      {/* Back */}
      <Link
        href="/jogadores"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
      >
        <ChevronLeft size={16} /> Jogadores
      </Link>

      {/* ── Header do perfil ─────────────────────────────────────────────────────
           Estrutura em 3 camadas para molduras funcionarem sem clipping:
           1. Outer card: position:relative, SEM overflow — frame pode extravasar
           2. Banner: overflow-hidden apenas para a imagem de fundo
           3. Avatar+Frame: absolutamente posicionado NO CARD EXTERNO (fora do overflow-hidden)
      */}
      {(() => {
        const AVATAR = 80;
        const frameMeta = equippedFrame?.item.metadata as
          | { frameScale?: number; frameOffsetX?: number; frameOffsetY?: number }
          | null | undefined;
        const fScale   = frameMeta?.frameScale  ?? 2.0;
        const fOffsetX = frameMeta?.frameOffsetX ?? 0;
        const fOffsetY = frameMeta?.frameOffsetY ?? 0;
        const frameSize  = AVATAR * fScale;
        const anchorLeft = AVATAR / 2 + fOffsetX;
        const anchorTop  = AVATAR / 2 + fOffsetY;
        // Avatar posicionado: left=20px, bottom=44px (altura da barra de status)
        const AVATAR_LEFT   = 20;
        const STATUS_HEIGHT = 44;

        return (
          <div data-tutorial="profile-avatar" className="relative rounded-2xl border border-border bg-slate-950">

            {/* ── Banner ── */}
            {/* No mobile usa altura fixa (180px). Em telas maiores usa aspect-ratio 4:1.
                clamp garante mínimo de 180px e máximo de 280px em qualquer tela. */}
            <div className="relative overflow-hidden rounded-2xl"
              style={{
                height: equippedBanner?.item.imageUrl
                  ? "clamp(180px, 25vw, 280px)"
                  : 160,
              }}>
              {equippedBanner?.item.imageUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={equippedBanner.item.imageUrl} alt="Banner"
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{
                      objectPosition: (() => {
                        const m = equippedBanner.item.metadata as { focusX?: number; focusY?: number } | null | undefined;
                        return `${m?.focusX ?? 50}% ${m?.focusY ?? 50}%`;
                      })()
                    }} />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f1a]/85 via-[#0f0f1a]/40 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f1a]/80 via-transparent to-transparent" />
                  {/* Brilho para banners raros/épicos/lendários */}
                  {["RARE","EPIC","LEGENDARY"].includes(equippedBanner.item.rarity) && (
                    <RarityShimmer rarity={equippedBanner.item.rarity} className="absolute inset-0" />
                  )}
                </>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900" />
              )}

              {/* Texto de identidade — margem esquerda reserva espaço do avatar */}
              <div className="absolute bottom-0 left-0 right-0 p-5"
                style={{ paddingLeft: AVATAR_LEFT + AVATAR + 20 }}>
                <h1 className="text-2xl font-bold leading-tight text-white drop-shadow-lg">
                  {player.displayName}
                </h1>
{/* mascote aparece no card abaixo */}
                {equippedTitle && (
                  <div className="mt-0.5">
                    <TitleDisplay
                      name={equippedTitle.item.name}
                      rarity={equippedTitle.item.rarity as TitleRarity}
                      theme={(equippedTitle.item.theme ?? "NEUTRAL") as TitleTheme}
                      flavorText={equippedTitle.item.flavorText}
                      context="profile"
                      entranceEffect={equippedTitle.item.entranceEffect ?? "NONE"}
                    />
                  </div>
                )}
                {player.ptcglNick && (
                  <p className="text-sm text-slate-300/80 drop-shadow">@{player.ptcglNick}</p>
                )}
              </div>
            </div>

            {/* ── Avatar + Frame — FORA do overflow-hidden, livre para extravasar ── */}
            <div
              className="absolute z-20"
              style={{ left: AVATAR_LEFT, bottom: STATUS_HEIGHT }}
            >
              <div className="relative" style={{ width: AVATAR, height: AVATAR }}>
                {/* Avatar photo */}
                <div
                  className="overflow-hidden rounded-2xl border-2 border-[#0f0f1a]/80 bg-slate-700 shadow-xl"
                  style={{ width: AVATAR, height: AVATAR }}
                >
                  {player.user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={player.user.image} alt={player.displayName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <User size={32} className="text-slate-400" />
                    </div>
                  )}
                </div>
                {/* Frame — ancorado no centro do avatar, extravasamento livre */}
                {equippedFrame?.item.imageUrl && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={equippedFrame.item.imageUrl}
                      alt="Moldura"
                      className="pointer-events-none absolute z-10 object-contain"
                      style={{
                        left: anchorLeft,
                        top:  anchorTop,
                        width: frameSize,
                        height: frameSize,
                        maxWidth: "none",
                        maxHeight: "none",
                        transform: "translate(-50%, -50%)",
                      }}
                    />
                    {/* Brilho sobre molduras raras/épicas/lendárias */}
                    {["RARE","EPIC","LEGENDARY"].includes(equippedFrame.item.rarity) && (
                      <div
                        aria-hidden="true"
                        className={`pointer-events-none absolute z-20 ${
                          equippedFrame.item.rarity === "LEGENDARY" ? "glint-legendary" :
                          equippedFrame.item.rarity === "EPIC"      ? "glint-epic"      :
                          "glint-rare"
                        }`}
                        style={{
                          left: anchorLeft,
                          top:  anchorTop,
                          width: frameSize,
                          height: frameSize,
                          maxWidth: "none",
                          maxHeight: "none",
                          transform: "translate(-50%, -50%)",
                          background: equippedFrame.item.rarity === "LEGENDARY"
                            ? "linear-gradient(105deg, transparent 25%, rgba(253,224,71,0.25) 42%, rgba(255,255,255,0.65) 50%, rgba(253,224,71,0.25) 58%, transparent 75%)"
                            : equippedFrame.item.rarity === "EPIC"
                            ? "linear-gradient(105deg, transparent 25%, rgba(192,132,252,0.22) 42%, rgba(255,255,255,0.55) 50%, rgba(192,132,252,0.22) 58%, transparent 75%)"
                            : "linear-gradient(105deg, transparent 25%, rgba(147,197,253,0.20) 42%, rgba(255,255,255,0.55) 50%, rgba(147,197,253,0.20) 58%, transparent 75%)",
                          borderRadius: "inherit",
                        }}
                      />
                    )}
                  </>
                )}
                {equippedFrame && !equippedFrame.item.imageUrl && (
                  <div className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-[#FFCB05]" />
                )}
              </div>
            </div>

            {/* ── Barra de status — padding-left reserva espaço do avatar ── */}
            <div
              className="border-t border-border/40 flex flex-wrap items-center justify-between gap-2 bg-slate-950/60"
              style={{ height: STATUS_HEIGHT, paddingLeft: AVATAR_LEFT + AVATAR + 16, paddingRight: 20 }}
            >
              <div className="flex flex-wrap gap-2">
                <StatusBadge variant={badge.variant} label={badge.label} />
                {player.user.role !== "PLAYER" && (
                  <StatusBadge variant="info" label={player.user.role} />
                )}
                {activeSeason && (
                  <StatusBadge variant="draft" label={activeSeason.season.name} />
                )}
              </div>
              {isSelf && (
                <Link
                  href="/perfil"
                  className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-400 hover:border-[#FFCB05]/40 hover:text-[#FFCB05] transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                  Configurações
                </Link>
              )}
            </div>
          </div>
        );
      })()}

      {/* Conquistas removidas daqui — exibidas abaixo (seção única) */}

      {/* Time dos Sonhos */}
      {dreamTeam.length > 0 && (
        <Card className="p-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">⭐ Time dos Sonhos</h2>
          <div className="flex flex-wrap gap-3">
            {dreamTeam.map((s) => (
              <div key={s.id} className="flex flex-col items-center gap-1 rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/5 p-2 w-20">
                {s.card.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.card.imageUrl} alt={s.card.displayName} className="h-14 w-14 object-contain" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-800 text-xs text-slate-500">#{s.card.nationalId}</div>
                )}
                <p className="text-center text-[10px] font-medium text-slate-300 leading-tight truncate w-full">{s.card.displayName}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Stats da temporada ativa */}
      {activeSeason && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">
            Temporada atual · {activeSeason.season.name}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Posição"
              value={myEntry ? `#${myEntry.position}` : "—"}
              icon={<Trophy size={20} />}
              highlight={myEntry?.position === 1}
            />
            <StatCard
              label="Pontos"
              value={myEntry?.points ?? 0}
              icon={<CheckCircle2 size={20} />}
            />
            <StatCard
              label="V / E / D"
              value={
                myEntry
                  ? `${myEntry.wins} / ${myEntry.draws} / ${myEntry.losses}`
                  : "0 / 0 / 0"
              }
              icon={<Swords size={20} />}
            />
            <StatCard
              label="Taxa de vitória"
              value={winRate !== null ? `${winRate}%` : "—"}
              icon={<Trophy size={20} />}
            />
          </div>
        </div>
      )}

      {/* Decks Públicos — apenas nome + tipos, clicáveis para ver a lista */}
      {publicDecks.length > 0 && (
        <Card data-tutorial="profile-decks">
          <div className="mb-4 flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BookOpen size={18} className="text-primary" /> Meus Decks
            </CardTitle>
            {publicDecks.length > 3 && (
              <span className="text-xs text-slate-500">{publicDecks.length} decks públicos</span>
            )}
          </div>
          <div className="space-y-2">
            {publicDecks.slice(0, 6).map((d) => {
              const typeValues = d.archetype
                ? d.archetype.split(",").map((t) => t.trim()).filter(Boolean)
                : [];
              // Deck list encoded for query param
              const deckParam = encodeURIComponent(d.deckList.slice(0, 2000));
              return (
                <details key={d.id} className="group rounded-lg border border-border bg-slate-900/40 overflow-hidden">
                  <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 hover:bg-slate-800/40 transition-colors list-none">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="font-semibold text-slate-200 text-sm truncate">{d.name}</span>
                      {typeValues.map((tv) => (
                        <span key={tv} className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold shrink-0 ${POKEMON_TYPE_COLORS[tv] ?? "bg-slate-700 text-slate-200"}`}>
                          {POKEMON_TYPE_EMOJIS[tv] ?? "●"} {POKEMON_TYPE_LABELS[tv] ?? tv}
                        </span>
                      ))}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <CopyDeckButton deckList={d.deckList} />
                      <span className="text-xs text-slate-500 group-open:hidden">Ver ↓</span>
                      <span className="text-xs text-slate-500 hidden group-open:inline">Fechar ↑</span>
                    </div>
                  </summary>
                  <div className="border-t border-border">
                    <pre className="max-h-64 overflow-auto px-3 py-3 font-mono text-xs text-slate-300 leading-relaxed">
                      {d.deckList}
                    </pre>
                  </div>
                </details>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Histórico de partidas */}
        <Card data-tutorial="profile-matches">
          <CardTitle className="mb-4 flex items-center gap-2">
            <Swords size={18} className="text-primary" /> Últimas partidas
          </CardTitle>
          {recentMatches.length === 0 ? (
            <EmptyState message="Nenhuma partida confirmada." icon={<Swords size={24} />} />
          ) : (
            <ul className="divide-y divide-border">
              {recentMatches.map((match) => {
                const isA = match.playerAId === playerId;
                const opp = isA ? match.playerB : match.playerA;
                const won = match.winnerPlayerId === playerId;
                const lost = match.loserPlayerId === playerId;
                const matchHref = match.tournamentWeek?.tournament?.slug && match.tournamentWeek?.weekNumber
                  ? `/torneios/${match.tournamentWeek.tournament.slug}/semanas/${match.tournamentWeek.weekNumber}/partidas`
                  : null;
                const prizes = won ? match.winnerDefendedPrizes : null;
                const inner = (
                  <li key={match.id} className={`flex items-center justify-between gap-3 py-3 text-sm ${matchHref ? "cursor-pointer hover:bg-slate-800/40 rounded-lg px-2 -mx-2 transition-colors" : ""}`}>
                    <div className="min-w-0">
                      <span className="text-white font-medium">
                        vs {opp?.displayName ?? "BYE"}
                      </span>
                      {match.tournamentWeek && (
                        <span className="ml-2 text-xs text-slate-500">
                          S{match.tournamentWeek.weekNumber}
                          {match.tournamentWeek.tournament && ` · ${match.tournamentWeek.tournament.name}`}
                        </span>
                      )}
                      {match.playedAt && (
                        <span className="ml-2 text-xs text-slate-600">
                          {new Date(match.playedAt).toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit" })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {prizes != null && prizes > 0 && (
                        <span className="text-xs text-slate-500">{prizes} prêmios</span>
                      )}
                      <StatusBadge
                        variant={won ? "success" : lost ? "danger" : "info"}
                        label={won ? "Vitória" : lost ? "Derrota" : "Empate"}
                      />
                    </div>
                  </li>
                );
                return matchHref
                  ? <Link key={match.id} href={matchHref}>{inner}</Link>
                  : inner;
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          {/* Decks enviados */}
          <Card>
            <CardTitle className="mb-4 flex items-center gap-2">
              <BookOpen size={18} className="text-primary" /> Decks enviados
            </CardTitle>
            {(() => {
              const validDecks = player.deckSubmissions.filter(
                (d) =>
                  d.tournament &&
                  d.tournamentWeek &&
                  !["DRAFT"].includes(d.tournament.status) &&
                  d.deckName &&
                  d.deckName.trim().length > 0
              );
              return validDecks.length === 0 ? (
                <EmptyState message="Nenhum deck enviado." icon={<BookOpen size={24} />} />
              ) : (
              <ul className="divide-y divide-border">
                {validDecks.map((deck) => {
                  const tournSlug = deck.tournament?.slug;
                  const weekNum = deck.tournamentWeek?.weekNumber;
                  const href = tournSlug && weekNum
                    ? `/torneios/${tournSlug}/semanas/${weekNum}`
                    : null;
                  return (
                  <li key={deck.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    {href ? (
                      <Link href={href} className="text-white hover:text-[#FFCB05] transition-colors flex items-center gap-1.5">
                        {deck.deckName}
                        {deck.tournament?.name && (
                          <span className="text-[10px] text-slate-500">· {deck.tournament.name}</span>
                        )}
                      </Link>
                    ) : (
                      <span className="text-slate-400">{deck.deckName}</span>
                    )}
                    <div className="flex items-center gap-2">
                      {deck.isLate && <StatusBadge variant="warning" label="Atrasado" />}
                      <StatusBadge
                        variant={deck.status === "APPROVED" ? "success" : deck.status === "REJECTED" ? "danger" : "info"}
                        label={deck.status === "APPROVED" ? "Aprovado" : deck.status === "REJECTED" ? "Rejeitado" : "Enviado"}
                      />
                    </div>
                  </li>
                  );
                })}
              </ul>
              );
            })()}
          </Card>

          {/* Conquistas */}
          {player.playerBadges.length > 0 && (
            <Card>
              <CardTitle className="mb-4 flex items-center gap-2">
                <Trophy size={18} className="text-primary" /> Insignias
              </CardTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                {player.playerBadges.map((playerBadge) => (
                  <div
                    key={playerBadge.id}
                    className="flex items-center gap-3 rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/10 p-3"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={playerBadge.badge.imageUrl}
                      alt={playerBadge.badge.name}
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{playerBadge.badge.name}</p>
                      <p className="truncate text-xs text-slate-400">{playerBadge.badge.tournament.name}</p>
                      <p className="text-xs text-[#FFCB05]">+3 pontos</p>
                      {isAdminUser && (
                        <PlayerBadgeAdminActions
                          badgeId={playerBadge.badgeId}
                          currentPlayerId={player.id}
                          players={allPlayers}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Conquistas — max 10 destacadas + "E X Outras" */}
          {(highlightedAchievements.length > 0 || player.playerAchievements.length > 0) && (
            <Card data-tutorial="profile-achievements">
              <CardTitle className="mb-4 flex items-center gap-2">
                <Trophy size={18} className="text-primary" /> Conquistas
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                {/* Até 10 conquistas em destaque */}
                {highlightedAchievements.slice(0, 10).map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-1.5 rounded-full border border-[#FFCB05]/30 bg-[#FFCB05]/5 px-2.5 py-1"
                  >
                    {a.achievement.iconUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.achievement.iconUrl} alt="" className="h-4 w-4 object-contain" />
                    )}
                    <span className="text-xs font-semibold text-slate-200">{a.achievement.name}</span>
                  </div>
                ))}
                {/* Tag "E X Outras" — sempre presente se houver conquistas além das exibidas */}
                {(() => {
                  const totalAchs = player.playerAchievements.length;
                  const shown = Math.min(highlightedAchievements.length, 10);
                  const remaining = totalAchs - shown;
                  if (remaining <= 0) return null;
                  return (
                    <div className="flex items-center rounded-full border border-slate-700 bg-slate-800/50 px-2.5 py-1">
                      <span className="text-xs text-slate-400">E {remaining} outra{remaining !== 1 ? "s" : ""}</span>
                    </div>
                  );
                })()}
                {/* Se não tem destaque mas tem conquistas, mostra contagem */}
                {highlightedAchievements.length === 0 && player.playerAchievements.length > 0 && (
                  <p className="text-xs text-slate-500">
                    {player.playerAchievements.length} conquista{player.playerAchievements.length !== 1 ? "s" : ""} — destaque algumas na aba de Conquistas.
                  </p>
                )}
              </div>
            </Card>
          )}

          {/* Códigos recebidos (só para si ou admin) */}
          {(isSelf || isAdminUser) && (
            <Card>
              <CardTitle className="mb-2 flex items-center gap-2">
                <Package size={18} className="text-primary" /> Códigos recebidos
              </CardTitle>
              <p className="text-2xl font-bold text-white">{codesCount}</p>
              <p className="mt-1 text-xs text-slate-400">
                {activeSeason ? `nesta temporada (excl. revogados)` : "em todas as temporadas"}
              </p>
            </Card>
          )}
          {isAdminUser && (
            <Link href={`/carteira?playerId=${player.id}`}>
              <Card className="transition-colors hover:border-[#FFCB05]/50 hover:bg-[#FFCB05]/5">
                <CardTitle className="mb-2 flex items-center gap-2">
                  <Coins size={18} className="text-primary" /> Carteira
                </CardTitle>
                <p className="text-sm font-semibold text-slate-200">Ver relatorio financeiro</p>
                <p className="mt-1 text-xs text-slate-400">Saldo e historico de ZikaCoins deste jogador.</p>
              </Card>
            </Link>
          )}
        </div>
      </div>

      {/* Mascote equipado — card completo com histórico de relações */}
      {publicMascots.length > 0 && (
        <Card>
          <CardTitle className="mb-3 flex items-center gap-2">
            <Swords size={18} className="text-primary" /> Mascotes
          </CardTitle>
          <PublicMascotGallery mascots={publicMascots} isAdmin={isAdminUser} />
        </Card>
      )}
      {equippedMascot && (
        <MascotProfileCard
          mascot={{
            id: equippedMascot.id,
            pokemonId: equippedMascot.pokemonId,
            nickname: equippedMascot.nickname,
            level: equippedMascot.level,
            exp: equippedMascot.exp,
            happiness: equippedMascot.happiness,
            mood: equippedMascot.mood,
            personality: equippedMascot.personality,
            isEquipped: equippedMascot.isEquipped,
            statForce: equippedMascot.statForce,
            statAgility: equippedMascot.statAgility,
            statCharisma: equippedMascot.statCharisma,
            statInstinct: equippedMascot.statInstinct,
            statVitality: equippedMascot.statVitality,
            battleWins: equippedMascot.battleWins,
            battleLosses: equippedMascot.battleLosses,
            hatchedAt: equippedMascot.hatchedAt,
            lastInteractedAt: equippedMascot.lastInteractedAt,
            lastFedAt: equippedMascot.lastFedAt,
            events: equippedMascot.events,
            activeExpedition: equippedMascot.expeditions[0] ?? null,
            relations: equippedMascot.relationsAsA.map(r => ({
              id: r.id,
              type: r.type,
              wins: r.wins,
              losses: r.losses,
              otherMascot: {
                id: r.mascotB.id,
                pokemonId: r.mascotB.pokemonId,
                nickname: r.mascotB.nickname,
                player: { displayName: r.mascotB.player.displayName },
              }
            })),
          }}
          isOwner={isSelf}
          isAdmin={isAdminUser}
        />
      )}

      {isAdminUser && (
        <div className="space-y-4">
          <GrantItemPanel
            playerId={playerId}
            shopItems={shopItems as { id: string; name: string; type: string; rarity: string; active: boolean }[]}
            ownedItemIds={new Set((ownedInventory as { itemId: string }[]).map((i) => i.itemId))}
          />
          <AdminResetPanel playerId={playerId} userId={player.user.id} />
        </div>
      )}
    </div>
  );
}
