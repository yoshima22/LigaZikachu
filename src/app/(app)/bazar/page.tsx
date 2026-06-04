import { Suspense } from "react";
import Link from "next/link";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getOrCreateWallet } from "@/lib/zikacoins";
import { Plus, Store, ChevronDown } from "lucide-react";
import { isAdmin } from "@/lib/auth/permissions";
import { MiauvadaoPanel } from "./_components/miauvadao-panel";
import { ShellGame } from "./_components/shell-game";
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
  const admin = session?.user ? isAdmin(session.user.role) : false;
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
        lastNpcMessage={miauvadao.lastNpcMessage ?? miauvadao.lastWinnerMessage ?? null}
      />

      {/* Shell Game */}
      <ShellGame
        balance={wallet?.balance ?? 0}
        playerId={playerId}
        vaultBalance={miauvadao.vaultBalance}
        lastWinnerMessage={miauvadao.lastWinnerMessage ?? null}
        isAdmin={admin}
      />

      {/* Filters */}
      <Suspense fallback={null}>
        <BazarFiltersClient />
      </Suspense>

      {/* FAQ accordion */}
      <details className="rounded-2xl border overflow-hidden group" style={{ borderColor: "#5a4700", background: "#0e0c06" }}>
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm font-semibold select-none"
          style={{ color: "#c9a800" }}>
          <span className="flex items-center gap-2">📖 Como funciona o Bazar e o Miauvadão?</span>
          <ChevronDown size={14} className="transition-transform group-open:rotate-180" style={{ color: "#5a4700" }} />
        </summary>
        <div className="border-t px-5 py-4 grid gap-4 sm:grid-cols-2 text-xs leading-relaxed"
          style={{ borderColor: "#5a4700", color: "#8b6c00" }}>

          <div className="space-y-1">
            <p className="font-semibold" style={{ color: "#c9a800" }}>🏪 Como anunciar no Bazar</p>
            <p>Clique em <strong style={{ color: "#c9a800" }}>Anunciar</strong> e escolha mascotes ou itens do seu inventário. Defina preço de venda, troca ou ambos. Itens ficam bloqueados enquanto anunciados. Taxa: <strong style={{ color: "#FFCB05" }}>10 ZC por anúncio</strong> (vai ao cofre do Miauvadão).</p>
          </div>

          <div className="space-y-1">
            <p className="font-semibold" style={{ color: "#c9a800" }}>💰 Cofre do Miauvadão</p>
            <p>O cofre é alimentado por: <strong style={{ color: "#FFCB05" }}>taxas de anúncio (10 ZC)</strong>, <strong style={{ color: "#FFCB05" }}>10% de cada compra</strong> nas ofertas, <strong style={{ color: "#FFCB05" }}>apostas perdidas</strong> no jogo e <strong style={{ color: "#FFCB05" }}>investimentos de jogadores (80 ZC)</strong>. Quanto mais cheio, melhores os descontos e prêmios.</p>
          </div>

          <div className="space-y-1">
            <p className="font-semibold" style={{ color: "#c9a800" }}>📊 Como os descontos são calculados</p>
            <p>Desconto base = faixa da raridade do item (COMMON: 15–35%, EPIC: 8–20%, LEGENDARY: 5–15%). Bônus do cofre: +1% por cada 500 ZC no cofre (máx +20%). Refresh por jogador: +5% extra em todos os itens.</p>
          </div>

          <div className="space-y-1">
            <p className="font-semibold" style={{ color: "#c9a800" }}>🔄 Atualizar Ofertas (80 ZC)</p>
            <p>Qualquer jogador pode pagar 80 ZC para atualizar as 3 ofertas do dia imediatamente. Os 80 ZC vão ao cofre, gerando descontos ainda melhores. O <strong style={{ color: "#FFCB05" }}>contador de tempo não reinicia</strong> — só os itens mudam.</p>
          </div>

          <div className="space-y-1">
            <p className="font-semibold" style={{ color: "#c9a800" }}>🎩 Jogo Shell Game</p>
            <p>Aposte entre 50–2000 ZC. A bolinha aparece num copo e os copos embaralham. Adivinhe certo e ganhe sua aposta + <strong style={{ color: "#FFCB05" }}>20% do cofre</strong>. Perca e a aposta vai ao cofre. Cooldown de 5 min entre partidas.</p>
          </div>

          <div className="space-y-1">
            <p className="font-semibold" style={{ color: "#c9a800" }}>🔄 Ciclo econômico</p>
            <p>Taxas → cofre → melhores descontos → mais compras → mais no cofre → prêmios maiores no jogo. O cofre é um <strong style={{ color: "#FFCB05" }}>sink econômico saudável</strong> que retira ZC da circulação e distribui em benefícios para todos.</p>
          </div>
        </div>
      </details>

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
