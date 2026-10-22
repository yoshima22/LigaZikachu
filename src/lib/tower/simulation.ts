/** Offline, seeded Tower model. Never call this from a request handler: the league
 * combat engine still consumes Math.random, which we scope to each synchronous fight. */
import { getPokemonTypes } from "@/lib/mascot-data";
import { type LeagueMascot } from "@/lib/league-combat";
import { resolveTowerBattle, selectTowerBattleWaves, towerEncounterLevel } from "./battle-waves";
import { towerAddCaptive, towerBalanceFor, towerBossDefenderCount, towerEnemyBaseStat, type TowerBalance } from "./balance-rules";
import { newExpeditionState, type TowerExpeditionV2 } from "./expedition-state";
import { resolveTowerClassEffects } from "./config";
import { TOWER_BOSS_PRIZES, TOWER_EXCLUSIVE_MASCOTS } from "./exclusive-catalog";
import { applyPressureToExpedition, bossOverloadValue, consumeBossOverloadCharge, earnBossOverloadCharge, overloadFromResults, pressureDelta, transitionFloor, updateOverload } from "./pressure-rules";
import { canUseRecoveryRoom, recoverSoloMascots, reviveMember } from "./recovery-rules";
import { switchSoloFormation } from "./formation";
import { recordFloorDrop, secureFloorDrops, discardPendingFloorDrops } from "./reward-ledger";
import { planRewardSettlement } from "./reward-ledger";
import { freezeRoomEncounter, groupActiveMembersByRoom, resolveRoomFront } from "./room-resolver";
import { generateTowerRoomGraph, towerEncounterPreview, type TowerRoomNode } from "./rooms";
import { moveMember, shortestKnownPath, towerCanLeaveRoom } from "./route-rules";
import { resolveTowerTalents } from "./talents";

export type BuildTier = "ZERO" | "INTERMEDIATE" | "PREPARED";
export type TowerSimulationScenario = {
  speciesIds?: readonly number[];
  statOffset?: number;
  roles?: readonly string[];
};
export type TowerSimulationReport = {
  seed: string; partySize: 1 | 2 | 3; partyProfile: "SOLO" | "GROUP"; balanceVersion: 2; buildTier: BuildTier; pace: "ONLINE" | "SLOW";
  routePolicy: "UNITED" | "SPLIT" | "STRATEGIC_SPLIT"; outcome: "WIN" | "LOSS" | "TURN_LIMIT";
  floorReached: number; bossesDefeated: number; turns: number; pressurePeak: number;
  preBossPressure: number[]; afkRate: number; missedWindows: number; afkAbandoned: number;
  bossDefenderCounts: number[];
  bossCaptiveCounts: number[];
  bossArrivalTurns: number[]; bossFightTurns: number[];
  bossWaitTurns: number[];
  bossOverloadEarnedTurns: number[];
  bossOverloadConsumedTurns: number[];
  hpRemaining: number; hpMaximum: number; downedCount: number; recoveries: number;
  recoveryTimings: { memberId: string; downedTurn: number; recoveredTurn: number }[];
  securedRewards: number; lostRewards: number; duplicateRewardIds: number; relicShards: number;
  dropsByPlayer: Record<string, number>; relicShardsByPlayer: Record<string, number>;
  unresolvedRooms: string[]; memberPositions: Record<string, string>;
};

