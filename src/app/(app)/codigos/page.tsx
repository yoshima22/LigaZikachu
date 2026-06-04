import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, type BadgeVariant } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { isAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/session";
import {
  BoosterCodeStatus,
  DistributionStatus,
  DistributionReason,
  GiftStatus,
  GiftType,
  SeasonStatus,
  type Prisma
} from "@prisma/client";
import { Package, Ticket } from "lucide-react";
import { CodeAdminPanel } from "./_components/code-admin-panel";
import { CodeRowActions } from "./_components/code-row-actions";
import { CodeFilters } from "./_components/code-filters";
import { PlayerCodeFilters } from "./_components/player-code-filters";
import { assignSpecificCodesToPlayerAction, listBoosterCodesAction } from "./actions";

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

const playerCodeStatusMap: Record<DistributionStatus, { label: string; variant: BadgeVariant }> = {
  ASSIGNED: { label: "Nao ativado", variant: "info" },
  REDEEMED: { label: "Ativado", variant: "success" },
  REVOKED: { label: "Revogado", variant: "danger" },
  EXPIRED: { label: "Expirado", variant: "warning" }
};

interface BoosterGiftPayload {
  code?: string;
  boosterCodeId?: string;
  distributionId?: string | null;
  rewardLabel?: string | null;
  sourceBatch?: string | null;
  reasonDetail?: string | null;
}

function getBoosterGiftPayload(payload: unknown): BoosterGiftPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  return payload as BoosterGiftPayload;
}

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
  const session = await getAppSession();
  if (!session?.user) return null;

  const admin = isAdmin(session.user.role);
  const sp = await searchParams;

  // ===== PLAYER VIEW =====
  if (!admin) {
    const player = await prisma.player.findUnique({
      where: { userId: session.user.id },
      select: { id: true, displayName: true }
    });

    if (!player) {
      return (
        <Card>
          <EmptyState
            message="Crie seu perfil de jogador para receber e consultar codigos."
            icon={<Ticket size={28} />}
          />
        </Card>
      );
    }

    const page = Number(sp.page) || 1;
    const pageSize = 50;
    const search = sp.search || "";
    const distributionStatusFilter = Object.values(DistributionStatus).includes(sp.status as DistributionStatus)
      ? (sp.status as DistributionStatus)
      : undefined;
    const codeStatusFilter = Object.values(BoosterCodeStatus).includes(sp.status as BoosterCodeStatus)
      ? (sp.status as BoosterCodeStatus)
      : undefined;

    const claimedCodeGifts = await prisma.playerGift.findMany({
      where: {
        playerId: player.id,
        type: GiftType.BOOSTER_CODE,
        status: GiftStatus.CLAIMED
      },
      select: {
        claimedAt: true,
        payload: true
      },
      orderBy: { claimedAt: "desc" }
    });

    const giftByDistributionId = new Map<string, { claimedAt: Date | null; payload: BoosterGiftPayload }>();
    const giftByCodeId = new Map<string, { claimedAt: Date | null; payload: BoosterGiftPayload }>();

    for (const gift of claimedCodeGifts) {
      const payload = getBoosterGiftPayload(gift.payload);
      const giftInfo = { claimedAt: gift.claimedAt, payload };
      if (payload.distributionId) giftByDistributionId.set(payload.distributionId, giftInfo);
      if (payload.boosterCodeId) giftByCodeId.set(payload.boosterCodeId, giftInfo);
    }

    const claimedDistributionIds = [...giftByDistributionId.keys()];
    const claimedBoosterCodeIds = [...giftByCodeId.keys()];
    const hasClaimedCodes = claimedDistributionIds.length > 0 || claimedBoosterCodeIds.length > 0;

    const ownershipFilters: Prisma.CodeDistributionWhereInput[] = [];
    if (claimedDistributionIds.length > 0) ownershipFilters.push({ id: { in: claimedDistributionIds } });
    if (claimedBoosterCodeIds.length > 0) ownershipFilters.push({ boosterCodeId: { in: claimedBoosterCodeIds } });

    const where: Prisma.CodeDistributionWhereInput = hasClaimedCodes
      ? {
          playerId: player.id,
          ...(distributionStatusFilter ? { status: distributionStatusFilter } : {}),
          ...(codeStatusFilter ? { boosterCode: { is: { status: codeStatusFilter } } } : {}),
          OR: ownershipFilters,
          ...(search
            ? {
                AND: [
                  {
                    OR: [
                      { reasonDetail: { contains: search, mode: "insensitive" } },
                      { boosterCode: { is: { code: { contains: search, mode: "insensitive" } } } },
                      { boosterCode: { is: { rewardLabel: { contains: search, mode: "insensitive" } } } },
                      { boosterCode: { is: { sourceBatch: { contains: search, mode: "insensitive" } } } }
                    ]
                  }
                ]
              }
            : {})
        }
      : { id: "__no_claimed_codes__" };

    const skip = (page - 1) * pageSize;
    const [distributions, total] = await Promise.all([
      prisma.codeDistribution.findMany({
        where,
        include: {
          boosterCode: {
            include: {
              season: { select: { name: true } }
            }
          }
        },
        orderBy: [{ assignedAt: "desc" }],
        skip,
        take: pageSize
      }),
      prisma.codeDistribution.count({ where })
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-pixel text-base text-[#FFCB05] leading-snug">Meus codigos</h1>
          <p className="mt-1 text-sm text-slate-400">
            Codigos recebidos da Caixa de Presentes ficam aqui para consulta e ativacao.
          </p>
        </div>

        <PlayerCodeFilters totalPages={totalPages} currentPage={page} />

        <p className="text-xs text-slate-500">
          {total} codigo(s) recebido(s)
          {total > pageSize && ` (mostrando ${distributions.length})`}
        </p>

        {distributions.length === 0 ? (
          <Card>
            <EmptyState
              message="Nenhum codigo recebido ainda. Abra presentes pendentes para enviar codigos para esta lista."
              icon={<Ticket size={28} />}
              action={
                <Button asChild>
                  <Link href="/caixa-de-presentes">Ir para Caixa de Presentes</Link>
                </Button>
              }
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
                    <th className="px-5 py-3">Recompensa</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Recebido em</th>
                    <th className="px-5 py-3">Ativado em</th>
                    <th className="px-5 py-3">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {distributions.map((distribution) => {
                    const status =
                      distribution.boosterCode.status === BoosterCodeStatus.INVALIDATED
                        ? codeStatusMap.INVALIDATED
                        : playerCodeStatusMap[distribution.status];
                    const giftInfo =
                      giftByDistributionId.get(distribution.id) ??
                      giftByCodeId.get(distribution.boosterCodeId);
                    const rewardDetail =
                      distribution.boosterCode.rewardLabel ??
                      distribution.boosterCode.sourceBatch ??
                      distribution.reasonDetail ??
                      giftInfo?.payload.reasonDetail ??
                      "-";

                    return (
                      <tr key={distribution.id}>
                        <td className="px-5 py-3 font-mono text-xs font-semibold text-white">
                          {distribution.boosterCode.code}
                        </td>
                        <td className="px-5 py-3 text-slate-300">
                          {distribution.boosterCode.season?.name ?? "-"}
                        </td>
                        <td className="px-5 py-3 text-slate-300">{rewardDetail}</td>
                        <td className="px-5 py-3">
                          <StatusBadge variant={status.variant} label={status.label} />
                        </td>
                        <td className="px-5 py-3 text-slate-400">{formatDate(giftInfo?.claimedAt ?? null)}</td>
                        <td className="px-5 py-3 text-slate-400">{formatDate(distribution.redeemedAt)}</td>
                        <td className="px-5 py-3">
                          <CodeRowActions
                            codeId={distribution.boosterCodeId}
                            codeStatus={distribution.boosterCode.status}
                            distributionId={distribution.id}
                            distributionStatus={distribution.status}
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

  // ===== ADMIN VIEW =====
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
        <form
          action={async (formData) => {
            "use server";
            const codeIds = formData.getAll("codeIds").map(String).filter(Boolean);
            const targetPlayerId = String(formData.get("bulkPlayerId") ?? "");
            const reasonDetail = String(formData.get("bulkReasonDetail") ?? "");

            await assignSpecificCodesToPlayerAction({
              boosterCodeIds: codeIds,
              playerId: targetPlayerId,
              reason: DistributionReason.MANUAL_ADJUSTMENT,
              reasonDetail: reasonDetail || null
            });
          }}
          className="space-y-3"
        >
          <Card className="flex flex-wrap items-end gap-3 p-4">
            <div className="min-w-56 flex-1">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-slate-500">
                Enviar selecionados para
              </label>
              <select
                name="bulkPlayerId"
                className="w-full rounded-xl border border-border bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
                required
              >
                {players.map((player) => (
                  <option key={player.id} value={player.id}>{player.displayName}</option>
                ))}
              </select>
            </div>
            <div className="min-w-56 flex-1">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-slate-500">
                Detalhe do presente
              </label>
              <input
                name="bulkReasonDetail"
                placeholder="Opcional"
                className="w-full rounded-xl border border-border bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
              />
            </div>
            <Button type="submit" disabled={players.length === 0}>
              Enviar codigos selecionados
            </Button>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-slate-900/70 text-left text-xs uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Selecionar</th>
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
                    const activeDistribution =
                      latestDistribution?.status === DistributionStatus.REVOKED ? null : latestDistribution;
                    return (
                      <tr key={code.id}>
                        <td className="px-5 py-3">
                          <input
                            type="checkbox"
                            name="codeIds"
                            value={code.id}
                            disabled={code.status !== BoosterCodeStatus.AVAILABLE}
                            className="h-4 w-4 rounded border-border bg-slate-900 text-[#FFCB05] disabled:opacity-30"
                            aria-label={`Selecionar codigo ${code.code}`}
                          />
                        </td>
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
                          {activeDistribution?.player?.displayName ?? (
                            <span className="text-slate-600 italic">Sem dono</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-slate-400">{formatDate(code.importedAt)}</td>
                        <td className="px-5 py-3">
                          <CodeRowActions
                            admin
                            codeId={code.id}
                            codeStatus={code.status}
                            distributionId={activeDistribution?.id}
                            distributionStatus={activeDistribution?.status}
                            players={players}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </form>
      )}
    </div>
  );
}
