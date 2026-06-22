import { prisma } from "@/lib/prisma";
import { WEEKLY_MODIFIERS } from "./constants";

function currentWeekKey() {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - jan1.getTime()) / 86400000);
  return `${now.getFullYear()}-W${String(Math.ceil((days + jan1.getDay() + 1) / 7)).padStart(2, "0")}`;
}

async function ensureCurrentLeague() {
  const weekKey = currentWeekKey();
  const existing = await prisma.weeklyMascotLeague.findUnique({ where: { weekKey } });
  if (existing) return existing.status === "FINISHED" ? null : existing;

  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return null;
  const monday = new Date(now);
  monday.setDate(now.getDate() + (day === 0 ? -6 : 1 - day));
  monday.setHours(0, 0, 0, 0);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);
  const battleDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
  const modifier = WEEKLY_MODIFIERS[[...battleDate].reduce((sum, char) => sum + char.charCodeAt(0), 0) % WEEKLY_MODIFIERS.length];

  try {
    return await prisma.$transaction(async (tx) => {
      const league = await tx.weeklyMascotLeague.create({ data: { weekKey, weekStart: monday, weekEnd: friday, status: "ACTIVE", modifierJson: { ...modifier, dailyDate: battleDate, dailyHistory: [modifier.id] } } });
      const players = await tx.player.findMany({ where: { active: true, user: { role: { notIn: ["ADMIN", "SUPER_ADMIN"] }, status: "ACTIVE" } }, select: { id: true } });
      if (players.length) await tx.weeklyMascotLeagueParticipant.createMany({ data: players.map((player) => ({ leagueId: league.id, playerId: player.id })), skipDuplicates: true });
      return league;
    });
  } catch {
    return prisma.weeklyMascotLeague.findUnique({ where: { weekKey } });
  }
}

