import { auth } from "@/auth";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, type BadgeVariant } from "@/components/ui/status-badge";
import { isAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { BoosterCodeStatus, DistributionStatus } from "@prisma/client";
import { Package, Ticket } from "lucide-react";

export const dynamic = "force-dynamic";

const codeStatusMap: Record<BoosterCodeStatus, { label: string; variant: BadgeVariant }> = {
  AVAILABLE: { label: "Disponivel", variant: "active" },
  ASSIGNED: { label: "Atribuido", variant: "info" },
  REDEEMED: { label: "Resgatado", variant: "success" },
  INVALIDATED: { label: "Invalidado", variant: "danger" },
  EXPIRED: { label: "Expirado", variant: "warning" }
};

const distributionStatusMap: Record<DistributionStatus, { label: string; variant: BadgeVariant }> = {
  ASSIGNED: { label: "Atribuido", variant: "info" },
  REDEEMED: { label: "Resgatado", variant: "success" },
  REVOKED: { label: "Revogado", variant: "danger" },
  EXPIRED: { label: "Expirado", variant: "warning" }
};

function formatDate(date: Date | null) {
  if (!date) return "-";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

export default async function CodesPage() {
  const session = await auth();
  if (!session?.user) return null;

  const admin = isAdmin(session.user.role);

  if (!admin) {
    const player = await prisma.player.findUnique({
      where: { userId: session.user.id },
      select: { id: true, displayName: true }
    });

    const distributions = player
      ? await prisma.codeDistribution.findMany({
          where: {
            playerId: player.id,
            status: { not: DistributionStatus.REVOKED }
          },
          include: {
            boosterCode: true,
            season: { select: { name: true } },
            assignedBy: { select: { name: true, email: true } }
          },
          orderBy: { assignedAt: "desc" }
        })
      : [];

    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-pixel text-base text-[#FFCB05] leading-snug">
            Meus codigos
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Codigos de booster atribuidos ao seu jogador.
          </p>
        </div>

        {distributions.length === 0 ? (
          <Card>
            <EmptyState
              message="Nenhum codigo foi atribuido a voce ainda."
              icon={<Ticket size={28} />}
            />
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-slate-900/70 text-left text-xs uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Codigo</th>
                    <th className="px-5 py-3">Temporada</th>
                    <th className="px-5 py-3">Motivo</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Atribuido em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {distributions.map((distribution) => {
                    const status = distributionStatusMap[distribution.status];
                    return (
                      <tr key={distribution.id}>
                        <td className="px-5 py-3 font-mono text-xs font-semibold text-white">
                          {distribution.boosterCode.code}
                        </td>
                        <td className="px-5 py-3 text-slate-300">
                          {distribution.season?.name ?? "-"}
                        </td>
                        <td className="px-5 py-3 text-slate-300">
                          {distribution.reasonDetail ?? distribution.reason}
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge variant={status.variant} label={status.label} />
                        </td>
                        <td className="px-5 py-3 text-slate-400">
                          {formatDate(distribution.assignedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    );
  }

  const [codes, totals] = await Promise.all([
    prisma.boosterCode.findMany({
      include: {
        season: { select: { name: true } },
        distributions: {
          include: {
            player: { select: { displayName: true } },
            assignedBy: { select: { name: true, email: true } }
          }
        }
      },
      orderBy: [{ status: "asc" }, { importedAt: "desc" }],
      take: 200
    }),
    prisma.boosterCode.groupBy({
      by: ["status"],
      _count: { _all: true }
    })
  ]);

  const totalByStatus = new Map(totals.map((item) => [item.status, item._count._all]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-pixel text-base text-[#FFCB05] leading-snug">
          Codigos de booster
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Estoque, atribuicoes e historico inicial de codigos da liga.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Object.values(BoosterCodeStatus).map((status) => {
          const meta = codeStatusMap[status];
          return (
            <Card key={status} className="p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">{meta.label}</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {totalByStatus.get(status) ?? 0}
              </p>
            </Card>
          );
        })}
      </div>

      {codes.length === 0 ? (
        <Card>
          <EmptyState message="Nenhum codigo cadastrado." icon={<Package size={28} />} />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-slate-900/70 text-left text-xs uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-5 py-3">Codigo</th>
                  <th className="px-5 py-3">Temporada</th>
                  <th className="px-5 py-3">Recompensa</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Jogador</th>
                  <th className="px-5 py-3">Importado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {codes.map((code) => {
                  const status = codeStatusMap[code.status];
                  const latestDistribution = code.distributions[0];
                  return (
                    <tr key={code.id}>
                      <td className="px-5 py-3 font-mono text-xs font-semibold text-white">
                        {code.code}
                      </td>
                      <td className="px-5 py-3 text-slate-300">{code.season?.name ?? "-"}</td>
                      <td className="px-5 py-3 text-slate-300">
                        {code.rewardLabel ?? code.sourceBatch ?? "-"}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge variant={status.variant} label={status.label} />
                      </td>
                      <td className="px-5 py-3 text-slate-300">
                        {latestDistribution?.player?.displayName ?? "-"}
                      </td>
                      <td className="px-5 py-3 text-slate-400">{formatDate(code.importedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
