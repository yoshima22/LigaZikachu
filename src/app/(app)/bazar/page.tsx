import Link from "next/link";
import { getAppSession, getSessionPlayer } from "@/lib/session";
import { getOrCreateWallet } from "@/lib/zikacoins";
import { Plus, Store, ShieldCheck, RefreshCw, Coins } from "lucide-react";
import { isAdmin, isStaff } from "@/lib/auth/permissions";
import { MiauvadaoGames } from "./_components/miauvadao-games";
import { AnunciosTab } from "./_components/anuncios-tab";
import { BazarTabs } from "./_components/bazar-tabs";
import { BuyOrdersTab } from "./_components/buy-orders-tab";
import { getCurrentMiauvadaoConfig } from "./actions";
import { ManualRefreshButton } from "@/app/(app)/_components/manual-refresh-button";
import type { MiauvadaoFusionEggType, MiauvadaoFusionEgg } from "@/lib/miauvadao-egg-fusion";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const TABS = ["anuncios", "jogos", "pedidos"] as const;
type Tab = (typeof TABS)[number];

export default async function BazarPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const searchParams = await searchParamsPromise;
  const tab: Tab = (TABS as readonly string[]).includes(searchParams.tab) ? (searchParams.tab as Tab) : "anuncios";

  const session = await getAppSession();
  const staff = session?.user ? isStaff(session.user.role) : false;
  // Gamemasters enxergam as ferramentas de gestão, mas continuam sujeitos
  // aos mesmos cooldowns e regras de jogo de qualquer jogador.
  const platformAdmin = session?.user ? isAdmin(session.user.role) : false;
  const currentPlayer = session?.user ? await getSessionPlayer(session.user.id) : null;
  const playerId = currentPlayer?.id ?? null;
  const wallet = playerId ? await getOrCreateWallet(playerId) : null;

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
              <Link href="/bazar/devedores" className="rounded-xl border border-orange-500/25 px-3 py-2 text-xs text-orange-200 hover:bg-orange-500/10">
                Ranking de Devedores
              </Link>
              <Link href="/bazar/criar"
                className="flex items-center gap-1.5 rounded-xl bg-[#FFCB05] px-4 py-2 text-xs font-bold text-[#1A1A2E] hover:bg-[#FFD700] transition-colors">
                <Plus size={13}/> Anunciar
              </Link>
              {staff && (
                <Link href="/bazar/admin"
                  className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors">
                  ⚙️ Admin
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      {staff && (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="flex items-center gap-2 text-sm font-bold text-red-300">
                <ShieldCheck size={15} />
                Controles admin do Bazar
              </p>
              <p className="text-xs text-slate-500">
                Ajuste ZC do cofre, publique ofertas manuais ou gere novas ofertas do Miauvadão.
                {platformAdmin ? " O modo debug do jogo dos copos permanece exclusivo das contas admin." : " Sua conta continua usando jogos, compras e cooldowns como um jogador comum."}
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

      <BazarTabs active={tab} />

      {tab === "anuncios" && (
        <AnunciosTab searchParams={searchParams} playerId={playerId} platformAdmin={platformAdmin} balance={wallet?.balance ?? 0} />
      )}
      {tab === "jogos" && <JogosTab playerId={playerId} platformAdmin={platformAdmin} balance={wallet?.balance ?? 0} />}
      {tab === "pedidos" && <BuyOrdersTab searchParams={searchParams} playerId={playerId} />}
    </div>
  );
}

async function JogosTab({ playerId, platformAdmin, balance }: { playerId: string | null; platformAdmin: boolean; balance: number }) {
  const [fusionEggRows, freshMiauvadao] = await Promise.all([
    playerId
      ? prisma.mascotEgg.findMany({
          where: {
            playerId,
            type: { in: ["COMMON", "EVENT", "RARE", "SPECIAL"] },
            incubation: null,
            NOT: { origin: { startsWith: "bazar:" } },
          },
          // Bônus maior primeiro dentro de cada raridade, para o jogador ver logo os
          // ovos "aumentados" e evitar consumi-los sem querer.
          orderBy: [{ type: "asc" }, { hatchRarityBonusPct: "desc" }, { obtainedAt: "asc" }],
          select: { id: true, type: true, hatchRarityBonusPct: true, obtainedAt: true, origin: true },
        })
      : [],
    getCurrentMiauvadaoConfig(),
  ]);
  const fusionEggs: MiauvadaoFusionEgg[] = fusionEggRows.map((egg) => ({
    id: egg.id,
    type: egg.type as MiauvadaoFusionEggType,
    hatchRarityBonusPct: egg.hatchRarityBonusPct,
    obtainedAt: egg.obtainedAt.toISOString(),
    origin: egg.origin,
  }));
  return (
    <MiauvadaoGames
      balance={balance}
      playerId={playerId}
      vaultBalance={freshMiauvadao.vaultBalance}
      lastWinnerMessage={freshMiauvadao.lastWinnerMessage ?? null}
      isAdmin={platformAdmin}
      eggs={fusionEggs}
    />
  );
}
