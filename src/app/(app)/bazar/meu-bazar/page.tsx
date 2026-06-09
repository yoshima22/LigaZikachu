import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { MyListingsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function MeuBazarPage() {
  const session = await getAppSession();
  if (!session?.user) return notFound();

  const player = await prisma.player.findUnique({ where: { userId: session.user.id } });
  if (!player) return notFound();

  // Anúncios ativos/reservados — todos; vendidos/cancelados — apenas últimos 4
  const [activeListings, soldListings] = await Promise.all([
    prisma.bazarListing.findMany({
      where: { playerId: player.id, status: { in: ["ACTIVE", "RESERVED"] } },
      include: {
        proposals: {
          include: { proposer: { select: { id: true, displayName: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.bazarListing.findMany({
      where: { playerId: player.id, status: { in: ["SOLD", "EXPIRED", "CANCELLED"] } },
      include: {
        proposals: {
          include: { proposer: { select: { id: true, displayName: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
  ]);
  const listings = [...activeListings, ...soldListings];

  // Últimas 5 propostas enviadas
  const sentProposals = await prisma.bazarProposal.findMany({
    where: { proposerId: player.id },
    include: {
      listing: {
        include: { player: { select: { displayName: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/bazar" className="rounded-lg border border-border p-2 text-slate-400 hover:text-slate-200">
            <ArrowLeft size={16}/>
          </Link>
          <div>
            <h1 className="font-pixel text-base text-[#FFCB05]">Meus Anúncios</h1>
            <p className="text-xs text-slate-500">
              Gerencie seus anúncios e propostas.{" "}
              <span className="text-slate-400">Limite: <strong className="text-[#FFCB05]">8 anúncios</strong> ativos simultâneos · últimos <strong className="text-[#FFCB05]">4 vendidos</strong> exibidos.</span>
            </p>
          </div>
        </div>
        <Link href="/bazar/criar"
          className="flex items-center gap-1.5 rounded-xl bg-[#FFCB05] px-3 py-2 text-xs font-bold text-[#1A1A2E] hover:bg-[#FFD700]">
          <Plus size={12}/> Novo
        </Link>
      </div>

      <MyListingsClient
        listings={listings.map(l => ({
          id: l.id,
          category: l.category,
          listingType: l.listingType,
          status: l.status,
          payload: l.payload as Record<string, unknown>,
          priceCoins: l.priceCoins,
          expiresAt: l.expiresAt,
          createdAt: l.createdAt,
          proposals: l.proposals.map(p => ({
            id: p.id,
            proposerName: p.proposer.displayName,
            coinsOffer: p.coinsOffer,
            itemsOffer: Array.isArray(p.itemsOffer)
              ? p.itemsOffer as Array<{ type: string; quantity: number; displayName: string; mascotId?: string }>
              : null,
            message: p.message,
            status: p.status,
            createdAt: p.createdAt,
          })),
        }))}
        sentProposals={sentProposals.map(p => ({
          id: p.id,
          listingId: p.listingId,
          sellerName: p.listing.player.displayName,
          listingPayload: p.listing.payload as Record<string, unknown>,
          coinsOffer: p.coinsOffer,
          itemsOffer: Array.isArray(p.itemsOffer)
            ? p.itemsOffer as Array<{ type: string; quantity: number; displayName: string; mascotId?: string }>
            : null,
          message: p.message,
          status: p.status,
          createdAt: p.createdAt,
        }))}
      />
    </div>
  );
}
