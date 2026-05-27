import { Award } from "lucide-react";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { BadgeAdminPanel } from "./_components/badge-admin-panel";

export default async function InsigniasPage() {
  const session = await auth();
  if (!session?.user) return null;

  const admin = isAdmin(session.user.role);

  const [tournaments, players, badges] = await Promise.all([
    prisma.tournament.findMany({
      select: {
        id: true,
        name: true,
        season: { select: { name: true } }
      },
      orderBy: [{ startDate: "desc" }, { name: "asc" }]
    }),
    prisma.player.findMany({
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" }
    }),
    prisma.leagueBadge.findMany({
      include: {
        tournament: {
          select: {
            name: true,
            season: { select: { name: true } }
          }
        },
        owners: {
          include: { player: { select: { displayName: true } } },
          orderBy: { awardedAt: "desc" }
        }
      },
      orderBy: [{ createdAt: "desc" }, { name: "asc" }]
    })
  ]);

  const mappedBadges = badges.map((badge) => ({
    id: badge.id,
    name: badge.name,
    imageUrl: badge.imageUrl,
    tournamentName: badge.tournament.name,
    seasonName: badge.tournament.season?.name ?? null,
    owners: badge.owners.map((owner) => ({
      id: owner.id,
      playerId: owner.playerId,
      playerName: owner.player.displayName
    }))
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-400">Liga Zikachu</p>
        <h1 className="font-pixel text-base text-[#FFCB05]">Insignias</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Insignias pertencem a um torneio especifico e somam 3 pontos para o jogador dono no ranking do torneio,
          na temporada vinculada e no Ranking Geral em Todas.
        </p>
      </div>

      {mappedBadges.length === 0 && !admin ? (
        <Card>
          <EmptyState message="Nenhuma insignia cadastrada ainda." icon={<Award size={28} />} />
        </Card>
      ) : (
        <BadgeAdminPanel
          admin={admin}
          tournaments={tournaments.map((tournament) => ({
            id: tournament.id,
            name: tournament.name,
            seasonName: tournament.season?.name ?? null
          }))}
          players={players}
          badges={mappedBadges}
        />
      )}
    </div>
  );
}
