import { prisma } from "@/lib/prisma";
import { WEEKLY_MODIFIERS } from "./constants";
import { getActiveWeeklyLeagueSabotage, getOrderStepUnlockState } from "@/lib/raid-event";

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
  // Current active league (if any)
  let currentLeague = null;
  let participants: unknown[] = [];
  let myTeams: unknown[] = [];
  let todayMatches: unknown[] = [];
  let allMascots: unknown[] = [];
  let weekHighlights: any[] = [];
  let lastChampion: {
    playerName: string; weekKey: string; points: number; wins: number; losses: number;
    avatarUrl: string | null; playerId: string;
    topAttacker: { name: string; pokemonId: number; damageDealt: number } | null;
    topDefender: { name: string; pokemonId: number; damageTaken: number } | null;
    topSupport: { name: string; pokemonId: number; heals: number } | null;
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
            const champMatches = await (prisma as any).weeklyMascotLeagueMatch.findMany({
              where: { leagueId: champLeague.id, replayJson: { not: null } },
              select: { replayJson: true },
            });
            const champStats = new Map<string, { name: string; pokemonId: number; damageDealt: number; damageTaken: number; heals: number }>();
            for (const m of champMatches) {
              const turns = (m.replayJson ?? []) as any[];
              for (const t of turns) {
                if (t.actorOwnerId === lastFinished.championPlayerId && t.action === "ATTACK" && t.damage > 0) {
                  const s = champStats.get(t.actorId) ?? { name: t.actorName, pokemonId: t.actorPokemonId ?? 0, damageDealt: 0, damageTaken: 0, heals: 0 };
                  s.damageDealt += t.damage;
                  champStats.set(t.actorId, s);
                }
                if (t.targetOwnerId === lastFinished.championPlayerId && t.action === "ATTACK" && t.damage > 0) {
                  const s = champStats.get(t.targetId) ?? { name: t.targetName, pokemonId: t.targetPokemonId ?? 0, damageDealt: 0, damageTaken: 0, heals: 0 };
                  s.damageTaken += t.damage;
                  champStats.set(t.targetId, s);
                }
                if (t.actorOwnerId === lastFinished.championPlayerId && t.action === "DEFEND" && t.effect?.includes("curou")) {
                  const s = champStats.get(t.actorId) ?? { name: t.actorName, pokemonId: t.actorPokemonId ?? 0, damageDealt: 0, damageTaken: 0, heals: 0 };
                  s.heals++;
                  champStats.set(t.actorId, s);
                }
              }
            }
            const statsArr = [...champStats.values()];
            const byDmg = statsArr.filter(s => s.damageDealt > 0).sort((a, b) => b.damageDealt - a.damageDealt);
            const byTank = statsArr.filter(s => s.damageTaken > 0).sort((a, b) => b.damageTaken - a.damageTaken);
            const byHeal = statsArr.filter(s => s.heals > 0).sort((a, b) => b.heals - a.heals);
            if (byDmg[0]) topAttacker = { name: byDmg[0].name, pokemonId: byDmg[0].pokemonId, damageDealt: byDmg[0].damageDealt };
            if (byTank[0]) topDefender = { name: byTank[0].name, pokemonId: byTank[0].pokemonId, damageTaken: byTank[0].damageTaken };
            if (byHeal[0]) topSupport = { name: byHeal[0].name, pokemonId: byHeal[0].pokemonId, heals: byHeal[0].heals };
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
        orderBy: [{ points: "desc" }, { wins: "desc" }, { damageDealt: "desc" }],
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
      const todayTeams = await (prisma as any).weeklyMascotLeagueDailyTeam.findMany({
        where: { leagueId: (currentLeague as any).id, playerId, battleDate: today },
        orderBy: { battleSlot: "asc" },
      });
      const todaySlots = new Set((todayTeams as any[]).map((t: any) => t.battleSlot));
      const result = [...todayTeams] as any[];

      // Herdar slots faltantes do último dia registrado
      for (const slot of [1, 2, 3]) {
        if (todaySlots.has(slot)) continue;
        const lastTeam = await (prisma as any).weeklyMascotLeagueDailyTeam.findFirst({
          where: { leagueId: (currentLeague as any).id, playerId, battleSlot: slot },
          orderBy: { battleDate: "desc" },
        });
        if (lastTeam) result.push({ ...lastTeam, battleDate: today, inherited: true });
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
        select: { id: true, roundNumber: true, battleDate: true, battleSlot: true, playerAId: true, playerBId: true, winnerId: true, isDraw: true, playerASurvivors: true, playerBSurvivors: true, playerADamageDealt: true, playerBDamageDealt: true, status: true, resolvedAt: true, resultJson: true, replayJson: true },
        orderBy: [{ battleSlot: "asc" }, { createdAt: "asc" }],
      });
      // Enrich with player names
      const matchPlayerIds = new Set<string>();
      for (const m of rawMatches as any[]) { matchPlayerIds.add(m.playerAId); if (m.playerBId) matchPlayerIds.add(m.playerBId); }
      const matchPlayers = await prisma.player.findMany({ where: { id: { in: [...matchPlayerIds] } }, select: { id: true, displayName: true, ptcglNick: true, user: { select: { email: true } } } });
      const mpNames = new Map(matchPlayers.map(p => [p.id, formatPlayerLabel(p)]));
      todayMatches = (rawMatches as any[]).map(m => ({
        ...m,
        playerAName: mpNames.get(m.playerAId) ?? "Jogador",
        playerBName: m.playerBId ? (mpNames.get(m.playerBId) ?? "Jogador") : null,
      }));
    } catch { /* table may not exist yet */ }

    // Load ALL resolved matches this week for highlights
    try {
      const allMatches = await (prisma as any).weeklyMascotLeagueMatch.findMany({
        where: { leagueId: (currentLeague as any).id, status: "RESOLVED" },
        select: { replayJson: true, playerAId: true, playerBId: true, winnerId: true },
      });
      // Compute per-mascot stats from replay logs
      const mascotStats = new Map<string, { id: string; name: string; pokemonId: number; ownerId: string; role: string; damageDealt: number; damageTaken: number; kosDealt: number; heals: number; matches: number; wins: number }>();

      for (const match of allMatches as any[]) {
        if (!match.replayJson || !Array.isArray(match.replayJson)) continue;
        const hpTracker = new Map<string, number>();
        const seen = new Map<string, { name: string; pokemonId?: number; ownerId?: string; role?: string }>();

        for (const t of match.replayJson as any[]) {
          if (!seen.has(t.actorId)) seen.set(t.actorId, { name: t.actorName, pokemonId: t.actorPokemonId, ownerId: t.actorOwnerId, role: t.actorRole });
          if (!seen.has(t.targetId)) seen.set(t.targetId, { name: t.targetName, pokemonId: t.targetPokemonId, ownerId: t.targetOwnerId, role: t.targetRole });

          if (t.action === "ATTACK" && t.damage > 0) {
            const prev = hpTracker.get(t.targetId) ?? 9999;
            const newHp = prev - t.damage;
            hpTracker.set(t.targetId, newHp);

            const key = t.actorId;
            const stat = mascotStats.get(key) ?? { id: t.actorId, name: t.actorName, pokemonId: t.actorPokemonId ?? 0, ownerId: t.actorOwnerId ?? "", role: t.actorRole ?? "Atacante", damageDealt: 0, damageTaken: 0, kosDealt: 0, heals: 0, matches: 0, wins: 0 };
            stat.damageDealt += t.damage;
            if (newHp <= 0) stat.kosDealt++;
            mascotStats.set(key, stat);

            const tgtStat = mascotStats.get(t.targetId) ?? { id: t.targetId, name: t.targetName, pokemonId: t.targetPokemonId ?? 0, ownerId: t.targetOwnerId ?? "", role: t.targetRole ?? "Atacante", damageDealt: 0, damageTaken: 0, kosDealt: 0, heals: 0, matches: 0, wins: 0 };
            tgtStat.damageTaken += t.damage;
            mascotStats.set(t.targetId, tgtStat);
          }

          if (t.action === "DEFEND" && t.effect?.includes("curou")) {
            const stat = mascotStats.get(t.actorId) ?? { id: t.actorId, name: t.actorName, pokemonId: t.actorPokemonId ?? 0, ownerId: t.actorOwnerId ?? "", role: t.actorRole ?? "Cuidador", damageDealt: 0, damageTaken: 0, kosDealt: 0, heals: 0, matches: 0, wins: 0 };
            stat.heals++;
            mascotStats.set(t.actorId, stat);
          }
        }

        // Mark matches played and wins
        for (const [id, info] of seen) {
          const stat = mascotStats.get(id);
          if (stat) {
            stat.matches++;
            if (info.ownerId === match.winnerId) stat.wins++;
            if (info.pokemonId && !stat.pokemonId) stat.pokemonId = info.pokemonId;
            if (info.name && (stat.name.startsWith("#") || !stat.name)) stat.name = info.name;
          }
        }
      }

      weekHighlights = [...mascotStats.values()];
    } catch { /* ok */ }
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
    orderSabotage,
    orderLeagueStepState,
    weekHighlights,
    lastChampion,
  };
}
