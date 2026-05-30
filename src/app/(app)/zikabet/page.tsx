import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateWallet } from "@/lib/zikacoins";
import { parseBetConfig } from "@/lib/zikabet";
import { isAdmin } from "@/lib/auth/permissions";
import Link from "next/link";
import { Coins, Swords, TrendingUp } from "lucide-react";
import { ZikaBetCard } from "./_components/zikabet-card";
import { BetConfigForm } from "./_components/bet-config-form";
import { OddsForm } from "./_components/odds-form";

export const dynamic = "force-dynamic";

export default async function ZikaBetPage() {
  const session = await auth();
  if (!session?.user) return null;

  const admin = isAdmin(session.user.role);

  const player = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  });

  const wallet = player ? await getOrCreateWallet(player.id) : null;

  // Torneios em andamento com apostas habilitadas
  const tournaments = await prisma.tournament.findMany({
    where: { status: { in: ["REGISTRATION_OPEN", "IN_PROGRESS"] } },
    select: {
      id: true,
      name: true,
      slug: true,
      betConfig: true,
      weeks: {
        where: { status: { in: ["OPEN", "PLANNED"] } },
        orderBy: { weekNumber: "asc" },
        take: 5,
        include: {
          // Admin vê todas as partidas para poder configurar odds
          // Jogador vê só as que têm apostas habilitadas
          matches: {
            where: admin
              ? { isBye: false, status: { in: ["DRAFT", "PENDING_CONFIRMATION"] } }
              : { betsEnabled: true, status: { in: ["DRAFT", "PENDING_CONFIRMATION"] } },
            include: {
              playerA: { select: { id: true, displayName: true } },
              playerB: { select: { id: true, displayName: true } },
              bets: player ? { where: { playerId: player.id } } : false
            }
          }
        }
      }
    }
  });

  // My bets summary
  const myOpenBets = player
    ? await prisma.zikaBet.count({ where: { playerId: player.id, status: "OPEN" } })
    : 0;

  const myStats = player
    ? await prisma.zikaBet.groupBy({
        by: ["status"],
        where: { playerId: player.id },
        _count: true,
        _sum: { amount: true, potentialReturn: true }
      })
    : [];

  const wonStat = myStats.find((s) => s.status === "WON");
  const lostStat = myStats.find((s) => s.status === "LOST");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-2xl border border-[#FFCB05]/20 bg-gradient-to-r from-[#1A1A2E] via-[#201d38] to-[#1A1A2E] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Liga Zikachu</p>
            <h1 className="font-pixel text-base text-[#FFCB05]">ZikaBet</h1>
            <p className="mt-1 text-sm text-slate-400">
              Aposte ZikaCoins nas partidas do campeonato. Pagamentos apenas no encerramento do dia.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {wallet && (
              <Link href="/carteira" className="flex items-center gap-2 rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-4 py-2 text-sm font-bold text-[#FFCB05]">
                <Coins size={16} />
                {wallet.balance.toLocaleString("pt-BR")} ZC
              </Link>
            )}
            <Link href="/zikabet/minhas-apostas" className="rounded-lg border border-border px-3 py-2 text-xs text-slate-400 hover:text-slate-200">
              Minhas apostas {myOpenBets > 0 && <span className="ml-1 rounded-full bg-[#FFCB05] px-1.5 text-[10px] font-bold text-[#1A1A2E]">{myOpenBets}</span>}
            </Link>
          </div>
        </div>

        {/* Mini stats */}
        {player && (wonStat || lostStat) && (
          <div className="mt-4 flex flex-wrap gap-4 border-t border-border/50 pt-4">
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp size={14} className="text-[#7AC74C]" />
              <span className="text-slate-400">{wonStat?._count ?? 0} apostas ganhas</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Swords size={14} className="text-red-400" />
              <span className="text-slate-400">{lostStat?._count ?? 0} perdidas</span>
            </div>
          </div>
        )}
      </div>

      {/* Admin: config global */}
      {admin && (
        <div className="space-y-4">
          {tournaments.map((t) => {
            const config = parseBetConfig(t.betConfig);
            return (
              <div key={t.id} className="rounded-xl border border-border bg-slate-950/50 p-5">
                <h2 className="mb-3 font-semibold text-slate-200">
                  Config ZikaBet — {t.name}
                </h2>
                <BetConfigForm tournamentId={t.id} config={config} />
              </div>
            );
          })}
        </div>
      )}

      {/* Partidas com apostas abertas */}
      {tournaments.map((t) => {
        const config = parseBetConfig(t.betConfig);
        const allMatches = t.weeks.flatMap((w) => w.matches.map((m) => ({ ...m, week: w })));
        const bettableMatches = allMatches.filter((m) => m.betsEnabled);

        if (!config.enabled && !admin) return null;

        return (
          <div key={t.id} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-200">
                <Link href={`/torneios/${t.slug}`} className="hover:text-[#FFCB05]">{t.name}</Link>
              </h2>
              {!config.enabled && admin && (
                <span className="rounded-full border border-slate-600 px-2 py-0.5 text-xs text-slate-500">
                  ZikaBet desabilitada
                </span>
              )}
            </div>

            {/* Admin: configurar odds em TODAS as partidas abertas */}
            {admin && allMatches.length > 0 && (
              <div className="rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-4 space-y-3">
                <p className="text-xs font-semibold text-[#FFCB05]">
                  Configurar odds (admin) — marque "Apostas abertas" para liberar para jogadores
                </p>
                {allMatches.map((m) => (
                  <OddsForm
                    key={m.id}
                    matchId={m.id}
                    playerAName={m.playerA?.displayName ?? "BYE"}
                    playerBName={m.playerB?.displayName ?? "BYE"}
                    playerAOdds={m.playerAOdds ? Number(m.playerAOdds) : 1.5}
                    playerBOdds={m.playerBOdds ? Number(m.playerBOdds) : 1.5}
                    betsEnabled={m.betsEnabled}
                  />
                ))}
              </div>
            )}

            {!admin && allMatches.length === 0 && (
              <p className="text-sm text-slate-500">Nenhuma partida com apostas abertas.</p>
            )}

            {config.enabled && (
              <div className="space-y-3">
                {/* Cards de apostas para jogadores */}
                {bettableMatches.length === 0 && admin && (
                  <p className="text-sm text-slate-500">Nenhuma partida com apostas liberadas ainda. Configure as odds acima e marque "Apostas abertas".</p>
                )}
                {bettableMatches.map((m) => {
                  </div>
                )}

                {/* Cards para apostar */}
                {bettableMatches.map((m) => {
                  const myBet = Array.isArray(m.bets) && m.bets.length > 0 ? m.bets[0] : null;
                  if (!m.playerB) return null;
                  return (
                    <ZikaBetCard
                      key={m.id}
                      match={{
                        id: m.id,
                        playerA: m.playerA!,
                        playerB: m.playerB,
                        playerAOdds: m.playerAOdds ? Number(m.playerAOdds) : null,
                        playerBOdds: m.playerBOdds ? Number(m.playerBOdds) : null,
                        weekLabel: m.week.label ?? `Semana ${m.week.weekNumber}`
                      }}
                      myBet={myBet ? {
                        betOnPlayerId: myBet.betOnPlayerId,
                        amount: myBet.amount,
                        odds: Number(myBet.odds),
                        potentialReturn: myBet.potentialReturn,
                        status: myBet.status
                      } : null}
                      balance={wallet?.balance ?? 0}
                      config={{ minBet: config.minBet, maxBet: config.maxBet }}
                      isLoggedIn={!!player}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {tournaments.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Swords size={32} className="mx-auto mb-3 text-slate-600" />
          <p className="text-sm text-slate-500">Nenhum torneio ativo com ZikaBet no momento.</p>
        </div>
      )}
    </div>
  );
}
