import { prisma } from "@/lib/prisma";
import { sendNotificationToUsers } from "@/lib/notifications";
import { getPokemonName } from "@/lib/mascot-data";

const TZ = "America/Sao_Paulo";
const EXPEDITION_LABELS: Record<string, string> = {
  STANDARD: "Padrão",
  TRAINING: "Treinamento",
  ITEMS: "Itens",
};

function mascotName(mascot: { nickname: string | null; speciesNameOverride: string | null; pokemonId: number }) {
  return mascot.nickname?.trim() || mascot.speciesNameOverride?.trim() || getPokemonName(mascot.pokemonId);
}

function brt(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, weekday: get("weekday"), minute: Number(get("hour")) * 60 + Number(get("minute")) };
}

async function claim(eventKey: string) {
  try {
    await prisma.pushNotificationMarker.create({ data: { eventKey } });
    return true;
  } catch { return false; }
}

async function sendOnce(eventKey: string, userIds: string[], title: string, body: string, url: string) {
  if (!userIds.length || !(await claim(eventKey))) return 0;
  const result = await sendNotificationToUsers(userIds, { title, body, url, data: { eventKey } });
  return result.sent;
}

export async function runPushAutomation(now = new Date()) {
  const local = brt(now);
  const recentCutoff = new Date(now.getTime() - 30 * 60_000);
  let sent = 0;

  // Expedições ficam ACTIVE até a coleta. O marcador por ID garante um único aviso.
  const expeditions = await prisma.mascotExpedition.findMany({
    where: { status: "ACTIVE", finishAt: { gt: recentCutoff, lte: now } },
    take: 200,
    select: { id: true, mascot: { select: { nickname: true, speciesNameOverride: true, pokemonId: true, player: { select: { userId: true } } } }, rewardJson: true },
  });
  for (const expedition of expeditions) {
    const reward = (expedition.rewardJson ?? {}) as Record<string, unknown>;
    const mode = String(reward.mode ?? "STANDARD").toUpperCase();
    const name = mascotName(expedition.mascot);
    if (mode === "VACATION") {
      sent += await sendOnce(`expedition-ready:${expedition.id}`, [expedition.mascot.player.userId], "Férias concluídas!", `${name} voltou das férias com o Professor Carvalho e já pode ser recebido.`, "/mascotes");
    } else {
      const label = EXPEDITION_LABELS[mode] ?? "Padrão";
      sent += await sendOnce(`expedition-ready:${expedition.id}`, [expedition.mascot.player.userId], "Expedição concluída!", `${name} voltou da expedição ${label}. As recompensas estão prontas.`, "/mascotes");
    }
  }

  const vacations = await prisma.mascotBuff.findMany({
    where: { type: "VACATION", expiresAt: { gt: recentCutoff, lte: now } }, take: 200,
    select: { id: true, mascot: { select: { nickname: true, speciesNameOverride: true, pokemonId: true, player: { select: { userId: true } } } } },
  });
  for (const vacation of vacations) {
    const name = mascotName(vacation.mascot);
    sent += await sendOnce(`vacation-ready:${vacation.id}`, [vacation.mascot.player.userId], "Férias concluídas!", `${name} voltou das férias e já pode ser recebido.`, "/mascotes");
  }

  if (["Mon", "Tue", "Wed", "Thu", "Fri"].includes(local.weekday)) {
    const weekly = await prisma.weeklyMascotLeague.findFirst({ where: { status: { in: ["REGISTRATION", "ACTIVE"] }, weekStart: { lte: now }, weekEnd: { gte: now } }, orderBy: { weekStart: "desc" }, select: { id: true, participants: { select: { playerId: true } } } });
    if (weekly) {
      const playerIds = weekly.participants.map((entry) => entry.playerId);
      const players = await prisma.player.findMany({ where: { id: { in: playerIds } }, select: { id: true, userId: true } });
      if (local.minute >= 19 * 60 + 30 && local.minute < 20 * 60) {
        const teams = await prisma.weeklyMascotLeagueDailyTeam.findMany({ where: { leagueId: weekly.id, battleDate: local.date }, select: { playerId: true, battleSlot: true } });
        const counts = new Map<string, Set<number>>();
        for (const team of teams) (counts.get(team.playerId) ?? counts.set(team.playerId, new Set()).get(team.playerId)!).add(team.battleSlot);
        const missing = players.filter((player) => (counts.get(player.id)?.size ?? 0) < 3).map((player) => player.userId);
        sent += await sendOnce(`weekly-team-warning:${weekly.id}:${local.date}`, missing, "Liga Semanal: equipe pendente", "Você ainda não salvou as três equipes de hoje. Às 20h o sistema usará o time herdado.", "/combates/liga-semanal");
      }
      if (local.minute >= 20 * 60 && local.minute < 20 * 60 + 30) sent += await sendOnce(`weekly-start:${weekly.id}:${local.date}`, players.map((player) => player.userId), "Liga Semanal começou!", "Os combates de hoje começaram. Acompanhe os resultados e replays.", "/combates/liga-semanal");
    }

    const rush = await prisma.rushLeague.findFirst({ where: { status: { in: ["REGISTRATION", "ACTIVE"] }, weekStart: { lte: now }, weekEnd: { gte: now } }, orderBy: { weekStart: "desc" }, select: { id: true, participants: { select: { playerId: true } } } });
    if (rush) {
      const playerIds = rush.participants.map((entry) => entry.playerId);
      const players = await prisma.player.findMany({ where: { id: { in: playerIds } }, select: { id: true, userId: true } });
      if (local.minute >= 18 * 60 + 30 && local.minute < 19 * 60) {
        const teams = await prisma.rushLeagueDailyTeam.findMany({ where: { leagueId: rush.id, battleDate: local.date }, select: { playerId: true, battleSlot: true } });
        const counts = new Map<string, Set<number>>();
        for (const team of teams) (counts.get(team.playerId) ?? counts.set(team.playerId, new Set()).get(team.playerId)!).add(team.battleSlot);
        const missing = players.filter((player) => (counts.get(player.id)?.size ?? 0) < 3).map((player) => player.userId);
        sent += await sendOnce(`rush-team-warning:${rush.id}:${local.date}`, missing, "Liga Rush: equipe pendente", "A primeira luta é às 19h. Salve as equipes ou o sistema usará a escalação herdada/automática.", "/combates/liga-rush");
      }
      if (local.minute >= 19 * 60 && local.minute < 19 * 60 + 30) sent += await sendOnce(`rush-start:${rush.id}:${local.date}`, players.map((player) => player.userId), "Liga Rush começou!", "Os combates das 19h, 19h10 e 19h20 começaram. Acompanhe a rodada.", "/combates/liga-rush");
    }
  }

  await prisma.pushNotificationMarker.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 45 * 24 * 60 * 60_000) } } });
  return { success: true, sent };
}
