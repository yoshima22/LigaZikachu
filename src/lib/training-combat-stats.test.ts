import assert from "node:assert/strict";
import test from "node:test";
import { extractBattleStats } from "./training-combat-stats";

// A: g (Gengar 94, 100hp) + x (Pikachu 25, 100hp). B: e1 (Charizard 6, 50hp, Defensor), e2 (Squirtle 7, 50hp).
const lineupA = [{ id: "g", pokemonId: 94, maxHp: 100, role: "Flanco" }, { id: "x", pokemonId: 25, maxHp: 100, role: "Atacante" }];
const lineupB = [{ id: "e1", pokemonId: 6, maxHp: 50, role: "Defensor" }, { id: "e2", pokemonId: 7, maxHp: 50, role: "Atacante" }];
const hit = (turn: number, round: number, actorId: string, targetId: string, damage: number, extra = {}) =>
  ({ turn, round, action: "ATTACK", actorId, targetId, damage, targetRole: targetId === "e1" ? "Defensor" : "Atacante", typeStep: 0, ...extra });

test("conta ataques, K.O.s, tipo/postura-alvo, super-efetivo e dano efetivo", () => {
  const log = [
    hit(1, 1, "g", "e1", 60, { typeStep: 1 }), // K.O. em e1 (50hp), dano efetivo 50
    hit(2, 1, "x", "e2", 50),                  // K.O. em e2 (aliado dá o golpe final)
    hit(3, 2, "e2", "g", 20, { typeStep: -1 }), // ignorado: e2 já morto não deveria agir, mas hit conta resistido do g
  ];
  const s = extractBattleStats({ log, lineupA, lineupB, winner: "A", rounds: 2 });
  const g = s.get("g")!;
  assert.equal(g.counts.DIRECT_ATTACKS, 1);
  assert.equal(g.counts.KOS, 1);
  assert.equal(g.counts.SUPER_EFFECTIVE, 1);
  assert.equal(g.counts.MULTI_KO_BATTLE, 1);
  assert.equal(g.counts.DAMAGE, 0.5);
  assert.equal(g.roleKos.Defensor, 1);
  assert.equal(g.typeKos["Fogo"], 1);
  assert.equal(g.typeKos["Água"], 1); // K.O. do aliado x também vale para o g
  assert.equal(g.counts.RESISTED_HITS, 1);
  assert.equal(g.counts.TURN_THREE_HOLD, undefined);
  assert.equal(g.affinity.PROUD, 1);
});

test("sem round no log, objetivos baseados em round não contam", () => {
  const log = [{ turn: 1, action: "ATTACK", actorId: "g", targetId: "e1", damage: 10, typeStep: 0 }];
  const s = extractBattleStats({ log, lineupA, lineupB, winner: "B", rounds: 6 });
  assert.equal(s.get("g")!.hasRounds, false);
  assert.equal(s.get("g")!.counts.TURN_THREE_HOLD, undefined);
  assert.equal(s.get("g")!.counts.DIRECT_ATTACKS, 1);
});
