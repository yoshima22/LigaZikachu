/** Offline, seeded Tower model. Never call this from a request handler: the league
 * combat engine still consumes Math.random, which we scope to each synchronous fight. */
import { getPokemonTypes } from "@/lib/mascot-data";
import { runLeagueCombat, type LeagueMascot } from "@/lib/league-combat";
import { newExpeditionState, type TowerExpeditionV2 } from "./expedition-state";
import { resolveTowerClassEffects } from "./config";
import { TOWER_BOSS_PRIZES, TOWER_EXCLUSIVE_MASCOTS } from "./exclusive-catalog";
import { applyPressureToExpedition, overloadFromResults, pressureDelta, transitionFloor, updateOverload } from "./pressure-rules";
import { canUseRecoveryRoom, reviveMember } from "./recovery-rules";
import { recordFloorDrop, secureFloorDrops, discardPendingFloorDrops } from "./reward-ledger";
import { planRewardSettlement } from "./reward-ledger";
import { freezeRoomEncounter, groupActiveMembersByRoom, resolveRoomFront } from "./room-resolver";
import { generateTowerRoomGraph, towerEncounterPreview, type TowerRoomNode } from "./rooms";
import { moveMember, shortestKnownPath, towerCanLeaveRoom } from "./route-rules";
import { resolveTowerTalents } from "./talents";

export type BuildTier = "ZERO" | "INTERMEDIATE" | "PREPARED";
export type TowerSimulationReport = {
  seed: string; partySize: 1 | 2 | 3; buildTier: BuildTier; pace: "ONLINE" | "SLOW";
  routePolicy: "UNITED" | "SPLIT"; outcome: "WIN" | "LOSS" | "TURN_LIMIT";
  floorReached: number; bossesDefeated: number; turns: number; pressurePeak: number;
  preBossPressure: number[]; afkRate: number; missedWindows: number; afkAbandoned: number;
  hpRemaining: number; hpMaximum: number; downedCount: number; recoveries: number;
  recoveryTimings: { memberId: string; downedTurn: number; recoveredTurn: number }[];
  securedRewards: number; lostRewards: number; duplicateRewardIds: number; relicShards: number;
  dropsByPlayer: Record<string, number>; relicShardsByPlayer: Record<string, number>;
  unresolvedRooms: string[]; memberPositions: Record<string, string>;
};

type SimMascot = { id: string; ownerId: string; pokemonId: number; level: number; stat: number; maxHp: number; hp: number; combatRole: LeagueMascot["combatRole"] };
const TIERS = {
  ZERO: { level: 70, stat: 220, ranks: {} as Record<string, number> },
  INTERMEDIATE: { level: 70, stat: 225, ranks: { COMBAT: 2, PRESSURE: 2, VIGOR: 2, BULWARK: 2, COMPOSURE: 2, PATHFINDER: 2 } as Record<string, number> },
  PREPARED: { level: 70, stat: 240, ranks: { COMBAT: 4, PRESSURE: 4, BOSS: 3, VIGOR: 4, FORCE: 3, VITALITY: 3, BULWARK: 4, COMPOSURE: 4, PATHFINDER: 4 } as Record<string, number> },
} as const;
const ROLES = ["ARTIFICE", "RITUALISTA", "PROTETOR"] as const;
const STANCES = [["ATTACKER", "SPECIALIST"], ["HEALER", "SURVIVOR"], ["DEFENDER", "GUARDIAN"]] as const;
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

function simulatedBattle(allies: LeagueMascot[], enemies: LeagueMascot[], random: () => number) {
  const prior = Math.random;
  Math.random = random;
  try { return runLeagueCombat(allies, enemies); }
  finally { Math.random = prior; }
}

