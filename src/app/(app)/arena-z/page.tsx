import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Swords, Bot, Coins, HeartPulse, History, ChevronDown } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/session";
import { isAdmin } from "@/lib/auth/permissions";
import { getPokemonName, getSpriteUrl } from "@/lib/mascot-data";
import {
  ARENA_Z_CONFIG, ARENA_ROOMS, ARENA_MAX_TEAMS, PVE_DAILY_COINS_CAP,
  PASSIVE_COINS_PER_MASCOT_PER_H, PASSIVE_EXP_PER_MASCOT_PER_H,
  RETIRE_COOLDOWN_MS, getArenaBotPreview, getArenaRanking, formatTurnLog,
  getTeamTimeMultiplier, applyMultiplierToVault, estimateVaultClaim,
  getArenaDebuffPct, getRoomsData, getTopArenaPlayers,
  getCachedDbReady, getCachedOpponentTeams, cleanupExpiredArenaResting,
} from "@/lib/arena-z";
import {
  AdminMascotStateButton, BotBattleButton, DeleteTeamButton,
  OpportunisticAttackButton, PurgeAdminArenaButton, PvpBattleButton,
  PvpCooldownIndicator, RepairArenaButton, RetirePenaltyBadge,
  RetireTeamButton, SusButton, SusShieldButton,
} from "./_components/arena-z-buttons";
import { PvpVaultLive } from "./_components/pvp-vault-live";
import { ArenaTutorial } from "./_components/arena-tutorial";
import { AddMascotToTeamForm, CreateTeamForm } from "./_components/create-team-form";
import { CombatRoleSelect } from "./_components/combat-role-select";
import { ManualRefreshButton } from "@/app/(app)/_components/manual-refresh-button";
import { AdminArenaHistorySelector } from "./_components/admin-arena-history-selector";

export const dynamic = "force-dynamic";

const TABS = ["salas", "equipes", "montar", "sus", "historico", "guia"] as const;
type Tab = typeof TABS[number];

function stateLabel(state: string, restingUntil?: Date | null) {
  if (state === "INJURED") return "Ferido";
  if (state === "RESTING") return restingUntil && restingUntil > new Date()
    ? `Repouso até ${restingUntil.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}`
    : "Repouso concluído";
  if (state === "ARENA") return "Na Arena";
  return "Livre";
}

