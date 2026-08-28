// Torre dos Rebeldes — núcleo do turn engine (janela global; Online 5min / Lento
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
import { TOWER_EXCLUSIVE_MASCOTS, towerRewardForFloor, XANDINHO } from "./exclusive-mascots";
import { resolveTowerTalents } from "./talents";

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
  const choices = Object.values(submissions).map((s) => (s.actions ?? {}) as { routeId?: string; puzzleChoice?: string; action?: string; _roomId?: string }).filter((choice) => !choice._roomId || choice._roomId === room.id);
  const distinctRoutes = new Set(choices.map((choice) => choice.routeId).filter(Boolean));
  // Efeitos dos 15 talentos novos (status/pressão/movimento) — resolvidos uma vez.
  const talentRowsAll = await tx.towerCommunityProgress.findMany({ where: { floorId: 1, metricKey: { startsWith: "TALENT:" } } });
  const talentValue = (key: string) => talentRowsAll.find((row) => row.metricKey === `TALENT:${key}`)?.value ?? 0;
  const talentFx = resolveTowerTalents(talentValue);
  const splitPathPenalty = distinctRoutes.size > 1 ? talentFx.splitPenalty : 1;
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
      if (destination.kind === "BOSS" && preview[0]) preview[0].pokemonId = towerRewardForFloor(run.currentFloor).pokemonId;
      if ((destination.kind === "COMBAT" || destination.kind === "BOSS") && preview.length < 8) {
        const captive = await tx.towerLostMascot.findFirst({ where: { recoveredAt: null }, orderBy: { createdAt: "asc" } });
        const captiveMascot = captive ? await tx.mascot.findUnique({ where: { id: captive.mascotId }, select: { pokemonId: true, nickname: true, level: true } }) : null;
        if (captiveMascot) preview.push({ pokemonId: captiveMascot.pokemonId, level: captiveMascot.level, name: `${captiveMascot.nickname ?? getPokemonName(captiveMascot.pokemonId)} · sob Psicose` });
      }
      const encounter = destination.kind === "COMBAT" || destination.kind === "BOSS" ? { roomId: destination.id, preparationTurns: destination.kind === "BOSS" ? 2 : 1, enemies: preview.map((enemy) => ({ ...enemy, name: TOWER_EXCLUSIVE_MASCOTS.find((entry) => entry.pokemonId === enemy.pokemonId)?.name ?? enemy.name ?? getPokemonName(enemy.pokemonId) })) } : undefined;
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
    const failurePressure = state.countermeasures?.includes("ROLE:ARTIFICE") ? 1 : 2;
    state = applyTowerPressure({ ...state, graph: [...state.graph], lastOutcome: success ? "O mecanismo cedeu. O grupo registrou uma nova descoberta." : `Resposta errada. A passagem abriu, mas a Torre despertou${failurePressure===1?"; o Artífice conteve parte da reação":""}.` }, success ? 0 : failurePressure);
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
    const rescuedMascots = prisoners.length ? await tx.mascot.findMany({
      where: { id: { in: prisoners.map((prisoner) => prisoner.mascotId) } },
      select: { id: true, nickname: true, pokemonId: true, player: { select: { displayName: true } } },
    }) : [];
    const rescuedById = new Map(rescuedMascots.map((mascot) => [mascot.id, `${mascot.nickname ?? getPokemonName(mascot.pokemonId)} · dono: ${mascot.player.displayName}`]));
    for (const prisoner of prisoners) await tx.towerLostMascot.update({ where: { id: prisoner.id }, data: { recoveredAt: new Date(), recoveredById: run.members[0]?.userId ?? null } });
    room.cleared = true;
    const rescuedNames = prisoners.map((prisoner) => rescuedById.get(prisoner.mascotId) ?? `Mascote #${prisoner.mascotId}`).join("; ");
    state = { ...state, graph: [...state.graph], lastOutcome: prisoners.length ? `A Sala Anti-Psicose libertou ${prisoners.length} mascote(s) de outras runs e os devolveu aos donos: ${rescuedNames}.` : "A Sala Anti-Psicose foi ativada, mas as jaulas estavam vazias. Nenhum mascote precisava de resgate." };
    battleLog.push(state.lastOutcome!);
  } else if (room.kind === "REST") {
    const decision = majority(choices.map((choice) => choice.action));
    const runMascots = await tx.towerRunMascot.findMany({ where: { member: { runId: run.id }, state: "IN_TOWER" } });
    const healMult = state.activeModifiers.reduce((m, mod) => m * mod.healingMultiplier, 1);
    const ritualHeal = state.countermeasures?.includes("ROLE:RITUALISTA") ? 1.1 : 1;
    if (decision === "INTERACT") for (const mascot of runMascots) await tx.towerRunMascot.update({ where: { id: mascot.id }, data: { currentHp: Math.min(mascot.maxHp, mascot.currentHp + Math.round(mascot.maxHp * .2 * healMult * ritualHeal)) } });
    room.cleared = true;
    state = decision === "INTERACT"
      ? applyTowerPressure({ ...state, graph: [...state.graph], lastOutcome: "O grupo decidiu usar a chama, recuperou parte do HP e aceitou que a Torre avançasse seu relógio." })
      : { ...state, graph: [...state.graph], lastOutcome: "O grupo ignorou a chama e seguiu sem recuperar HP." };
    battleLog.push(state.lastOutcome!);
  } else if (room.kind === "COMBAT" || room.kind === "BOSS") {
    const encounterDecision = majority(choices.map((choice) => choice.action));
    if (encounterDecision === "WAIT") {
      const navigatorDiscount = state.countermeasures?.includes("ROLE:NAVEGADOR") && !state.countermeasures.includes("ROLE:NAVEGADOR:USED") ? 1 : 0;
      state = applyTowerPressure({ ...state, countermeasures: navigatorDiscount ? [...(state.countermeasures??[]),"ROLE:NAVEGADOR:USED"] : state.countermeasures, encounter: state.encounter ? { ...state.encounter, preparationTurns: state.encounter.preparationTurns + 1 } : state.encounter, lastOutcome: navigatorDiscount ? "O Navegador encontrou um abrigo: a primeira espera custou 1 Pressão a menos." : "O grupo decidiu esperar reforços. A Torre ganhou +1 de Pressão adicional e fortaleceu seus defensores." }, Object.keys(submissions).length + 1 - navigatorDiscount);
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
    // Talentos originais COMBAT/BOSS (efeito antigo) + novos talentos por atributo.
    const combatTalent = talentValue("COMBAT");
    const bossTalent = room.kind === "BOSS" ? talentValue("BOSS") : 0;
    const allyTalentMult = 1 + combatTalent * .02 + bossTalent * .03;
    const bossFx = room.kind === "BOSS" ? talentFx.bossMult : 1;
    for (const ally of allies) {
      ally.force = Math.round(ally.force * allyTalentMult * talentFx.forceMult * bossFx);
      ally.agility = Math.round(ally.agility * allyTalentMult * talentFx.agilityMult * bossFx);
      ally.instinct = Math.round(ally.instinct * allyTalentMult * talentFx.instinctMult * bossFx);
      ally.vitality = Math.round(ally.vitality * allyTalentMult * talentFx.vitalityMult * bossFx);
    }
    const pressureMult = state.activeModifiers.reduce((m, mod) => m * mod.enemyMultiplier, 1) * (1 + state.pressure * talentFx.enemyPressureScale);
    // A composição é congelada ao entrar na sala. Esperar pode fortalecer os
    // inimigos pela Pressão, mas nunca inserir espécies que não apareceram no preview.
    const frozenPreview = state.encounter?.enemies ?? towerEncounterPreview(room, avg, allies.length);
    const enemies: LeagueMascot[] = frozenPreview.map((previewEnemy, index) => {
      const pokemonId = previewEnemy.pokemonId;
      const base = Math.max(12, Math.round((avg * .72 + 18 + room.index * 2) * pressureMult));
      const level = Math.max(1, previewEnemy.level);
      const exclusive = TOWER_EXCLUSIVE_MASCOTS.find((entry) => entry.pokemonId === pokemonId);
      return { id: `tower:${run.id}:${room.id}:${index}`, ownerId: "TORRE", pokemonId, types: exclusive ? [exclusive.primaryType, "secondaryType" in exclusive ? exclusive.secondaryType : null].filter(Boolean) as string[] : getPokemonTypes(pokemonId), name: previewEnemy.name || exclusive?.name || getPokemonName(pokemonId), level, force: base, agility: base, instinct: base, vitality: base, charisma: base, hp: 55 + level * 6 + base * 4, combatRole: normalizeCombatRole(index % 2 ? "DEFENDER" : "ATTACKER"), slot: index + 1 };
    });
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
      const run = await tx.towerRun.findUnique({ where: { id: runId }, include: { members: { include: { mascots: true } } } });
      if (!run || run.status !== "ACTIVE") return;

      const vol = (run.volatileState ?? {}) as TowerVolatile;
      const submissions = vol.submissions ?? {};
      const active = run.members.filter((m) => !m.afkRemoved && m.mascots.some((mascot) => mascot.currentHp > 0 && mascot.state === "IN_TOWER"));
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
        for (const member of run.members.filter((entry) => !entry.afkRemoved)) await tx.towerFeat.create({ data: { userId: member.userId, runId, featKey: "TOWER_TALENT_CONTRIBUTION", data: { floor: run.currentFloor, source: "BOSS", spectator: !active.some((entry) => entry.userId === member.userId) } } });
        const reward = towerRewardForFloor(run.currentFloor);
        for (const member of run.members) {
          const prior = await tx.towerFeat.findFirst({ where: { userId: member.userId, featKey: { in: ["TOWER_MASCOT_PENDING", "TOWER_MASCOT_CLAIMED"] }, data: { path: ["pokemonId"], equals: reward.pokemonId } } });
          if (!prior) await tx.towerFeat.create({ data: { userId: member.userId, runId, featKey: "TOWER_MASCOT_PENDING", data: { pokemonId: reward.pokemonId, basePokemonId: reward.basePokemonId, name: reward.name, floor: run.currentFloor } } });
        }
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
        for (const member of run.members) {
          const prior = await tx.towerFeat.findFirst({ where: { userId: member.userId, featKey: { in: ["TOWER_MASCOT_PENDING", "TOWER_MASCOT_CLAIMED"] }, data: { path: ["pokemonId"], equals: XANDINHO.pokemonId } } });
          if (!prior) await tx.towerFeat.create({ data: { userId: member.userId, runId, featKey: "TOWER_MASCOT_PENDING", data: { pokemonId: XANDINHO.pokemonId, basePokemonId: XANDINHO.basePokemonId, name: XANDINHO.name, reason: "FIRST_RUN_LOSS" } } });
        }
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
