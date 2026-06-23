import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Swords } from "lucide-react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { UndoBetButton } from "./_components/undo-bet-button";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  OPEN: "Aberta", CLOSED: "Fechada", WON: "Vencida",
  LOST: "Perdida", REFUNDED: "Reembolsada", CANCELLED: "Cancelada"
};
const statusColor: Record<string, string> = {
  OPEN: "text-[#F7D02C] bg-[#F7D02C]/10 border-[#F7D02C]/30",
  CLOSED: "text-slate-400 bg-slate-400/10 border-slate-400/20",
  WON: "text-[#7AC74C] bg-[#7AC74C]/10 border-[#7AC74C]/30",
  LOST: "text-red-400 bg-red-400/10 border-red-400/20",
  REFUNDED: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  CANCELLED: "text-slate-500 bg-slate-500/10 border-slate-500/20"
};

export default async function MinhasApostasPage() {
  const session = await getAppSession();
  if (!session?.user) return null;

  const player = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  });
  if (!player) return null;

  const [tournamentBets, leagueBets] = await Promise.all([
    prisma.zikaBet.findMany({
      where: { playerId: player.id },
      orderBy: { placedAt: "desc" },
      include: {
        match: {
          include: {
            playerA: { select: { displayName: true } },
            playerB: { select: { displayName: true } },
            winnerPlayer: { select: { displayName: true } },
            tournamentWeek: {
              include: { tournament: { select: { name: true, slug: true } } }
            }
          }
        },
        betOnPlayer: { select: { displayName: true } }
      }
    }),
    prisma.weeklyMascotLeagueBet.findMany({
      where: { playerId: player.id },
      orderBy: { placedAt: "desc" },
      include: {
        weeklyMatch: { select: { playerAId: true, playerBId: true, winnerId: true, status: true, battleDate: true, battleSlot: true } },
        betOnPlayer: { select: { displayName: true } },
      },
    }).catch(() => [] as any[]),
  ]);

  // Enrich league bets with player names
  const leaguePlayerIds = new Set<string>();
  for (const b of leagueBets) {
    leaguePlayerIds.add(b.weeklyMatch.playerAId);
    if (b.weeklyMatch.playerBId) leaguePlayerIds.add(b.weeklyMatch.playerBId);
  }
  const leaguePlayers = leaguePlayerIds.size > 0
    ? await prisma.player.findMany({ where: { id: { in: [...leaguePlayerIds] } }, select: { id: true, displayName: true } })
    : [];
  const lpNames = new Map(leaguePlayers.map(p => [p.id, p.displayName]));

  // Unified list
  type UnifiedBet = {
    id: string; source: "TOURNAMENT" | "LEAGUE"; status: string;
    amount: number; odds: number; potentialReturn: number; placedAt: Date;
    playerAName: string; playerBName: string; betOnName: string;
    winnerName: string | null; context: string;
    canCancel: boolean;
  };

  const bets: UnifiedBet[] = [
    ...tournamentBets.map((b): UnifiedBet => ({
      id: b.id, source: "TOURNAMENT", status: b.status,
      amount: b.amount, odds: Number(b.odds), potentialReturn: b.potentialReturn,
      placedAt: b.placedAt,
      playerAName: b.match.playerA?.displayName ?? "?",
      playerBName: b.match.playerB?.displayName ?? "BYE",
      betOnName: b.betOnPlayer.displayName,
      winnerName: b.match.winnerPlayer?.displayName ?? null,
      context: b.match.tournamentWeek?.tournament?.name ?? "Torneio",
      canCancel: b.status === "OPEN" && ["OPEN", "PLANNED"].includes(b.match.tournamentWeek?.status ?? ""),
    })),
    ...leagueBets.map((b: any): UnifiedBet => ({
      id: b.id, source: "LEAGUE", status: b.status,
      amount: b.amount, odds: Number(b.odds), potentialReturn: b.potentialReturn,
      placedAt: b.placedAt,
      playerAName: lpNames.get(b.weeklyMatch.playerAId) ?? "?",
      playerBName: b.weeklyMatch.playerBId ? (lpNames.get(b.weeklyMatch.playerBId) ?? "?") : "BYE",
      betOnName: b.betOnPlayer.displayName,
      winnerName: b.weeklyMatch.winnerId ? (lpNames.get(b.weeklyMatch.winnerId) ?? null) : null,
      context: `Liga Semanal · ${b.weeklyMatch.battleDate} Slot ${b.weeklyMatch.battleSlot}`,
      canCancel: b.status === "OPEN" && b.weeklyMatch.status === "SCHEDULED",
    })),
  ].sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());

  const totalWon  = bets.filter((b) => b.status === "WON").reduce((s, b) => s + b.potentialReturn, 0);
  const totalLost = bets.filter((b) => b.status === "LOST").reduce((s, b) => s + b.amount, 0);

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-xs text-slate-500">
        <Link href="/zikabet" className="hover:text-slate-300">ZikaBet</Link>
        <ChevronRight size={12} />
        <span className="text-slate-300">Minhas Apostas</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-pixel text-base text-[#FFCB05]">Minhas Apostas</h1>
          <p className="mt-1 text-sm text-slate-400">{bets.length} aposta(s) no total</p>
        </div>
        <div className="flex gap-4">
          <div className="text-right">
            <p className="text-xs text-slate-500">Total ganho</p>
            <p className="font-bold text-[#7AC74C]">+{totalWon.toLocaleString("pt-BR")} ZC</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Total perdido</p>
            <p className="font-bold text-red-400">-{totalLost.toLocaleString("pt-BR")} ZC</p>
          </div>
        </div>
      </div>

      {bets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Swords size={32} className="mx-auto mb-3 text-slate-600" />
          <p className="text-sm text-slate-500">Você ainda não fez nenhuma aposta.</p>
          <Link href="/zikabet" className="mt-2 inline-block text-sm text-[#FFCB05] hover:underline">Ir para a ZikaBet →</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {bets.map((bet) => (
              <div key={bet.id} className="rounded-xl border border-border bg-slate-950/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-500">
                      {bet.source === "LEAGUE" ? "🏆 " : ""}{bet.context}
                    </p>
                    <p className="text-sm text-slate-200">
                      <span className="font-semibold text-white">{bet.playerAName}</span>
                      <span className="text-slate-500"> vs </span>
                      <span className="font-semibold text-white">{bet.playerBName}</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      Apostei em <span className="font-semibold text-white">{bet.betOnName}</span>
                      {" "}@ <span className="text-[#FFCB05]">{bet.odds}x</span>
                    </p>
                    {bet.winnerName && (
                      <p className="text-xs text-slate-500">Resultado: {bet.winnerName} venceu</p>
                    )}
                    <p className="text-[10px] text-slate-600">
                      {new Date(bet.placedAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusColor[bet.status]}`}>
                      {statusLabel[bet.status]}
                    </span>
                    {bet.canCancel && (
                      <div className="flex justify-end">
                        <UndoBetButton betId={bet.id} isLeague={bet.source === "LEAGUE"} />
                      </div>
                    )}
                    <p className="text-sm font-bold text-slate-200">{bet.amount.toLocaleString("pt-BR")} ZC</p>
                    {bet.status === "OPEN" && (
                      <p className="text-xs text-slate-500">→ {bet.potentialReturn.toLocaleString("pt-BR")} ZC</p>
                    )}
                    {bet.status === "WON" && (
                      <p className="text-xs font-semibold text-[#7AC74C]">+{bet.potentialReturn.toLocaleString("pt-BR")} ZC</p>
                    )}
                    {bet.status === "LOST" && (
                      <p className="text-xs text-red-400">-{bet.amount.toLocaleString("pt-BR")} ZC</p>
                    )}
                  </div>
                </div>
              </div>
          ))}
        </div>
      )}
    </div>
  );
}
