// A prioridade das habilidades independe da posição do mascote: npx tsx scripts/test-ability-priority.ts
import assert from "node:assert/strict";
import { ABILITIES } from "../src/lib/abilities/data.generated";
import { abilityPriorityIndices, evaluateTeamAbilities, getAbilityInfo } from "../src/lib/abilities";
import { arenaZAbilitiesLive } from "../src/lib/abilities/schedule";

const dano = Object.keys(ABILITIES).filter((s) => getAbilityInfo(s)?.category === "Dano").slice(0, 3);
assert.equal(dano.length, 3);
const ids = ["a", "b", "c"];

// Sem prioridade: ordem dos slots (1º 100%, 2º 70%, 3º desligado).
assert.deepEqual(evaluateTeamAbilities(dano).map((s) => s.state), ["ACTIVE", "REDUCED", "OFF"]);
// Prioridade c > a > b: o 3º slot passa a valer 100% e o 2º slot desliga.
const prio = abilityPriorityIndices(ids, ["c", "a"]);
assert.deepEqual(prio, [2, 0, 1]);
assert.deepEqual(evaluateTeamAbilities(dano, prio).map((s) => s.state), ["REDUCED", "OFF", "ACTIVE"]);

// Agendamento: 23/11/2026 00:00 BRT.
assert.equal(arenaZAbilitiesLive(new Date("2026-11-23T02:59:59Z")), false);
assert.equal(arenaZAbilitiesLive(new Date("2026-11-23T03:00:00Z")), true);
console.log("ok");
