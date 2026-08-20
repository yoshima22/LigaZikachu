// Torre dos Rebeldes — núcleo do turn engine (janela global; Online 120s / Lento
// 4h). Módulo de servidor comum (NÃO "use server"): usado pelas server actions e
// pelo cron, sem expor a resolução como action pública.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveEncounterTurn, type TowerBattleState, type TowerIntent, type TowerPlannedDestination } from "./encounter";
import type { TowerBattleEvent } from "./engine/types";
import { applyTowerPressure, currentTowerRoom, generateTowerRoomGraph, towerEncounterPreview, type TowerExplorationState } from "./rooms";
import { runLeagueCombat, toLeagueMascot, type LeagueMascot } from "@/lib/league-combat";
import { getPokemonName, getPokemonTypes } from "@/lib/mascot-data";
import { normalizeCombatRole } from "@/lib/combat-roles";

export type TowerVolatile = {
  submissions?: Record<string, { confirmedAt: string; actions: unknown }>;
  log?: string[];
  battle?: TowerBattleState;
  lastEvents?: TowerBattleEvent[];
  lastResolvedTurn?: number;
  roomIndex?: number;
  exploration?: TowerExplorationState;
};

function finalHp(lineup: LeagueMascot[], log: { action: string; targetId: string; damage: number }[]) {
  const hp = new Map(lineup.map((m) => [m.id, m.hp]));
  for (const event of log) {
    if (event.action === "ATTACK") hp.set(event.targetId, Math.max(0, (hp.get(event.targetId) ?? 0) - event.damage));
    if (event.action === "HEAL" && (hp.get(event.targetId) ?? 0) > 0) {
      const max = lineup.find((m) => m.id === event.targetId)?.hp ?? 0;
      hp.set(event.targetId, Math.min(max, (hp.get(event.targetId) ?? 0) + event.damage));
    }
  }
  return hp;
}

