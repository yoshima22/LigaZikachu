import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { addExp } from "../src/lib/mascot";
import { PASSIVE_COINS_PER_MASCOT_PER_H, PASSIVE_EXP_PER_MASCOT_PER_H, getTeamTimeMultiplier } from "../src/lib/arena-z";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const playerQuery = readArg("--player") ?? "Luiz";
const sinceArg = readArg("--since");
const txId = readArg("--tx");
const teamId = readArg("--team");

function readArg(name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function toDate(value: string | undefined): Date {
  if (!value) return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Data invalida em --since: ${value}`);
  return date;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function numberField(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readLootExp(value: unknown, key?: string): number {
  const root = asRecord(value);
  if (!root) return 0;
  const node = key ? asRecord(root[key]) : root;
  return numberField(node?.exp);
}

function readLootCoins(value: unknown, key?: string): number {
  const root = asRecord(value);
  if (!root) return 0;
  const node = key ? asRecord(root[key]) : root;
  return numberField(node?.coins);
}

function parseDescriptionMultiplier(description: string | null | undefined): number | null {
  if (!description) return null;
  const match = description.match(/[x×]\s*([0-9]+(?:[.,][0-9]+)?)/i);
  if (!match) return null;
  const parsed = Number(match[1].replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function findPlayer(query: string) {
  const player = await prisma.player.findFirst({
    where: {
      OR: [
        { displayName: { equals: query, mode: "insensitive" } },
        { ptcglNick: { equals: query, mode: "insensitive" } },
        { user: { email: { equals: query, mode: "insensitive" } } },
        { displayName: { contains: query, mode: "insensitive" } },
        { ptcglNick: { contains: query, mode: "insensitive" } },
      ],
    },
    include: { wallet: true, user: { select: { email: true } } },
  });
  if (!player) throw new Error(`Jogador nao encontrado: ${query}`);
  return player;
}

async function mascotIdsForTeam(playerId: string, id: string, enteredAt: Date) {
  const ids = new Set<string>();
  const members = await prisma.arenaTeamMember.findMany({ where: { teamId: id }, select: { mascotId: true } });
  members.forEach(member => ids.add(member.mascotId));

  const battles = await prisma.arenaBattle.findMany({
    where: {
      createdAt: { gte: enteredAt },
      OR: [{ attackTeamId: id }, { defenseTeamId: id }],
    },
    select: { turnLog: true },
  });

  for (const battle of battles) {
    const turns = Array.isArray(battle.turnLog) ? battle.turnLog : [];
    for (const rawTurn of turns) {
      const turn = asRecord(rawTurn);
      if (!turn) continue;
      if (turn.actorOwnerId === playerId && typeof turn.actorId === "string") ids.add(turn.actorId);
      if (turn.targetOwnerId === playerId && typeof turn.targetId === "string") ids.add(turn.targetId);
    }
  }

  const valid = await prisma.mascot.findMany({
    where: { playerId, id: { in: [...ids] } },
    select: { id: true, nickname: true, pokemonId: true, level: true, exp: true },
  });
  return valid;
}

async function estimateBaseVault(team: { id: string; playerId: string; enteredAt: Date; updatedAt: Date; lastBattleAt: Date | null }, mascotCount: number) {
  const battles = await prisma.arenaBattle.findMany({
    where: {
      createdAt: { gte: team.enteredAt, lte: team.updatedAt },
      OR: [{ attackTeamId: team.id }, { defenseTeamId: team.id }],
    },
    orderBy: { createdAt: "asc" },
  });

  let coins = 0;
  let exp = 0;
  let food = 0;
  let sweet = 0;

  for (const battle of battles) {
    if (battle.type === "BOT" && battle.attackTeamId === team.id && battle.winnerPlayerId === team.playerId) {
      coins += readLootCoins(battle.lootResult);
      exp += readLootExp(battle.lootResult);
    }
    if (battle.type === "PVP") {
      if (battle.winnerPlayerId === team.playerId) {
        coins += readLootCoins(battle.lootResult, "stolen");
        exp += readLootExp(battle.lootResult, "stolen");
      } else if (battle.loserPlayerId === team.playerId) {
        coins = readLootCoins(battle.lootResult, "preserved");
        exp = readLootExp(battle.lootResult, "preserved");
      }
    }
  }

  const hours = Math.max(0, Math.min(24, (team.updatedAt.getTime() - team.enteredAt.getTime()) / 3_600_000));
  const passiveMascots = Math.max(1, mascotCount);
  coins += Math.floor(hours * passiveMascots * PASSIVE_COINS_PER_MASCOT_PER_H);
  exp += Math.floor(hours * passiveMascots * PASSIVE_EXP_PER_MASCOT_PER_H);

  return { coins, exp, food, sweet };
}

async function main() {
  const since = toDate(sinceArg);
  const player = await findPlayer(playerQuery);
  if (!player.wallet) throw new Error(`Jogador ${player.displayName} nao tem carteira.`);

  const transactions = await prisma.zikaCoinTransaction.findMany({
    where: {
      id: txId ? txId : undefined,
      walletId: player.wallet.id,
      amount: { gt: 0 },
      createdAt: { gte: since },
      description: { contains: "Cofre Arena Z", mode: "insensitive" },
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`Jogador: ${player.displayName} (${player.ptcglNick}) ${player.user?.email ?? ""}`);
  console.log(`Modo: ${apply ? "APLICAR" : "DRY-RUN"} | transacoes encontradas: ${transactions.length}`);

  const backups: unknown[] = [];
  let repaired = 0;

  for (const tx of transactions) {
    const start = new Date(tx.createdAt.getTime() - 15 * 60_000);
    const end = new Date(tx.createdAt.getTime() + 15 * 60_000);
    const team = await prisma.arenaTeam.findFirst({
      where: {
        id: teamId ? teamId : undefined,
        playerId: player.id,
        status: "RETIRED",
        updatedAt: { gte: start, lte: end },
      },
      orderBy: { updatedAt: "desc" },
    });
    if (!team) {
      console.log(`- TX ${tx.id}: sem time RETIRED perto de ${tx.createdAt.toISOString()}`);
      continue;
    }

    const marker = `[ARENA_EXP_REPAIR:${team.id}:${tx.id}]`;
    const already = await prisma.mascotEvent.findFirst({
      where: { description: { contains: marker } },
      select: { id: true },
    });
    if (already) {
      console.log(`- TX ${tx.id}: ja reparada (${marker})`);
      continue;
    }

    const mascots = await mascotIdsForTeam(player.id, team.id, team.enteredAt);
    if (mascots.length === 0) {
      console.log(`- TX ${tx.id}: nenhum mascote identificado para o time ${team.id}`);
      continue;
    }

    const baseVault = await estimateBaseVault(team, mascots.length);
    const parsedMult = parseDescriptionMultiplier(tx.description);
    const fallbackMult = baseVault.coins > 0 ? tx.amount / baseVault.coins : getTeamTimeMultiplier(team.enteredAt);
    const effectiveMult = parsedMult ?? fallbackMult;
    const finalExp = Math.max(0, Math.floor(baseVault.exp * effectiveMult));
    const expEach = finalExp > 0 ? Math.max(1, Math.floor(finalExp / mascots.length)) : 0;

    console.log(`- TX ${tx.id} (${tx.createdAt.toISOString()}): time=${team.id} ZC=${tx.amount} baseExp=${baseVault.exp} mult=${effectiveMult.toFixed(2)} finalExp=${finalExp} mascotes=${mascots.length} cada=${expEach}`);

    if (finalExp <= 0) continue;

    backups.push({ tx, team, mascots, baseVault, effectiveMult, finalExp, expEach, marker });
    if (!apply) continue;

    for (const mascot of mascots) {
      await addExp(mascot.id, expEach, { ignoreBenchPenalty: true });
      await prisma.mascotEvent.create({
        data: {
          mascotId: mascot.id,
          emoji: "AZ",
          description: `${marker} EXP de cofre da Arena Z reparada: +${expEach} EXP.`,
        },
      });
    }
    repaired++;
  }

  if (backups.length > 0) {
    const dir = path.join(process.cwd(), "backups", "arena-exp-repair");
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `arena-exp-repair-${timestamp()}.json`);
    await writeFile(file, JSON.stringify(backups, null, 2), "utf8");
    console.log(`Backup/relatorio: ${file}`);
  }

  console.log(`Concluido. Reparos aplicados: ${repaired}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
