import { prisma } from "@/lib/prisma";
import { getAppSession, getSessionPlayer } from "@/lib/session";

type CombatTurn = {
  action?: string;
  actorId?: string;
  actorName?: string;
  actorOwnerId?: string | null;
  actorRole?: string;
  targetId?: string;
  targetName?: string;
  targetOwnerId?: string | null;
  damage?: number;
  effect?: string;
  advantageApplied?: boolean;
};

type LineupMascot = { name?: string; level?: number; role?: string };

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function readLineup(value: unknown, side: "A" | "B"): LineupMascot[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const lineup = (value as Record<string, unknown>)[`lineup${side}`];
  return Array.isArray(lineup) ? lineup as LineupMascot[] : [];
}

function lineupLabel(lineup: LineupMascot[]) {
  return lineup.length
    ? lineup.map((mascot) => `${mascot.name ?? "Mascote"}${mascot.level ? ` Nv.${mascot.level}` : ""}${mascot.role ? ` (${mascot.role})` : ""}`).join(", ")
    : "escalacao nao registrada";
}

function summarizeReplay(replay: unknown, playerId: string) {
  const turns = Array.isArray(replay) ? replay as CombatTurn[] : [];
  if (!turns.length) return "Replay detalhado indisponivel.";

  const own = new Map<string, { name: string; role: string; actions: number; damage: number; healing: number; received: number; advantages: number }>();
  let totalDamage = 0;
  let totalReceived = 0;
  let totalHealing = 0;

  const ensureMascot = (id: string, name: string, role = "postura nao registrada") => {
    const entry = own.get(id) ?? { name, role, actions: 0, damage: 0, healing: 0, received: 0, advantages: 0 };
    own.set(id, entry);
    return entry;
  };

  for (const turn of turns) {
    const amount = Math.max(0, Number(turn.damage ?? 0));
    if (turn.actorOwnerId === playerId) {
      const entry = ensureMascot(turn.actorId ?? turn.actorName ?? "mascot", turn.actorName ?? "Mascote", turn.actorRole);
      entry.actions++;
      if (turn.action === "HEAL" || /curou|cura/i.test(turn.effect ?? "")) {
        entry.healing += amount;
        totalHealing += amount;
      } else if (turn.action === "ATTACK") {
        entry.damage += amount;
        totalDamage += amount;
        if (turn.advantageApplied) entry.advantages++;
      }
    }
    if (turn.targetOwnerId === playerId && turn.action === "ATTACK") {
      const entry = ensureMascot(turn.targetId ?? turn.targetName ?? "mascot", turn.targetName ?? "Mascote");
      entry.received += amount;
      totalReceived += amount;
    }
  }

  const mascotLines = [...own.values()]
    .sort((a, b) => b.damage + b.healing - (a.damage + a.healing))
    .map((mascot) => `${mascot.name} [${mascot.role}]: ${mascot.actions} acoes, ${mascot.damage} dano, ${mascot.healing} cura e ${mascot.received} dano recebido${mascot.advantages ? `; ${mascot.advantages} ataques com vantagem` : ""}`)
    .join("; ");
  return `${turns.length} eventos. A equipe causou ${totalDamage} dano, recebeu ${totalReceived} e curou ${totalHealing}. Por mascote: ${mascotLines || "sem acoes proprias registradas"}.`;
}