async function resolveRoom(tx: Prisma.TransactionClient, run: Awaited<ReturnType<typeof tx.towerRun.findUnique>> & { members: Array<{ id: string; userId: string; expeditionRole: string; afkRemoved: boolean; consecutiveMisses: number }> }, vol: TowerVolatile, submissions: Record<string, { confirmedAt: string; actions: unknown }>, battleLog: string[]) {
  let state = vol.exploration;
  if (!state) return;
  const room = currentTowerRoom(state);
  const choices = Object.values(submissions).map((s) => (s.actions ?? {}) as { routeId?: string; puzzleChoice?: string; action?: string });
  const distinctRoutes = new Set(choices.map((choice) => choice.routeId).filter(Boolean));
  const splitPathPenalty = distinctRoutes.size > 1 ? 2 : 1;
  const majority = (values: (string | undefined)[]) => {
    const count = new Map<string, number>();
    for (const value of values) if (value) count.set(value, (count.get(value) ?? 0) + 1);
    return [...count].sort((a, b) => b[1] - a[1])[0]?.[0];
  };

  if (room.cleared) {
    const routeId = majority(choices.map((c) => c.routeId));
    if (routeId && room.connections.includes(routeId)) {
      const destination = state.graph.find((r) => r.id === routeId)!;
      const snapshots = await tx.towerRunMascot.findMany({ where: { member: { runId: run.id }, state: "IN_TOWER" }, select: { mascotId: true } });
      const levels = await tx.mascot.findMany({ where: { id: { in: snapshots.map((m) => m.mascotId) } }, select: { level: true } });
      const averageLevel = Math.max(1, Math.round(levels.reduce((sum, m) => sum + m.level, 0) / Math.max(1, levels.length)));
      const preview = towerEncounterPreview(destination, averageLevel, snapshots.length);
      if (destination.kind === "BOSS" && preview[0]) preview[0].pokemonId = [25,448,197,94,778,52,196][Math.min(6, run.currentFloor - 1)];
      const encounter = destination.kind === "COMBAT" || destination.kind === "BOSS" ? { roomId: destination.id, preparationTurns: destination.kind === "BOSS" ? 2 : 1, enemies: preview.map((enemy) => ({ ...enemy, name: getPokemonName(enemy.pokemonId) })) } : undefined;
      state = { ...state, currentRoomId: routeId, visited: [...new Set([...state.visited, routeId])], encounter, lastOutcome: distinctRoutes.size > 1 ? `O grupo se dividiu entre caminhos. A maioria chegou a ${destination.title}, mas a Pressão desta ação foi dobrada.` : `O grupo percorreu a passagem e chegou a ${destination.title}.` };
      battleLog.push(state.lastOutcome!);
    } else {
      state = applyTowerPressure({ ...state, lastOutcome: "A expedição hesitou. A Torre ficou mais atenta." });
      battleLog.push(state.lastOutcome!);
    }
  } else if (room.kind === "PUZZLE" && room.puzzle) {
    const answer = majority(choices.map((c) => c.puzzleChoice));
    const success = answer === room.puzzle.answer;
    room.cleared = success;
    state = applyTowerPressure({ ...state, graph: [...state.graph], lastOutcome: success ? "O mecanismo cedeu. O grupo registrou uma nova descoberta." : "Resposta errada. A passagem abriu, mas a Torre despertou." }, success ? 0 : 2);
    battleLog.push(state.lastOutcome!);
    if (success) {
      const found = await tx.towerCodexEntry.findFirst({ where: { userId: null, subjectType: "PUZZLE", subjectKey: room.puzzle.id }, select: { id: true } });
      if (found) await tx.towerCodexEntry.update({ where: { id: found.id }, data: { discoveryLevel: { increment: 1 }, data: { text: room.puzzle.discovery } } });
      else await tx.towerCodexEntry.create({ data: { userId: null, subjectType: "PUZZLE", subjectKey: room.puzzle.id, discoveryLevel: 1, data: { text: room.puzzle.discovery } } });
    }
  } else if (room.kind === "EVENT" || room.kind === "LUCK") {
    const decision = majority(choices.map((choice) => choice.action));
    if (decision === "INTERACT") {
      const favorable = ([...`${run.seed}:${room.id}:${run.globalTurn}`].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 100) >= Math.min(65, 25 + state.pressure * 4);
      if (favorable) state = { ...state, pressureShield: (state.pressureShield ?? 0) + 1, relics: [...(state.relics ?? []), { key: `relic:${room.id}`, name: "Fragmento de Lucidez", description: "Absorve 1 ponto futuro de Pressão." }], lastOutcome: "A interação revelou um Fragmento de Lucidez. O grupo ganhou 1 proteção contra Pressão." };
      else state = applyTowerPressure({ ...state, lastOutcome: "O objeto era uma isca rebelde. A Torre ganhou 2 de Pressão e seus próximos defensores ficaram mais fortes." }, 2);
    } else state = { ...state, lastOutcome: "O grupo deixou o objeto intocado e preservou a rota." };
    room.cleared = true; state.graph = [...state.graph]; battleLog.push(state.lastOutcome!);
  } else if (room.kind === "RESCUE") {
    const prisoners = await tx.towerLostMascot.findMany({ where: { recoveredAt: null }, orderBy: { createdAt: "asc" }, take: 2 });
    for (const prisoner of prisoners) await tx.towerLostMascot.update({ where: { id: prisoner.id }, data: { recoveredAt: new Date(), recoveredById: run.members[0]?.userId ?? null } });
    room.cleared = true;
    state = { ...state, graph: [...state.graph], lastOutcome: prisoners.length ? `${prisoners.length} mascote(s) de outras runs foram libertados e devolvidos aos donos.` : "As jaulas estavam vazias. Alguém chegou antes." };
    battleLog.push(state.lastOutcome!);
  } else if (room.kind === "REST") {
    const decision = majority(choices.map((choice) => choice.action));
    const runMascots = await tx.towerRunMascot.findMany({ where: { member: { runId: run.id }, state: "IN_TOWER" } });
    const healMult = state.activeModifiers.reduce((m, mod) => m * mod.healingMultiplier, 1);
    if (decision === "INTERACT") for (const mascot of runMascots) await tx.towerRunMascot.update({ where: { id: mascot.id }, data: { currentHp: Math.min(mascot.maxHp, mascot.currentHp + Math.round(mascot.maxHp * .2 * healMult)) } });
    room.cleared = true;
    state = decision === "INTERACT"
      ? applyTowerPressure({ ...state, graph: [...state.graph], lastOutcome: "O grupo decidiu usar a chama, recuperou parte do HP e aceitou que a Torre avançasse seu relógio." })
      : { ...state, graph: [...state.graph], lastOutcome: "O grupo ignorou a chama e seguiu sem recuperar HP." };
    battleLog.push(state.lastOutcome!);
  } else if (room.kind === "COMBAT" || room.kind === "BOSS") {
    const encounterDecision = majority(choices.map((choice) => choice.action));
    if (encounterDecision === "WAIT") {
      state = applyTowerPressure({ ...state, encounter: state.encounter ? { ...state.encounter, preparationTurns: state.encounter.preparationTurns + 1 } : state.encounter, lastOutcome: "O grupo decidiu esperar reforços. A Torre ganhou +1 de Pressão adicional e fortaleceu seus defensores." }, Object.keys(submissions).length + 1);
      battleLog.push(state.lastOutcome!);
      vol.exploration = state;
      return;
    }
    if (state.encounter && state.encounter.preparationTurns > 1 && encounterDecision !== "FIGHT") {
      state = applyTowerPressure({ ...state, encounter: { ...state.encounter, preparationTurns: state.encounter.preparationTurns - 1 }, lastOutcome: `O confronto se aproxima. Resta ${state.encounter.preparationTurns - 1} janela de preparação para aliados chegarem.` }, Object.keys(submissions).length);
      battleLog.push(state.lastOutcome!);
      vol.exploration = state;
      return;
    }
    const snapshots = await tx.towerRunMascot.findMany({ where: { member: { runId: run.id } }, include: { member: true } });
    const rows = await tx.mascot.findMany({ where: { id: { in: snapshots.map((m) => m.mascotId) } } });
    const snapById = new Map(snapshots.map((m) => [m.mascotId, m]));
    const allies = rows.flatMap((m, index) => {
      const snap = snapById.get(m.id); if (!snap || snap.currentHp <= 0) return [];
      const fighter = toLeagueMascot(m, index + 1, snap.currentStance);
      fighter.hp = snap.currentHp;
      if (snap.member.expeditionRole === "INVESTIGADOR") fighter.instinct = Math.round(fighter.instinct * 1.08);
      if (snap.member.expeditionRole === "NAVEGADOR") fighter.agility = Math.round(fighter.agility * 1.03);
      if (snap.member.expeditionRole === "PROTETOR") fighter.vitality = Math.round(fighter.vitality * 1.06);
      if (snap.member.expeditionRole === "ARTIFICE") fighter.force = Math.round(fighter.force * 1.04);
      if (snap.member.expeditionRole === "RITUALISTA") fighter.charisma = Math.round(fighter.charisma * 1.10);
      if (snap.member.expeditionRole === "BATEDOR") fighter.agility = Math.round(fighter.agility * 1.07);
      return [fighter];
    });
    const avg = Math.max(1, Math.round(allies.reduce((sum, m) => sum + m.level, 0) / Math.max(1, allies.length)));
    const talentRows = await tx.towerCommunityProgress.findMany({ where: { floorId: 1, metricKey: { in: ["TALENT:COMBAT", "TALENT:BOSS"] } } });
    const combatTalent = talentRows.find((row) => row.metricKey === "TALENT:COMBAT")?.value ?? 0;
    const bossTalent = room.kind === "BOSS" ? talentRows.find((row) => row.metricKey === "TALENT:BOSS")?.value ?? 0 : 0;
    const allyTalentMult = 1 + combatTalent * .02 + bossTalent * .03;
    for (const ally of allies) { ally.force = Math.round(ally.force * allyTalentMult); ally.agility = Math.round(ally.agility * allyTalentMult); ally.instinct = Math.round(ally.instinct * allyTalentMult); ally.vitality = Math.round(ally.vitality * allyTalentMult); }
    const pressureMult = state.activeModifiers.reduce((m, mod) => m * mod.enemyMultiplier, 1) * (1 + state.pressure * .03);
    const variance = Math.abs([...`${run.seed}:${room.id}`].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 5 - 1;
    const count = Math.max(1, Math.min(8, allies.length + variance + (room.kind === "BOSS" ? 2 : 0)));
    const bossIds = [25, 448, 197, 94, 778, 52, 196];
    const pool = room.kind === "BOSS" ? [bossIds[Math.min(6, run.currentFloor - 1)], 609, 94, 302] : [92, 198, 200, 353, 607, 215];
    const enemies: LeagueMascot[] = Array.from({ length: count }, (_, index) => {
      const pokemonId = pool[(room.index + index) % pool.length];
      const base = Math.max(12, Math.round((avg * .72 + 18 + room.index * 2) * pressureMult));
      return { id: `tower:${run.id}:${room.id}:${index}`, ownerId: "TORRE", pokemonId, types: getPokemonTypes(pokemonId), name: getPokemonName(pokemonId), level: Math.max(1, avg + room.index * 2), force: base, agility: base, instinct: base, vitality: base, charisma: base, hp: 55 + avg * 6 + base * 4, combatRole: normalizeCombatRole(index % 2 ? "DEFENDER" : "ATTACKER"), slot: index + 1 };
    });
    const captive = await tx.towerLostMascot.findFirst({ where: { recoveredAt: null }, orderBy: { createdAt: "asc" } });
    if (captive && enemies.length < 8) {
      const capturedMascot = await tx.mascot.findUnique({ where: { id: captive.mascotId } });
      if (capturedMascot) {
        const rebel = toLeagueMascot(capturedMascot, enemies.length + 1, "ATTACKER");
        rebel.id = `captive:${capturedMascot.id}`;
        rebel.ownerId = "TORRE";
        rebel.name = `${rebel.name} · sob Psicose`;
        rebel.force = Math.round(rebel.force * pressureMult);
        rebel.agility = Math.round(rebel.agility * pressureMult);
        enemies.push(rebel);
      }
    }
    const result = runLeagueCombat(allies, enemies);
    const hp = finalHp(allies, result.log);
    for (const ally of allies) await tx.towerRunMascot.updateMany({ where: { mascotId: ally.id, member: { runId: run.id } }, data: { currentHp: hp.get(ally.id) ?? 0, state: (hp.get(ally.id) ?? 0) <= 0 ? "DEFEATED" : "IN_TOWER" } });
    const won = result.winner === "A";
    room.cleared = won;
    state = { ...state, graph: [...state.graph], encounter: undefined, lastOutcome: won ? `${room.title} foi vencida.` : "A expedição foi derrotada.", pendingReplay: { winner: result.winner, log: result.log, lineupA: result.lineupA, lineupB: result.lineupB, teamASurvivors: result.teamASurvivors, teamBSurvivors: result.teamBSurvivors, title: room.title } };
    battleLog.push(state.lastOutcome!);
  }
  vol.exploration = applyTowerPressure(state, Object.keys(submissions).length * splitPathPenalty);
}

/** Duração da janela de turno por ritmo. */
export function windowMsFor(pace: string): number {
  return pace === "SLOW" ? 4 * 60 * 60_000 : 120_000;
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

/**
 * Resolve UMA passagem de turno (idempotente, sob lock). Aplica AFK, avança o
 * turno global, rotaciona a ordem, limpa submissões e reabre a janela.
 * A resolução de gameplay (exploração/encounters via o núcleo tático) entra aqui
 * nas próximas fases — este é o esqueleto do loop.
 */
export async function resolveTowerTurnLocked(runId: string): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${runLockKey(runId)})`;
      const run = await tx.towerRun.findUnique({ where: { id: runId }, include: { members: true } });
      if (!run || run.status !== "ACTIVE") return;

      const vol = (run.volatileState ?? {}) as TowerVolatile;
      const submissions = vol.submissions ?? {};
      const active = run.members.filter((m) => !m.afkRemoved);
      const battleLog: string[] = [];

      if (vol.exploration) await resolveRoom(tx, run as never, vol, submissions, battleLog);

      // ── Resolução do encounter (uma rodada do motor tático por Turno Global) ──
      if (!vol.exploration && vol.battle && !vol.battle.encounterOver) {
        // Coleta intenções por mascote e interações com objetos das submissões.
        const intents: Record<string, TowerIntent> = {};
        const interactions: string[] = [];
        const destinations: Record<string, TowerPlannedDestination> = {};
        const targets: Record<string, string> = {};
        for (const m of active) {
          const payload = submissions[m.userId]?.actions as {
            intents?: Record<string, TowerIntent>;
            interactions?: string[];
            destinations?: Record<string, TowerPlannedDestination>;
            targets?: Record<string, string>;
          } | null | undefined;
          if (payload?.intents) for (const [mid, it] of Object.entries(payload.intents)) intents[mid] = it;
          if (Array.isArray(payload?.interactions)) interactions.push(...payload.interactions);
          if (payload?.destinations) Object.assign(destinations, payload.destinations);
          if (payload?.targets) Object.assign(targets, payload.targets);
        }
        const { state, events, objectLog } = resolveEncounterTurn(vol.battle, run.seed, run.globalTurn, { intents, interactions, destinations, targets });
        vol.battle = state;
        vol.lastEvents = events;
        vol.lastResolvedTurn = run.globalTurn;
        battleLog.push(...objectLog);
        for (const e of events) if (e.kind === "KO" || e.kind === "SURVIVE") battleLog.push(e.text);
        if (state.encounterOver) battleLog.push(state.outcome === "WIN" ? "Encounter vencido!" : "Todos os mascotes caíram no encounter.");
        // Survivor: sincroniza o HP dos aliados de volta no snapshot da run.
        for (const u of state.units) {
          if (u.team !== "ALLY") continue;
          await tx.towerRunMascot.updateMany({
            where: { mascotId: u.id, member: { runId } },
            data: { currentHp: u.hp, state: u.hp <= 0 ? "DEFEATED" : "IN_TOWER" },
          });
        }
      }

      // AFK: quem confirmou zera as faltas; quem não confirmou soma; 2 seguidas remove.
      let removedNow = 0;
      for (const m of active) {
        const confirmed = Boolean(submissions[m.userId]);
        if (confirmed) {
          if (m.consecutiveMisses !== 0) {
            await tx.towerRunMember.update({ where: { id: m.id }, data: { consecutiveMisses: 0 } });
          }
        } else {
          const misses = m.consecutiveMisses + 1;
          const remove = misses >= 2;
          if (remove) removedNow++;
          await tx.towerRunMember.update({
            where: { id: m.id },
            data: { consecutiveMisses: misses, afkRemoved: remove, removedAt: remove ? new Date() : null },
          });
          if (remove) {
            const abandoned = await tx.towerRunMascot.findMany({ where: { memberId: m.id } });
            for (const mascot of abandoned) {
              await tx.towerRunMascot.update({ where: { id: mascot.id }, data: { currentHp: 0, state: "LOST_IN_TOWER" } });
              await tx.towerLostMascot.upsert({ where: { mascotId: mascot.mascotId }, create: { mascotId: mascot.mascotId, ownerUserId: mascot.ownerUserId, lostRunId: runId, floor: run.currentFloor }, update: { ownerUserId: mascot.ownerUserId, lostRunId: runId, floor: run.currentFloor, recoveredAt: null, recoveredById: null } });
            }
            battleLog.push(`Um treinador foi removido por AFK; seus ${abandoned.length} mascote(s) ficaram sob controle da Torre.`);
          }
        }
      }

      const stillActive = active.length - removedNow;
      const nextTurn = run.globalTurn + 1;
      const order = Array.isArray(run.resolutionOrder) ? (run.resolutionOrder as string[]) : [];
      const rotated = order.length ? [...order.slice(1), order[0]] : order;
      const explorationRoom = vol.exploration ? currentTowerRoom(vol.exploration) : null;
      const bossVictory = Boolean(explorationRoom?.kind === "BOSS" && explorationRoom.cleared) || Boolean(vol.battle?.isBoss && vol.battle.encounterOver && vol.battle.outcome === "WIN");
      const runFailed = Boolean(vol.exploration?.pendingReplay?.winner === "B" && explorationRoom && !explorationRoom.cleared) || Boolean(vol.battle?.encounterOver && vol.battle.outcome === "LOSS");
      const log = [...(vol.log ?? []), ...battleLog, ...(bossVictory ? ["🏆 Boss do andar derrotado!"] : []), `Turno ${run.globalTurn} resolvido.`].slice(-50);

      if (bossVictory) {
        await tx.towerCommunityProgress.upsert({ where: { floorId_metricKey: { floorId: 1, metricKey: "TALENT_POINTS" } }, create: { floorId: 1, metricKey: "TALENT_POINTS", value: 1 }, update: { value: { increment: 1 } } });
        const shardCount = run.pace === "ONLINE" ? 2 : 1;
        for (const member of active) for (let shard = 0; shard < shardCount; shard++) await tx.towerFeat.create({ data: { userId: member.userId, runId, featKey: "TOWER_RELIC_SHARD", data: { floor: run.currentFloor, pace: run.pace } } });
      }

      if (bossVictory && run.currentFloor < 7) {
        const nextFloor = run.currentFloor + 1;
        const nextExploration = generateTowerRoomGraph(run.seed, nextFloor);
        nextExploration.countermeasures = vol.exploration?.countermeasures ?? [];
        nextExploration.pressureShield = vol.exploration?.pressureShield ?? 0;
        await tx.towerCodexEntry.create({ data: { userId: null, subjectType: "LEADER", subjectKey: `floor-${run.currentFloor}`, discoveryLevel: 1, data: { defeatedAt: new Date().toISOString(), runId } } }).catch(() => null);
        await tx.towerRun.update({ where: { id: runId }, data: { currentFloor: nextFloor, globalTurn: nextTurn, resolutionOrder: rotated, nextDeadline: new Date(Date.now() + windowMsFor(run.pace)), volatileState: { ...vol, exploration: nextExploration, submissions: {}, log: [...log, `As escadas abriram. O grupo alcançou o ${nextFloor}º andar.`] } as unknown as Prisma.InputJsonValue } });
        return;
      }

      if (runFailed) {
        const defeated = await tx.towerRunMascot.findMany({ where: { member: { runId }, currentHp: { lte: 0 } } });
        for (const mascot of defeated) {
          await tx.towerLostMascot.upsert({ where: { mascotId: mascot.mascotId }, create: { mascotId: mascot.mascotId, ownerUserId: mascot.ownerUserId, lostRunId: runId, floor: run.currentFloor }, update: { ownerUserId: mascot.ownerUserId, lostRunId: runId, floor: run.currentFloor, recoveredAt: null, recoveredById: null } });
          await tx.towerRunMascot.update({ where: { id: mascot.id }, data: { state: "LOST_IN_TOWER" } });
        }
      }

      if (stillActive <= 0 || bossVictory || runFailed) {
        await tx.towerRun.update({
          where: { id: runId },
          data: { status: runFailed ? "FAILED" : "FINISHED", endedAt: new Date(), volatileState: { ...vol, submissions: {}, log } as unknown as Prisma.InputJsonValue },
        });
        return;
      }

      await tx.towerRun.update({
        where: { id: runId },
        data: {
          globalTurn: nextTurn,
          resolutionOrder: rotated,
          nextDeadline: new Date(Date.now() + windowMsFor(run.pace)),
          volatileState: { ...vol, submissions: {}, log } as unknown as Prisma.InputJsonValue,
        },
      });
    },
    { timeout: 15000 },
  );
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