function remainingHp(lineup: LeagueMascot[], log: { action: string; targetId: string; damage: number }[]) {
  const hp = new Map(lineup.map((mascot) => [mascot.id, mascot.hp]));
  for (const event of log) {
    const current = hp.get(event.targetId);
    if (current === undefined) continue;
    if (event.action === "ATTACK") hp.set(event.targetId, Math.max(0, current - event.damage));
    if (event.action === "HEAL" && current > 0) hp.set(event.targetId, Math.min(lineup.find((entry) => entry.id === event.targetId)!.hp, current + event.damage));
  }
  return hp;
}

function nextRoom(room: TowerRoomNode, memberIndex: number, floor: number, policy: "UNITED" | "SPLIT") {
  if (!room.connections.length) return null;
  return room.connections[policy === "UNITED" ? 0 : (memberIndex + floor) % room.connections.length];
}

export function simulateTower(
  seed: string, partySize: 1 | 2 | 3, buildTier: BuildTier,
  pace: "ONLINE" | "SLOW", routePolicy: "UNITED" | "SPLIT", afkRate = 0,
): TowerSimulationReport {
  if (!seed || ![1, 2, 3].includes(partySize) || !Number.isFinite(afkRate) || afkRate < 0 || afkRate > 1)
    throw new Error("Parâmetros da simulação inválidos.");
  const tier = TIERS[buildTier];
  const memberIds = Array.from({ length: partySize }, (_, index) => `treinador-${index + 1}`);
  let state = newExpeditionState(generateTowerRoomGraph(seed), memberIds);
  const random = seededRandom(`${seed}:${partySize}:${buildTier}`);
  const afkRandom = seededRandom(`afk:${seed}:${partySize}:${buildTier}:${afkRate}`);
  const talentValue = (key: string) => tier.ranks[key] ?? 0;
  const talentFx = resolveTowerTalents(talentValue);
  state.pressureShield = talentFx.pressureShieldStart;
  const mascots: SimMascot[] = memberIds.flatMap((ownerId, index) => [0, 1].map((slot) => {
    const maxHp = 55 + tier.level * 6 + tier.stat * 4;
    return { id: `${ownerId}-${slot}`, ownerId, pokemonId: [448, 196, 25, 94, 197, 609][index * 2 + slot],
      level: tier.level, stat: tier.stat, maxHp, hp: maxHp,
      combatRole: STANCES[index][slot] as LeagueMascot["combatRole"] };
  }));
  let floor = 1, turns = 0, pressurePeak = 0, downedCount = 0, recoveries = 0, bossesDefeated = 0;
  let outcome: TowerSimulationReport["outcome"] = "TURN_LIMIT";
  const downedEver = new Set<string>();
  const downedAt = new Map<string, number>();
  const recoveryTimings: TowerSimulationReport["recoveryTimings"] = [];
  const preBossPressure: number[] = [];
  let missedWindows = 0, afkAbandoned = 0;
  const relicShardsByPlayer = Object.fromEntries(memberIds.map((id) => [id, 0]));
  let regroupTarget: string | null = null;

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
    if (recoveryActor && downed && canUseRecoveryRoom(floor, state.lastRecoveryFloor)) {
      const result = reviveMember(state, downed, { kind: "ROOM", actorId: recoveryActor }, floor,
        mascots.map((mascot) => ({ mascotId: mascot.id, ownerUserId: mascot.ownerId, currentHp: mascot.hp, maxHp: mascot.maxHp })));
      state = result.state;
      for (const [id, hp] of Object.entries(result.hpByMascotId)) mascots.find((mascot) => mascot.id === id)!.hp = hp;
      recoveryTimings.push({ memberId: downed, downedTurn: downedAt.get(downed) ?? turns - 1, recoveredTurn: turns });
      downedAt.delete(downed);
      recoveryActorUsed = recoveryActor;
      recoveries++;
    }
    if (regroupTarget && state.rooms[regroupTarget]?.cleared) regroupTarget = null;
    if (!regroupTarget && Object.values(state.members).some((member) => member.status === "ACTIVE" && state.graph.find((room) => room.id === member.roomId)?.kind === "BOSS"))
      regroupTarget = Object.entries(state.rooms).find(([roomId, saved]) => roomId !== "boss" && !saved.cleared && saved.encounter)?.[0] ?? null;
    for (const [index, memberId] of memberIds.entries()) {
      const member = state.members[memberId];
      if (member.status !== "ACTIVE" || member.availableFromTurn > turns || memberId === recoveryActorUsed || missingThisTurn.has(memberId) || !towerCanLeaveRoom(state, member.roomId)) continue;
      const room = state.graph.find((entry) => entry.id === member.roomId)!;
      const returnPath = regroupTarget && room.id !== regroupTarget ? shortestKnownPath(state, room.id, regroupTarget) : null;
      const destination = returnPath?.[1] ?? nextRoom(room, index, floor, routePolicy);
      if (destination) state = moveMember(state, memberId, destination);
    }
    const activeFrontCount = groupActiveMembersByRoom(state).size;
    const fronts = [];
    let waits = 0;
    for (const [roomId, memberGroup] of groupActiveMembersByRoom(state)) {
      const room = state.graph.find((entry) => entry.id === roomId)!;
      if (room.kind === "BOSS" && memberIds.some((id) => state.members[id].status === "ACTIVE" && state.members[id].roomId !== roomId)) waits++;
      if (state.rooms[roomId].cleared) continue;
      if ((room.kind === "COMBAT" || room.kind === "BOSS") && !state.rooms[roomId].encounter) {
        const local = mascots.filter((mascot) => memberGroup.includes(mascot.ownerId) && mascot.hp > 0);
        const averageLevel = Math.round(local.reduce((sum, mascot) => sum + mascot.level, 0) / Math.max(1, local.length));
        const preview = towerEncounterPreview(room, averageLevel, local.length);
        if (room.kind === "BOSS" && preview[0]) preview[0].pokemonId = BOSS_POKEMON_IDS[floor - 1];
        state = freezeRoomEncounter(state, roomId, preview, room.kind === "BOSS" ? 2 : 1);
      }
      const actions = memberGroup.filter((memberId) => !missingThisTurn.has(memberId)).map((memberId) => ({ memberId, action: room.kind === "COMBAT" || room.kind === "BOSS" ? "FIGHT" : "INTERACT", puzzleChoice: room.puzzle?.answer }));
      if (room.kind === "BOSS" && actions.length && memberIds.every((id) => state.members[id].status !== "ACTIVE" || state.members[id].roomId === roomId))
        preBossPressure.push(state.pressure);
      const result = resolveRoomFront(state, roomId, actions, ({ room: combatRoom, memberIds: presentIds }) => {
        const locals = mascots.filter((mascot) => presentIds.includes(mascot.ownerId) && mascot.hp > 0);
        const allies: LeagueMascot[] = locals.map((mascot, index) => {
          const role = ROLES[memberIds.indexOf(mascot.ownerId)];
          const classFx = resolveTowerClassEffects(role, { kind: "COMBAT" });
          const bossMult = combatRoom.kind === "BOSS" ? talentFx.bossMult : 1;
          const combatMult = 1 + talentValue("COMBAT") * 0.02 + (combatRoom.kind === "BOSS" ? talentValue("BOSS") * 0.03 : 0);
          const value = (mult: number, talent: number) => Math.round(mascot.stat * mult * talent * combatMult * bossMult);
          return { id: mascot.id, ownerId: mascot.ownerId, pokemonId: mascot.pokemonId,
            types: getPokemonTypes(mascot.pokemonId), name: mascot.id, level: mascot.level,
            force: value(classFx.forceMult, talentFx.forceMult), agility: value(classFx.agilityMult, talentFx.agilityMult),
            instinct: value(classFx.instinctMult, talentFx.instinctMult), vitality: value(classFx.vitalityMult, talentFx.vitalityMult),
            charisma: value(classFx.charismaMult, talentFx.charismaMult), hp: mascot.hp,
            combatRole: missingThisTurn.has(mascot.ownerId) ? "DEFENDER" : mascot.combatRole, slot: index + 1 };
        });
        if (!allies.length) return { won: false, hpByMascotId: {}, events: ["Nenhum mascote apto."], kos: [] };
        const averageLevel = Math.round(allies.reduce((sum, ally) => sum + ally.level, 0) / allies.length);
        const pressureMult = state.activeModifiers.reduce((product, modifier) => product * modifier.enemyMultiplier, 1) *
          (1 + state.pressure * talentFx.enemyPressureScale) *
          (1 - (state.overload && state.overload.expiresAfterTurn >= turns ? state.overload.value : 0));
        const enemies: LeagueMascot[] = (state.rooms[roomId].encounter?.enemies ?? []).map((enemy, index) => {
          const base = Math.max(12, Math.round((averageLevel * 0.72 + 18 + combatRoom.index * 2) * pressureMult));
          const exclusive = TOWER_EXCLUSIVE_MASCOTS.find((entry) => entry.pokemonId === enemy.pokemonId);
          return { id: `enemy-${roomId}-${index}`, ownerId: "TORRE", pokemonId: enemy.pokemonId,
            types: exclusive ? [exclusive.primaryType, "secondaryType" in exclusive ? exclusive.secondaryType : null].filter(Boolean) as string[] : getPokemonTypes(enemy.pokemonId),
            name: enemy.name || exclusive?.name || "Defensor", level: enemy.level,
            force: base, agility: base, instinct: base, vitality: base, charisma: base,
            hp: 55 + enemy.level * 6 + base * 4, combatRole: index % 2 ? "DEFENDER" : "ATTACKER", slot: index + 1 };
        });
        const battle = simulatedBattle(allies, enemies, random);
        const hp = remainingHp(allies, battle.log);
        const enemyHp = remainingHp(enemies, battle.log);
        return { won: battle.winner === "A", hpByMascotId: Object.fromEntries(allies.map((ally) => [ally.id, hp.get(ally.id) ?? 0])),
          events: [], kos: enemies.filter((enemy) => (enemyHp.get(enemy.id) ?? 0) <= 0).map((enemy) => enemy.id) };
      });
      state = result.state;
      fronts.push(result);
      for (const [id, hp] of Object.entries(result.hpByMascotId)) mascots.find((mascot) => mascot.id === id)!.hp = hp;
      if (result.interaction === "REST") {
        const ritual = result.participantIds.some((id) => resolveTowerClassEffects(ROLES[memberIds.indexOf(id)], { kind: "REST" }).healingMult > 1) ? 1.1 : 1;
        for (const mascot of mascots.filter((entry) => result.participantIds.includes(entry.ownerId) && entry.hp > 0))
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
      const transition = transitionFloor(state, floor, seed, mascots.map((mascot) => ({ mascotId: mascot.id, ownerUserId: mascot.ownerId, currentHp: mascot.hp, maxHp: mascot.maxHp })));
      state = transition.state;
      for (const [id, hp] of Object.entries(transition.healingByMascotId)) mascots.find((mascot) => mascot.id === id)!.hp = hp;
    }
    if (!Object.values(state.members).some((member) => member.status === "ACTIVE")) { outcome = "LOSS"; break; }
  }
  if (outcome !== "WIN") state = discardPendingFloorDrops(state, floor);
  const rewardIds = state.rewardLedger.map((entry) => entry.id);
  const grants = planRewardSettlement(state, `offline:${seed}`);
  const dropsByPlayer = Object.fromEntries(memberIds.map((id) => [id, grants.filter((grant) => grant.userId === id).length]));
  return { seed, partySize, buildTier, pace, routePolicy, outcome, floorReached: floor, bossesDefeated, turns,
    pressurePeak, preBossPressure, afkRate, missedWindows, afkAbandoned,
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
