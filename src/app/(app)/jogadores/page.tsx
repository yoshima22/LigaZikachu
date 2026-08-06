import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/auth/permissions";
import { getCachedPlayerRanking } from "@/lib/ranking-cache";
import { PlayerFilters } from "./_components/player-filters";
import { PlayersTable, type PlayerRow } from "./_components/players-table";
import { Prisma, SeasonStatus, UserStatus } from "@prisma/client";
import Link from "next/link";

const PAGE_SIZE = 40;

interface SearchParams {
  q?: string;
  status?: string;
  page?: string;
}

export default async function PlayersPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [session, { q = "", status: statusFilter = "", page: pageParam = "1" }] = await Promise.all([
    getAppSession(),
    searchParams
  ]);

  if (!session?.user) return null;

  const statusWhere =
    statusFilter && Object.values(UserStatus).includes(statusFilter as UserStatus)
      ? ({ status: statusFilter as UserStatus } as const)
      : {};

  const page = Math.max(1, Number.parseInt(pageParam, 10) || 1);
  const where: Prisma.UserWhereInput = {
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
  };
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
    where,
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
    orderBy: { createdAt: "asc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  })]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Ranking da temporada ativa para V/D
  const activeSeason = await prisma.season.findFirst({
    where: { status: SeasonStatus.ACTIVE },
    orderBy: { createdAt: "desc" }
  });

  const ranking = activeSeason ? await getCachedPlayerRanking(activeSeason.id) : [];
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

  const admin = isStaff(session.user.role);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-pixel text-base text-[#FFCB05] leading-snug">Jogadores</h1>
          <p className="mt-1 text-sm text-slate-400">{total} jogador(es) encontrado(s)</p>
        </div>
      </div>

      <PlayerFilters q={q} status={statusFilter} />

      <PlayersTable
        players={rows}
        seasonId={activeSeason?.id ?? ""}
        currentUserId={session.user.id}
        currentUserRole={session.user.role}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          {page > 1 ? (
            <Link href={`/jogadores?${new URLSearchParams({ ...(q ? { q } : {}), ...(statusFilter ? { status: statusFilter } : {}), page: String(page - 1) })}`} className="rounded-lg border border-border bg-slate-900 px-4 py-2 text-xs text-slate-300 hover:text-white">← Anterior</Link>
          ) : <span className="rounded-lg border border-border px-4 py-2 text-xs text-slate-600">← Anterior</span>}
          <span className="text-xs text-slate-500">Página {Math.min(page, totalPages)} de {totalPages}</span>
          {page < totalPages ? (
            <Link href={`/jogadores?${new URLSearchParams({ ...(q ? { q } : {}), ...(statusFilter ? { status: statusFilter } : {}), page: String(page + 1) })}`} className="rounded-lg border border-border bg-slate-900 px-4 py-2 text-xs text-slate-300 hover:text-white">Próxima →</Link>
          ) : <span className="rounded-lg border border-border px-4 py-2 text-xs text-slate-600">Próxima →</span>}
        </div>
      )}

      {!admin && (
        <p className="text-center text-xs text-slate-600">
          Clique em um jogador para ver o perfil completo
        </p>
      )}
    </div>
  );
}