export async function getLeaguePageData(playerId: string, displayName: string, admin = false) {
  // Current active league (if any)
  let currentLeague = null;
  let participants: unknown[] = [];
  let myTeams: unknown[] = [];
  let todayMatches: unknown[] = [];
  let allMascots: unknown[] = [];

  try {
    currentLeague = await (prisma as any).weeklyMascotLeague.findFirst({
      where: { status: { in: ["REGISTRATION", "ACTIVE"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!currentLeague) currentLeague = await ensureCurrentLeague();
  } catch { /* table may not exist yet */ }

  if (currentLeague) {
    try {
      participants = await (prisma as any).weeklyMascotLeagueParticipant.findMany({
        where: { leagueId: (currentLeague as any).id },
        select: { id: true, playerId: true, points: true, wins: true, losses: true, draws: true, woLosses: true, byes: true, survivorsScore: true, damageDealt: true, damageTaken: true, finalRank: true, rewardGranted: true },
        orderBy: [{ points: "desc" }, { wins: "desc" }, { damageDealt: "desc" }],
      });
      const playerIds = (participants as Array<{ playerId: string }>).map((entry) => entry.playerId);
      const players = await prisma.player.findMany({
        where: { id: { in: playerIds } },
        select: { id: true, displayName: true, ptcglNick: true, active: true, user: { select: { role: true, status: true } } },
      });
      const validPlayerIds = new Set(players.filter(p => p.active && p.user.status === "ACTIVE" && !["ADMIN", "SUPER_ADMIN"].includes(p.user.role)).map(p => p.id));
      const nameById = new Map(players.map((entry) => [entry.id, entry.displayName || entry.ptcglNick]));
      participants = (participants as Array<Record<string, unknown> & { playerId: string }>)
        .filter((entry) => validPlayerIds.has(entry.playerId))
        .map((entry) => ({
          ...entry,
          playerName: nameById.get(entry.playerId) ?? "Jogador",
        }));
    } catch { /* table may not exist yet */ }

    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    try {
      myTeams = await (prisma as any).weeklyMascotLeagueDailyTeam.findMany({
        where: { leagueId: (currentLeague as any).id, playerId, battleDate: today },
        orderBy: { battleSlot: "asc" },
      });
      // Se não tem times hoje, carregar do último dia registrado (persistência entre dias)
      if ((myTeams as any[]).length === 0) {
        const lastTeams = await (prisma as any).weeklyMascotLeagueDailyTeam.findMany({
          where: { leagueId: (currentLeague as any).id, playerId },
          orderBy: [{ battleDate: "desc" }, { battleSlot: "asc" }],
          take: 3,
        });
        if ((lastTeams as any[]).length > 0) {
          myTeams = (lastTeams as any[]).map((t: any) => ({ ...t, battleDate: today, inherited: true }));
        }
      }
    } catch { /* table may not exist yet */ }

    // Load which players registered teams today
    try {
      const todayTeams = await (prisma as any).weeklyMascotLeagueDailyTeam.findMany({
        where: { leagueId: (currentLeague as any).id, battleDate: today },
        select: { playerId: true, battleSlot: true },
      });
      const teamsByPlayer = new Map<string, number[]>();
      for (const t of todayTeams as Array<{ playerId: string; battleSlot: number }>) {
        const slots = teamsByPlayer.get(t.playerId) ?? [];
        slots.push(t.battleSlot);
        teamsByPlayer.set(t.playerId, slots);
      }
      participants = (participants as Array<Record<string, unknown> & { playerId: string }>).map((entry) => ({
        ...entry,
        teamsToday: teamsByPlayer.get(entry.playerId)?.length ?? 0,
      }));
    } catch {}

    try {
      todayMatches = await (prisma as any).weeklyMascotLeagueMatch.findMany({
        where: { leagueId: (currentLeague as any).id, battleDate: today },
        select: { id: true, roundNumber: true, battleDate: true, battleSlot: true, playerAId: true, playerBId: true, winnerId: true, isDraw: true, playerASurvivors: true, playerBSurvivors: true, playerADamageDealt: true, playerBDamageDealt: true, status: true, resolvedAt: true },
        orderBy: [{ battleSlot: "asc" }, { createdAt: "asc" }],
      });
    } catch { /* table may not exist yet */ }
  }

  let walletBalance = 0;
  let leagueInventory: { type: string; quantity: number }[] = [];
  let selectedBattleItems: { battleSlot: number; effectType: string }[] = [];

  try {
    const wallet = await prisma.zikaCoinWallet.findUnique({ where: { playerId }, select: { balance: true } });
    walletBalance = wallet?.balance ?? 0;
  } catch {}

  try {
    const inv = await prisma.playerInventory.findMany({
      where: {
        playerId,
        quantity: { gt: 0 },
        item: { type: { in: [
          "LEAGUE_CAPTAIN_BAND", "LEAGUE_FORMATION_WHISTLE", "LEAGUE_BENCH_SHIELD",
          "LEAGUE_CHEER_FLAG", "LEAGUE_ENGUICA_STRATEGY", "LEAGUE_ANALYSIS_LANTERN",
          "LEAGUE_ROUND_BOOTS", "LEAGUE_LOCKER_TONIC",
          "LEAGUE_CONFUSION_SPRAY", "LEAGUE_WRONG_SIGN", "LEAGUE_ANNOYING_WHISTLE",
          "LEAGUE_FIELD_SAND", "LEAGUE_EVIL_EYE", "LEAGUE_CROWD_NOISE",
          "LEAGUE_EMBARRASSING_TAPE", "LEAGUE_PROVOCATION_TICKET",
        ] } },
      },
      include: { item: { select: { type: true } } },
    });
    const totals = new Map<string, number>();
    for (const entry of inv) totals.set(entry.item.type, (totals.get(entry.item.type) ?? 0) + entry.quantity);
    leagueInventory = [...totals].map(([type, quantity]) => ({ type, quantity }));
  } catch {}

  if (currentLeague) {
    try {
      selectedBattleItems = await prisma.weeklyMascotLeagueBattleItem.findMany({
        where: { leagueId: (currentLeague as any).id, playerId, battleDate: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()), consumedAt: null, refundedAt: null },
        select: { battleSlot: true, effectType: true },
      });
    } catch {}
  }

  try {
    allMascots = await prisma.mascot.findMany({
      where: { playerId },
      select: {
        id: true, pokemonId: true, nickname: true, level: true,
        statForce: true, statAgility: true, statInstinct: true, statVitality: true, statCharisma: true,
      },
      orderBy: { level: "desc" },
    });
  } catch { /* should always work */ }

  return {
    player: { id: playerId, displayName, walletBalance, isAdmin: admin },
    currentLeague,
    participants,
    myTeams,
    todayMatches,
    availableMascots: allMascots,
    leagueInventory,
    selectedBattleItems,
  };
}
