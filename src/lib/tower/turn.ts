// Torre dos Rebeldes — núcleo do turn engine (janela global; Online 5min / Lento
// 4h). Módulo de servidor comum (NÃO "use server"): usado pelas server actions e
// pelo cron, sem expor a resolução como action pública.

import { EggType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { towerAddCaptive, towerBossDefenderCount, towerEnemyBaseStat } from "./balance-rules";
import {
  resolveEncounterTurn,
  type TowerBattleState,
  type TowerIntent,
  type TowerPlannedDestination,
} from "./encounter";
import type { TowerBattleEvent } from "./engine/types";
import {
  applyTowerPressure,
  currentTowerRoom,
  generateTowerRoomGraph,
  towerEncounterPreview,
  type TowerExplorationState,
  type TowerRunReport,
} from "./rooms";
import {
  runLeagueCombat,
  toLeagueMascot,
  type LeagueMascot,
} from "@/lib/league-combat";
import { getPokemonName, getPokemonTypes } from "@/lib/mascot-data";
import { normalizeCombatRole } from "@/lib/combat-roles";
import {
  TOWER_EXCLUSIVE_MASCOTS,
  TOWER_BOSS_PRIZES,
  towerRewardForFloor,
  XANDINHO,
} from "./exclusive-mascots";
import { resolveTowerTalents, towerLuckCoins, towerRescueCapacity } from "./talents";
import { isExpeditionV2, type TowerExpeditionV2 } from "./expedition-state";
import { freezeRoomEncounter, groupActiveMembersByRoom, resolveRoomFront, type RoomFrontAction, type RoomFrontResult } from "./room-resolver";
import { addCombatToRunReport, recordRecoveryInReport, recordRoomClearedInReport } from "./run-report";
import { advanceV2Turn, type V2Submission } from "./turn-v2-rules";
import {
  applyPressureToExpedition,
  overloadFromResults,
  pressureDelta,
  transitionFloor,
  updateOverload,
} from "./pressure-rules";
import { mergeRecoveredHp, releaseCapturedMascot, reviveMember, terminalMascotDisposition, TowerRecoveryError, TOWER_REVIVE_ITEM_ID } from "./recovery-rules";
import { resolveTowerClassEffects } from "./config";
import type { TowerNarrativeEvent } from "./narrative";
import { discardPendingFloorDrops, planRewardSettlement, recordFloorDrop, secureFloorDrops, settleRunRewards, type TowerRewardEntry } from "./reward-ledger";

export type TowerVolatile = {
  submissions?: Record<string, { confirmedAt: string; actions: unknown }>;
  log?: string[];
  battle?: TowerBattleState;
  lastEvents?: TowerBattleEvent[];
  lastResolvedTurn?: number;
  roomIndex?: number;
  exploration?: TowerExplorationState;
  narrativeEvents?: { kind: TowerNarrativeEvent; floor: number; turn: number }[];
};

type V2RunInput = {
  id: string;
  seed: string;
  currentFloor: number;
  globalTurn: number;
  members: Array<{
    userId: string;
    expeditionRole: string;
    mascots: Array<{ mascotId: string; currentHp: number; maxHp: number; currentStance: string }>;
  }>;
};

async function resolveV2Recoveries(
  tx: Prisma.TransactionClient,
  run: V2RunInput,
  state: TowerExpeditionV2,
  submissions: NonNullable<TowerVolatile["submissions"]>,
): Promise<{ state: TowerExpeditionV2; log: string[]; recoveredHpByMascotId: Record<string, number> }> {
  let next = state;
  const log: string[] = [];
  const recoveredHpByMascotId: Record<string, number> = {};
  const vitals = await tx.towerRunMascot.findMany({
    where: { member: { runId: run.id } },
    select: { mascotId: true, ownerUserId: true, currentHp: true, maxHp: true },
  });
  for (const [actorId, submission] of Object.entries(submissions)) {
    const payload = (submission.actions ?? {}) as { action?: string; targetMemberId?: string };
    if (payload.action !== "REVIVE_ITEM" && payload.action !== "REVIVE_ROOM") continue;
    if (!payload.targetMemberId) continue;
    const kind = payload.action === "REVIVE_ITEM" ? "ITEM" : "ROOM";
    try {
      const revived = reviveMember(next, payload.targetMemberId, { kind, actorId }, run.currentFloor, vitals);
      if (kind === "ITEM") {
        const player = await tx.player.findUnique({ where: { userId: actorId }, select: { id: true } });
        const consumed = player ? await tx.playerInventory.updateMany({
          where: { playerId: player.id, itemId: TOWER_REVIVE_ITEM_ID, quantity: { gte: 1 } },
          data: { quantity: { decrement: 1 } },
        }) : { count: 0 };
        if (!consumed.count) {
          log.push(`${actorId} não tinha um Kit de Reanimação disponível; nenhum item foi consumido.`);
          continue;
        }
      }
      for (const [mascotId, currentHp] of Object.entries(revived.hpByMascotId))
        await tx.towerRunMascot.updateMany({
          where: { mascotId, member: { runId: run.id, userId: payload.targetMemberId } },
          data: { currentHp, state: "IN_TOWER" },
        });
      Object.assign(recoveredHpByMascotId, revived.hpByMascotId);
      next = { ...revived.state, runReport: recordRecoveryInReport(revived.state.runReport) };
      log.push(`${actorId} reanimou ${payload.targetMemberId}: os dois mascotes voltaram com 50% do HP.`);
    } catch (error) {
      if (!(error instanceof TowerRecoveryError)) throw error;
      log.push(`${actorId} não conseguiu reanimar ${payload.targetMemberId}: ${error.message}`);
    }
  }
  return { state: next, log, recoveredHpByMascotId };
}

/** One DB read for the party, then a separate deterministic battle per occupied room. */
async function resolveV2RoomFronts(
  tx: Prisma.TransactionClient,
  run: V2RunInput,
  state: TowerExpeditionV2,
  submissions: NonNullable<TowerVolatile["submissions"]>,
  defensiveMemberIds: string[],
): Promise<{ state: TowerExpeditionV2; log: string[]; fronts: RoomFrontResult[]; splitPenalty: number }> {
  const snapshots = run.members.flatMap((member) => member.mascots.map((mascot) => ({ ...mascot, member })));
  const rows = await tx.mascot.findMany({ where: { id: { in: snapshots.map((mascot) => mascot.mascotId) } } });
  const mascotById = new Map(rows.map((mascot) => [mascot.id, mascot]));
  const talentRows = await tx.towerCommunityProgress.findMany({
    where: { floorId: 1, metricKey: { startsWith: "TALENT:" } },
  });
  const talentValue = (key: string) => talentRows.find((entry) => entry.metricKey === `TALENT:${key}`)?.value ?? 0;
  const talentFx = resolveTowerTalents(talentValue);
  let next = state;
  const log: string[] = [];
  const fronts: RoomFrontResult[] = [];
  for (const roomId of groupActiveMembersByRoom(state).keys()) {
    const currentRoom = next.graph.find((room) => room.id === roomId);
    if (currentRoom && (currentRoom.kind === "COMBAT" || currentRoom.kind === "BOSS") && !next.rooms[roomId]?.encounter) {
      const presentIds = groupActiveMembersByRoom(next).get(roomId) ?? [];
      const present = snapshots.filter((snapshot) => presentIds.includes(snapshot.member.userId) && snapshot.currentHp > 0);
      const levels = present.map((snapshot) => mascotById.get(snapshot.mascotId)?.level ?? 1);
      const averageLevel = Math.max(1, Math.round(levels.reduce((sum, level) => sum + level, 0) / Math.max(1, levels.length)));
      const allyCount = currentRoom.kind === "BOSS"
        ? snapshots.filter((snapshot) => next.members[snapshot.member.userId]?.status === "ACTIVE" && snapshot.currentHp > 0).length
        : present.length;
      let preview = towerEncounterPreview(currentRoom, averageLevel, allyCount);
      if (currentRoom.kind === "BOSS") preview.length = towerBossDefenderCount(allyCount, run.currentFloor);
      if (currentRoom.kind === "BOSS" && preview[0]) preview[0].pokemonId = towerRewardForFloor(run.currentFloor).pokemonId;
      const reservedCaptives = new Set(Object.values(next.rooms).flatMap((savedRoom) =>
        savedRoom.encounter?.enemies.flatMap((enemy) => enemy.captiveMascotId ? [enemy.captiveMascotId] : []) ?? []));
      const candidates = await tx.towerLostMascot.findMany({
        where: { recoveredAt: null }, orderBy: { createdAt: "asc" }, take: 8,
        select: { mascotId: true },
      });
      const candidate = candidates.find((entry) => !reservedCaptives.has(entry.mascotId));
      if (candidate && preview.length < 8) {
        const captive = await tx.mascot.findUnique({
          where: { id: candidate.mascotId },
          select: { pokemonId: true, nickname: true, level: true },
        });
        if (captive) preview = towerAddCaptive(preview, {
          pokemonId: captive.pokemonId,
          name: `${captive.nickname ?? getPokemonName(captive.pokemonId)} · cativo da Torre`,
          level: captive.level,
          captiveMascotId: candidate.mascotId,
        } as typeof preview[number], currentRoom.kind, run.currentFloor, allyCount);
      }
      next = freezeRoomEncounter(next, roomId, preview, currentRoom.kind === "BOSS" ? 2 : 1);
    }
    const frozenEnemies = next.rooms[roomId]?.encounter?.enemies ?? [];
    const actions: RoomFrontAction[] = Object.entries(submissions).map(([memberId, submission]) => {
      const payload = (submission.actions ?? {}) as { action?: string; puzzleChoice?: string };
      return { memberId, action: payload.action, puzzleChoice: payload.puzzleChoice };
    });
    let combatForReport: { allies: LeagueMascot[]; enemies: LeagueMascot[]; log: Parameters<typeof addCombatToRunReport>[3]; won: boolean; boss: boolean } | null = null;
    const wasCleared = Boolean(next.rooms[roomId]?.cleared);
    const result = resolveRoomFront(next, roomId, actions, ({ room, memberIds }) => {
      const local = snapshots.filter((snapshot) => memberIds.includes(snapshot.member.userId) && snapshot.currentHp > 0);
      const allies = local.flatMap((snapshot, index) => {
        const mascot = mascotById.get(snapshot.mascotId);
        if (!mascot) return [];
        const fighter = toLeagueMascot(mascot, index + 1, snapshot.currentStance);
        fighter.hp = snapshot.currentHp;
        if (defensiveMemberIds.includes(snapshot.member.userId)) fighter.combatRole = normalizeCombatRole("DEFENDER");
        const classFx = resolveTowerClassEffects(snapshot.member.expeditionRole, { kind: "COMBAT" });
        fighter.force = Math.round(fighter.force * classFx.forceMult);
        fighter.agility = Math.round(fighter.agility * classFx.agilityMult);
        fighter.instinct = Math.round(fighter.instinct * classFx.instinctMult);
        fighter.vitality = Math.round(fighter.vitality * classFx.vitalityMult);
        fighter.charisma = Math.round(fighter.charisma * classFx.charismaMult);
        const talentMult = 1 + talentValue("COMBAT") * 0.02 + (room.kind === "BOSS" ? talentValue("BOSS") * 0.03 : 0);
        const bossMult = room.kind === "BOSS" ? talentFx.bossMult : 1;
        fighter.force = Math.round(fighter.force * talentMult * talentFx.forceMult * bossMult);
        fighter.agility = Math.round(fighter.agility * talentMult * talentFx.agilityMult * bossMult);
        fighter.instinct = Math.round(fighter.instinct * talentMult * talentFx.instinctMult * bossMult);
        fighter.vitality = Math.round(fighter.vitality * talentMult * talentFx.vitalityMult * bossMult);
        fighter.charisma = Math.round(fighter.charisma * talentMult * talentFx.charismaMult * bossMult);
        return [fighter];
      });
      if (!allies.length) return { won: false, hpByMascotId: {}, events: ["Nenhum mascote apto para lutar nesta sala."], kos: [] };
      const averageLevel = Math.max(1, Math.round(allies.reduce((sum, mascot) => sum + mascot.level, 0) / allies.length));
      const preview = (next.rooms[roomId].encounter?.enemies ?? towerEncounterPreview(room, averageLevel, allies.length))
        .map((enemy) => ({ ...enemy }));
      if (room.kind === "BOSS" && preview[0]) preview[0].pokemonId = towerRewardForFloor(run.currentFloor).pokemonId;
      const pressureMult = next.activeModifiers.reduce((mult, modifier) => mult * modifier.enemyMultiplier, 1) *
        (1 + next.pressure * talentFx.enemyPressureScale) *
        (1 - (next.overload && next.overload.expiresAfterTurn >= next.globalTurn ? next.overload.value : 0));
      const enemies: LeagueMascot[] = preview.map((enemy, index) => {
        const base = towerEnemyBaseStat(averageLevel, room.index, pressureMult, run.currentFloor);
        const exclusive = TOWER_EXCLUSIVE_MASCOTS.find((entry) => entry.pokemonId === enemy.pokemonId);
        return {
          id: `tower:${run.id}:${room.id}:${index}`,
          ownerId: "TORRE",
          pokemonId: enemy.pokemonId,
          types: exclusive
            ? ([exclusive.primaryType, "secondaryType" in exclusive ? exclusive.secondaryType : null].filter(Boolean) as string[])
            : getPokemonTypes(enemy.pokemonId),
          name: enemy.name || exclusive?.name || getPokemonName(enemy.pokemonId),
          level: Math.max(1, enemy.level),
          force: base, agility: base, instinct: base, vitality: base, charisma: base,
          hp: 55 + Math.max(1, enemy.level) * 6 + base * 4,
          combatRole: normalizeCombatRole(index % 2 ? "DEFENDER" : "ATTACKER"),
          slot: index + 1,
        };
      });
      const battle = runLeagueCombat(allies, enemies);
      combatForReport = { allies, enemies, log: battle.log, won: battle.winner === "A", boss: room.kind === "BOSS" };
      const hp = finalHp(allies, battle.log);
      const enemyHp = finalHp(enemies, battle.log);
      const replay = {
        winner: battle.winner,
        log: battle.log,
        lineupA: battle.lineupA,
        lineupB: battle.lineupB,
        teamASurvivors: battle.teamASurvivors,
        teamBSurvivors: battle.teamBSurvivors,
        title: room.title,
      };
      return {
        won: battle.winner === "A",
        hpByMascotId: Object.fromEntries(allies.map((ally) => [ally.id, hp.get(ally.id) ?? 0])),
        events: [battle.winner === "A" ? `${room.title} foi vencida.` : `${room.title}: a frente caiu.`],
        kos: enemies.filter((enemy) => (enemyHp.get(enemy.id) ?? 0) <= 0).map((enemy) => enemy.id),
        replay,
      };
    });
    next = result.state;
    if (combatForReport) {
      const combat = combatForReport as { allies: LeagueMascot[]; enemies: LeagueMascot[]; log: Parameters<typeof addCombatToRunReport>[3]; won: boolean; boss: boolean };
      next = { ...next, runReport: addCombatToRunReport(next.runReport, combat.allies, combat.enemies, combat.log, combat.boss, combat.won) };
    } else if (!wasCleared && result.state.rooms[roomId]?.cleared) {
      next = { ...next, runReport: recordRoomClearedInReport(next.runReport) };
    }
    fronts.push(result);
    log.push(...result.events);
    if (result.interaction === "REST") {
      const healMult = next.activeModifiers.reduce((mult, modifier) => mult * modifier.healingMultiplier, 1);
      const ritual = run.members.some((member) => result.participantIds.includes(member.userId) &&
        resolveTowerClassEffects(member.expeditionRole, { kind: "REST" }).healingMult > 1) ? 1.1 : 1;
      for (const snapshot of snapshots.filter((entry) => result.participantIds.includes(entry.member.userId) && entry.currentHp > 0)) {
        const currentHp = Math.min(snapshot.maxHp, snapshot.currentHp + Math.round(snapshot.maxHp * 0.2 * healMult * ritual));
        await tx.towerRunMascot.updateMany({ where: { mascotId: snapshot.mascotId, member: { runId: run.id } }, data: { currentHp } });
      }
      log.push("A sala de descanso curou apenas os mascotes dos treinadores presentes.");
    }
    const releaseStore = {
      markRecoveredIfCaptive: async (mascotId: string, encounterId: string, actorId: string) => {
        const changed = await tx.towerLostMascot.updateMany({
          where: { mascotId, recoveredAt: null },
          data: { recoveredAt: new Date(), recoveredById: actorId },
        });
        if (changed.count) await tx.towerFeat.create({
          data: { userId: actorId, runId: run.id, featKey: "TOWER_CAPTIVE_RESCUE", data: { mascotId, encounterId } },
        });
        return changed.count > 0;
      },
      restoreMascotToOwner: async (mascotId: string) => {
        await tx.towerRunMascot.updateMany({
          where: { mascotId, state: { in: ["LOST_IN_TOWER", "DEFEATED"] } },
          data: { state: "RECOVERED", currentHp: 1 },
        });
      },
    };
    if (result.interaction === "RESCUE") {
      const captives = await tx.towerLostMascot.findMany({
        where: { recoveredAt: null }, orderBy: { createdAt: "asc" }, take: towerRescueCapacity(talentValue("RESCUE")),
        select: { mascotId: true },
      });
      for (const captive of captives) {
        const released = await releaseCapturedMascot(releaseStore, captive.mascotId, `${run.id}:${roomId}:${run.globalTurn}`, result.participantIds[0]);
        if (released) log.push(`Mascote ${captive.mascotId} foi libertado e voltou ao dono em repouso.`);
      }
    }
    for (const [index, enemy] of frozenEnemies.entries()) {
      if (!enemy.captiveMascotId || !result.kos.includes(`tower:${run.id}:${roomId}:${index}`)) continue;
      const released = await releaseCapturedMascot(releaseStore, enemy.captiveMascotId, `${run.id}:${roomId}:${run.globalTurn}`, result.participantIds[0]);
      if (released) log.push(`${enemy.name} foi libertado e voltou ao dono em repouso; não entrou no espólio.`);
    }
    if (result.blockedBy.length) log.push(`Chefe bloqueado: aguardando ${result.blockedBy.join(", ")}.`);
    for (const [mascotId, hp] of Object.entries(result.hpByMascotId))
      await tx.towerRunMascot.updateMany({
        where: { mascotId, member: { runId: run.id } },
        data: { currentHp: hp, state: hp <= 0 ? "DEFEATED" : "IN_TOWER" },
      });
  }
  return { state: next, log, fronts, splitPenalty: talentFx.splitPenalty };
}

function finalHp(
  lineup: LeagueMascot[],
  log: { action: string; targetId: string; damage: number }[],
) {
  const hp = new Map(lineup.map((m) => [m.id, m.hp]));
  for (const event of log) {
    if (event.action === "ATTACK")
      hp.set(
        event.targetId,
        Math.max(0, (hp.get(event.targetId) ?? 0) - event.damage),
      );
    if (event.action === "HEAL" && (hp.get(event.targetId) ?? 0) > 0) {
      const max = lineup.find((m) => m.id === event.targetId)?.hp ?? 0;
      hp.set(
        event.targetId,
        Math.min(max, (hp.get(event.targetId) ?? 0) + event.damage),
      );
    }
  }
  return hp;
}

async function resolveRoom(
  tx: Prisma.TransactionClient,
  run: Awaited<ReturnType<typeof tx.towerRun.findUnique>> & {
    members: Array<{
      id: string;
      userId: string;
      expeditionRole: string;
      afkRemoved: boolean;
      consecutiveMisses: number;
    }>;
  },
  vol: TowerVolatile,
  submissions: Record<string, { confirmedAt: string; actions: unknown }>,
  battleLog: string[],
) {
  let state = vol.exploration;
  if (!state) return;
  const room = currentTowerRoom(state);
  const choices = Object.values(submissions)
    .map(
      (s) =>
        (s.actions ?? {}) as {
          routeId?: string;
          puzzleChoice?: string;
          action?: string;
          _roomId?: string;
        },
    )
    .filter((choice) => !choice._roomId || choice._roomId === room.id);
  const distinctRoutes = new Set(
    choices.map((choice) => choice.routeId).filter(Boolean),
  );
  // Efeitos dos 15 talentos novos (status/pressão/movimento) — resolvidos uma vez.
  const talentRowsAll = await tx.towerCommunityProgress.findMany({
    where: { floorId: 1, metricKey: { startsWith: "TALENT:" } },
  });
  const talentValue = (key: string) =>
    talentRowsAll.find((row) => row.metricKey === `TALENT:${key}`)?.value ?? 0;
  const talentFx = resolveTowerTalents(talentValue);
  const rallyActive =
    distinctRoutes.size > 1 &&
    state.countermeasures?.includes("RALLY") &&
    !state.countermeasures.includes("RALLY:USED");
  const splitPathPenalty =
    distinctRoutes.size > 1
      ? Math.max(1, talentFx.splitPenalty - (rallyActive ? 1 : 0))
      : 1;
  if (rallyActive)
    state = {
      ...state,
      countermeasures: [...(state.countermeasures ?? []), "RALLY:USED"],
    };
  const majority = (values: (string | undefined)[]) => {
    const count = new Map<string, number>();
    for (const value of values)
      if (value) count.set(value, (count.get(value) ?? 0) + 1);
    return [...count].sort((a, b) => b[1] - a[1])[0]?.[0];
  };

  if (room.cleared) {
    const routeId = majority(choices.map((c) => c.routeId));
    if (routeId && room.connections.includes(routeId)) {
      const destination = state.graph.find((r) => r.id === routeId)!;
      const snapshots = await tx.towerRunMascot.findMany({
        where: { member: { runId: run.id }, state: "IN_TOWER" },
        select: { mascotId: true },
      });
      const levels = await tx.mascot.findMany({
        where: { id: { in: snapshots.map((m) => m.mascotId) } },
        select: { level: true },
      });
      const averageLevel = Math.max(
        1,
        Math.round(
          levels.reduce((sum, m) => sum + m.level, 0) /
            Math.max(1, levels.length),
        ),
      );
      const preview = towerEncounterPreview(
        destination,
        averageLevel,
        snapshots.length,
      );
      if (destination.kind === "BOSS" && preview[0])
        preview[0].pokemonId = towerRewardForFloor(run.currentFloor).pokemonId;
      if (
        (destination.kind === "COMBAT" || destination.kind === "BOSS") &&
        preview.length < 8
      ) {
        const captive = await tx.towerLostMascot.findFirst({
          where: { recoveredAt: null },
          orderBy: { createdAt: "asc" },
        });
        const captiveMascot = captive
          ? await tx.mascot.findUnique({
              where: { id: captive.mascotId },
              select: { pokemonId: true, nickname: true, level: true },
            })
          : null;
        if (captiveMascot)
          preview.push({
            pokemonId: captiveMascot.pokemonId,
            level: captiveMascot.level,
            name: `${captiveMascot.nickname ?? getPokemonName(captiveMascot.pokemonId)} · sob Psicose`,
          });
      }
      const encounter =
        destination.kind === "COMBAT" || destination.kind === "BOSS"
          ? {
              roomId: destination.id,
              preparationTurns: destination.kind === "BOSS" ? 2 : 1,
              enemies: preview.map((enemy) => ({
                ...enemy,
                name:
                  TOWER_EXCLUSIVE_MASCOTS.find(
                    (entry) => entry.pokemonId === enemy.pokemonId,
                  )?.name ??
                  enemy.name ??
                  getPokemonName(enemy.pokemonId),
              })),
            }
          : undefined;
      state = {
        ...state,
        currentRoomId: routeId,
        visited: [...new Set([...state.visited, routeId])],
        encounter,
        lastOutcome:
          distinctRoutes.size > 1
            ? `O grupo se dividiu entre caminhos. A maioria chegou a ${destination.title}, mas a Pressão desta ação foi dobrada.`
            : `O grupo percorreu a passagem e chegou a ${destination.title}.`,
      };
      delete state.pendingReplay;
      battleLog.push(state.lastOutcome!);
    } else {
      state = applyTowerPressure({
        ...state,
        lastOutcome: "A expedição hesitou. A Torre ficou mais atenta.",
      });
      battleLog.push(state.lastOutcome!);
    }
  } else if (room.kind === "PUZZLE" && room.puzzle) {
    const answer = majority(choices.map((c) => c.puzzleChoice));
    const success = answer === room.puzzle.answer;
    room.cleared = success;
    const failurePressure =
      state.countermeasures?.includes("ROLE:ARTIFICE") ||
      state.countermeasures?.includes("SABOTAGE")
        ? 1
        : 2;
    state = applyTowerPressure(
      {
        ...state,
        graph: [...state.graph],
        lastOutcome: success
          ? "O mecanismo cedeu. O grupo registrou uma nova descoberta."
          : `Resposta errada. A passagem abriu, mas a Torre despertou${failurePressure === 1 ? "; o Artífice conteve parte da reação" : ""}.`,
      },
      success ? 0 : failurePressure,
    );
    battleLog.push(state.lastOutcome!);
    if (success) {
      const found = await tx.towerCodexEntry.findFirst({
        where: {
          userId: null,
          subjectType: "PUZZLE",
          subjectKey: room.puzzle.id,
        },
        select: { id: true },
      });
      if (found)
        await tx.towerCodexEntry.update({
          where: { id: found.id },
          data: {
            discoveryLevel: { increment: 1 },
            data: { text: room.puzzle.discovery },
          },
        });
      else
        await tx.towerCodexEntry.create({
          data: {
            userId: null,
            subjectType: "PUZZLE",
            subjectKey: room.puzzle.id,
            discoveryLevel: 1,
            data: { text: room.puzzle.discovery },
          },
        });
    }
  } else if (room.kind === "EVENT" || room.kind === "LUCK") {
    const decision = majority(choices.map((choice) => choice.action));
    if (decision === "INTERACT") {
      const favorableThreshold =
        Math.min(65, 25 + state.pressure * 4) -
        (state.countermeasures?.includes("FORTUNE") ? 8 : 0);
      const favorable =
        [...`${run.seed}:${room.id}:${run.globalTurn}`].reduce(
          (sum, char) => sum + char.charCodeAt(0),
          0,
        ) %
          100 >=
        favorableThreshold;
      if (favorable)
        state = {
          ...state,
          pressureShield: (state.pressureShield ?? 0) + 1,
          relics: [
            ...(state.relics ?? []),
            {
              key: `relic:${room.id}`,
              name: "Fragmento de Lucidez",
              description: "Absorve 1 ponto futuro de Pressão.",
            },
          ],
          lastOutcome:
            "A interação revelou um Fragmento de Lucidez. O grupo ganhou 1 proteção contra Pressão.",
        };
      else
        state = applyTowerPressure(
          {
            ...state,
            lastOutcome:
              "O objeto era uma isca rebelde. A Torre ganhou 2 de Pressão e seus próximos defensores ficaram mais fortes.",
          },
          2,
        );
    } else
      state = {
        ...state,
        lastOutcome: "O grupo deixou o objeto intocado e preservou a rota.",
      };
    room.cleared = true;
    state.graph = [...state.graph];
    battleLog.push(state.lastOutcome!);
  } else if (room.kind === "RESCUE") {
    const prisoners = await tx.towerLostMascot.findMany({
      where: { recoveredAt: null },
      orderBy: { createdAt: "asc" },
      take: state.countermeasures?.includes("RESCUE") ? 3 : 2,
    });
    const rescuedMascots = prisoners.length
      ? await tx.mascot.findMany({
          where: { id: { in: prisoners.map((prisoner) => prisoner.mascotId) } },
          select: {
            id: true,
            nickname: true,
            pokemonId: true,
            player: { select: { displayName: true } },
          },
        })
      : [];
    const rescuedById = new Map(
      rescuedMascots.map((mascot) => [
        mascot.id,
        `${mascot.nickname ?? getPokemonName(mascot.pokemonId)} · dono: ${mascot.player.displayName}`,
      ]),
    );
    for (const prisoner of prisoners)
      await tx.towerLostMascot.update({
        where: { id: prisoner.id },
        data: {
          recoveredAt: new Date(),
          recoveredById: run.members[0]?.userId ?? null,
        },
      });
    room.cleared = true;
    const rescuedNames = prisoners
      .map(
        (prisoner) =>
          rescuedById.get(prisoner.mascotId) ?? `Mascote #${prisoner.mascotId}`,
      )
      .join("; ");
    state = {
      ...state,
      graph: [...state.graph],
      runReport: {
        ...(state.runReport ?? { mascots: {}, monstersDefeated: 0, bossesDefeated: 0, alliesRecovered: 0, talentPoints: 0, roomsCleared: 0 }),
        alliesRecovered: (state.runReport?.alliesRecovered ?? 0) + prisoners.length,
        roomsCleared: (state.runReport?.roomsCleared ?? 0) + 1,
      },
      lastOutcome: prisoners.length
        ? `A Sala Anti-Psicose libertou ${prisoners.length} mascote(s) de outras runs e os devolveu aos donos: ${rescuedNames}.`
        : "A Sala Anti-Psicose foi ativada, mas as jaulas estavam vazias. Nenhum mascote precisava de resgate.",
    };
    battleLog.push(state.lastOutcome!);
  } else if (room.kind === "REST") {
    const decision = majority(choices.map((choice) => choice.action));
    const runMascots = await tx.towerRunMascot.findMany({
      where: { member: { runId: run.id }, state: "IN_TOWER" },
    });
    const healMult = state.activeModifiers.reduce(
      (m, mod) => m * mod.healingMultiplier,
      1,
    );
    const ritualHeal =
      (state.countermeasures?.includes("ROLE:RITUALISTA") ? 1.1 : 1) *
      (state.countermeasures?.includes("MEDIC") ? 1.1 : 1);
    if (decision === "INTERACT")
      for (const mascot of runMascots)
        await tx.towerRunMascot.update({
          where: { id: mascot.id },
          data: {
            currentHp: Math.min(
              mascot.maxHp,
              mascot.currentHp +
                Math.round(mascot.maxHp * 0.2 * healMult * ritualHeal),
            ),
          },
        });
    room.cleared = true;
    state =
      decision === "INTERACT"
        ? applyTowerPressure({
            ...state,
            graph: [...state.graph],
            lastOutcome:
              "O grupo decidiu usar a chama, recuperou parte do HP e aceitou que a Torre avançasse seu relógio.",
          })
        : {
            ...state,
            graph: [...state.graph],
            lastOutcome: "O grupo ignorou a chama e seguiu sem recuperar HP.",
          };
    battleLog.push(state.lastOutcome!);
  } else if (room.kind === "COMBAT" || room.kind === "BOSS") {
    const encounterDecision = majority(choices.map((choice) => choice.action));
    if (encounterDecision === "WAIT") {
      const navigatorDiscount =
        state.countermeasures?.includes("ROLE:NAVEGADOR") &&
        !state.countermeasures.includes("ROLE:NAVEGADOR:USED")
          ? 1
          : 0;
      state = applyTowerPressure(
        {
          ...state,
          countermeasures: navigatorDiscount
            ? [...(state.countermeasures ?? []), "ROLE:NAVEGADOR:USED"]
            : state.countermeasures,
          encounter: state.encounter
            ? {
                ...state.encounter,
                preparationTurns: state.encounter.preparationTurns + 1,
              }
            : state.encounter,
          lastOutcome: navigatorDiscount
            ? "O Navegador encontrou um abrigo: a primeira espera custou 1 Pressão a menos."
            : "O grupo decidiu esperar reforços. A Torre ganhou +1 de Pressão adicional e fortaleceu seus defensores.",
        },
        Object.keys(submissions).length + 1 - navigatorDiscount,
      );
      battleLog.push(state.lastOutcome!);
      vol.exploration = state;
      return;
    }
    if (
      state.encounter &&
      state.encounter.preparationTurns > 1 &&
      encounterDecision !== "FIGHT"
    ) {
      state = applyTowerPressure(
        {
          ...state,
          encounter: {
            ...state.encounter,
            preparationTurns: state.encounter.preparationTurns - 1,
          },
          lastOutcome: `O confronto se aproxima. Resta ${state.encounter.preparationTurns - 1} janela de preparação para aliados chegarem.`,
        },
        Object.keys(submissions).length,
      );
      battleLog.push(state.lastOutcome!);
      vol.exploration = state;
      return;
    }
    const snapshots = await tx.towerRunMascot.findMany({
      where: { member: { runId: run.id } },
      include: { member: true },
    });
    const rows = await tx.mascot.findMany({
      where: { id: { in: snapshots.map((m) => m.mascotId) } },
    });
    const snapById = new Map(snapshots.map((m) => [m.mascotId, m]));
    const allies = rows.flatMap((m, index) => {
      const snap = snapById.get(m.id);
      if (!snap || snap.currentHp <= 0) return [];
      const fighter = toLeagueMascot(m, index + 1, snap.currentStance);
      fighter.hp = snap.currentHp;
      if (snap.member.expeditionRole === "INVESTIGADOR")
        fighter.instinct = Math.round(fighter.instinct * 1.08);
      if (snap.member.expeditionRole === "NAVEGADOR")
        fighter.agility = Math.round(fighter.agility * 1.03);
      if (snap.member.expeditionRole === "PROTETOR")
        fighter.vitality = Math.round(fighter.vitality * 1.06);
      if (snap.member.expeditionRole === "ARTIFICE")
        fighter.force = Math.round(fighter.force * 1.04);
      if (snap.member.expeditionRole === "RITUALISTA")
        fighter.charisma = Math.round(fighter.charisma * 1.1);
      if (snap.member.expeditionRole === "BATEDOR")
        fighter.agility = Math.round(fighter.agility * 1.07);
      return [fighter];
    });
    const avg = Math.max(
      1,
      Math.round(
        allies.reduce((sum, m) => sum + m.level, 0) /
          Math.max(1, allies.length),
      ),
    );
    // Talentos originais COMBAT/BOSS (efeito antigo) + novos talentos por atributo.
    const combatTalent = talentValue("COMBAT");
    const bossTalent = room.kind === "BOSS" ? talentValue("BOSS") : 0;
    const allyTalentMult = 1 + combatTalent * 0.02 + bossTalent * 0.03;
    const bossFx = room.kind === "BOSS" ? talentFx.bossMult : 1;
    for (const ally of allies) {
      ally.force = Math.round(
        ally.force * allyTalentMult * talentFx.forceMult * bossFx,
      );
      ally.agility = Math.round(
        ally.agility * allyTalentMult * talentFx.agilityMult * bossFx,
      );
      ally.instinct = Math.round(
        ally.instinct * allyTalentMult * talentFx.instinctMult * bossFx,
      );
      ally.vitality = Math.round(
        ally.vitality * allyTalentMult * talentFx.vitalityMult * bossFx,
      );
      ally.charisma = Math.round(ally.charisma * allyTalentMult * talentFx.charismaMult * bossFx);
    }
    const pressureMult =
      state.activeModifiers.reduce((m, mod) => m * mod.enemyMultiplier, 1) *
      (1 + state.pressure * talentFx.enemyPressureScale);
    // A composição é congelada ao entrar na sala. Esperar pode fortalecer os
    // inimigos pela Pressão, mas nunca inserir espécies que não apareceram no preview.
    const frozenPreview =
      state.encounter?.enemies ??
      towerEncounterPreview(room, avg, allies.length);
    const enemies: LeagueMascot[] = frozenPreview.map((previewEnemy, index) => {
      const pokemonId = previewEnemy.pokemonId;
      const base = Math.max(
        12,
        Math.round((avg * 0.72 + 18 + room.index * 2) * pressureMult),
      );
      const level = Math.max(1, previewEnemy.level);
      const exclusive = TOWER_EXCLUSIVE_MASCOTS.find(
        (entry) => entry.pokemonId === pokemonId,
      );
      return {
        id: `tower:${run.id}:${room.id}:${index}`,
        ownerId: "TORRE",
        pokemonId,
        types: exclusive
          ? ([
              exclusive.primaryType,
              "secondaryType" in exclusive ? exclusive.secondaryType : null,
            ].filter(Boolean) as string[])
          : getPokemonTypes(pokemonId),
        name: previewEnemy.name || exclusive?.name || getPokemonName(pokemonId),
        level,
        force: base,
        agility: base,
        instinct: base,
        vitality: base,
        charisma: base,
        hp: 55 + level * 6 + base * 4,
        combatRole: normalizeCombatRole(index % 2 ? "DEFENDER" : "ATTACKER"),
        slot: index + 1,
      };
    });
    const result = runLeagueCombat(allies, enemies);
    const hp = finalHp(allies, result.log);
    for (const ally of allies)
      await tx.towerRunMascot.updateMany({
        where: { mascotId: ally.id, member: { runId: run.id } },
        data: {
          currentHp: hp.get(ally.id) ?? 0,
          state: (hp.get(ally.id) ?? 0) <= 0 ? "DEFEATED" : "IN_TOWER",
        },
      });
    const won = result.winner === "A";
    const runReport = addCombatToRunReport(state.runReport, allies, enemies, result.log, room.kind === "BOSS", won);
    room.cleared = won;
    state = {
      ...state,
      graph: [...state.graph],
      encounter: undefined,
      lastOutcome: won
        ? `${room.title} foi vencida.`
        : "A expedição foi derrotada.",
      pendingReplay: {
        winner: result.winner,
        log: result.log,
        lineupA: result.lineupA,
        lineupB: result.lineupB,
        teamASurvivors: result.teamASurvivors,
        teamBSurvivors: result.teamBSurvivors,
        title: room.title,
      },
      runReport,
    };
    battleLog.push(state.lastOutcome!);
  }
  vol.exploration = applyTowerPressure(
    state,
    Object.keys(submissions).length * splitPathPenalty,
  );
}

/** Duração da janela de turno por ritmo. */
export function windowMsFor(pace: string): number {
  return pace === "SLOW" ? 4 * 60 * 60_000 : 5 * 60_000;
}

/** Lock consultivo estável por run (evita resolver o mesmo turno duas vezes). */
export function runLockKey(runId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < runId.length; i++) {
    h ^= runId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h | 0; // int32 assinado, aceito por pg_advisory_xact_lock
}

/** Called only while holding the per-run advisory lock inside the same transaction. */
async function grantV2RewardOnce(
  tx: Prisma.TransactionClient,
  runId: string,
  userId: string,
  rewardId: string,
  reward: TowerRewardEntry,
): Promise<boolean> {
  const isBoss = reward.kind === "BOSS_BUNDLE";
  const previous = await tx.towerFeat.findFirst({
    where: isBoss
      ? { userId, featKey: "TOWER_BOSS_PRIZE", data: { path: ["floor"], equals: reward.floor } }
      : { userId, runId, featKey: "TOWER_REWARD_GRANTED", data: { path: ["rewardId"], equals: rewardId } },
    select: { id: true },
  });
  if (previous) return false;
  const player = await tx.player.findUnique({ where: { userId }, select: { id: true } });
  if (!player) throw new Error(`Destinatário da Torre não encontrado: ${userId}`);
  const coins = isBoss ? reward.coins ?? 0 : reward.kind === "COINS" ? reward.quantity : 0;
  if (coins > 0) await tx.zikaCoinWallet.upsert({
    where: { playerId: player.id },
    create: { playerId: player.id, balance: coins, totalEarned: coins },
    update: { balance: { increment: coins }, totalEarned: { increment: coins } },
  });
  const eggs = isBoss ? reward.eggs ?? [] : reward.kind === "EGG" && reward.eggType
    ? [{ type: reward.eggType, quantity: reward.quantity }] : [];
  for (const egg of eggs) {
    if (!Object.values(EggType).includes(egg.type as EggType)) throw new Error(`Ovo da Torre inválido: ${egg.type}`);
    await tx.mascotEgg.createMany({
      data: Array.from({ length: egg.quantity }, () => ({
        playerId: player.id,
        type: egg.type as EggType,
        origin: isBoss ? `Torre dos Rebeldes · ${reward.boss}` : "Torre dos Rebeldes · achado de andar",
      })),
    });
  }
  if (reward.kind === "ITEM") {
    if (!reward.itemId) throw new Error("Item da Torre sem ID.");
    await tx.playerInventory.upsert({
      where: { playerId_itemId: { playerId: player.id, itemId: reward.itemId } },
      create: { playerId: player.id, itemId: reward.itemId, quantity: reward.quantity, source: "TOWER" },
      update: { quantity: { increment: reward.quantity } },
    });
  }
  await tx.towerFeat.create({
    data: {
      userId, runId, featKey: isBoss ? "TOWER_BOSS_PRIZE" : "TOWER_REWARD_GRANTED",
      data: isBoss
        ? { floor: reward.floor, boss: reward.boss, label: reward.label, coins, eggs }
        : { floor: reward.floor, rewardId, kind: reward.kind, label: reward.label, quantity: reward.quantity },
    },
  });
  if (isBoss && reward.floor === 7) {
    const priorChoice = await tx.towerFeat.findFirst({
      where: { userId, featKey: { in: ["TOWER_BOSS_CHOICE_PENDING", "TOWER_BOSS_CHOICE_CLAIMED"] } },
      select: { id: true },
    });
    if (!priorChoice) await tx.towerFeat.create({
      data: { userId, runId, featKey: "TOWER_BOSS_CHOICE_PENDING", data: { unlockedAtFloor: 7, firstClearRunId: runId } },
    });
  }
  return true;
}

/**
 * Resolve UMA passagem de turno (idempotente, sob lock). Aplica AFK, avança o
 * turno global, rotaciona a ordem, limpa submissões e reabre a janela.
 * A resolução de gameplay (exploração/encounters via o núcleo tático) entra aqui
 * nas próximas fases — este é o esqueleto do loop.
 */
export async function resolveTowerTurnLocked(runId: string, expectedTurn?: number): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${runLockKey(runId)})`;
      const run = await tx.towerRun.findUnique({
        where: { id: runId },
        include: { members: { include: { mascots: true } } },
      });
      if (!run || run.status !== "ACTIVE") return;

      const vol = (run.volatileState ?? {}) as TowerVolatile;
      if (isExpeditionV2(vol.exploration)) {
        const submissions = vol.submissions ?? {};
        if (expectedTurn !== undefined && expectedTurn !== run.globalTurn) return;
        if (vol.lastResolvedTurn === run.globalTurn) return;
        if (vol.exploration.globalTurn !== run.globalTurn) throw new Error("Turno V2 fora de sincronia com a run.");
        const mapped: Record<string, V2Submission> = Object.fromEntries(Object.entries(submissions).map(([memberId, submission]) => {
          const payload = (submission.actions ?? {}) as { roomId?: string; globalTurn?: number };
          return [memberId, {
            memberId,
            roomId: payload.roomId ?? "",
            globalTurn: payload.globalTurn ?? -1,
            actions: submission.actions,
          }];
        }));
        const deadlineReached = Boolean(run.nextDeadline && run.nextDeadline <= new Date());
        const turn = advanceV2Turn(vol.exploration, mapped, run.globalTurn, deadlineReached);
        if (!turn) return;
        const activeState = { ...turn.state, globalTurn: run.globalTurn };
        const recovery = await resolveV2Recoveries(tx, run, activeState, submissions);
        const runAfterRecovery = { ...run, members: run.members.map((member) => ({
          ...member, mascots: mergeRecoveredHp(member.mascots, recovery.recoveredHpByMascotId),
        })) };
        const resolved = await resolveV2RoomFronts(tx, runAfterRecovery, recovery.state, submissions, turn.defensiveMemberIds);
        const members = { ...resolved.state.members };
        for (const member of run.members) {
          const nextMember = members[member.userId];
          if (!nextMember) continue;
          if (nextMember.status === "AFK_ABANDONED") {
            for (const mascot of member.mascots)
              await tx.towerRunMascot.updateMany({
                where: { memberId: member.id, mascotId: mascot.mascotId },
                data: terminalMascotDisposition("AFK_ABANDONED", false, mascot.currentHp),
              });
            if (turn.abandonedMemberIds.includes(member.userId))
              await tx.towerFeat.deleteMany({
                where: { runId, userId: member.userId,
                  featKey: { in: ["TOWER_RELIC_SHARD", "TOWER_TALENT_CONTRIBUTION"] } },
              });
          }
          await tx.towerRunMember.update({
            where: { id: member.id },
            data: {
              consecutiveMisses: nextMember.consecutiveMisses,
              afkRemoved: nextMember.status === "AFK_ABANDONED",
              removedAt: nextMember.status === "AFK_ABANDONED" ? new Date() : null,
            },
          });
        }
        const latestMascots = await tx.towerRunMascot.findMany({
          where: { member: { runId } },
          include: { member: { select: { userId: true } } },
        });
        for (const [memberId, member] of Object.entries(members)) {
          if (member.status !== "ACTIVE") continue;
          const mascots = latestMascots.filter((entry) => entry.member.userId === memberId);
          if (mascots.length && mascots.every((entry) => entry.currentHp <= 0)) {
            members[memberId] = { ...member, status: "DOWNED" };
          }
        }
        const waitingRooms = new Set(Object.entries(submissions)
          .filter(([, submission]) => (submission.actions as { action?: string } | null)?.action === "WAIT")
          .map(([memberId]) => activeState.members[memberId]?.roomId)
          .filter((roomId): roomId is string => Boolean(roomId)));
        const navigatorUsed = activeState.countermeasures?.includes("ROLE:NAVEGADOR:USED") ?? false;
        const navigatorDiscount = !navigatorUsed && [...waitingRooms].some((roomId) => run.members.some((member) =>
          member.expeditionRole === "NAVEGADOR" && activeState.members[member.userId]?.roomId === roomId &&
          activeState.members[member.userId]?.status === "ACTIVE")) ? 1 : 0;
        const rawMistakes = resolved.fronts.reduce((sum, front) => sum + front.mistakes, 0);
        const artificeDiscount = resolved.fronts.reduce((sum, front) => sum + (front.mistakes > 0 && run.members.some((member) =>
          member.expeditionRole === "ARTIFICE" && front.participantIds.includes(member.userId)) ? 1 : 0), 0);
        const pressureChange = pressureDelta({
          activeFronts: groupActiveMembersByRoom(activeState).size,
          mistakes: Math.max(0, rawMistakes - artificeDiscount),
          waits: Math.max(0, waitingRooms.size - navigatorDiscount),
          shield: resolved.state.pressureShield ?? 0,
          splitPenalty: resolved.splitPenalty,
        });
        if (navigatorDiscount) pressureChange.reasons.push(...resolveTowerClassEffects("NAVEGADOR", { kind: "WAIT", firstWait: true }).reasons);
        if (artificeDiscount) pressureChange.reasons.push(...resolveTowerClassEffects("ARTIFICE", { kind: "PUZZLE_MISTAKE" }).reasons);
        let nextState = applyPressureToExpedition({ ...resolved.state, members }, pressureChange);
        if (navigatorDiscount) nextState = { ...nextState, countermeasures: [...(nextState.countermeasures ?? []), "ROLE:NAVEGADOR:USED"] };
        const appliedPressure = nextState.lastPressureChange?.applied ?? 0;
        nextState = updateOverload(nextState, run.globalTurn, overloadFromResults(resolved.fronts));
        for (const front of resolved.fronts) {
          if (!front.success) continue;
          const room = nextState.graph.find((entry) => entry.id === front.roomId);
          if (!room) continue;
          // Small deterministic room finds. The event-only drop table remains a separate economy decision.
          if (front.interaction === "EVENT" || front.interaction === "LUCK") {
            const luckRank = front.interaction === "LUCK"
              ? (await tx.towerCommunityProgress.findUnique({
                  where: { floorId_metricKey: { floorId: 1, metricKey: "TALENT:LUCK" } }, select: { value: true },
                }))?.value ?? 0 : 0;
            const amount = front.interaction === "LUCK" ? towerLuckCoins(luckRank) : 15;
            nextState = recordFloorDrop(nextState, run.currentFloor, {
              id: `room:${run.currentFloor}:${front.roomId}`,
              kind: "COINS", quantity: amount, label: `${amount} ZC · ${room.title}`,
            });
          }
          if (room.kind === "BOSS") {
            const prize = TOWER_BOSS_PRIZES[run.currentFloor - 1];
            if (!prize) throw new Error(`Prêmio do chefe ausente no andar ${run.currentFloor}.`);
            nextState = recordFloorDrop(nextState, run.currentFloor, {
              id: `boss:${run.currentFloor}`, kind: "BOSS_BUNDLE", quantity: 1,
              label: prize.label, boss: prize.boss, coins: prize.coins,
              eggs: prize.eggs.map((egg) => ({ type: egg.type, quantity: egg.quantity })),
            });
            nextState = secureFloorDrops(nextState, run.currentFloor);
          }
        }
        const bossVictory = resolved.fronts.some((front) =>
          front.success && nextState.graph.find((room) => room.id === front.roomId)?.kind === "BOSS");
        if (bossVictory) {
          const contributed = await tx.towerFeat.findFirst({
            where: { runId, featKey: "TOWER_TALENT_CONTRIBUTION", data: { path: ["floor"], equals: run.currentFloor } },
            select: { id: true },
          });
          if (!contributed) {
            await tx.towerCommunityProgress.upsert({
              where: { floorId_metricKey: { floorId: 1, metricKey: "TALENT_POINTS" } },
              create: { floorId: 1, metricKey: "TALENT_POINTS", value: 1 },
              update: { value: { increment: 1 } },
            });
            for (const member of run.members.filter((entry) => members[entry.userId]?.status !== "AFK_ABANDONED")) {
              await tx.towerFeat.create({
                data: { userId: member.userId, runId, featKey: "TOWER_TALENT_CONTRIBUTION",
                  data: { floor: run.currentFloor, source: "BOSS", spectator: members[member.userId]?.status === "DOWNED" } },
              });
              for (let shard = 0; shard < (run.pace === "ONLINE" ? 2 : 1); shard++)
                await tx.towerFeat.create({
                  data: { userId: member.userId, runId, featKey: "TOWER_RELIC_SHARD", data: { floor: run.currentFloor, pace: run.pace } },
                });
            }
          }
        }
        let nextFloor = run.currentFloor;
        if (bossVictory && run.currentFloor < 7) {
          nextFloor = run.currentFloor + 1;
          const transition = transitionFloor(nextState, nextFloor, run.seed, latestMascots.map((mascot) => ({
            mascotId: mascot.mascotId,
            ownerUserId: mascot.ownerUserId,
            currentHp: mascot.currentHp,
            maxHp: mascot.maxHp,
          })));
          nextState = transition.state;
          for (const [mascotId, currentHp] of Object.entries(transition.healingByMascotId))
            await tx.towerRunMascot.updateMany({
              where: { mascotId, member: { runId } },
              data: { currentHp },
            });
        }
        const hasActive = Object.values(members).some((member) => member.status === "ACTIVE");
        const allAbandoned = Object.values(members).every((member) => member.status === "AFK_ABANDONED");
        const wonRun = bossVictory && run.currentFloor === 7;
        const ended = !hasActive || wonRun;
        const narrativeKinds: { kind: TowerNarrativeEvent; floor: number; turn: number }[] = [];
        const addNarrativeEvent = (kind: TowerNarrativeEvent, floor = run.currentFloor) => {
          if (!narrativeKinds.some((event) => event.kind === kind && event.floor === floor))
            narrativeKinds.push({ kind, floor, turn: run.globalTurn });
        };
        if (Object.entries(activeState.members).some(([id, member]) => vol.exploration &&
          isExpeditionV2(vol.exploration) && vol.exploration.members[id]?.roomId !== member.roomId)) addNarrativeEvent("ROOM_ENTERED");
        for (const front of resolved.fronts) {
          const frontRoom = resolved.state.graph.find((room) => room.id === front.roomId);
          if (frontRoom?.kind === "PUZZLE" && front.mistakes) addNarrativeEvent("PUZZLE_FAILURE");
          else if (frontRoom?.kind === "PUZZLE" && front.success) addNarrativeEvent("PUZZLE_SUCCESS");
          if (front.interaction === "EVENT") addNarrativeEvent("EVENT_FOUND");
          if (front.interaction === "LUCK") addNarrativeEvent("LUCK_FOUND");
          if (front.interaction === "REST") addNarrativeEvent("REST_USED");
          if (frontRoom?.kind === "COMBAT" && resolved.state.rooms[front.roomId]?.encounter) addNarrativeEvent("ENCOUNTER_FOUND");
          if (resolved.state.rooms[front.roomId]?.encounter?.enemies.some((enemy) => enemy.captiveMascotId))
            addNarrativeEvent("CAPTIVE_FOUND");
          if (frontRoom?.kind === "BOSS" && !front.success) addNarrativeEvent("BOSS_APPROACHED");
        }
        if (waitingRooms.size) addNarrativeEvent("WAITED");
        if (recovery.log.some((entry) => entry.includes(" reanimou "))) addNarrativeEvent("ALLY_RESCUED");
        if (resolved.log.some((entry) => entry.includes("foi libertado"))) addNarrativeEvent("CAPTIVE_RESCUED");
        if (resolved.state.pressure < 6 && nextState.pressure >= 6) addNarrativeEvent("PRESSURE_HIGH");
        if (bossVictory) addNarrativeEvent("BOSS_VICTORY");
        if (bossVictory) addNarrativeEvent("FLOOR_CLEARED");
        if (bossVictory && !wonRun) addNarrativeEvent("FLOOR_ENTERED", nextFloor);
        if (wonRun) addNarrativeEvent("RUN_VICTORY");
        else if (ended) addNarrativeEvent("RUN_DEFEAT");
        if (ended) {
          if (!wonRun) nextState = discardPendingFloorDrops(nextState, run.currentFloor);
          const settlement = await settleRunRewards({
            grantOnce: (grantRunId, userId, rewardId, reward) =>
              grantV2RewardOnce(tx, grantRunId, userId, rewardId, reward),
          }, planRewardSettlement(nextState, runId));
          nextState = { ...nextState, rewardSettlement: { ...settlement, settledAt: new Date().toISOString() } };
          if (wonRun) await tx.towerCommunityProgress.upsert({
            where: { floorId_metricKey: { floorId: 7, metricKey: "FIRST_FINAL_CLEAR" } },
            create: { floorId: 7, metricKey: "FIRST_FINAL_CLEAR", value: 1 },
            update: {},
          });
          for (const mascot of latestMascots) {
            const member = members[mascot.member.userId];
            if (member?.status === "AFK_ABANDONED") continue;
            const disposition = terminalMascotDisposition(member?.status ?? "DOWNED", wonRun, mascot.currentHp);
            if (disposition.state === "LOST_IN_TOWER") {
              await tx.towerLostMascot.upsert({
                where: { mascotId: mascot.mascotId },
                create: { mascotId: mascot.mascotId, ownerUserId: mascot.ownerUserId, lostRunId: runId, floor: run.currentFloor },
                update: { ownerUserId: mascot.ownerUserId, lostRunId: runId, floor: run.currentFloor, recoveredAt: null, recoveredById: null },
              });
              await tx.towerRunMascot.update({ where: { id: mascot.id }, data: { state: "LOST_IN_TOWER" } });
            } else {
              await tx.towerRunMascot.update({
                where: { id: mascot.id },
                data: disposition,
              });
            }
          }
        }
        await tx.towerRun.update({
          where: { id: runId },
          data: {
            globalTurn: turn.state.globalTurn,
            currentFloor: nextFloor,
            status: wonRun ? "FINISHED" : ended ? (allAbandoned ? "ABANDONED" : "FAILED") : "ACTIVE",
            endedAt: ended ? new Date() : null,
            nextDeadline: ended ? null : new Date(Date.now() + windowMsFor(run.pace)),
            volatileState: {
              ...vol,
              exploration: { ...nextState, globalTurn: turn.state.globalTurn },
              narrativeEvents: [...(vol.narrativeEvents ?? []), ...narrativeKinds],
              submissions: {},
              lastResolvedTurn: run.globalTurn,
              log: [
                ...(vol.log ?? []), ...turn.events, ...recovery.log, ...resolved.log,
                `Pressão ${appliedPressure > 0 ? "+" : ""}${appliedPressure}: ${pressureChange.reasons.join("; ")}.`,
                ...(bossVictory ? [wonRun ? "O 7º regente caiu. Expedição concluída!" : `O grupo alcançou o ${nextFloor}º andar; a Pressão diminuiu.`] : []),
                `Turno ${run.globalTurn} resolvido.`,
              ].slice(-50),
            } as unknown as Prisma.InputJsonValue,
          },
        });
        return;
      }
      const submissions = vol.submissions ?? {};
      const active = run.members.filter(
        (m) =>
          !m.afkRemoved &&
          m.mascots.some(
            (mascot) => mascot.currentHp > 0 && mascot.state === "IN_TOWER",
          ),
      );
      const battleLog: string[] = [];

      if (vol.exploration)
        await resolveRoom(tx, run as never, vol, submissions, battleLog);

      // ── Resolução do encounter (uma rodada do motor tático por Turno Global) ──
      if (!vol.exploration && vol.battle && !vol.battle.encounterOver) {
        // Coleta intenções por mascote e interações com objetos das submissões.
        const intents: Record<string, TowerIntent> = {};
        const interactions: string[] = [];
        const destinations: Record<string, TowerPlannedDestination> = {};
        const targets: Record<string, string> = {};
        for (const m of active) {
          const payload = submissions[m.userId]?.actions as
            | {
                intents?: Record<string, TowerIntent>;
                interactions?: string[];
                destinations?: Record<string, TowerPlannedDestination>;
                targets?: Record<string, string>;
              }
            | null
            | undefined;
          if (payload?.intents)
            for (const [mid, it] of Object.entries(payload.intents))
              intents[mid] = it;
          if (Array.isArray(payload?.interactions))
            interactions.push(...payload.interactions);
          if (payload?.destinations)
            Object.assign(destinations, payload.destinations);
          if (payload?.targets) Object.assign(targets, payload.targets);
        }
        const { state, events, objectLog } = resolveEncounterTurn(
          vol.battle,
          run.seed,
          run.globalTurn,
          { intents, interactions, destinations, targets },
        );
        vol.battle = state;
        vol.lastEvents = events;
        vol.lastResolvedTurn = run.globalTurn;
        battleLog.push(...objectLog);
        for (const e of events)
          if (e.kind === "KO" || e.kind === "SURVIVE") battleLog.push(e.text);
        if (state.encounterOver)
          battleLog.push(
            state.outcome === "WIN"
              ? "Encounter vencido!"
              : "Todos os mascotes caíram no encounter.",
          );
        // Survivor: sincroniza o HP dos aliados de volta no snapshot da run.
        for (const u of state.units) {
          if (u.team !== "ALLY") continue;
          await tx.towerRunMascot.updateMany({
            where: { mascotId: u.id, member: { runId } },
            data: {
              currentHp: u.hp,
              state: u.hp <= 0 ? "DEFEATED" : "IN_TOWER",
            },
          });
        }
      }

      // AFK: quem confirmou zera as faltas; quem não confirmou soma; 2 seguidas remove.
      let removedNow = 0;
      for (const m of active) {
        const confirmed = Boolean(submissions[m.userId]);
        if (confirmed) {
          if (m.consecutiveMisses !== 0) {
            await tx.towerRunMember.update({
              where: { id: m.id },
              data: { consecutiveMisses: 0 },
            });
          }
        } else {
          const misses = m.consecutiveMisses + 1;
          const remove = misses >= 2;
          if (remove) removedNow++;
          await tx.towerRunMember.update({
            where: { id: m.id },
            data: {
              consecutiveMisses: misses,
              afkRemoved: remove,
              removedAt: remove ? new Date() : null,
            },
          });
          if (remove) {
            const abandoned = await tx.towerRunMascot.findMany({
              where: { memberId: m.id },
            });
            for (const mascot of abandoned) {
              await tx.towerRunMascot.update({
                where: { id: mascot.id },
                data: { currentHp: 0, state: "LOST_IN_TOWER" },
              });
              await tx.towerLostMascot.upsert({
                where: { mascotId: mascot.mascotId },
                create: {
                  mascotId: mascot.mascotId,
                  ownerUserId: mascot.ownerUserId,
                  lostRunId: runId,
                  floor: run.currentFloor,
                },
                update: {
                  ownerUserId: mascot.ownerUserId,
                  lostRunId: runId,
                  floor: run.currentFloor,
                  recoveredAt: null,
                  recoveredById: null,
                },
              });
            }
            battleLog.push(
              `Um treinador foi removido por AFK; seus ${abandoned.length} mascote(s) ficaram sob controle da Torre.`,
            );
          }
        }
      }

      const stillActive = active.length - removedNow;
      const nextTurn = run.globalTurn + 1;
      const order = Array.isArray(run.resolutionOrder)
        ? (run.resolutionOrder as string[])
        : [];
      const rotated = order.length ? [...order.slice(1), order[0]] : order;
      const explorationRoom = vol.exploration
        ? currentTowerRoom(vol.exploration)
        : null;
      const bossVictory =
        Boolean(explorationRoom?.kind === "BOSS" && explorationRoom.cleared) ||
        Boolean(
          vol.battle?.isBoss &&
          vol.battle.encounterOver &&
          vol.battle.outcome === "WIN",
        );
      const runFailed =
        Boolean(
          vol.exploration?.pendingReplay?.winner === "B" &&
          explorationRoom &&
          !explorationRoom.cleared,
        ) ||
        Boolean(vol.battle?.encounterOver && vol.battle.outcome === "LOSS");
      const log = [
        ...(vol.log ?? []),
        ...battleLog,
        ...(bossVictory ? ["🏆 Boss do andar derrotado!"] : []),
        `Turno ${run.globalTurn} resolvido.`,
      ].slice(-50);

      if (bossVictory) {
        const bossAlreadyRewarded = await tx.towerFeat.findFirst({
          where: { runId, featKey: "TOWER_TALENT_CONTRIBUTION", data: { path: ["floor"], equals: run.currentFloor } },
          select: { id: true },
        });
        if (!bossAlreadyRewarded) {
          await tx.towerCommunityProgress.upsert({
            where: { floorId_metricKey: { floorId: 1, metricKey: "TALENT_POINTS" } },
            create: { floorId: 1, metricKey: "TALENT_POINTS", value: 1 },
            update: { value: { increment: 1 } },
          });
          const shardCount = run.pace === "ONLINE" ? 2 : 1;
          for (const member of active)
            for (let shard = 0; shard < shardCount; shard++)
              await tx.towerFeat.create({
                data: { userId: member.userId, runId, featKey: "TOWER_RELIC_SHARD", data: { floor: run.currentFloor, pace: run.pace } },
              });
          for (const member of run.members.filter((entry) => !entry.afkRemoved))
            await tx.towerFeat.create({
              data: {
                userId: member.userId,
                runId,
                featKey: "TOWER_TALENT_CONTRIBUTION",
                data: { floor: run.currentFloor, source: "BOSS", spectator: !active.some((entry) => entry.userId === member.userId) },
              },
            });
        }
        const prize = TOWER_BOSS_PRIZES[run.currentFloor - 1];
        for (const member of run.members) {
          const prior = await tx.towerFeat.findFirst({
            where: {
              userId: member.userId,
              featKey: "TOWER_BOSS_PRIZE",
              data: { path: ["floor"], equals: run.currentFloor },
            },
          });
          if (!prior && prize) {
            const player = await tx.player.findUnique({ where: { userId: member.userId }, select: { id: true } });
            if (player) {
              await tx.zikaCoinWallet.upsert({
                where: { playerId: player.id },
                create: { playerId: player.id, balance: prize.coins, totalEarned: prize.coins },
                update: { balance: { increment: prize.coins }, totalEarned: { increment: prize.coins } },
              });
              for (const egg of prize.eggs)
                await tx.mascotEgg.createMany({
                  data: Array.from({ length: egg.quantity }, () => ({ playerId: player.id, type: egg.type as EggType, origin: `Torre dos Rebeldes · ${prize.boss}` })),
                });
            }
            await tx.towerFeat.create({
              data: {
                userId: member.userId,
                runId,
                featKey: "TOWER_BOSS_PRIZE",
                data: { floor: run.currentFloor, boss: prize.boss, label: prize.label, coins: prize.coins, eggs: prize.eggs },
              },
            });
          }
        }
        if (run.currentFloor === 7) {
          await tx.towerCommunityProgress.upsert({
            where: { floorId_metricKey: { floorId: 7, metricKey: "FIRST_FINAL_CLEAR" } },
            create: { floorId: 7, metricKey: "FIRST_FINAL_CLEAR", value: 1 },
            update: {},
          });
          for (const member of run.members) {
            const priorChoice = await tx.towerFeat.findFirst({
              where: { userId: member.userId, featKey: { in: ["TOWER_BOSS_CHOICE_PENDING", "TOWER_BOSS_CHOICE_CLAIMED"] } },
            });
            if (!priorChoice)
              await tx.towerFeat.create({
                data: { userId: member.userId, runId, featKey: "TOWER_BOSS_CHOICE_PENDING", data: { unlockedAtFloor: 7, firstClearRunId: runId } },
              });
          }
        }
      }

      if (bossVictory && run.currentFloor < 7) {
        const nextFloor = run.currentFloor + 1;
        const nextExploration = generateTowerRoomGraph(run.seed, nextFloor);
        nextExploration.countermeasures =
          vol.exploration?.countermeasures ?? [];
        nextExploration.pressureShield = vol.exploration?.pressureShield ?? 0;
        nextExploration.runReport = vol.exploration?.runReport;
        await tx.towerCodexEntry
          .create({
            data: {
              userId: null,
              subjectType: "LEADER",
              subjectKey: `floor-${run.currentFloor}`,
              discoveryLevel: 1,
              data: { defeatedAt: new Date().toISOString(), runId },
            },
          })
          .catch(() => null);
        await tx.towerRun.update({
          where: { id: runId },
          data: {
            currentFloor: nextFloor,
            globalTurn: nextTurn,
            resolutionOrder: rotated,
            nextDeadline: new Date(Date.now() + windowMsFor(run.pace)),
            volatileState: {
              ...vol,
              exploration: nextExploration,
              submissions: {},
              log: [
                ...log,
                `As escadas abriram. O grupo alcançou o ${nextFloor}º andar.`,
              ],
            } as unknown as Prisma.InputJsonValue,
          },
        });
        return;
      }

      if (runFailed) {
        for (const member of run.members) {
          const prior = await tx.towerFeat.findFirst({
            where: {
              userId: member.userId,
              featKey: { in: ["TOWER_MASCOT_PENDING", "TOWER_MASCOT_CLAIMED"] },
              data: { path: ["pokemonId"], equals: XANDINHO.pokemonId },
            },
          });
          if (!prior)
            await tx.towerFeat.create({
              data: {
                userId: member.userId,
                runId,
                featKey: "TOWER_MASCOT_PENDING",
                data: {
                  pokemonId: XANDINHO.pokemonId,
                  basePokemonId: XANDINHO.basePokemonId,
                  name: XANDINHO.name,
                  reason: "FIRST_RUN_LOSS",
                },
              },
            });
        }
        const defeated = await tx.towerRunMascot.findMany({
          where: { member: { runId }, currentHp: { lte: 0 } },
        });
        for (const mascot of defeated) {
          await tx.towerLostMascot.upsert({
            where: { mascotId: mascot.mascotId },
            create: {
              mascotId: mascot.mascotId,
              ownerUserId: mascot.ownerUserId,
              lostRunId: runId,
              floor: run.currentFloor,
            },
            update: {
              ownerUserId: mascot.ownerUserId,
              lostRunId: runId,
              floor: run.currentFloor,
              recoveredAt: null,
              recoveredById: null,
            },
          });
          await tx.towerRunMascot.update({
            where: { id: mascot.id },
            data: { state: "LOST_IN_TOWER" },
          });
        }
      }

      if (stillActive <= 0 || bossVictory || runFailed) {
        await tx.towerRun.update({
          where: { id: runId },
          data: {
            status: runFailed ? "FAILED" : "FINISHED",
            endedAt: new Date(),
            volatileState: {
              ...vol,
              submissions: {},
              log,
            } as unknown as Prisma.InputJsonValue,
          },
        });
        return;
      }

      await tx.towerRun.update({
        where: { id: runId },
        data: {
          globalTurn: nextTurn,
          resolutionOrder: rotated,
          nextDeadline: new Date(Date.now() + windowMsFor(run.pace)),
          volatileState: {
            ...vol,
            submissions: {},
            log,
          } as unknown as Prisma.InputJsonValue,
        },
      });
    },
    { timeout: 15000 },
  );
}

/** Explicit-turn entry point used by the final confirmation; cron uses the same locked resolver. */
export async function resolveTowerTurnV2(runId: string, expectedTurn: number): Promise<void> {
  await resolveTowerTurnLocked(runId, expectedTurn);
}

/** Varredura (cron): resolve janelas expiradas. Retorna quantas foram resolvidas. */
export async function sweepTowerDeadlines(): Promise<number> {
  const expired = await prisma.towerRun.findMany({
    where: { status: "ACTIVE", nextDeadline: { lte: new Date() } },
    select: { id: true },
    take: 50,
  });
  let resolved = 0;
  for (const r of expired) {
    await resolveTowerTurnLocked(r.id).catch(() => null);
    resolved++;
  }
  return resolved;
}
