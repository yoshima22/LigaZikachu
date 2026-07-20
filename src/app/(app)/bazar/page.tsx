import { Suspense } from "react";
import Link from "next/link";
import { getAppSession, getSessionPlayer } from "@/lib/session";
import { getOrCreateWallet } from "@/lib/zikacoins";
import { Plus, Store, ChevronDown, ShieldCheck, RefreshCw, Coins } from "lucide-react";
import { isAdmin } from "@/lib/auth/permissions";
import { MiauvadaoPanel } from "./_components/miauvadao-panel";
import { ShellGame } from "./_components/shell-game";
import { BazarListingCard } from "./_components/bazar-listing-card";
import { BazarFeed } from "./_components/bazar-feed";
import { BazarFiltersClient } from "./_components/bazar-filters-client";
import { BazarPagination } from "./_components/bazar-pagination";
import { autoRefreshMiauvadaoIfNeeded, getMiauvadaoConfig, markBazarProposalsViewed } from "./actions";
import { getCachedListings, getCachedRecentTransactions } from "./queries";
import type { BazarItemCategory, BazarListingType } from "@prisma/client";
import { ManualRefreshButton } from "@/app/(app)/_components/manual-refresh-button";
import { getActiveRaidSabotages, getOrderStepUnlockState } from "@/lib/raid-event";
import { MysteryStepButton } from "@/app/(app)/combates/ordem-da-trapaca/_components/mystery-step-button";

export const dynamic = "force-dynamic";

