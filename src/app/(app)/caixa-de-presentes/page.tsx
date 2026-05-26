import { redirect } from "next/navigation";
import { Gift, PackageOpen, Ticket } from "lucide-react";
import { GiftStatus, GiftType } from "@prisma/client";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, type BadgeVariant } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { claimAllGifts, claimGift } from "./actions";

export const dynamic = "force-dynamic";

const giftStatusMap: Record<GiftStatus, { label: string; variant: BadgeVariant }> = {
  UNCLAIMED: { label: "Disponivel", variant: "pending" },
  CLAIMED: { label: "Recebido", variant: "success" },
  EXPIRED: { label: "Expirado", variant: "warning" }
};

const giftTypeLabels: Record<GiftType, string> = {
  BOOSTER_CODE: "Codigo de booster",
  BADGE: "Insignia",
  ACHIEVEMENT: "Conquista",
  CUSTOM: "Presente"
};

interface BoosterPayload {
  code?: string;
  boosterCodeId?: string;
  distributionId?: string | null;
  seasonId?: string | null;
  rewardLabel?: string | null;
  sourceBatch?: string | null;
  reason?: string;
  reasonDetail?: string | null;
}

function formatDate(date: Date | null) {
  if (!date) return "-";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getBoosterPayload(payload: unknown): BoosterPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  return payload as BoosterPayload;
}

export default async function GiftBoxPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const player = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: { id: true, displayName: true }
  });

  if (!player) {
    return (
      <Card>
        <EmptyState message="Crie seu perfil de jogador para receber presentes." icon={<Gift size={28} />} />
      </Card>
    );
  }

  const gifts = await prisma.playerGift.findMany({
    where: {
      playerId: player.id,
      status: GiftStatus.UNCLAIMED
    },
    orderBy: { createdAt: "desc" }
  });
  const unclaimedCount = gifts.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-pixel text-base leading-snug text-[#FFCB05]">Caixa de presentes</h1>
          <p className="mt-1 text-sm text-slate-400">
            Presentes enviados para {player.displayName}. Codigos, insignias e titulos futuros chegam aqui antes de entrar na sua conta.
          </p>
        </div>

        {unclaimedCount > 0 && (
          <form
            action={async () => {
              "use server";
              await claimAllGifts({ playerId: player.id });
            }}
          >
            <Button type="submit" className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
              <PackageOpen size={16} className="mr-2" />
              Receber todos ({unclaimedCount})
            </Button>
          </form>
        )}
      </div>

      {gifts.length === 0 ? (
        <Card>
          <EmptyState message="Nenhum presente pendente. Presentes recebidos aparecem em suas areas correspondentes." icon={<Gift size={28} />} />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {gifts.map((gift) => {
            const status = giftStatusMap[gift.status];
            const payload = getBoosterPayload(gift.payload);
            const rewardDetail =
              payload.rewardLabel ?? payload.sourceBatch ?? payload.reasonDetail ?? gift.description;

            return (
              <Card key={gift.id} className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">{giftTypeLabels[gift.type]}</p>
                    <h2 className="mt-1 text-base font-semibold text-white">{gift.title}</h2>
                  </div>
                  <StatusBadge variant={status.variant} label={status.label} />
                </div>

                {gift.description && gift.description !== rewardDetail && (
                  <p className="text-sm text-slate-300">{gift.description}</p>
                )}

                {rewardDetail && (
                  <div className="rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#FFCB05]/80">
                      Recompensa
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-100">{rewardDetail}</p>
                  </div>
                )}

                {gift.type === GiftType.BOOSTER_CODE && (
                  <div className="rounded-xl border border-border bg-slate-900/60 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                      <Ticket size={13} /> Codigo
                    </div>
                    <p className="text-sm text-slate-400">Receba este presente para enviar o codigo para Meus Codigos.</p>
                  </div>
                )}

                <dl className="grid gap-2 text-xs text-slate-500">
                  <div className="flex justify-between gap-3">
                    <dt>Recebido em</dt>
                    <dd className="text-slate-300">{formatDate(gift.createdAt)}</dd>
                  </div>
                  {gift.claimedAt && (
                    <div className="flex justify-between gap-3">
                      <dt>Resgatado em</dt>
                      <dd className="text-slate-300">{formatDate(gift.claimedAt)}</dd>
                    </div>
                  )}
                  {gift.expiresAt && (
                    <div className="flex justify-between gap-3">
                      <dt>Expira em</dt>
                      <dd className="text-slate-300">{formatDate(gift.expiresAt)}</dd>
                    </div>
                  )}
                </dl>

                {gift.status === GiftStatus.UNCLAIMED && (
                  <form
                    action={async () => {
                      "use server";
                      await claimGift({ giftId: gift.id });
                    }}
                    className="mt-auto"
                  >
                    <Button type="submit" className="w-full">
                      Receber presente
                    </Button>
                  </form>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