function fmtLoot(v: { vaultCoins: number; vaultExp: number; vaultFood: number; vaultSweet: number }) {
  const parts = [
    `${v.vaultCoins} ZC`, `${v.vaultExp} EXP`,
    v.vaultFood > 0 ? `${v.vaultFood} 🍖` : null,
    v.vaultSweet > 0 ? `${v.vaultSweet} 🍬` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function readBattleLoot(loot: unknown) {
  if (!loot || typeof loot !== "object") return null;
  const data = loot as Record<string, unknown>;
  if (typeof data.coins === "number" || typeof data.exp === "number") {
    return {
      label: "Loot",
      coins: typeof data.coins === "number" ? data.coins : 0,
      exp: typeof data.exp === "number" ? data.exp : 0,
    };
  }
  if (data.stolen && typeof data.stolen === "object") {
    const stolen = data.stolen as Record<string, unknown>;
    return {
      label: "Roubado",
      coins: typeof stolen.coins === "number" ? stolen.coins : 0,
      exp: typeof stolen.exp === "number" ? stolen.exp : 0,
    };
  }
  return null;
}

function readArenaLootSection(loot: unknown, key: "preserved" | "burned" | "stolenByBot") {
  if (!loot || typeof loot !== "object") return null;
  const section = (loot as Record<string, unknown>)[key];
  if (!section || typeof section !== "object") return null;
  const d = section as Record<string, unknown>;
  return {
    coins: typeof d.coins === "number" ? d.coins : 0,
    exp: typeof d.exp === "number" ? d.exp : 0,
  };
}

type TeamReadiness = {
  members: Array<{
    mascot: { arenaState: string; restingUntil: Date | null; nickname: string | null; pokemonId: number };
  }>;
};

function getTeamBlockedReason(team: TeamReadiness): string | null {
  const now = new Date();
  for (const member of team.members) {
    const name = member.mascot.nickname ?? getPokemonName(member.mascot.pokemonId);
    if (member.mascot.arenaState === "INJURED") return `${name} está ferido e precisa de Atendimento SUS.`;
    if (member.mascot.restingUntil && member.mascot.restingUntil > now)
      return `${name} está em repouso até ${member.mascot.restingUntil.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`;
  }
  return null;
}

export default async function ArenaZPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; viewAs?: string }>;
}) {
  const session = await getAppSession();
  if (!session?.user) redirect("/login");
  const admin = isAdmin(session.user.role);
  const params = await searchParams;
  const activeTab: Tab = (TABS.includes(params.tab as Tab) ? params.tab : "salas") as Tab;

  const player = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: { id: true, displayName: true },
  });
  if (!player) redirect("/dashboard");

  // Admin pode visualizar o histórico de outro jogador via ?viewAs=<playerId>
  const viewAsPlayer = admin && params.viewAs && params.viewAs !== player.id
    ? await prisma.player.findUnique({ where: { id: params.viewAs }, select: { id: true, displayName: true } }).catch(() => null)
    : null;
  const historyPlayerId = viewAsPlayer?.id ?? player.id;

  await cleanupExpiredArenaResting(player.id).catch(() => null);

  // Colunas novas (adicionadas na reformulação Jun/2026) — lidas separadamente para não quebrar se migration ainda não rodou
  const playerArenaData = await prisma.player.findUnique({
    where: { id: player.id },
    select: { arenaPveCoinsDate: true, arenaPveCoinsEarned: true, susShieldDate: true, arenaTutorialClaimed: true },
  }).catch(() => null);

  const todayBRT = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const pveEarnedToday = playerArenaData?.arenaPveCoinsDate === todayBRT ? (playerArenaData.arenaPveCoinsEarned ?? 0) : 0;
  const pveCapRemaining = Math.max(0, PVE_DAILY_COINS_CAP - pveEarnedToday);
  const shieldUsedToday = playerArenaData?.susShieldDate === todayBRT;

  // Verifica se colunas da reformulação Jun/2026 já existem no DB (cacheado 5 min)
  const dbReady = await getCachedDbReady();

  if (!dbReady) {
    return (
      <div className="rounded-2xl border border-orange-500/40 bg-orange-500/10 p-8 text-center space-y-3">
        <p className="font-pixel text-lg text-orange-300">Arena Z — Migração Necessária</p>
        <p className="text-sm text-slate-300">As novas colunas do banco de dados ainda não foram criadas.</p>
        <p className="text-xs text-slate-500">Rode o SQL de migração no Supabase e faça redeploy.</p>
        <pre className="mt-4 rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-left text-[10px] text-slate-300 overflow-x-auto">{`ALTER TABLE players ADD COLUMN IF NOT EXISTS "arenaPveCoinsDate" TEXT DEFAULT '';
ALTER TABLE players ADD COLUMN IF NOT EXISTS "arenaPveCoinsEarned" INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS "susShieldDate" TEXT DEFAULT '';
ALTER TABLE arena_teams DROP COLUMN IF EXISTS "teamType";
ALTER TABLE arena_teams ADD COLUMN IF NOT EXISTS "roomLevel" INTEGER DEFAULT 0;
ALTER TABLE arena_teams ADD COLUMN IF NOT EXISTS "lastPveBattleAt" TIMESTAMPTZ;`}</pre>
      </div>
    );
  }

  const needsMascotRoster = activeTab === "equipes" || activeTab === "montar" || activeTab === "sus";
  const needsBattleHistory = activeTab === "historico";
  const needsSusData = activeTab === "sus";

  const [wallet, mascots, injuredMascotCount, teams, allActiveTeams, battles, recentIncomingBattle, arenaRankingData, lastRetiredTeam, injuredRivals, roomsData, topPlayers] = await Promise.all([
    prisma.zikaCoinWallet.findUnique({ where: { playerId: player.id }, select: { balance: true } }),
    needsMascotRoster
      ? prisma.mascot.findMany({
          where: { playerId: player.id },
          select: {
            id: true, pokemonId: true, nickname: true, level: true, isShiny: true,
            arenaState: true, restingUntil: true, injuredAt: true,
            bazarListed: true, happiness: true,
            statForce: true, statAgility: true, statInstinct: true, statVitality: true, statCharisma: true,
            expeditions: { where: { status: "ACTIVE" }, take: 1, select: { id: true } },
          },
          orderBy: [{ level: "desc" }],
        })
      : Promise.resolve([]),
    prisma.mascot.count({ where: { playerId: player.id, arenaState: "INJURED" } }),
    prisma.arenaTeam.findMany({
      where: { playerId: player.id, status: { in: ["ACTIVE", "DEFEATED"] } },
      include: {
        members: {
          include: {
            mascot: {
              select: {
                id: true, pokemonId: true, nickname: true, level: true,
                arenaState: true, restingUntil: true, isShiny: true,
                statForce: true, statAgility: true, statInstinct: true, statVitality: true, statCharisma: true, happiness: true,
              },
            },
          },
          orderBy: { slot: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    getCachedOpponentTeams(),
    needsBattleHistory
      ? Promise.all([
          prisma.arenaBattle.findMany({
            where: { attackerPlayerId: historyPlayerId },
            select: {
              id: true, type: true, status: true, result: true,
              attackerPlayerId: true, defenderPlayerId: true,
              attackTeamId: true, defenseTeamId: true,
              botName: true, levelBandMin: true, levelBandMax: true,
              winnerPlayerId: true, loserPlayerId: true,
              lootResult: true, injuredMascotIds: true,
              createdAt: true,
              attackerPlayer: { select: { displayName: true, ptcglNick: true } },
              defenderPlayer: { select: { displayName: true, ptcglNick: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 15,
          }),
          prisma.arenaBattle.findMany({
            where: { defenderPlayerId: historyPlayerId },
            select: {
              id: true, type: true, status: true, result: true,
              attackerPlayerId: true, defenderPlayerId: true,
              attackTeamId: true, defenseTeamId: true,
              botName: true, levelBandMin: true, levelBandMax: true,
              winnerPlayerId: true, loserPlayerId: true,
              lootResult: true, injuredMascotIds: true,
              createdAt: true,
              attackerPlayer: { select: { displayName: true, ptcglNick: true } },
              defenderPlayer: { select: { displayName: true, ptcglNick: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 15,
          }),
        ]).then(([asAttacker, asDefender]) =>
          [...asAttacker, ...asDefender]
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 15)
        )
      : Promise.resolve([]),
    prisma.arenaBattle.findFirst({
      where: {
        type: "PVP",
        defenderPlayerId: player.id,
        createdAt: { gt: new Date(Date.now() - 30 * 60_000) },
      },
      select: {
        id: true,
        type: true,
        defenderPlayerId: true,
        createdAt: true,
        attackerPlayer: { select: { displayName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    getArenaRanking(20),
    prisma.arenaTeam.findFirst({
      where: { playerId: player.id, status: "RETIRED", retiredAt: { gt: new Date(Date.now() - RETIRE_COOLDOWN_MS) } },
      orderBy: { retiredAt: "desc" },
      select: { retiredAt: true },
    }),
    needsSusData
      ? prisma.mascot.findMany({
          where: {
            arenaState: "INJURED",
            playerId: { not: player.id },
            relationsAsB: { some: { mascotA: { playerId: player.id }, type: "RIVAL" } },
          },
          include: { player: { select: { displayName: true } } },
          take: 10,
        })
      : Promise.resolve([]),
    getRoomsData(player.id).catch(() => ARENA_ROOMS.map(r => ({ roomLevel: r, teamCount: 0, teams: [] as never[] }))),
    getTopArenaPlayers().catch(() => [] as never[]),
  ]);

  // Mascotes feridos de jogadores aliados (amizade entre mascotes)
  const friendPlayerIds = needsSusData ? await Promise.all([
    prisma.mascotRelation.findMany({
      where: { type: "FRIEND", mascotA: { playerId: player.id } },
      select: { mascotB: { select: { playerId: true } } },
      take: 50,
    }),
    prisma.mascotRelation.findMany({
      where: { type: "FRIEND", mascotB: { playerId: player.id } },
      select: { mascotA: { select: { playerId: true } } },
      take: 50,
    }),
  ]).then(([asA, asB]) => {
    const ids = new Set<string>();
    for (const r of asA) if (r.mascotB.playerId !== player.id) ids.add(r.mascotB.playerId);
    for (const r of asB) if (r.mascotA.playerId !== player.id) ids.add(r.mascotA.playerId);
    return [...ids];
  }).catch(() => [] as string[]) : [];

  const injuredFriends = friendPlayerIds.length > 0
    ? await prisma.mascot.findMany({
        where: { arenaState: "INJURED", playerId: { in: friendPlayerIds } },
        include: { player: { select: { displayName: true } } },
        take: 15,
      }).catch(() => [] as never[])
    : [] as { id: string; pokemonId: number; nickname: string | null; level: number; restingUntil: Date | null; player: { displayName: string } }[];

  const opponentTeams = allActiveTeams.filter(t => t.playerId !== player.id);

  const now = new Date();
  const mascotIdsInActiveTeams = new Set(
    teams.filter(t => t.status === "ACTIVE").flatMap(t => t.members.map(m => m.mascot.id))
  );
  const availableMascots = mascots.filter(m =>
    (m.arenaState === "FREE" || (m.arenaState === "RESTING" && (!m.restingUntil || m.restingUntil <= now))) &&
    !m.bazarListed && m.expeditions.length === 0 &&
    (!m.restingUntil || m.restingUntil <= now) &&
    !mascotIdsInActiveTeams.has(m.id)
  );
  const injuredMascots = mascots.filter(m => m.arenaState === "INJURED");
  const activeTeams = teams.filter(t => t.status === "ACTIVE");
  const teamBlockReasons = new Map(activeTeams.map(t => [t.id, getTeamBlockedReason(t)]));
  const readyActiveTeams = activeTeams.filter(t => !teamBlockReasons.get(t.id));
  const readyOpponentTeams = opponentTeams.filter(t => !getTeamBlockedReason(t));

  const botPreviews = new Map<string, Awaited<ReturnType<typeof getArenaBotPreview>>>();
  for (const team of activeTab === "equipes" ? readyActiveTeams : []) {
    botPreviews.set(team.id, await getArenaBotPreview(player.id, team.id, "normal"));
  }
  const pvpCooldowns = new Map<string, Date | null>();
  await Promise.all(readyActiveTeams.map(async (team) => {
    const lastPvp = await prisma.arenaBattle.findFirst({
      where: { type: "PVP", attackTeamId: team.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    pvpCooldowns.set(team.id, lastPvp
      ? new Date(lastPvp.createdAt.getTime() + ARENA_Z_CONFIG.pvpCooldownMinutes * 60_000)
      : null);
  }));

  const opportunisticBattles = injuredRivals.length > 0
    ? await prisma.arenaBattle.findMany({
        where: { type: "OPPORTUNISTIC", attackerPlayerId: player.id, defenderPlayerId: { in: injuredRivals.map(m => m.playerId) } },
        select: { defenderPlayerId: true, createdAt: true },
      })
    : [];
  const attackedInjuryOwners = new Set(
    opportunisticBattles
      .filter(b => { const rival = injuredRivals.find(m => m.playerId === b.defenderPlayerId); return rival?.injuredAt ? b.createdAt >= rival.injuredAt : true; })
      .map(b => b.defenderPlayerId).filter(Boolean) as string[]
  );
  const recentIncomingName = recentIncomingBattle
    ? recentIncomingBattle.attackerPlayer?.displayName ?? "Outro jogador"
    : null;

  const tabLink = (t: Tab) => `/arena-z?tab=${t}`;

  const TAB_LABELS: Record<Tab, string> = {
    salas: "🗺️ Salas",
    equipes: "⚔️ Minhas Equipes",
    montar: "🏗️ Montar Equipe",
    sus: "🏥 SUS",
    historico: "📜 Histórico",
    guia: "📖 Guia",
  };

  return (
    <div className="space-y-5">
      <ArenaTutorial tutorialClaimed={playerArenaData?.arenaTutorialClaimed ?? false} />

      {/* Header */}
      <div className="rounded-2xl border border-[#FFCB05]/20 bg-gradient-to-r from-[#1A1A2E] via-[#201d38] to-[#1A1A2E] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-red-300">
              <ShieldCheck size={14} /> Arena Z
            </p>
            <h1 className="mt-1 flex items-center gap-3 font-pixel text-base text-[#FFCB05]">
              <Swords size={20} /> Arena Z — Salas por Nível
            </h1>
            <p className="mt-1 max-w-xl text-xs text-slate-400">
              Monte equipes, entre em salas por nível, enfrente bots e outros jogadores. Máx. {ARENA_MAX_TEAMS} equipes simultâneas.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ManualRefreshButton label="Atualizar" />
            <div className="rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-4 py-2 text-sm font-bold text-[#FFCB05]">
              {wallet?.balance.toLocaleString("pt-BR") ?? 0} ZC
            </div>
          </div>
        </div>

        {/* PvE cap indicator */}
        <div className="mt-3 flex flex-wrap gap-3 text-[10px]">
          <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-green-300">
            PvE hoje: {pveEarnedToday}/{PVE_DAILY_COINS_CAP} ZC ({pveCapRemaining} restantes)
          </span>
          <span className={`rounded-full border px-2.5 py-1 ${shieldUsedToday ? "border-slate-700 text-slate-500" : "border-blue-500/30 bg-blue-500/10 text-blue-300"}`}>
            🛡️ Escudo SUS: {shieldUsedToday ? "usado hoje" : "disponível"}
          </span>
          <span className="rounded-full border border-slate-700 px-2.5 py-1 text-slate-500">
            Equipes: {activeTeams.length}/{ARENA_MAX_TEAMS}
          </span>
        </div>
      </div>

      {/* Aviso de ataque PvP recente */}
      {recentIncomingBattle && (
        <div className="rounded-2xl border border-red-400/50 bg-red-500/10 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-red-300">⚠️ Você foi atacado!</p>
          <p className="mt-1 text-sm text-red-50">
            {recentIncomingName} atacou uma das suas equipes em {recentIncomingBattle.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.
          </p>
        </div>
      )}

      {/* Top 2 jogadores */}
      {topPlayers.length > 0 && (
        <div className="rounded-2xl border border-[#FFCB05]/30 bg-[#FFCB05]/5 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-[#FFCB05] mb-3">👑 Destaques da Arena</p>
          <div className="flex flex-wrap gap-3">
            {topPlayers.map((p, i) => (
              <div key={p.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${i === 0 ? "border-[#FFCB05]/60 bg-[#FFCB05]/10 shadow-[0_0_20px_rgba(255,203,5,0.2)]" : "border-slate-600/60 bg-slate-900/40"}`}>
                <span className="text-lg">{i === 0 ? "🏆" : "🥈"}</span>
                <div>
                  <p className="text-xs font-bold text-slate-100">{p.displayName}</p>
                  <p className="text-[10px] text-slate-500">{p.teamCount} equipe{p.teamCount !== 1 ? "s" : ""} · {Math.floor(p.totalHours)}h na arena</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <nav className="flex flex-wrap gap-1 rounded-2xl border border-border bg-slate-950/60 p-1.5">
        {TABS.map(t => (
          <Link
            key={t}
            href={tabLink(t)}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
              activeTab === t
                ? "bg-[#FFCB05]/10 text-[#FFCB05] border border-[#FFCB05]/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {TAB_LABELS[t]}
            {t === "sus" && injuredMascotCount > 0 && (
              <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] text-white">{injuredMascotCount}</span>
            )}
            {t === "equipes" && activeTeams.length > 0 && (
              <span className="ml-1 rounded-full bg-slate-700 px-1.5 py-0.5 text-[9px] text-slate-300">{activeTeams.length}</span>
            )}
          </Link>
        ))}
      </nav>

      {/* ══ TAB: SALAS ══ */}
      {activeTab === "salas" && (() => {
        // pré-calcula mapa de oponentes por sala
        const opponentsBySala = new Map<number, typeof opponentTeams>();
        for (const t of readyOpponentTeams) {
          const lvl = t.roomLevel ?? 0;
          if (!opponentsBySala.has(lvl)) opponentsBySala.set(lvl, []);
          opponentsBySala.get(lvl)!.push(t);
        }
        const activeRooms = roomsData.filter(r => r.teamCount > 0);
        const emptyRooms = roomsData.filter(r => r.teamCount === 0);

        return (
          <div className="space-y-4">
            {/* Legenda rápida */}
            <div className="flex flex-wrap gap-3 text-[10px] text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#FFCB05]" />Sua equipe nesta sala</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400" />Oponente atacável</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-600" />Vazia</span>
            </div>

            {/* Salas com atividade */}
            {activeRooms.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                <p className="text-2xl mb-2">🏟️</p>
                <p className="text-sm text-slate-400 font-semibold">Arena vazia</p>
                <p className="text-xs text-slate-600 mt-1">Nenhum jogador na arena ainda.</p>
                <Link href={tabLink("montar")} className="mt-3 inline-block rounded-xl bg-[#FFCB05]/10 border border-[#FFCB05]/30 px-4 py-2 text-xs font-bold text-[#FFCB05] hover:bg-[#FFCB05]/20">
                  Montar equipe →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {activeRooms.map(room => {
                  const myTeams = room.teams.filter(t => t.isOwn);
                  const otherTeams = room.teams.filter(t => !t.isOwn);
                  const opponents = opponentsBySala.get(room.roomLevel) ?? [];
                  const hasOpponents = opponents.length > 0 && readyActiveTeams.length > 0;

                  return (
                    <details key={room.roomLevel} className="group rounded-2xl border overflow-hidden
                      border-border bg-slate-950/60
                      open:border-slate-600/60"
                      open={myTeams.length > 0 || hasOpponents}
                    >
                      {/* ── Cabeçalho da sala ── */}
                      <summary className="flex cursor-pointer select-none items-center gap-4 px-5 py-4 hover:bg-slate-900/40 transition-colors">
                        {/* Nível */}
                        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 text-center">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">nv.</span>
                          <span className="text-lg font-black leading-none text-slate-100">≤{room.roomLevel}</span>
                        </div>

                        {/* Info central */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-sm text-slate-200">
                              Sala {room.roomLevel}
                            </span>
                            {myTeams.length > 0 && (
                              <span className="rounded-full border border-[#FFCB05]/50 bg-[#FFCB05]/10 px-2 py-0.5 text-[9px] font-bold text-[#FFCB05]">
                                ★ {myTeams.length} sua{myTeams.length !== 1 ? "s" : ""}
                              </span>
                            )}
                            {hasOpponents && (
                              <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[9px] font-bold text-red-300">
                                ⚔️ {opponents.length} atacável{opponents.length !== 1 ? "is" : ""}
                              </span>
                            )}
                          </div>
                          {/* Barra de ocupação */}
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="flex gap-0.5">
                              {Array.from({ length: Math.min(room.teamCount, 12) }).map((_, i) => {
                                const t = room.teams[i];
                                const color = !t ? "bg-slate-800" : t.isOwn ? "bg-[#FFCB05]" : "bg-slate-500";
                                return <div key={i} className={`h-1.5 w-3 rounded-full ${color}`} />;
                              })}
                              {room.teamCount > 12 && <span className="text-[9px] text-slate-600 ml-1">+{room.teamCount - 12}</span>}
                            </div>
                            <span className="text-[10px] text-slate-500">{room.teamCount} equipe{room.teamCount !== 1 ? "s" : ""}</span>
                          </div>
                        </div>

                        {/* Seta */}
                        <ChevronDown size={16} className="shrink-0 text-slate-600 transition-transform group-open:rotate-180" />
                      </summary>

                      {/* ── Conteúdo expandido ── */}
                      <div className="border-t border-border/50 px-5 py-4 space-y-4">

                        {/* Minhas equipes nesta sala */}
                        {myTeams.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#FFCB05]/80 mb-2">Suas equipes nesta sala</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {myTeams.map(t => (
                                <div key={t.id} className="rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/5 p-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="truncate text-xs font-bold text-[#FFCB05]">{t.name}</p>
                                      <p className="text-[10px] text-slate-500 mt-0.5">
                                        {t.members.length} mascote{t.members.length !== 1 ? "s" : ""} · na arena há {Math.floor((Date.now() - new Date(t.enteredAt).getTime()) / 3_600_000)}h
                                      </p>
                                    </div>
                                    {t.vaultCoins !== null && t.vaultCoins > 0 && (
                                      <span className="shrink-0 rounded-lg border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-2 py-1 text-[10px] font-bold text-[#FFCB05]">
                                        {t.vaultCoins} ZC
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {t.members.map((m, i) => (
                                      <span key={i} className="flex items-center gap-1 rounded-full border border-[#FFCB05]/20 bg-slate-900/60 px-2 py-0.5 text-[9px] text-slate-300">
                                        <span className="font-semibold">Nv.{m.level}</span>
                                        <span className="text-slate-500">{m.name ?? "—"}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Equipes de outros jogadores */}
                        {otherTeams.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                              Outros jogadores nesta sala
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {otherTeams.map(t => {
                                const isAttackable = opponents.some(o => o.id === t.id) && readyActiveTeams.length > 0;
                                return (
                                  <div key={t.id} className={`rounded-xl border p-3 ${isAttackable ? "border-red-500/25 bg-red-500/5" : "border-slate-700/50 bg-slate-900/30"}`}>
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="truncate text-xs font-semibold text-slate-200">{t.name}</p>
                                        <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
                                          {t.playerName}
                                          {t.isCasual && (
                                            <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[8px] font-bold text-sky-300" title="Jogador Casual: sem movimentação de cofre ou cooldown nestas batalhas">
                                              Casual
                                            </span>
                                          )}
                                        </p>
                                      </div>
                                      {isAttackable && (
                                        <span className="shrink-0 rounded-full border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold text-red-300">
                                          ⚔️ atacável
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {t.members.map((m, i) => (
                                        <span key={i} className="rounded border border-slate-700/60 bg-slate-800/50 px-1.5 py-0.5 text-[9px] text-slate-400">
                                          {m.name ? <>{m.name} <span className="text-slate-600">Nv.{m.level}</span></> : <span className="text-slate-600">??? Nv.{m.level}</span>}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* PvP: atacar equipes desta sala */}
                        {hasOpponents && (
                          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 space-y-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-red-400">⚔️ Atacar nesta sala</p>
                            {readyActiveTeams.map(attackTeam => {
                              const pvpCooldownUntil = pvpCooldowns.get(attackTeam.id) ?? null;
                              return (
                                <div key={attackTeam.id}>
                                  <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                                    <p className="text-[11px] font-semibold text-slate-300">
                                      Atacando com: <span className="text-slate-100">{attackTeam.name}</span>
                                    </p>
                                    <PvpCooldownIndicator until={pvpCooldownUntil} />
                                  </div>
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    {opponents.map(defenseTeam => {
                                      const debuff = Math.round(getArenaDebuffPct(defenseTeam.enteredAt) * 100);
                                      return (
                                        <div key={defenseTeam.id} className="rounded-xl border border-slate-700/60 bg-slate-950/60 p-3">
                                          <div className="flex items-start justify-between gap-2 mb-2">
                                            <div>
                                              <p className="text-[11px] font-bold text-slate-100">{defenseTeam.name}</p>
                                              <p className="text-[10px] text-slate-500">
                                                {defenseTeam.player.displayName ?? defenseTeam.player.ptcglNick}
                                                {debuff > 0 && <span className="ml-1 text-orange-400"> · -{debuff}% stats</span>}
                                              </p>
                                            </div>
                                            <PvpBattleButton
                                              attackTeamId={attackTeam.id}
                                              defenseTeamId={defenseTeam.id}
                                              attackTeamUpdatedAt={attackTeam.updatedAt.toISOString()}
                                              pvpCooldownUntil={pvpCooldownUntil}
                                            />
                                          </div>
                                          <PvpVaultLive
                                            teamId={defenseTeam.id}
                                            initialCoins={defenseTeam.vaultCoins}
                                            initialExp={defenseTeam.vaultExp}
                                            initialFood={defenseTeam.vaultFood}
                                            initialSweet={defenseTeam.vaultSweet}
                                            initialMultiplier={parseFloat(getTeamTimeMultiplier(defenseTeam.enteredAt).toFixed(1))}
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}

            {/* Salas vazias — colapsadas em um bloco só */}
            {emptyRooms.length > 0 && (
              <details className="group rounded-2xl border border-border/40 overflow-hidden">
                <summary className="flex cursor-pointer select-none items-center gap-3 px-5 py-3 text-xs text-slate-600 hover:text-slate-400">
                  <ChevronDown size={13} className="transition-transform group-open:rotate-180" />
                  {emptyRooms.length} sala{emptyRooms.length !== 1 ? "s" : ""} vazia{emptyRooms.length !== 1 ? "s" : ""} ({emptyRooms.map(r => `Nv.${r.roomLevel}`).join(", ")})
                </summary>
                <div className="border-t border-border/30 px-5 py-3">
                  <div className="flex flex-wrap gap-2">
                    {emptyRooms.map(r => (
                      <div key={r.roomLevel} className="flex h-10 w-16 flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40 text-center opacity-50">
                        <span className="text-[8px] text-slate-600">NÍV.</span>
                        <span className="text-sm font-bold text-slate-500">≤{r.roomLevel}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            )}

            {/* Ranking */}
            <details className="group rounded-2xl border border-border bg-slate-950/60 overflow-hidden">
              <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-5 py-4 font-semibold text-slate-200 hover:text-white">
                <span>🏆 Ranking Arena Z</span>
                <ChevronDown size={14} className="text-slate-500 transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-border/50 px-5 py-4">
                {arenaRankingData.length === 0 ? (
                  <p className="text-xs text-slate-500">Nenhum combate registrado ainda.</p>
                ) : (
                  <div className="space-y-1.5">
                    {arenaRankingData.map((row, i) => {
                      const total = row.wins + row.losses + row.draws;
                      const wr = total > 0 ? Math.round((row.wins / total) * 100) : 0;
                      const MEDALS = ["🥇", "🥈", "🥉"];
                      return (
                        <div key={row.playerId} className="flex items-center gap-3 rounded-xl border border-border/60 bg-slate-900/40 px-3 py-2">
                          <span className="w-6 text-center text-sm font-bold text-[#FFCB05]">{MEDALS[i] ?? i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-200">{row.name}</p>
                            <p className="text-[10px] text-slate-500">
                              <span className="text-green-300">{row.wins}V</span>{" "}
                              <span className="text-red-300">{row.losses}D</span>
                              {row.draws > 0 && <span className="text-slate-400"> {row.draws}E</span>}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-bold text-slate-300">{wr}%</p>
                            <p className="text-[10px] text-[#FFCB05]">{row.stolenCoins} ZC</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </details>
          </div>
        );
      })()}

      {/* ══ TAB: MINHAS EQUIPES ══ */}
      {activeTab === "equipes" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-200">Minhas Equipes ({activeTeams.length}/{ARENA_MAX_TEAMS})</h2>
            {lastRetiredTeam?.retiredAt && <RetirePenaltyBadge retiredAt={lastRetiredTeam.retiredAt} />}
          </div>
          {teams.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <p className="text-sm text-slate-500">Nenhuma equipe ainda.</p>
              <Link href={tabLink("montar")} className="mt-2 inline-block text-xs text-[#FFCB05] underline">
                Montar equipe →
              </Link>
            </div>
          ) : teams.map(team => {
            const debuffPct = team.status === "ACTIVE" ? getArenaDebuffPct(team.enteredAt) : 0;
            const debuffDisplay = Math.round(debuffPct * 100);
            const mult = getTeamTimeMultiplier(team.enteredAt);
            const multPct = Math.round((mult - 1) * 100);
            const vaultNow = estimateVaultClaim(
              { coins: team.vaultCoins, exp: team.vaultExp, food: team.vaultFood, sweet: team.vaultSweet },
              team.enteredAt, team.members.length,
            );
            return (
              <div key={team.id} className="rounded-2xl border border-border bg-slate-950/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-100">{team.name}</p>
                      <span className="rounded-full border border-blue-500/40 bg-blue-500/10 text-blue-200 px-2 py-0.5 text-[10px] font-bold">
                        Sala Nv.{team.roomLevel}
                      </span>
                      {debuffDisplay > 0 && (
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${debuffDisplay >= 60 ? "border-red-500/60 text-red-300" : "border-orange-500/60 text-orange-300"}`}>
                          😓 -{debuffDisplay}% stats
                        </span>
                      )}
                      {team.status === "DEFEATED" && (
                        <span className="rounded-full border border-red-500/50 bg-red-500/10 text-red-300 px-2 py-0.5 text-[10px] font-bold">Derrotada</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {team.members.length} mascote(s) · entrou {team.enteredAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {(team.status === "ACTIVE" || team.status === "DEFEATED") && (
                      <RetireTeamButton teamId={team.id} defeated={team.status === "DEFEATED"} teamUpdatedAt={team.updatedAt.toISOString()} />
                    )}
                    <DeleteTeamButton teamId={team.id} isAdmin={admin} teamStatus={team.status} />
                  </div>
                </div>

                {/* Cofre */}
                {(team.vaultCoins > 0 || team.vaultExp > 0) && (
                  <div className="mt-3 rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-[#FFCB05]"><Coins size={12} className="mr-1 inline" />{fmtLoot(team)}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${mult >= 4 ? "bg-[#FFCB05] text-[#1A1A2E]" : "border border-[#FFCB05]/40 text-[#FFCB05]"}`}>
                        ×{mult.toFixed(1)}{mult >= 4 ? " MAX!" : ` (+${multPct}%)`}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                      <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-2">
                        <p className="font-semibold text-green-300">✅ Retirar agora</p>
                        <p className="text-slate-300">{vaultNow.coins} ZC · {vaultNow.exp} EXP</p>
                      </div>
                      <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2">
                        <p className="font-semibold text-red-300">⚠️ Se derrotado</p>
                        <p className="text-slate-300">~{Math.floor(vaultNow.coins * 0.4)} ZC perdidos</p>
                      </div>
                    </div>
                    <p className="mt-1.5 text-[9px] text-slate-600">
                      Renda passiva: +{team.members.length * PASSIVE_COINS_PER_MASCOT_PER_H} ZC e +{team.members.length * PASSIVE_EXP_PER_MASCOT_PER_H} EXP/hora
                    </p>
                  </div>
                )}

                {/* Membros */}
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {team.members.map(member => (
                    <div key={member.id} className="flex items-center gap-2 rounded-xl border border-border/60 bg-slate-950/60 p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={getSpriteUrl(member.mascot.pokemonId, true)} alt="" className="h-8 w-8 object-contain shrink-0" style={{ imageRendering: "pixelated" }} />
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-semibold text-slate-200">
                          {member.mascot.nickname ?? getPokemonName(member.mascot.pokemonId)}
                        </p>
                        <p className="text-[10px] text-slate-500">Nv.{member.mascot.level} · {stateLabel(member.mascot.arenaState, member.mascot.restingUntil)}</p>
                        {team.status === "ACTIVE" && (
                          <CombatRoleSelect teamId={team.id} mascotId={member.mascotId} value={member.combatRole} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Aviso bloqueado */}
                {team.status === "ACTIVE" && teamBlockReasons.get(team.id) && (
                  <div className="mt-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-100">
                    <p className="font-bold">Equipe aguardando recuperação</p>
                    <p className="mt-1 text-yellow-100/80">{teamBlockReasons.get(team.id)}</p>
                  </div>
                )}

                {/* Adicionar mascote */}
                {team.status === "ACTIVE" && team.members.length < 6 && (
                  <AddMascotToTeamForm
                    teamId={team.id}
                    mascots={availableMascots.map(m => ({
                      id: m.id, pokemonId: m.pokemonId, nickname: m.nickname,
                      level: m.level, statForce: m.statForce, statAgility: m.statAgility,
                      statVitality: m.statVitality, statInstinct: m.statInstinct, statCharisma: m.statCharisma,
                      arenaState: m.arenaState, restingUntil: m.restingUntil?.toISOString() ?? null,
                      arenaEntryCooldownUntil: null,
                    }))}
                    slotsUsed={team.members.length}
                  />
                )}

                {/* Bot preview */}
                {team.status === "ACTIVE" && botPreviews.get(team.id) && (
                  <div className="mt-4 rounded-2xl border border-green-500/20 bg-green-500/5 p-3">
                    {(() => {
                      const bot = botPreviews.get(team.id)!;
                      return (
                        <>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="flex items-center gap-1.5 text-xs font-bold text-green-200">
                                <Bot size={13} /> Prévia bot Normal: {bot.trainerName}
                              </p>
                              <p className="mt-0.5 text-[10px] text-slate-500">
                                Faixa Nv.{bot.levelBandMin}–{bot.levelBandMax} · {bot.rewardRange.coinsMin}–{bot.rewardRange.coinsMax} ZC · {bot.rewardRange.expMin}–{bot.rewardRange.expMax} EXP
                              </p>
                            </div>
                            <BotBattleButton
                              teamId={team.id}
                              teamName={team.name}
                              teamUpdatedAt={team.updatedAt.toISOString()}
                              cooldownUntil={bot.cooldownUntil ?? null}
                              cooldownAfterMs={ARENA_Z_CONFIG.botCooldownMinutes * 60_000}
                            />
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {bot.mascots.map(m => (
                              <span key={m.id} className="flex items-center gap-1 rounded-full border border-green-500/20 bg-slate-950/50 px-2 py-0.5 text-[10px] text-slate-300">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={getSpriteUrl(m.pokemonId, true)} alt="" className="h-5 w-5 object-contain" style={{ imageRendering: "pixelated" }} />
                                {m.name} Nv.{m.level}
                              </span>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}

          {/* Admin controls */}
          {admin && (
            <div className="rounded-2xl border border-border bg-slate-950/60 p-5">
              <h2 className="font-semibold text-slate-200 mb-3">Controles Admin</h2>
              <div className="flex flex-wrap gap-2 mb-4">
                <RepairArenaButton />
                <PurgeAdminArenaButton />
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {mascots.slice(0, 20).map(m => (
                  <div key={m.id} className="rounded-xl border border-border/60 bg-slate-900/40 p-3">
                    <p className="text-xs font-semibold text-slate-200">{m.nickname ?? getPokemonName(m.pokemonId)}</p>
                    <p className="mb-2 text-[10px] text-slate-500">{stateLabel(m.arenaState, m.restingUntil)}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <AdminMascotStateButton mascotId={m.id} state="FREE" label="Livre" />
                      <AdminMascotStateButton mascotId={m.id} state="INJURED" label="Ferir" />
                      <AdminMascotStateButton mascotId={m.id} state="RESTING" label="Repouso" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: MONTAR EQUIPE ══ */}
      {activeTab === "montar" && (
        <div className="rounded-2xl border border-border bg-slate-950/60 p-5">
          <h2 className="font-semibold text-slate-200 mb-1">Montar Equipe</h2>
          <p className="text-xs text-slate-500 mb-1">Máx. {ARENA_MAX_TEAMS} equipes simultâneas. Selecione até 6 mascotes e escolha a sala.</p>
          {activeTeams.length >= ARENA_MAX_TEAMS ? (
            <div className="mt-3 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 text-sm text-orange-200">
              Você já tem {ARENA_MAX_TEAMS} equipes ativas. Retire uma antes de criar nova.
            </div>
          ) : (
            <>
              {lastRetiredTeam?.retiredAt && (
                <div className="mt-3">
                  <RetirePenaltyBadge retiredAt={lastRetiredTeam.retiredAt} />
                </div>
              )}
              <CreateTeamForm mascots={mascots.filter(m =>
                !mascotIdsInActiveTeams.has(m.id) && !m.bazarListed && m.expeditions.length === 0 && m.arenaState !== "INJURED"
              ).map(m => ({
                id: m.id, pokemonId: m.pokemonId, nickname: m.nickname,
                level: m.level, statForce: m.statForce, statAgility: m.statAgility,
                statVitality: m.statVitality, statInstinct: m.statInstinct, statCharisma: m.statCharisma,
                arenaState: m.arenaState, restingUntil: m.restingUntil?.toISOString() ?? null,
                arenaEntryCooldownUntil: null,
              }))} />
            </>
          )}
        </div>
      )}

      {/* ══ TAB: SUS ══ */}
      {activeTab === "sus" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-slate-950/60 p-5">
            <h2 className="flex items-center gap-2 font-semibold text-slate-200">
              <HeartPulse size={16} /> Atendimento SUS
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Custo: {ARENA_Z_CONFIG.susCost} ZC. Repouso base: {ARENA_Z_CONFIG.restAfterSusHours}h (reduzível por felicidade, vitalidade e amigos).
            </p>
            <div className="mt-4 space-y-2">
              {injuredMascots.length === 0 ? (
                <p className="text-xs text-slate-500 p-4 text-center">Nenhum mascote ferido. 🎉</p>
              ) : injuredMascots.map(m => (
                <div key={m.id} className="flex items-center justify-between gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getSpriteUrl(m.pokemonId, true)} alt="" className="h-10 w-10 object-contain" style={{ imageRendering: "pixelated" }} />
                    <span>
                      <span className="block text-xs font-semibold text-red-200">{m.nickname ?? getPokemonName(m.pokemonId)}</span>
                      <span className="text-[10px] text-slate-500">
                        Nv.{m.level} · Ferido {m.injuredAt ? m.injuredAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "agora"}
                      </span>
                    </span>
                  </div>
                  <SusButton mascotId={m.id} />
                </div>
              ))}
            </div>
          </div>

          {/* Rivais feridos */}
          {/* Aliados feridos — usar escudo */}
          {injuredFriends.length > 0 && (
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
              <h2 className="font-semibold text-blue-200 mb-1">🛡️ Aliados Feridos</h2>
              <p className="text-xs text-slate-500 mb-3">
                Use seu escudo diário para reduzir o repouso de um aliado em 20 min.
                {shieldUsedToday && <span className="ml-1 text-slate-600">(Escudo já usado hoje — reseta à meia-noite BRT)</span>}
              </p>
              <div className="space-y-2">
                {injuredFriends.map(m => (
                  <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-blue-500/15 bg-slate-950/50 p-3">
                    <span>
                      <span className="block text-xs font-semibold text-slate-200">
                        {m.nickname ?? getPokemonName(m.pokemonId)} (Nv.{m.level})
                      </span>
                      <span className="text-[10px] text-slate-500">
                        de {m.player.displayName}
                        {m.restingUntil && m.restingUntil > new Date()
                          ? ` · em repouso até ${m.restingUntil.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}`
                          : " · ferido"}
                      </span>
                    </span>
                    <SusShieldButton mascotId={m.id} shieldUsedToday={shieldUsedToday} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {injuredRivals.length > 0 && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
              <h2 className="font-semibold text-red-200 mb-1">😈 Rivais Feridos</h2>
              <p className="text-xs text-slate-500 mb-3">Apenas rivais podem ser atacados oportunistamente. 1 ataque por período de ferimento.</p>
              <div className="space-y-2">
                {injuredRivals.map(m => {
                  const alreadyAttacked = attackedInjuryOwners.has(m.playerId);
                  return (
                    <div key={m.id} className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${alreadyAttacked ? "border-slate-700 opacity-60" : "border-red-500/20 bg-slate-950/50"}`}>
                      <span>
                        <span className="block text-xs font-semibold text-slate-200">
                          {m.nickname ?? getPokemonName(m.pokemonId)} (Nv.{m.level})
                        </span>
                        <span className="text-[10px] text-slate-500">
                          de {m.player.displayName} · {alreadyAttacked ? "já atacado neste ferimento" : "ferido e vulnerável"}
                        </span>
                      </span>
                      {alreadyAttacked ? (
                        <span className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold text-slate-500">Já atacado</span>
                      ) : (
                        <OpportunisticAttackButton mascotId={m.id} mascotName={m.nickname ?? getPokemonName(m.pokemonId)} ownerName={m.player.displayName} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: HISTÓRICO ══ */}
      {activeTab === "historico" && (
        <div className="rounded-2xl border border-border bg-slate-950/60 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
            <h2 className="flex items-center gap-2 font-semibold text-slate-200">
              <History size={16} /> Histórico de Combates
              {viewAsPlayer && <span className="text-xs font-normal text-amber-300">— {viewAsPlayer.displayName}</span>}
            </h2>
            {admin && (
              <AdminArenaHistorySelector currentViewAs={params.viewAs ?? ""} />
            )}
          </div>
          <div className="mt-4 space-y-3">
            {battles.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum combate registrado.</p>
            ) : battles.map(battle => {
              const log: Array<{ turn: number; actorName: string; targetName: string; damage: number; action: string }> = [];
              const loot = readBattleLoot(battle.lootResult);
              const preservedLoot = readArenaLootSection(battle.lootResult, "preserved");
              const burnedLoot = readArenaLootSection(battle.lootResult, "burned");
              const stolenByBotLoot = readArenaLootSection(battle.lootResult, "stolenByBot");
              const injuredCount = Array.isArray(battle.injuredMascotIds) ? battle.injuredMascotIds.length : 0;
              const attackerName = battle.attackerPlayer?.displayName ?? "Atacante";
              const defenderName = battle.type === "BOT" ? (battle.botName ?? "Bot") : (battle.defenderPlayer?.displayName ?? "Defensor");
              const resultLabel = battle.result === "ATTACKER_WIN" ? `${attackerName} venceu` : battle.result === "DEFENDER_WIN" ? `${defenderName} venceu` : "Empate";
              return (
                <details key={battle.id} className="rounded-xl border border-border bg-slate-900/40 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-200">
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <span className="text-slate-400 text-xs">{battle.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${battle.type === "PVP" ? "border-red-500/30 text-red-200" : "border-green-500/30 text-green-200"}`}>{battle.type}</span>
                      <span className="text-slate-400 text-xs">{attackerName} vs {defenderName}</span>
                      <span className="rounded-full border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-2 py-0.5 text-[10px] text-[#FFCB05]">{resultLabel}</span>
                    </span>
                  </summary>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    {loot && <span className="rounded-full border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-2 py-1 text-[#FFCB05]">{loot.label}: {loot.coins} ZC / {loot.exp} EXP</span>}
                    {injuredCount > 0 && <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-1 text-red-200">{injuredCount} ferido(s)</span>}
                    {preservedLoot && (preservedLoot.coins > 0 || preservedLoot.exp > 0) && <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-1 text-green-200">Preservado: {preservedLoot.coins} ZC</span>}
                    {stolenByBotLoot && stolenByBotLoot.coins > 0 && <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-orange-200">Bot roubou: {stolenByBotLoot.coins} ZC</span>}
                    {burnedLoot && burnedLoot.coins > 0 && <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 text-yellow-200">Queimado: {burnedLoot.coins} ZC</span>}
                  </div>
                  <div className="mt-2 space-y-0.5 text-xs text-slate-400">
                    {formatTurnLog(log).slice(0, 10).map((line, i) => <p key={i}>{line}</p>)}
                    {log.length > 10 && <p className="text-slate-600">...mais {log.length - 10} turno(s)</p>}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ TAB: GUIA ══ */}
      {activeTab === "guia" && (
        <div className="rounded-2xl border border-border bg-slate-950/60 p-5 space-y-5">
          <h2 className="font-semibold text-slate-200">📖 Como Funciona a Arena Z</h2>
          <div className="grid gap-4 sm:grid-cols-2 text-xs text-slate-400 leading-relaxed">
            <div className="space-y-1">
              <p className="font-semibold text-slate-200">🗺️ Salas por Nível</p>
              <p>Existem 10 salas: Nv.10, 20, ..., 100. Seus mascotes devem ter nível ≤ ao máximo da sala. Mascotes abaixo do mínimo recebem aviso mas podem entrar.</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-slate-200">👥 Limite de Equipes</p>
              <p>Máximo de {ARENA_MAX_TEAMS} equipes simultâneas por jogador. Cada equipe atua tanto em PvE quanto em PvP — não há mais separação de modo.</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-slate-200">🤖 Combate PvE (Bots)</p>
              <p>Escolha dificuldade (Fácil/Normal/Difícil). Cooldown: {ARENA_Z_CONFIG.botCooldownMinutes} min por equipe após cada batalha. Cap diário: {PVE_DAILY_COINS_CAP} ZC por jogador (reseta meia-noite BRT).</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-slate-200">⚔️ PvP entre Jogadores</p>
              <p>Ataque equipes de outros jogadores. Vencer rouba 30% do cofre adversário. Cooldown PvP: {ARENA_Z_CONFIG.pvpCooldownMinutes} min entre ataques da mesma equipe.</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-slate-200">💰 Cofre e Multiplicador</p>
              <p>Loot acumula no cofre. Multiplicador cresce com o tempo (+{ARENA_Z_CONFIG.multPerHour * 60 * 100}%/hora, cap ×{ARENA_Z_CONFIG.multCap}). Retire para receber os ganhos.</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-slate-200">🏥 SUS e Recuperação</p>
              <p>Mascotes derrotados ficam feridos. Pague {ARENA_Z_CONFIG.susCost} ZC no SUS. Repouso base: {ARENA_Z_CONFIG.restAfterSusHours}h — reduzível pela vitalidade/felicidade do mascote e amigos.</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-slate-200">🛡️ Escudo SUS</p>
              <p>Cada jogador tem 1 escudo diário. Use para proteger um mascote amigo no SUS: reduz o repouso em 20 min <strong>e bloqueia o próximo ataque oportunista</strong>. Só funciona entre amigos.</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-slate-200">😈 Ataques Oportunistas</p>
              <p>Apenas rivais podem atacar mascotes feridos no SUS. Rouba EXP e aumenta o tempo de repouso. Limite: 1 ataque por período de ferimento.</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-slate-200">🚪 Abandonar vs Retirar</p>
              <p>Retirar com cofre vazio = sem cooldown de re-entrada. Retirar com ZC = cooldown de {Math.floor(RETIRE_COOLDOWN_MS / 60000)} min. Abandonar (deletar) = sem traços, sem cooldown.</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-slate-200">🔍 Inspeção de Sala</p>
              <p>Veja as equipes de cada sala na aba Salas. Nomes de pokémons ficam ocultos (&quot;???&quot;) até você lutar contra aquela equipe específica.</p>
            </div>
          </div>
        </div>
      )}

      <div className="text-center text-xs text-slate-600">
        <Link href="/mascotes" className="underline hover:text-[#FFCB05]">← Voltar para Mascotes</Link>
      </div>
    </div>
  );
}
