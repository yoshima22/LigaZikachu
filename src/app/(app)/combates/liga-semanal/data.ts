import { Prisma } from "@prisma/client";
import { getChampionHighlights, getWeeklyHighlights } from "@/lib/weekly-league-highlights";
import { prisma } from "@/lib/prisma";
import { WEEKLY_MODIFIERS } from "./constants";
import { getActiveWeeklyLeagueSabotage, getOrderStepUnlockState } from "@/lib/raid-event";
import { getWeeklyTeamEditWindow } from "./team-edit-window";

function formatPlayerLabel(p: { displayName: string; ptcglNick?: string | null; user?: { email?: string | null } | null }): string {
  const base = p.displayName;
  if (p.ptcglNick) return `${base} (${p.ptcglNick})`;
  if (p.user?.email) return `${base} (${p.user.email.split("@")[0]})`;
  return base;
}

function currentWeekKey() {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - jan1.getTime()) / 86400000);
  return `${now.getFullYear()}-W${String(Math.ceil((days + jan1.getDay() + 1) / 7)).padStart(2, "0")}`;
}

async function ensureCurrentLeague() {
  const weekKey = currentWeekKey();
  const existing = await prisma.weeklyMascotLeague.findUnique({ where: { weekKey } });
  if (existing) return existing;

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
  const teamSelection = getWeeklyTeamEditWindow();
  // Current active league (if any)
  let currentLeague = null;
  let participants: unknown[] = [];
  let myTeams: unknown[] = [];
  let todayMatches: unknown[] = [];
  let previousMatches: unknown[] = [];
  let allMascots: unknown[] = [];
  let weekHighlights: any[] = [];
  let opponentAnalyses: Record<string, any> = {};
  // Preferência de esconder resultados (spoiler) e partidas já reveladas pelo jogador.
  let hideResults = false;
  let revealedMatchIds: string[] = [];
  try {
    const prefRow = await prisma.player.findUnique({ where: { id: playerId }, select: { hideLeagueResults: true } });
    hideResults = prefRow?.hideLeagueResults ?? false;
  } catch {}
  let lastChampion: {
    playerName: string; weekKey: string; points: number; wins: number; losses: number;
    avatarUrl: string | null; playerId: string;
    topAttacker: { name: string; pokemonId: number; damageDealt: number } | null;
    topDefender: { name: string; pokemonId: number; damageTaken: number } | null;
    topSupport: { name: string; pokemonId: number; heals: number } | null;
    runnersUp: { position: number; playerName: string; avatarUrl: string | null; points: number; wins: number; losses: number; playerId: string }[];
  } | null = null;

  // Load last finished league champion
  try {
    const lastFinished = await (prisma as any).weeklyMascotLeague.findFirst({
      where: { status: "FINISHED", championPlayerId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { weekKey: true, championPlayerId: true },
    });
    if (lastFinished?.championPlayerId) {
      const champ = await prisma.player.findUnique({
        where: { id: lastFinished.championPlayerId },
        select: { displayName: true, ptcglNick: true, avatarUrl: true },
      });
      const champParticipant = await (prisma as any).weeklyMascotLeagueParticipant.findFirst({
        where: { leagueId: (await (prisma as any).weeklyMascotLeague.findFirst({ where: { weekKey: lastFinished.weekKey } }))?.id, playerId: lastFinished.championPlayerId },
        select: { points: true, wins: true, losses: true },
      });
      if (champ) {
        let topAttacker: { name: string; pokemonId: number; damageDealt: number } | null = null;
        let topDefender: { name: string; pokemonId: number; damageTaken: number } | null = null;
        let topSupport: { name: string; pokemonId: number; heals: number } | null = null;

        try {
          const champLeague = await (prisma as any).weeklyMascotLeague.findFirst({ where: { weekKey: lastFinished.weekKey } });
          if (champLeague) {
            ({ topAttacker, topDefender, topSupport } = await getChampionHighlights(champLeague.id, lastFinished.championPlayerId));
          }
        } catch {}

        // 2º e 3º colocados (pódio) da mesma liga finalizada
        let runnersUp: { position: number; playerName: string; avatarUrl: string | null; points: number; wins: number; losses: number; playerId: string }[] = [];
        try {
          const standingsLeague = await (prisma as any).weeklyMascotLeague.findFirst({
            where: { weekKey: lastFinished.weekKey },
            select: { id: true },
          });
          if (standingsLeague) {
            const parts = await (prisma as any).weeklyMascotLeagueParticipant.findMany({
              where: { leagueId: standingsLeague.id },
              select: { playerId: true, points: true, wins: true, losses: true, finalRank: true, damageDealt: true, survivorsScore: true, damageTaken: true },
              // finalRank é a classificação oficial gravada na finalização — usar como
              // fonte da verdade (mesma ordem do campeão). As métricas ficam como
              // desempate para ligas antigas sem finalRank.
              orderBy: [
                { finalRank: { sort: "asc", nulls: "last" } },
                { points: "desc" },
                { wins: "desc" },
                { damageDealt: "desc" },
                { survivorsScore: "desc" },
                { damageTaken: "asc" },
              ],
            });
            const ids = (parts as Array<{ playerId: string }>).map((p) => p.playerId);
            const pls = await prisma.player.findMany({
              where: { id: { in: ids } },
              select: { id: true, displayName: true, ptcglNick: true, avatarUrl: true, active: true, user: { select: { role: true, status: true } } },
            });
            const validMap = new Map(
              pls
                .filter((p) => p.active && p.user.status === "ACTIVE" && !["ADMIN", "SUPER_ADMIN"].includes(p.user.role))
                .map((p) => [p.id, p] as const),
            );
            runnersUp = (parts as Array<{ playerId: string; points: number; wins: number; losses: number }>)
              .filter((p) => validMap.has(p.playerId) && p.playerId !== lastFinished.championPlayerId)
              .slice(0, 2)
              .map((p, i) => {
                const pl = validMap.get(p.playerId)!;
                return {
                  position: i + 2,
                  playerName: pl.ptcglNick ? `${pl.displayName} (${pl.ptcglNick})` : pl.displayName,
                  avatarUrl: pl.avatarUrl ?? null,
                  points: p.points,
                  wins: p.wins,
                  losses: p.losses,
                  playerId: p.playerId,
                };
              });
          }
        } catch {}

        lastChampion = {
          playerName: champ.ptcglNick ? `${champ.displayName} (${champ.ptcglNick})` : champ.displayName,
          weekKey: lastFinished.weekKey,
          points: champParticipant?.points ?? 0,
          wins: champParticipant?.wins ?? 0,
          losses: champParticipant?.losses ?? 0,
          avatarUrl: champ.avatarUrl ?? null,
          playerId: lastFinished.championPlayerId,
          topAttacker,
          topDefender,
          topSupport,
          runnersUp,
        };
      }
    }
  } catch {}

  try {
    currentLeague = await (prisma as any).weeklyMascotLeague.findFirst({
      where: { status: { in: ["REGISTRATION", "ACTIVE", "FINISHED"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!currentLeague) currentLeague = await ensureCurrentLeague();
  } catch { /* table may not exist yet */ }

  if (currentLeague) {
    try {
      participants = await (prisma as any).weeklyMascotLeagueParticipant.findMany({
        where: { leagueId: (currentLeague as any).id },
        select: { id: true, playerId: true, points: true, wins: true, losses: true, draws: true, woLosses: true, byes: true, survivorsScore: true, damageDealt: true, damageTaken: true, finalRank: true, rewardGranted: true },
        orderBy: [
          { points: "desc" },
          { wins: "desc" },
          { damageDealt: "desc" },
          { survivorsScore: "desc" },
          { damageTaken: "asc" },
        ],
      });
      const playerIds = (participants as Array<{ playerId: string }>).map((entry) => entry.playerId);
      const players = await prisma.player.findMany({
        where: { id: { in: playerIds } },
        select: { id: true, displayName: true, ptcglNick: true, active: true, user: { select: { role: true, status: true, email: true } } },
      });
      const validPlayerIds = new Set(players.filter(p => p.active && p.user.status === "ACTIVE" && !["ADMIN", "SUPER_ADMIN"].includes(p.user.role)).map(p => p.id));
      const nameById = new Map(players.map((entry) => [entry.id, formatPlayerLabel(entry)]));
      participants = (participants as Array<Record<string, unknown> & { playerId: string }>)
        .filter((entry) => validPlayerIds.has(entry.playerId))
        .map((entry) => ({
          ...entry,
          playerName: nameById.get(entry.playerId) ?? "Jogador",
        }));
    } catch { /* table may not exist yet */ }

    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    try {
      const selectedTeams = await (prisma as any).weeklyMascotLeagueDailyTeam.findMany({
        where: { leagueId: (currentLeague as any).id, playerId, battleDate: teamSelection.battleDate },
        orderBy: { battleSlot: "asc" },
      });
      const selectedSlots = new Set((selectedTeams as any[]).map((t: any) => t.battleSlot));
      const result = [...selectedTeams] as any[];

      // Herdar slots faltantes do último dia registrado
      for (const slot of [1, 2, 3]) {
        if (selectedSlots.has(slot)) continue;
        const lastTeam = await (prisma as any).weeklyMascotLeagueDailyTeam.findFirst({
          where: {
            leagueId: (currentLeague as any).id,
            playerId,
            battleSlot: slot,
            battleDate: { lt: teamSelection.battleDate },
          },
          orderBy: { battleDate: "desc" },
        });
        if (lastTeam) result.push({ ...lastTeam, battleDate: teamSelection.battleDate, inherited: true });
      }
      myTeams = result.sort((a: any, b: any) => a.battleSlot - b.battleSlot);
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
      let matchDate = today;
      const todayCount = await (prisma as any).weeklyMascotLeagueMatch.count({
        where: { leagueId: (currentLeague as any).id, battleDate: today },
      });
      if (!todayCount) {
        const lastMatch = await (prisma as any).weeklyMascotLeagueMatch.findFirst({
          where: { leagueId: (currentLeague as any).id },
          orderBy: { battleDate: "desc" },
          select: { battleDate: true },
        });
        if (lastMatch) matchDate = lastMatch.battleDate;
      }
      const rawMatches = await (prisma as any).weeklyMascotLeagueMatch.findMany({
        where: { leagueId: (currentLeague as any).id, battleDate: matchDate },
        select: { id: true, roundNumber: true, battleDate: true, battleSlot: true, playerAId: true, playerBId: true, winnerId: true, loserId: true, isDraw: true, playerASurvivors: true, playerBSurvivors: true, playerADamageDealt: true, playerBDamageDealt: true, status: true, resolvedAt: true },
        orderBy: [{ battleSlot: "asc" }, { createdAt: "asc" }],
      });
      const previousRaw = await (prisma as any).weeklyMascotLeagueMatch.findMany({
        where: { leagueId: (currentLeague as any).id, battleDate: { lt: matchDate } },
        select: { id: true, roundNumber: true, battleDate: true, battleSlot: true, playerAId: true, playerBId: true, winnerId: true, loserId: true, isDraw: true, playerASurvivors: true, playerBSurvivors: true, playerADamageDealt: true, playerBDamageDealt: true, status: true, resolvedAt: true },
        orderBy: [{ battleDate: "desc" }, { battleSlot: "asc" }, { createdAt: "asc" }],
      });
      const matches = [...rawMatches, ...previousRaw] as any[];
      const matchPlayerIds = [...new Set(matches.flatMap(m => [m.playerAId, m.playerBId]).filter(Boolean))] as string[];
      const matchPlayers = await prisma.player.findMany({ where: { id: { in: matchPlayerIds } }, select: { id: true, displayName: true, ptcglNick: true, user: { select: { email: true } } } });
      const names = new Map(matchPlayers.map(p => [p.id, formatPlayerLabel(p)]));
      const replayFlags = matches.length ? await prisma.$queryRaw<Array<{ id: string; available: boolean; result: Prisma.JsonValue }>>(Prisma.sql`
        SELECT id, ("replayJson" IS NOT NULL AND "replayJson" <> 'null'::jsonb) AS available,
          jsonb_build_object('oddsA', "resultJson"->'oddsA', 'oddsB', "resultJson"->'oddsB',
            'reason', "resultJson"->'reason', 'availableMascots', "resultJson"->'availableMascots',
            'requiredMascots', "resultJson"->'requiredMascots', 'loserId', "resultJson"->'loserId') AS result
        FROM weekly_mascot_league_matches WHERE id IN (${Prisma.join(matches.map(m => m.id))})
      `) : [];
      const available = new Set(replayFlags.filter(r => r.available).map(r => r.id));
      const results = new Map(replayFlags.map(r => [r.id, r.result]));
      const summary = (m: any) => ({ ...m, resultJson: results.get(m.id), hasReplay: available.has(m.id), playerAName: names.get(m.playerAId) ?? "Jogador", playerBName: m.playerBId ? names.get(m.playerBId) ?? "Jogador" : null });
      todayMatches = rawMatches.map(summary);
      previousMatches = previousRaw.map(summary);
    } catch { /* table may not exist yet */ }

    // Partidas de hoje já reveladas por este jogador (para a preferência de spoiler).
    try {
      const todayMatchIds = (todayMatches as Array<{ id: string }>).map((m) => m.id);
      if (todayMatchIds.length > 0) {
        const reveals = await prisma.weeklyMascotLeagueResultReveal.findMany({
          where: { playerId, matchId: { in: todayMatchIds } },
          select: { matchId: true },
        });
        revealedMatchIds = reveals.map((r) => r.matchId);
      }
    } catch {}

    // Load ALL resolved matches this week for highlights
    try {
      weekHighlights = await getWeeklyHighlights((currentLeague as any).id);
    } catch { /* ok */ }

    // Scouting carregado sob demanda; nenhum replay histórico entra no carregamento inicial.
  }

  let walletBalance = 0;
  let leagueInventory: { type: string; quantity: number }[] = [];
  let selectedBattleItems: { battleSlot: number; effectType: string }[] = [];
  const [orderSabotage, orderLeagueStepState] = await Promise.all([
    getActiveWeeklyLeagueSabotage(),
    getOrderStepUnlockState("MASCOT_LEAGUE_LAST_PLACE_THREE_CLICKS"),
  ]);

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
    const rows = await prisma.mascot.findMany({
      where: { playerId },
      select: {
        id: true, pokemonId: true, nickname: true, level: true,
        statForce: true, statAgility: true, statInstinct: true, statVitality: true, statCharisma: true, diseasedAt: true,
        megaEvolvedAt: true, megaEvolvedFromPokemonId: true, preferredCombatRole: true,
      },
      orderBy: { level: "desc" },
    });
    const { isMegaEvolvedMascot } = await import("@/lib/battle-divisions");
    allMascots = rows.map((m) => ({ ...m, isMega: isMegaEvolvedMascot(m) }));
  } catch { /* should always work */ }

  // Divisão atual do modo (LIMITED/UNLIMITED) para o client validar/avisar.
  let weeklyDivision: "LIMITED" | "UNLIMITED" = "LIMITED";
  try {
    const { getBattleModeDivision } = await import("@/lib/battle-division-settings");
    weeklyDivision = await getBattleModeDivision("WEEKLY_LEAGUE");
  } catch { /* keep default */ }

  return {
    player: { id: playerId, displayName, walletBalance, isAdmin: admin },
    currentLeague,
    participants,
    myTeams,
    teamSelection,
    todayMatches,
    previousMatches,
    availableMascots: allMascots,
    weeklyDivision,
    leagueInventory,
    selectedBattleItems,
    orderSabotage,
    orderLeagueStepState,
    weekHighlights,
    opponentAnalyses,
    lastChampion,
    hideResults,
    revealedMatchIds,
  };
}
