import assert from "node:assert/strict";
import { test } from "node:test";
import { getTowerRouteIntel } from "./route-intel";

test("route clues identify real opportunities without promising conditional outcomes", () => {
  const fight = getTowerRouteIntel({ kind: "COMBAT", index: 4 });
  const puzzle = getTowerRouteIntel({ kind: "PUZZLE", index: 5 });
  const rest = getTowerRouteIntel({ kind: "REST", index: 6 });
  const rescue = getTowerRouteIntel({ kind: "RESCUE", index: 7 });
  assert.match(fight.opportunity, /combate|confronto/i);
  assert.match(puzzle.opportunity, /mecanismo|enigma/i);
  assert.match(rest.opportunity, /pode/i);
  assert.match(rescue.opportunity, /se houver/i);
  assert.notEqual(fight.signal, puzzle.signal);
  assert.doesNotMatch(JSON.stringify([fight, puzzle, rest, rescue]), /regente|ovo|ZC|resposta correta/i);
});

test("same-profile corridors keep true positional and ally clues", () => {
  const upper = getTowerRouteIntel({ kind: "COMBAT", index: 3 });
  const lower = getTowerRouteIntel({ kind: "COMBAT", index: 5 }, { allyNames: ["Bruno"] });
  assert.match(upper.signal, /superior/i);
  assert.match(lower.signal, /inferior/i);
  assert.match(lower.opportunity, /Bruno/);
  assert.notEqual(upper.risk, lower.risk);
  assert.match(upper.risk, /\+6 níveis/);
  assert.match(lower.risk, /\+10 níveis/);
});

test("a puzzle clue describes its motif but never its answer", () => {
  const bells = getTowerRouteIntel({ kind: "PUZZLE", index: 5, puzzle: { id: "bells" } });
  const mirror = getTowerRouteIntel({ kind: "PUZZLE", index: 5, puzzle: { id: "mirror" } });
  assert.match(bells.signal, /sinos/i);
  assert.match(mirror.signal, /espelhos/i);
  assert.notEqual(bells.signal, mirror.signal);
  assert.doesNotMatch(JSON.stringify([bells, mirror]), /crescente|dark|instinto/i);
});