type SimMascot = { id: string; ownerId: string; pokemonId: number; level: number; stat: number; maxHp: number; hp: number; combatRole: LeagueMascot["combatRole"]; formationSlot: number };
const TIERS = {
  ZERO: { level: 70, stat: 220, ranks: {} as Record<string, number> },
  INTERMEDIATE: { level: 70, stat: 225, ranks: { COMBAT: 2, PRESSURE: 2, VIGOR: 2, BULWARK: 2, COMPOSURE: 2, PATHFINDER: 2 } as Record<string, number> },
  PREPARED: { level: 70, stat: 240, ranks: { COMBAT: 4, PRESSURE: 4, BOSS: 3, VIGOR: 4, FORCE: 3, VITALITY: 3, BULWARK: 4, COMPOSURE: 4, PATHFINDER: 4 } as Record<string, number> },
} as const;
const ROLES = ["ARTIFICE", "RITUALISTA", "PROTETOR"] as const;
const STANCES = [["ATTACKER", "SPECIALIST"], ["HEALER", "SURVIVOR"], ["DEFENDER", "GUARDIAN"]] as const;
const SOLO_STANCES = ["ATTACKER", "SPECIALIST", "DEFENDER", "HEALER"] as const;
const BOSS_POKEMON_IDS = [210006, 210005, 210003, 210004, 210002, 210007, 210001];

