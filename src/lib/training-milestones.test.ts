import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTrainingJourney,
  buildTrainingManualCopy,
  evaluateTrainingEvent,
  expeditionProgressValue,
  pickObjectiveTarget,
  validateArenaTrainingCredit,
  type TrainingJourney,
} from "./training-milestones";

test("builds a long Loyal Purifier journey without impossible self-healing", () => {
  const journey = buildTrainingJourney({ stance: "PURIFIER", personality: "LOYAL", seed: 7 });

  assert.ok(journey.objectives.length >= 5 && journey.objectives.length <= 7);
  assert.equal(new Set(journey.objectives.map((objective) => objective.type)).size, journey.objectives.length);
  const affinity = journey.objectives.find((objective) => objective.type === "AFFINITY");
  assert.deepEqual(affinity && { label: affinity.label, target: affinity.target }, {
    label: "Proteja 30 vezes o aliado que o Leal protege (o de maior Carisma da equipe) quando ele estiver abaixo de 50% de HP: cure-o ou intercepte o golpe com a postura Guardião.",
    target: 30,
  });
  assert.equal(journey.objectives.some((objective) => objective.type === "SELF_HEAL_AFTER_LOW_HP"), false);
});

test("builds every deterministic Executor seed without looping", () => {
  const journey = buildTrainingJourney({ stance: "EXECUTOR", personality: "COMPETITIVE", seed: 1 });
  assert.equal(journey.objectives.length, 7);
  assert.equal(new Set(journey.objectives.map((objective) => objective.type)).size, 7);
});

function journeyWith(type: TrainingJourney["objectives"][number]["type"], target: number): TrainingJourney {
  return {
    stance: "EXECUTOR",
    personality: "COMPETITIVE",
    itemName: "Marco de Postura - Executor",
    objectives: [{ id: "only", type, label: "Teste", target, progress: 0, perBattleCap: 2 }],
  };
}

test("caps K.O. credit at two per battle", () => {
  const result = evaluateTrainingEvent(journeyWith("KOS", 20), { battleId: "battle-1", kos: 4 });
  assert.equal(result.delta, 2);
  assert.match(result.reason, /limite de 2/i);
});

test("recognizes pressure under risk without needing self-heal", () => {
  const result = evaluateTrainingEvent(journeyWith("PRESSURE_UNDER_RISK", 30), {
    battleId: "battle-1",
    lowHpDirectAttacks: 3,
    survivedToNextRound: true,
  });
  assert.equal(result.delta, 2);
  assert.match(result.reason, /abaixo de 50%/i);
});

const arenaInput = {
  sourceMode: "ARENA_Z_PVP",
  ownerId: "owner-a",
  opponentOwnerId: "owner-b",
  ownMascots: 2,
  opponentMascots: 2,
  resolvedActions: 6,
  selectedTrainingMascot: true,
  pairLastCreditAt: new Date("2026-11-02T10:00:00Z"),
  now: new Date("2026-11-03T10:00:00Z"),
  ownerCreditsToday: 1,
};

test("accepts an Arena-Z credit after the exact pair cooldown", () => {
  assert.deepEqual(validateArenaTrainingCredit(arenaInput), { eligible: true, reasons: [] });
});

test("rejects Arena-Z credits before cooldown and for ineligible sources", () => {
  const early = validateArenaTrainingCredit({ ...arenaInput, now: new Date("2026-11-03T09:59:59Z") });
  assert.equal(early.eligible, false);
  assert.match(early.reasons.join(" "), /24 horas/i);
  const draft = validateArenaTrainingCredit({ ...arenaInput, sourceMode: "ARENA_DRAFT" });
  assert.equal(draft.eligible, false);
  assert.match(draft.reasons.join(" "), /Arena-Z PvP/i);
});

test("rejects same owner, short battles, missing focus, and daily cap", () => {
  for (const input of [
    { ...arenaInput, opponentOwnerId: "owner-a" },
    { ...arenaInput, resolvedActions: 5 },
    { ...arenaInput, selectedTrainingMascot: false },
    { ...arenaInput, ownerCreditsToday: 2 },
  ]) assert.equal(validateArenaTrainingCredit(input).eligible, false);
});

test("manual copy publishes training limits without claiming the system is live", () => {
  const copy = buildTrainingManualCopy();
  assert.match(copy, /em preparação/i);
  assert.match(copy, /Marco de Postura - \[Postura\]/);
  assert.match(copy, /24 horas/i);
  assert.doesNotMatch(copy, /Penetração de Armadura/);
  assert.doesNotMatch(copy, /mitigação de dano/i);
});

test("expedition milestone only completes with 6 expeditions in every mode", () => {
  assert.equal(expeditionProgressValue({ STANDARD: 30, TRAINING: 0, ITEMS: 0 }, 24), 12);
  assert.equal(expeditionProgressValue({ STANDARD: 12, TRAINING: 12, ITEMS: 5 }, 24), 23);
  assert.equal(expeditionProgressValue({ STANDARD: 12, TRAINING: 6, ITEMS: 6 }, 24), 24);
});

test("type and posture KO objectives name a concrete target", () => {
  const journey = buildTrainingJourney({ stance: "EXECUTOR", personality: "LOYAL", seed: 3 });
  for (const objective of journey.objectives) assert.doesNotMatch(objective.label, /\{type\}|\{role\}|alvo desta jornada/);
  assert.equal(pickObjectiveTarget("TYPE_KOS", 2), "Água");
  assert.equal(pickObjectiveTarget("ROLE_KOS", 0), "Defensor");
});
