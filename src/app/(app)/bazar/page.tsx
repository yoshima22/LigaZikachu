import { Suspense } from "react";
import Link from "next/link";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getOrCreateWallet } from "@/lib/zikacoins";
import { Plus, Store } from "lucide-react";
import { MiauvadaoPanel } from "./_components/miauvadao-panel";
import { BazarListingCard } from "./_components/bazar-listing-card";
import { BazarFeed } from "./_components/bazar-feed";
import { BazarFiltersClient } from "./_components/bazar-filters-client";
import { getListings, getRecentTransactions, getMiauvadaoConfig, autoRefreshMiauvadaoIfNeeded } from "./actions";
import type { BazarItemCategory, BazarListingType } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function BazarPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const searchParams = await searchParamsPromise;

  const session = await getAppSession();
  const playerId = session?.user
    ? (await prisma.player.findUnique({ where: { userId: session.user.id }, select: { id: true } }))?.id ?? null
    : null;

  const wallet = playerId ? await getOrCreateWallet(playerId) : null;

  // Auto-rotate Miauvadão offers if expired / first time
  await autoRefreshMiauvadaoIfNeeded();

  const [listings, transactions, miauvadao] = await Promise.all([
    getListings({
      category: searchParams.cat as BazarItemCategory | undefined,
      type: searchParams.type as BazarListingType | undefined,
      maxPrice: searchParams.maxPrice ? parseInt(searchParams.maxPrice) : undefined,
      sortBy: (searchParams.sort as "newest" | "cheapest" | "expensive") ?? "newest",
    }),
    getRecentTransactions(20),
    getMiauvadaoConfig(),
  ]);

  const dailyOffers = (miauvadao.dailyOffers as unknown[]) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[#FFCB05]/20 bg-gradient-to-r from-[#1A1A2E] via-[#201d38] to-[#1A1A2E] p-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">Liga Zikachu</p>
          <h1 className="font-pixel text-base text-[#FFCB05] flex items-center gap-2">
            <Store size={18}/> Bazar da Liga
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Compre, venda e troque mascotes e itens com outros jogadores.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {wallet && (
            <div className="flex items-center gap-2 rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-4 py-2 text-sm font-bold text-[#FFCB05]">
              💰 {wallet.balance.toLocaleString("pt-BR")} ZC
            </div>
          )}
          {playerId && (
            <>
              <Link href="/bazar/meu-bazar"
                className="rounded-xl border border-border px-3 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors">
                Meus Anúncios
              </Link>
              <Link href="/bazar/criar"
                className="flex items-center gap-1.5 rounded-xl bg-[#FFCB05] px-4 py-2 text-xs font-bold text-[#1A1A2E] hover:bg-[#FFD700] transition-colors">
                <Plus size={13}/> Anunciar
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Miauvadão */}
      <MiauvadaoPanel
        offers={dailyOffers as never}
        vaultBalance={miauvadao.vaultBalance}
        balance={wallet?.balance ?? 0}
        playerId={playerId}
        offersRefreshedAt={miauvadao.offersRefreshedAt?.toISOString() ?? null}
      />

      {/* Filters */}
      <Suspense fallback={null}>
        <BazarFiltersClient />
      </Suspense>

      {/* Listings + Feed */}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-slate-200">Anúncios ativos</h2>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
              {listings.length}
            </span>
          </div>

          {listings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
              <p className="text-3xl">🏪</p>
              <p className="text-sm text-slate-500">Nenhum anúncio encontrado.</p>
              {playerId && (
                <Link href="/bazar/criar"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#FFCB05] px-4 py-2 text-xs font-bold text-[#1A1A2E]">
                  <Plus size={12}/> Criar primeiro anúncio
                </Link>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {listings.map(l => (
                <BazarListingCard
                  key={l.id}
                  listing={{
                    ...l,
                    payload: l.payload as Record<string, unknown>,
                    player: l.player,
                    _count: l._count,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Feed sidebar */}
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-200 text-sm">📡 Atividade recente</h3>
          <BazarFeed transactions={transactions.map(t => ({ ...t, category: t.category as string }))} />
        </div>
      </div>
    </div>
  );
}