export async function buildProfessorBattleContext(query: string): Promise<string> {
  const q = normalizeText(query);
  if (!/batalha|combate|partida|replay|historico|luta|jogo|equipe usada|escalacao|estrategia|desempenho|por que perdi|porque perdi/.test(q)) return "";

  const session = await getAppSession();
  if (!session?.user.id) return "HISTORICO DE COMBATES: sessao nao identificada.";
  const player = await getSessionPlayer(session.user.id);
  if (!player) return "HISTORICO DE COMBATES: perfil de jogador nao encontrado.";

  const wantsReplay = /replay|log|analisa|analise|ultima luta|ultimo combate|por que perdi|porque perdi|estrategia/.test(q);
  const [weeklyMatches, arenaBattles] = await Promise.all([
    prisma.weeklyMascotLeagueMatch.findMany({
      where: { status: "RESOLVED", OR: [{ playerAId: player.id }, { playerBId: player.id }] },
      orderBy: { resolvedAt: "desc" },
      take: 5,
      select: {
        id: true, battleDate: true, battleSlot: true, playerAId: true, playerBId: true,
        winnerId: true, isDraw: true, playerASurvivors: true, playerBSurvivors: true,
        playerADamageDealt: true, playerBDamageDealt: true, resultJson: true, resolvedAt: true,
        league: { select: { weekKey: true } },
      },
    }),
    prisma.arenaBattle.findMany({
      where: { type: "PVP", OR: [{ attackerPlayerId: player.id }, { defenderPlayerId: player.id }] },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, attackerPlayerId: true, defenderPlayerId: true, winnerPlayerId: true, rounds: true, createdAt: true },
    }),
  ]);

  const opponentIds = [...new Set([
    ...weeklyMatches.flatMap((match) => [match.playerAId, match.playerBId]),
    ...arenaBattles.flatMap((battle) => [battle.attackerPlayerId, battle.defenderPlayerId]),
  ].filter((id): id is string => !!id && id !== player.id))];
  const opponents = opponentIds.length
    ? await prisma.player.findMany({ where: { id: { in: opponentIds } }, select: { id: true, displayName: true } })
    : [];
  const names = new Map(opponents.map((opponent) => [opponent.id, opponent.displayName]));

  const weeklyLines = weeklyMatches.map((match) => {
    const isA = match.playerAId === player.id;
    const opponentId = isA ? match.playerBId : match.playerAId;
    const result = match.isDraw ? "empate" : match.winnerId === player.id ? "vitoria" : "derrota";
    return `- ${match.battleDate}, jogo ${match.battleSlot}, ${match.league.weekKey}: ${result} contra ${opponentId ? names.get(opponentId) ?? "Jogador" : "BYE"}; ${isA ? match.playerADamageDealt : match.playerBDamageDealt} dano; ${isA ? match.playerASurvivors : match.playerBSurvivors} sobreviventes; equipe: ${lineupLabel(readLineup(match.resultJson, isA ? "A" : "B"))}; rival: ${lineupLabel(readLineup(match.resultJson, isA ? "B" : "A"))}.`;
  });
  const arenaLines = arenaBattles.map((battle) => {
    const opponentId = battle.attackerPlayerId === player.id ? battle.defenderPlayerId : battle.attackerPlayerId;
    const result = battle.winnerPlayerId === player.id ? "vitoria" : battle.winnerPlayerId ? "derrota" : "sem vencedor registrado";
    return `- ${battle.createdAt.toISOString()}: ${result} contra ${opponentId ? names.get(opponentId) ?? "Jogador" : "oponente desconhecido"}; ${battle.rounds} rodadas.`;
  });

  let detail = "";
  if (wantsReplay) {
    const newestWeekly = weeklyMatches[0];
    const newestArena = arenaBattles[0];
    const explicitlyWeekly = /liga semanal|semanal/.test(q);
    const explicitlyArena = /arena/.test(q) && !explicitlyWeekly;
    const useWeekly = !!newestWeekly && !explicitlyArena && (explicitlyWeekly || !newestArena || (newestWeekly.resolvedAt?.getTime() ?? 0) >= newestArena.createdAt.getTime());
    if (useWeekly && newestWeekly) {
      const replay = await prisma.weeklyMascotLeagueMatch.findUnique({ where: { id: newestWeekly.id }, select: { replayJson: true } });
      detail = `\nREPLAY MAIS RECENTE (Liga Semanal): ${summarizeReplay(replay?.replayJson, player.id)}`;
    } else if (newestArena) {
      const replay = await prisma.arenaBattle.findUnique({ where: { id: newestArena.id }, select: { turnLog: true } });
      detail = `\nREPLAY MAIS RECENTE (Arena): ${summarizeReplay(replay?.turnLog, player.id)}`;
    }
  }

  return `HISTORICO PRIVADO DE COMBATES DE ${player.displayName}\nLiga Semanal (ultimos ${weeklyLines.length}):\n${weeklyLines.join("\n") || "- Nenhuma partida resolvida."}\nArena PvP (ultimos ${arenaLines.length}):\n${arenaLines.join("\n") || "- Nenhuma batalha PvP resolvida."}${detail}\nSepare fatos observados de hipoteses. Cite equipe, postura, dano e atributos que sustentam cada dica. Uma unica partida nao prova que uma escolha e sempre ruim.`;
}
