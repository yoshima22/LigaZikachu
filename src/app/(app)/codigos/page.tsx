import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, type BadgeVariant } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { isAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  BoosterCodeStatus,
  DistributionStatus,
  SeasonStatus
} from "@prisma/client";
import { Package, Ticket } from "lucide-react";
import { CodeAdminPanel } from "./_components/code-admin-panel";
import { CodeRowActions } from "./_components/code-row-actions";
import { CodeFilters } from "./_components/code-filters";
import { listBoosterCodesAction } from "./actions";

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

interface CodesPageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    playerId?: string;
    page?: string;
  }>;
}

export default async function CodesPage({ searchParams }: CodesPageProps) {
  const session = await auth();
  if (!session?.user) return null;

  const admin = isAdmin(session.user.role);

  // ===== PLAYER VIEW =====
  if (!admin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-pixel text-base text-[#FFCB05] leading-snug">Meus codigos</h1>
          <p className="mt-1 text-sm text-slate-400">
            Codigos enviados pela liga agora chegam primeiro na sua Caixa de Presentes.
          </p>
        </div>

        <Card>
          <EmptyState
            message="Abra sua Caixa de Presentes para receber codigos, insignias e outros premios."
            icon={<Ticket size={28} />}
            action={
              <Button asChild>
                <Link href="/caixa-de-presentes">Ir para Caixa de Presentes</Link>
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  // ===== ADMIN VIEW =====
  const sp = await searchParams;
  const page = Number(sp.page) || 1;
  const search = sp.search || "";
  const statusFilter = sp.status as BoosterCodeStatus | undefined;
  const playerFilter = sp.playerId;

  const [codesResult, totals, seasons, players, availableCount] = await Promise.all([
    listBoosterCodesAction({
      search,
      status: statusFilter,
      playerId: playerFilter === "NONE" ? undefined : playerFilter,
      page,
      pageSize: 50,
    }),
    prisma.boosterCode.groupBy({
      by: ["status"],
      _count: { _all: true }
    }),
    prisma.season.findMany({
      select: { id: true, name: true, status: true },
      orderBy: [{ status: "asc" }, { startDate: "desc" }]
    }),
    prisma.player.findMany({
      where: {
        active: true,
        user: { status: "ACTIVE" }
      },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" }
    }),
    prisma.boosterCode.count({
      where: {
        status: BoosterCodeStatus.AVAILABLE,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      }
    })
  ]);

  const totalByStatus = new Map(totals.map((item) => [item.status, item._count._all]));
  const defaultSeasonId =
    seasons.find((season) => season.status === SeasonStatus.ACTIVE)?.id ??
    seasons[0]?.id ??
    "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-pixel text-base text-[#FFCB05] leading-snug">Codigos de booster</h1>
        <p className="mt-1 text-sm text-slate-400">Estoque, atribuicoes e historico de codigos da liga.</p>
      </div>

      <CodeAdminPanel
        seasons={seasons}
        players={players}
        defaultSeasonId={defaultSeasonId}
        availableCount={availableCount}
      />

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

      <CodeFilters
        players={players}
        totalPages={codesResult.totalPages}
        currentPage={codesResult.page}
      />

      <p className="text-xs text-slate-500">
        {codesResult.total} codigo(s) encontrado(s)
        {codesResult.total > codesResult.pageSize && ` (mostrando ${codesResult.codes.length})`}
      </p>

      {codesResult.codes.length === 0 ? (
        <Card>
          <EmptyState message="Nenhum codigo encontrado." icon={<Package size={28} />} />
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
                  <th className="px-5 py-3">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {codesResult.codes.map((code) => {
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
                        {latestDistribution?.player?.displayName ?? (
                          <span className="text-slate-600 italic">Sem dono</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-400">{formatDate(code.importedAt)}</td>
                      <td className="px-5 py-3">
                        <CodeRowActions
                          admin
                          codeId={code.id}
                          codeStatus={code.status}
                          distributionId={latestDistribution?.id}
                          distributionStatus={latestDistribution?.status}
                        />
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