export default async function BazarPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const searchParams = await searchParamsPromise;

  const session = await getAppSession();
  const admin = session?.user ? isAdmin(session.user.role) : false;
  const currentPlayer = session?.user ? await getSessionPlayer(session.user.id) : null;
  const playerId = currentPlayer?.id ?? null;

  const wallet = playerId ? await getOrCreateWallet(playerId) : null;

  // Manutenção do Bazar — fire-and-forget: não bloqueia o carregamento da página
  // (rotação de ofertas do Miauvadão e limpeza de anúncios expirados)
  // Marcar propostas respondidas como vistas — invalida o badge do nav
  const [, listingsResult, transactions, miauvadao, raidSabotages, bazarStepState] = await Promise.all([
    markBazarProposalsViewed(),
    getCachedListings({
      category: searchParams.cat as BazarItemCategory | undefined,
      type: searchParams.type as BazarListingType | undefined,
      maxPrice: searchParams.maxPrice ? parseInt(searchParams.maxPrice) : undefined,
      sortBy: (searchParams.sort as "newest" | "cheapest" | "expensive") ?? "newest",
      search: searchParams.q || undefined,
      page: searchParams.page ? parseInt(searchParams.page) : 1,
    }),
    getCachedRecentTransactions(6),
    getMiauvadaoConfig(),
    getActiveRaidSabotages("BAZAR"),
    getOrderStepUnlockState("BAZAR_SLOT_SIX_CLICKS"),
  ]);
  const blockedSlotSabotage = raidSabotages.find((s) => s.sabotageType === "BLOCK_BAZAR_SLOT");
  const shouldShowBazarAnomaly = Boolean(blockedSlotSabotage) || (bazarStepState.active && bazarStepState.unlocked && !bazarStepState.resolved);

  // Auto-refresh ofertas do Miauvadão se o timer expirou.
  // Usa o config retornado diretamente (sem passar pelo cache) quando houve roll.
  const refreshResult = await autoRefreshMiauvadaoIfNeeded().catch(() => null);
  const freshMiauvadao = refreshResult?.freshConfig ?? miauvadao;

  const { listings, total, page, totalPages } = listingsResult;

  const dailyOffers = (freshMiauvadao.dailyOffers as unknown[]) ?? [];

  const REFRESH_DAILY_LIMIT = 3;
  const todayBRT = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const refreshData = (freshMiauvadao.playerRefreshData ?? {}) as Record<string, { date?: string; count?: number }>;
  const globalRefreshCount = refreshData["__global__"]?.date === todayBRT ? (refreshData["__global__"]?.count ?? 0) : 0;
  const refreshesRemaining = Math.max(0, REFRESH_DAILY_LIMIT - globalRefreshCount);

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
          <ManualRefreshButton label="Atualizar Bazar" />
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
              {admin && (
                <Link href="/bazar/admin"
                  className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors">
                  ⚙️ Admin
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      {admin && (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="flex items-center gap-2 text-sm font-bold text-red-300">
                <ShieldCheck size={15} />
                Controles admin do Bazar
              </p>
              <p className="text-xs text-slate-500">
                Ajuste ZC do cofre, publique ofertas manuais ou gere novas ofertas do Miauvadão. O modo debug do copos aparece no Jogo do Miauvadão para contas admin.
              </p>
            </div>
            <Link href="/bazar/admin"
              className="inline-flex items-center gap-2 rounded-xl bg-[#FFCB05] px-4 py-2 text-xs font-bold text-[#1A1A2E] hover:bg-[#FFD700]">
              <Coins size={13} />
              Gerenciar cofre e ofertas
              <RefreshCw size={13} />
            </Link>
          </div>
        </div>
      )}

      {/* FAQ accordion — acima das ofertas */}
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
            <p>Clique em <strong style={{ color: "#c9a800" }}>Anunciar</strong> e escolha mascotes ou itens do seu inventário. Defina preço de venda, troca ou ambos. Itens ficam bloqueados enquanto anunciados. Taxa: <strong style={{ color: "#FFCB05" }}>10 ZC por anúncio</strong> (vai ao cofre do Miauvadão). Limite: <strong style={{ color: "#FFCB05" }}>8 anúncios ativos</strong> por jogador.</p>
          </div>

          <div className="space-y-1">
            <p className="font-semibold" style={{ color: "#c9a800" }}>💰 Cofre do Miauvadão</p>
            <p>O cofre é alimentado por: <strong style={{ color: "#FFCB05" }}>taxas de anúncio (10 ZC)</strong>, <strong style={{ color: "#FFCB05" }}>10% de cada compra</strong> nas ofertas, <strong style={{ color: "#FFCB05" }}>apostas perdidas</strong> no jogo e <strong style={{ color: "#FFCB05" }}>investimentos de jogadores (60 ZC)</strong>. Quanto mais cheio, melhores os descontos e prêmios.</p>
          </div>

          <div className="space-y-1">
            <p className="font-semibold" style={{ color: "#c9a800" }}>📊 Como os descontos são calculados</p>
            <p>Desconto base = faixa da raridade. O cofre adiciona um bonus suave, com teto raro de <strong style={{ color: "#FFCB05" }}>70%</strong>. Refresh pago adiciona <strong style={{ color: "#FFCB05" }}>+10 pontos percentuais extras</strong> aos itens novos, ainda respeitando o teto.</p>
          </div>

          <div className="space-y-1">
            <p className="font-semibold" style={{ color: "#c9a800" }}>🔄 Atualizar Ofertas (60 ZC)</p>
            <p>Qualquer jogador pode pagar 60 ZC para atualizar os 3 itens do dia imediatamente. Os 60 ZC vão ao cofre e os novos itens ganham <strong style={{ color: "#FFCB05" }}>+10 pontos de desconto extras</strong> além do normal. O <strong style={{ color: "#FFCB05" }}>contador de tempo não reinicia</strong> — só os itens mudam.</p>
          </div>

          <div className="space-y-1">
            <p className="font-semibold" style={{ color: "#c9a800" }}>🎩 Jogo Shell Game</p>
            <p>Aposte entre 50–2000 ZC. A bolinha aparece num copo e os copos embaralham. Adivinhe certo e receba <strong style={{ color: "#FFCB05" }}>aposta + 40% da aposta</strong> (ex: 100 ZC apostados → recebe 140 ZC). O bônus de 40% sai do cofre. Perca e a aposta vai ao cofre. Cooldown de 5 min.</p>
          </div>

          <div className="space-y-1">
            <p className="font-semibold" style={{ color: "#c9a800" }}>🔄 Ciclo econômico</p>
            <p>Taxas → cofre → melhores descontos → mais compras → mais no cofre → prêmios maiores no jogo. O cofre é um <strong style={{ color: "#FFCB05" }}>sink econômico saudável</strong> que retira ZC da circulação e distribui em benefícios para todos.</p>
          </div>
        </div>
      </details>

      {/* Miauvadão */}
      <MiauvadaoPanel
        offers={dailyOffers as never}
        vaultBalance={freshMiauvadao.vaultBalance}
        balance={wallet?.balance ?? 0}
        playerId={playerId}
        lastNpcMessage={freshMiauvadao.lastNpcMessage ?? freshMiauvadao.lastWinnerMessage ?? null}
        refreshesRemaining={refreshesRemaining}
        refreshDailyLimit={REFRESH_DAILY_LIMIT}
        sabotagedOfferIndex={shouldShowBazarAnomaly ? 1 : null}
      />

      {shouldShowBazarAnomaly && (
        <div className="rounded-2xl border border-purple-500/35 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.18),transparent_35%),rgba(15,23,42,0.85)] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-purple-300">Sinal estranho</p>
              <p className="mt-1 text-sm font-bold text-slate-100">Uma oferta perdeu a sincronizacao.</p>
              <p className="mt-1 text-xs text-slate-400">O Bazar continua funcionando, mas este slot parece responder de um jeito diferente.</p>
            </div>
            {bazarStepState.unlocked ? (
            <MysteryStepButton
              stepKey="BAZAR_SLOT_SIX_CLICKS"
              returnPath="/bazar"
              className="group relative min-h-20 w-full max-w-48 overflow-hidden rounded-xl border border-purple-400/40 bg-slate-950/80 px-4 py-3 text-left shadow-[0_0_18px_rgba(168,85,247,0.22)] transition hover:border-purple-300/70 disabled:opacity-60 sm:w-48"
              showOnlySuccess
              pendingLabel={null}
              title="Oferta instável"
            >
              <span className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(168,85,247,0.12)_0px,rgba(168,85,247,0.12)_1px,transparent_1px,transparent_8px)] opacity-60 group-hover:opacity-90" />
              <span className="relative block text-[10px] uppercase tracking-widest text-purple-300">Oferta instável</span>
              <span className="relative mt-1 block text-xs font-black text-slate-100">???</span>
              <span className="relative mt-1 block text-[10px] text-slate-500">dados corrompidos</span>
            </MysteryStepButton>
            ) : (
              <div
                className="group relative min-h-20 w-full max-w-48 overflow-hidden rounded-xl border border-purple-400/20 bg-slate-950/60 px-4 py-3 text-left shadow-[0_0_18px_rgba(168,85,247,0.12)] sm:w-48"
                title={`Ainda faltam pistas: geral ${bazarStepState.generalClues}/${bazarStepState.requiredGeneralClues}, Bazar ${bazarStepState.specificClues}/${bazarStepState.requiredSpecificClues}`}
              >
                <span className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(168,85,247,0.08)_0px,rgba(168,85,247,0.08)_1px,transparent_1px,transparent_8px)] opacity-50" />
                <span className="relative block text-[10px] uppercase tracking-widest text-purple-300/70">Oferta instavel</span>
                <span className="relative mt-1 block text-xs font-black text-slate-300">???</span>
                <span className="relative mt-1 block text-[10px] text-slate-600">ainda sem contexto</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shell Game */}
      <ShellGame
        balance={wallet?.balance ?? 0}
        playerId={playerId}
        vaultBalance={freshMiauvadao.vaultBalance}
        lastWinnerMessage={freshMiauvadao.lastWinnerMessage ?? null}
        isAdmin={admin}
      />

      {/* Filters */}
      <Suspense fallback={null}>
        <BazarFiltersClient />
      </Suspense>

      {/* Listings + Feed */}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          {/* Cabeçalho com contador e label de busca ativa */}
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-slate-200">Anúncios ativos</h2>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
              {total} {total === 1 ? "resultado" : "resultados"}
            </span>
            {searchParams.q && (
              <span className="rounded-full border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-2 py-0.5 text-[10px] text-[#FFCB05]">
                🔍 &ldquo;{searchParams.q}&rdquo;
              </span>
            )}
            {totalPages > 1 && (
              <span className="ml-auto text-[10px] text-slate-500">
                Página {page} de {totalPages}
              </span>
            )}
          </div>

          {listings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
              <p className="text-3xl">{searchParams.q ? "🔍" : "🏪"}</p>
              <p className="text-sm text-slate-500">
                {searchParams.q
                  ? `Nenhum anúncio encontrado para "${searchParams.q}".`
                  : "Nenhum anúncio encontrado."}
              </p>
              {playerId && !searchParams.q && (
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

          {/* Paginação */}
          {totalPages > 1 && (
            <BazarPagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={12}
            />
          )}
        </div>

        {/* Feed sidebar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-200 text-sm">📡 Atividade recente</h3>
            <Link href="/bazar/historico" className="text-[10px] font-semibold text-[#FFCB05] hover:underline">
              Ver histórico completo
            </Link>
          </div>
          <BazarFeed transactions={transactions.map(t => ({ ...t, category: t.category as string }))} />
        </div>
      </div>
    </div>
  );
}