function seedNumber(value: string) {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function seededRandom(seed: string) {
  let state = seedNumber(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function simulatedAllyStat(base: number, classMult: number, talentMult: number): number {
  return Math.round(Math.round(base * classMult) * talentMult);
}

function nextRoom(room: TowerRoomNode, memberIndex: number, floor: number, policy: "UNITED" | "SPLIT") {
  if (!room.connections.length) return null;
  return room.connections[policy === "UNITED" ? 0 : (memberIndex + floor) % room.connections.length];
}

function shortestForwardPath(state: TowerExpeditionV2, from: string, to: string): string[] | null {
  const queue: string[][] = [[from]];
  const visited = new Set([from]);
  while (queue.length) {
    const path = queue.shift()!;
    const roomId = path[path.length - 1];
    if (roomId === to) return path;
    const room = state.graph.find((entry) => entry.id === roomId);
    for (const next of room?.connections ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push([...path, next]);
    }
  }
  return null;
}

/** Planejamento idealizado offline: convergir pela menor rota adiante já desenhada no mapa. */
export function strategicReunionPaths(state: TowerExpeditionV2): Record<string, string[]> {
  const active = Object.entries(state.members).filter(([, member]) => member.status === "ACTIVE");
  if (active.length < 2 || new Set(active.map(([, member]) => member.roomId)).size < 2) return {};
  const options = state.graph.flatMap((room) => {
    const paths = active.map(([id, member]) => [id, shortestForwardPath(state, member.roomId, room.id)] as const);
    if (paths.some(([, path]) => !path)) return [];
    const valid = paths as [string, string[]][];
    return [{ roomId: room.id, paths: Object.fromEntries(valid),
      max: Math.max(...valid.map(([, path]) => path.length)),
      sum: valid.reduce((total, [, path]) => total + path.length, 0) }];
  }).sort((left, right) => left.max - right.max || left.sum - right.sum || left.roomId.localeCompare(right.roomId));
  return options[0]?.paths ?? {};
}

/** A solo trainer can only backtrack to an already reached, off-cooldown infirmary. */
export function soloRecoveryRetreatPath(state: TowerExpeditionV2, fromRoomId: string, floor: number): string[] | null {
  if (!towerCanLeaveRoom(state, fromRoomId) || !canUseRecoveryRoom(floor, state.lastRecoveryFloor)) return null;
  const paths = state.graph
    .filter((room) => room.kind === "RECOVERY" && state.visited.includes(room.id))
    .map((room) => shortestKnownPath(state, fromRoomId, room.id))
    .filter((path): path is string[] => path !== null);
  return paths.sort((left, right) => left.length - right.length)[0] ?? null;
}

export function simulateTower(
  seed: string, partySize: 1 | 2 | 3, buildTier: BuildTier,
  pace: "ONLINE" | "SLOW", routePolicy: "UNITED" | "SPLIT" | "STRATEGIC_SPLIT", afkRate = 0,
  balance?: Readonly<TowerBalance>,
  firstBossCaptive = false,
  scenario: TowerSimulationScenario = {},
): TowerSimulationReport {
  if (!seed || ![1, 2, 3].includes(partySize) || !Number.isFinite(afkRate) || afkRate < 0 || afkRate > 1)
    throw new Error("Parâmetros da simulação inválidos.");
  const tier = TIERS[buildTier];
  const stat = Math.max(1, tier.stat + (scenario.statOffset ?? 0));
  const effectiveBalance = balance ?? towerBalanceFor(partySize === 1 ? "SOLO" : "GROUP", 2);
  const memberIds = Array.from({ length: partySize }, (_, index) => `treinador-${index + 1}`);
  const roleByMember = memberIds.map((_, index) => scenario.roles?.[index] ?? ROLES[index]);
  let state = newExpeditionState(generateTowerRoomGraph(seed), memberIds);
  const random = seededRandom(`${seed}:${partySize}:${buildTier}`);
  const afkRandom = seededRandom(`afk:${seed}:${partySize}:${buildTier}:${afkRate}`);
  const talentValue = (key: string) => tier.ranks[key] ?? 0;
  const talentFx = resolveTowerTalents(talentValue);
  state.pressureShield = talentFx.pressureShieldStart;
  const mascots: SimMascot[] = memberIds.flatMap((ownerId, index) =>
    Array.from({ length: partySize === 1 ? 4 : 2 }, (_, slot) => {
    const maxHp = 55 + tier.level * 6 + stat * 4;
    return { id: `${ownerId}-${slot}`, ownerId, pokemonId: scenario.speciesIds?.[index * 2 + slot] ?? [448, 196, 25, 94, 197, 609][index * 2 + slot],
      level: tier.level, stat, maxHp, hp: maxHp,
      formationSlot: slot + 1,
      combatRole: (partySize === 1 ? SOLO_STANCES[slot] : STANCES[index][slot]) as LeagueMascot["combatRole"] };
  }));
  let floor = 1, turns = 0, pressurePeak = 0, downedCount = 0, recoveries = 0, bossesDefeated = 0;
  let outcome: TowerSimulationReport["outcome"] = "TURN_LIMIT";
  const downedEver = new Set<string>();
  const downedAt = new Map<string, number>();
  const recoveryTimings: TowerSimulationReport["recoveryTimings"] = [];
  const preBossPressure: number[] = [];
  const bossOverloadEarnedTurns: number[] = [];
  const bossOverloadConsumedTurns: number[] = [];
  const bossDefenderCounts: number[] = [];
  const bossCaptiveCounts: number[] = [];
  const bossArrivalTurns: number[] = [];
  const bossFightTurns: number[] = [];
  const bossWaitTurns: number[] = [];
  let missedWindows = 0, afkAbandoned = 0;
  const relicShardsByPlayer = Object.fromEntries(memberIds.map((id) => [id, 0]));
  let regroupTarget: string | null = null;
  let soloRecoveryTarget: string | null = null;
  let soloReturnTarget: string | null = null;

  while (turns < 1200) {
    if (!Object.values(state.members).some((member) => member.status === "ACTIVE")) { outcome = "LOSS"; break; }
    turns++;
    state = { ...state, globalTurn: turns };
    const missingThisTurn = new Set<string>();
    if (afkRate > 0) for (const memberId of memberIds) {
      const member = state.members[memberId];
      if (member.status !== "ACTIVE" || member.availableFromTurn > turns) continue;
      if (afkRandom() >= afkRate) {
        if (member.consecutiveMisses) state = { ...state, members: { ...state.members, [memberId]: { ...member, consecutiveMisses: 0 } } };
        continue;
      }
      missingThisTurn.add(memberId);
      missedWindows++;
      const misses = member.consecutiveMisses + 1;
      const abandoned = misses >= 2;
      if (abandoned) afkAbandoned++;
      state = { ...state, members: { ...state.members, [memberId]: {
        ...member, consecutiveMisses: misses, status: abandoned ? "AFK_ABANDONED" : "ACTIVE",
      } } };
    }
    if (!Object.values(state.members).some((member) => member.status === "ACTIVE")) { outcome = "LOSS"; break; }
    // Live V2 resolves submitted recovery before room combat. A fallen ally
    // cannot be revived by a room they only reached during the same fight.
    const recoveryActor = memberIds.find((id) => state.members[id].status === "ACTIVE" &&
      state.members[id].availableFromTurn <= turns && !missingThisTurn.has(id) &&
      state.graph.find((room) => room.id === state.members[id].roomId)?.kind === "RECOVERY");
    const downed = memberIds.find((id) => state.members[id].status === "DOWNED");
    let recoveryActorUsed: string | null = null;
    const soloNeedsRecovery = partySize === 1 && recoveryActor &&
      mascots.some((mascot) => mascot.ownerId === recoveryActor && mascot.hp <= 0) &&
      mascots.some((mascot) => mascot.ownerId === recoveryActor && mascot.hp > 0);
    if (recoveryActor && (downed || soloNeedsRecovery) && canUseRecoveryRoom(floor, state.lastRecoveryFloor)) {
      const vitals = mascots.map((mascot) => ({ mascotId: mascot.id, ownerUserId: mascot.ownerId, currentHp: mascot.hp, maxHp: mascot.maxHp }));
      const result = partySize === 1
        ? recoverSoloMascots(state, recoveryActor, "ROOM", floor, vitals)
        : reviveMember(state, downed!, { kind: "ROOM", actorId: recoveryActor }, floor, vitals);
      state = result.state;
      for (const [id, hp] of Object.entries(result.hpByMascotId)) mascots.find((mascot) => mascot.id === id)!.hp = hp;
      if (downed) {
        recoveryTimings.push({ memberId: downed, downedTurn: downedAt.get(downed) ?? turns - 1, recoveredTurn: turns });
        downedAt.delete(downed);
      }
      recoveryActorUsed = recoveryActor;
      recoveries++;
      if (partySize === 1 && soloRecoveryTarget === state.members[recoveryActor].roomId) {
        soloRecoveryTarget = null;
      }
    }
    // O modelo não concede itens de recuperação. Se a enfermaria já estiver
    // acessível a partir do chefe, a formação solo pode voltar e tentar de novo.
    if (partySize === 1 && mascots.filter((mascot) => mascot.hp > 0).length < 2) {
      const occupied = state.members[memberIds[0]].roomId;
      const kind = state.graph.find((room) => room.id === occupied)?.kind;
      if (!state.rooms[occupied]?.cleared && (kind === "COMBAT" || kind === "BOSS")) {
        const retreat = soloRecoveryRetreatPath(state, occupied, floor);
        if (retreat && retreat.length >= 2) {
          soloRecoveryTarget = retreat.at(-1)!;
          soloReturnTarget = occupied;
        }
      }
    }
    if (partySize === 1) {
      const ordered = [...mascots].sort((left, right) => left.formationSlot - right.formationSlot);
      const living = ordered.filter((mascot) => mascot.hp > 0);
      const requiredActive = Math.min(2, living.length);
      if (requiredActive > 0 && ordered.slice(0, requiredActive).filter((mascot) => mascot.hp > 0).length < requiredActive) {
        const selection = [...living, ...ordered.filter((mascot) => mascot.hp <= 0)].map((mascot) => mascot.id);
        for (const slot of switchSoloFormation(ordered.map((mascot) => ({ mascotId: mascot.id, currentHp: mascot.hp, formationSlot: mascot.formationSlot })), selection))
          mascots.find((mascot) => mascot.id === slot.mascotId)!.formationSlot = slot.formationSlot;
      }
    }
    if (regroupTarget && state.rooms[regroupTarget]?.cleared) regroupTarget = null;
    if (!regroupTarget && Object.values(state.members).some((member) => member.status === "ACTIVE" && state.graph.find((room) => room.id === member.roomId)?.kind === "BOSS"))
      regroupTarget = Object.entries(state.rooms).find(([roomId, saved]) => roomId !== "boss" && !saved.cleared && saved.encounter)?.[0] ?? null;
    const strategicPaths = routePolicy === "STRATEGIC_SPLIT" && state.bossOverloadAwarded
      ? strategicReunionPaths(state) : {};
    const movedThisTurn = new Set<string>();
    for (const [index, memberId] of memberIds.entries()) {
      const member = state.members[memberId];
      if (member.status !== "ACTIVE" || member.availableFromTurn > turns || memberId === recoveryActorUsed || missingThisTurn.has(memberId) || !towerCanLeaveRoom(state, member.roomId)) continue;
      const room = state.graph.find((entry) => entry.id === member.roomId)!;
      if (member.roomId === soloReturnTarget) soloReturnTarget = null;
      const returnPath = regroupTarget && room.id !== regroupTarget ? shortestKnownPath(state, room.id, regroupTarget) : null;
      const soloPath = soloRecoveryTarget
        ? shortestKnownPath(state, room.id, soloRecoveryTarget)
        : soloReturnTarget ? shortestKnownPath(state, room.id, soloReturnTarget) : null;
      const route = routePolicy === "STRATEGIC_SPLIT"
        ? state.bossOverloadAwarded ? "UNITED" : "SPLIT"
        : routePolicy;
      const destination = soloPath?.[1] ?? returnPath?.[1] ?? strategicPaths[memberId]?.[1] ?? nextRoom(room, index, floor, route);
      if (destination) {
        state = moveMember(state, memberId, destination);
        movedThisTurn.add(memberId);
      }
    }
    const activeFrontCount = groupActiveMembersByRoom(state).size;
    const fronts = [];
    let waits = 0;
    for (const [roomId, memberGroup] of groupActiveMembersByRoom(state)) {
      const room = state.graph.find((entry) => entry.id === roomId)!;
      if (room.kind === "BOSS" && bossArrivalTurns[floor - 1] === undefined)
        bossArrivalTurns[floor - 1] = turns;
      const bossMissingAlly = room.kind === "BOSS" && memberIds.some((id) => state.members[id].status === "ACTIVE" && state.members[id].roomId !== roomId);
      if (state.rooms[roomId].cleared) continue;
      if ((room.kind === "COMBAT" || room.kind === "BOSS") && !state.rooms[roomId].encounter) {
        const frontline = mascots.filter((mascot) => memberGroup.includes(mascot.ownerId) && mascot.hp > 0 &&
          (partySize !== 1 || mascot.formationSlot <= 2));
        const local = frontline.length ? frontline : mascots.filter((mascot) => memberGroup.includes(mascot.ownerId) && mascot.hp > 0);
        const averageLevel = Math.round(local.reduce((sum, mascot) => sum + mascot.level, 0) / Math.max(1, local.length));
        const activeAllyCount = room.kind === "BOSS"
          ? mascots.filter((mascot) => state.members[mascot.ownerId]?.status === "ACTIVE" && mascot.hp > 0 &&
            (partySize !== 1 || mascot.formationSlot <= 2)).length
          : local.length;
        const allyCount = activeAllyCount || (partySize === 1
          ? mascots.filter((mascot) => state.members[mascot.ownerId]?.status === "ACTIVE" && mascot.hp > 0).length
          : 0);
        let preview = towerEncounterPreview(room, averageLevel, allyCount);
        if (room.kind === "BOSS") {
          preview.length = towerBossDefenderCount(allyCount, floor, effectiveBalance);
          if (floor === 1 && firstBossCaptive) preview = towerAddCaptive(preview,
            { pokemonId: 448, name: "Cativo sintético", level: averageLevel }, "BOSS", floor, allyCount, effectiveBalance);
          bossDefenderCounts.push(preview.length);
          bossCaptiveCounts.push(floor === 1 && firstBossCaptive ? 1 : 0);
        }
        if (room.kind === "BOSS" && preview[0]) preview[0].pokemonId = BOSS_POKEMON_IDS[floor - 1];
        state = freezeRoomEncounter(state, roomId, preview, room.kind === "BOSS" ? 2 : 1);
      }
      const actions = memberGroup.filter((memberId) => !missingThisTurn.has(memberId) && !movedThisTurn.has(memberId))
        .map((memberId) => ({ memberId, action: bossMissingAlly ? "WAIT" : room.kind === "COMBAT" || room.kind === "BOSS" ? "FIGHT" : "INTERACT", puzzleChoice: room.puzzle?.answer }));
      if (actions.some((entry) => entry.action === "WAIT")) { waits++; bossWaitTurns.push(turns); }
      if (room.kind === "BOSS" && actions.length && memberIds.every((id) => state.members[id].status !== "ACTIVE" || state.members[id].roomId === roomId))
        preBossPressure.push(state.pressure);
      let bossFightStarted = false;
      const result = resolveRoomFront(state, roomId, actions, ({ room: combatRoom, memberIds: presentIds }) => {
        if (combatRoom.kind === "BOSS" && bossFightTurns[floor - 1] === undefined) bossFightTurns[floor - 1] = turns;
        const locals = mascots.filter((mascot) => presentIds.includes(mascot.ownerId) && (partySize === 1 || mascot.hp > 0));
        const allies: LeagueMascot[] = locals.map((mascot, index) => {
          const role = roleByMember[memberIds.indexOf(mascot.ownerId)];
          const classFx = resolveTowerClassEffects(role, { kind: "COMBAT" });
          const bossMult = combatRoom.kind === "BOSS" ? talentFx.bossMult : 1;
          const combatMult = 1 + talentValue("COMBAT") * 0.02 + (combatRoom.kind === "BOSS" ? talentValue("BOSS") * 0.03 : 0);
          const value = (mult: number, talent: number) => simulatedAllyStat(mascot.stat, mult, talent * combatMult * bossMult);
          return { id: mascot.id, ownerId: mascot.ownerId, pokemonId: mascot.pokemonId,
            types: getPokemonTypes(mascot.pokemonId), name: mascot.id, level: mascot.level,
            force: value(classFx.forceMult, talentFx.forceMult), agility: value(classFx.agilityMult, talentFx.agilityMult),
            instinct: value(classFx.instinctMult, talentFx.instinctMult), vitality: value(classFx.vitalityMult, talentFx.vitalityMult),
            charisma: value(classFx.charismaMult, talentFx.charismaMult), hp: mascot.hp,
            combatRole: missingThisTurn.has(mascot.ownerId) ? "DEFENDER" : mascot.combatRole, slot: index + 1 };
        });
        const fightingAllies = allies.filter((ally) => ally.hp > 0);
        if (!fightingAllies.length) return { won: false, hpByMascotId: {}, events: ["Nenhum mascote apto."], kos: [] };
        const slotByMascotId = new Map(locals.map((mascot) => [mascot.id, mascot.formationSlot]));
        const { active, reserves } = selectTowerBattleWaves(
          partySize === 1 ? "SOLO" : "GROUP", 2,
          allies.map((fighter) => ({ fighter, formationSlot: slotByMascotId.get(fighter.id) ?? null })),
        );
        if (!active.some((mascot) => mascot.hp > 0)) return { won: false, hpByMascotId: {}, events: ["Ativos indisponíveis."], kos: [] };
        if (combatRoom.kind === "BOSS") bossFightStarted = true;
        const averageLevel = towerEncounterLevel(active);
        const temporaryOverload = state.overload && state.overload.expiresAfterTurn >= turns ? state.overload.value : 0;
        const bankedOverload = combatRoom.kind === "BOSS" && partySize > 1 ? bossOverloadValue(state) : 0;
        const pressureMult = state.activeModifiers.reduce((product, modifier) => product * modifier.enemyMultiplier, 1) *
          (1 + state.pressure * talentFx.enemyPressureScale) *
          (1 - Math.max(temporaryOverload, bankedOverload));
        const enemies: LeagueMascot[] = (state.rooms[roomId].encounter?.enemies ?? []).map((enemy, index) => {
          const base = towerEnemyBaseStat(averageLevel, combatRoom.index, pressureMult, floor, effectiveBalance, partySize);
          const exclusive = TOWER_EXCLUSIVE_MASCOTS.find((entry) => entry.pokemonId === enemy.pokemonId);
          return { id: `enemy-${roomId}-${index}`, ownerId: "TORRE", pokemonId: enemy.pokemonId,
            types: exclusive ? [exclusive.primaryType, "secondaryType" in exclusive ? exclusive.secondaryType : null].filter(Boolean) as string[] : getPokemonTypes(enemy.pokemonId),
            name: enemy.name || exclusive?.name || "Defensor", level: enemy.level,
            force: base, agility: base, instinct: base, vitality: base, charisma: base,
            hp: 55 + enemy.level * 6 + base * 4, combatRole: index % 2 ? "DEFENDER" : "ATTACKER", slot: index + 1 };
        });
        const battle = resolveTowerBattle({
          active,
          reserves,
          enemies,
          random,
          requireEnemyKnockout: true,
        });
        return { won: battle.battle.winner === "A", hpByMascotId: battle.hpByMascotId,
          events: [], kos: enemies.filter((enemy) => (battle.enemyHpById[enemy.id] ?? 0) <= 0).map((enemy) => enemy.id) };
      });
      state = result.state;
      if (bossFightStarted && bossOverloadValue(state) > 0) {
        bossOverloadConsumedTurns.push(turns);
        state = consumeBossOverloadCharge(state);
      }
      fronts.push(result);
      for (const [id, hp] of Object.entries(result.hpByMascotId)) mascots.find((mascot) => mascot.id === id)!.hp = hp;
      if (result.interaction === "REST") {
        const ritual = result.participantIds.some((id) => resolveTowerClassEffects(roleByMember[memberIds.indexOf(id)], { kind: "REST" }).healingMult > 1) ? 1.1 : 1;
        for (const mascot of mascots.filter((entry) => result.participantIds.includes(entry.ownerId) && entry.hp > 0 &&
          (partySize !== 1 || entry.formationSlot <= 2)))
          mascot.hp = Math.min(mascot.maxHp, mascot.hp + Math.round(mascot.maxHp * 0.2 * ritual * state.activeModifiers.reduce((product, modifier) => product * modifier.healingMultiplier, 1)));
      }
      if (result.interaction === "EVENT" || result.interaction === "LUCK") {
        const quantity = result.interaction === "EVENT" ? 15 : 25 + talentValue("LUCK") * 5;
        state = recordFloorDrop(state, floor, { id: `room:${floor}:${roomId}`, kind: "COINS", quantity, label: `${quantity} ZC` });
      }
    }
    for (const memberId of memberIds) {
      if (state.members[memberId].status === "ACTIVE" && mascots.filter((mascot) => mascot.ownerId === memberId).every((mascot) => mascot.hp <= 0)) {
        state = { ...state, members: { ...state.members, [memberId]: { ...state.members[memberId], status: "DOWNED" } } };
        downedAt.set(memberId, turns);
        if (!downedEver.has(memberId)) { downedEver.add(memberId); downedCount++; }
      }
    }
    const pressureChange = pressureDelta({ activeFronts: activeFrontCount, mistakes: fronts.reduce((sum, front) => sum + front.mistakes, 0), waits, shield: state.pressureShield ?? 0, splitPenalty: talentFx.splitPenalty });
    state = updateOverload(applyPressureToExpedition(state, pressureChange), turns, overloadFromResults(fronts));
    if (partySize > 1) {
      const previousCharge = bossOverloadValue(state);
      state = earnBossOverloadCharge(state, fronts.filter((front) => front.success).map((front) => front.roomId));
      if (bossOverloadValue(state) > previousCharge) bossOverloadEarnedTurns.push(turns);
    }
    pressurePeak = Math.max(pressurePeak, state.pressure);
    const bossWon = fronts.some((front) => front.success && state.graph.find((room) => room.id === front.roomId)?.kind === "BOSS");
    if (bossWon) {
      for (const memberId of memberIds)
        if (state.members[memberId].status !== "AFK_ABANDONED")
          relicShardsByPlayer[memberId] += pace === "ONLINE" ? 2 : 1;
      const prize = TOWER_BOSS_PRIZES[floor - 1];
      state = secureFloorDrops(recordFloorDrop(state, floor, { id: `boss:${floor}`, kind: "BOSS_BUNDLE", quantity: 1,
        label: prize.label, coins: prize.coins, eggs: prize.eggs.map((egg) => ({ type: egg.type, quantity: egg.quantity })), boss: prize.boss }), floor);
      bossesDefeated++;
      if (floor === 7) { outcome = "WIN"; break; }
      floor++;
      const transition = transitionFloor(state, floor, seed, mascots.map((mascot) => ({ mascotId: mascot.id, ownerUserId: mascot.ownerId, currentHp: mascot.hp, maxHp: mascot.maxHp })), effectiveBalance);
      state = transition.state;
      for (const [id, hp] of Object.entries(transition.healingByMascotId)) mascots.find((mascot) => mascot.id === id)!.hp = hp;
    }
    if (!Object.values(state.members).some((member) => member.status === "ACTIVE")) { outcome = "LOSS"; break; }
  }
  if (outcome !== "WIN") state = discardPendingFloorDrops(state, floor);
  const rewardIds = state.rewardLedger.map((entry) => entry.id);
  const grants = planRewardSettlement(state, `offline:${seed}`);
  const dropsByPlayer = Object.fromEntries(memberIds.map((id) => [id, grants.filter((grant) => grant.userId === id).length]));
  return { seed, partySize, partyProfile: partySize === 1 ? "SOLO" : "GROUP", balanceVersion: 2,
    buildTier, pace, routePolicy, outcome, floorReached: floor, bossesDefeated, turns,
    pressurePeak, preBossPressure, bossDefenderCounts, bossCaptiveCounts, bossArrivalTurns, bossFightTurns, bossWaitTurns,
    bossOverloadEarnedTurns, bossOverloadConsumedTurns,
    afkRate, missedWindows, afkAbandoned,
    hpRemaining: mascots.reduce((sum, mascot) => sum + mascot.hp, 0),
    hpMaximum: mascots.reduce((sum, mascot) => sum + mascot.maxHp, 0), downedCount, recoveries, recoveryTimings,
    securedRewards: state.rewardLedger.filter((entry) => entry.status === "SECURED").length,
    lostRewards: state.rewardLedger.filter((entry) => entry.status === "LOST").length,
    duplicateRewardIds: rewardIds.length - new Set(rewardIds).size,
    relicShards: Object.values(relicShardsByPlayer).reduce((sum, count) => sum + count, 0),
    dropsByPlayer, relicShardsByPlayer,
    unresolvedRooms: Object.entries(state.rooms).filter(([, room]) => !room.cleared && room.encounter).map(([id]) => id),
    memberPositions: Object.fromEntries(memberIds.map((id) => [id, `${state.members[id].status}:${state.members[id].roomId}:${state.graph.find((room) => room.id === state.members[id].roomId)?.kind}:${state.rooms[state.members[id].roomId]?.cleared}`])) };
}
