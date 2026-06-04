import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth/permissions";
import { computePlayerRanking } from "@/lib/ranking";
import { PlayerFilters } from "./_components/player-filters";
import { PlayersTable, type PlayerRow } from "./_components/players-table";
import { SeasonStatus, UserStatus } from "@prisma/client";

interface SearchParams {
  q?: string;
  status?: string;
}

export default async function PlayersPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [session, { q = "", status: statusFilter = "" }] = await Promise.all([
    getAppSession(),
    searchParams
  ]);

  if (!session?.user) return null;

  const statusWhere =
    statusFilter && Object.values(UserStatus).includes(statusFilter as UserStatus)
      ? ({ status: statusFilter as UserStatus } as const)
      : {};

  const users = await prisma.user.findMany({
    where: {
      player: { isNot: null },
      ...statusWhere,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { player: { displayName: { contains: q, mode: "insensitive" } } },
              { player: { ptcglNick: { contains: q, mode: "insensitive" } } }
            ]
          }
        : {})
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      status: true,
      role: true,
      player: {
        select: {
          id: true,
          displayName: true,
          ptcglNick: true,
          whatsapp: true,
          notes: true
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  // Ranking da temporada ativa para V/D
  const activeSeason = await prisma.season.findFirst({
    where: { status: SeasonStatus.ACTIVE },
    orderBy: { createdAt: "desc" }
  });

  const ranking = activeSeason ? await computePlayerRanking(activeSeason.id) : [];
  const rankMap = new Map(ranking.map((r) => [r.playerId, r]));

  const rows: PlayerRow[] = users
    .filter((u) => u.player !== null)
    .map((u) => {
      const p = u.player!;
      const stats = rankMap.get(p.id);
      return {
        userId: u.id,
        playerId: p.id,
        displayName: p.displayName,
        ptcglNick: p.ptcglNick,
        email: u.email,
        status: u.status,
        role: u.role,
        image: u.image,
        whatsapp: p.whatsapp,
        notes: p.notes,
        wins: stats?.wins ?? 0,
        losses: stats?.losses ?? 0
      };
    });

  const admin = isAdmin(session.user.role);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-pixel text-base text-[#FFCB05] leading-snug">Jogadores</h1>
          <p className="mt-1 text-sm text-slate-400">{rows.length} jogador(es) encontrado(s)</p>
        </div>
      </div>

      <PlayerFilters q={q} status={statusFilter} />

      <PlayersTable
        players={rows}
        seasonId={activeSeason?.id ?? ""}
        currentUserId={session.user.id}
        currentUserRole={session.user.role}
      />

      {!admin && (
        <p className="text-center text-xs text-slate-600">
          Clique em um jogador para ver o perfil completo
        </p>
      )}
    </div>
  );
}
