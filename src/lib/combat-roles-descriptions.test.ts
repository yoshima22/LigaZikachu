import assert from "node:assert/strict";
import test from "node:test";
import { COMBAT_ROLE_DESCRIPTIONS } from "./combat-roles";

test("commander description explains the one-time KO order without changing initiative", () => {
  const description = COMBAT_ROLE_DESCRIPTIONS.COMMANDER;
  assert.match(description, /primeiro K\.O\./i);
  assert.match(description, /próxima ação/i);
  assert.match(description, /não altera.*Agilidade/i);
});

test("variable advanced posture effects state which attributes control their range", () => {
  assert.match(COMBAT_ROLE_DESCRIPTIONS.EXECUTOR, /média de Força e Agilidade/i);
  assert.match(COMBAT_ROLE_DESCRIPTIONS.CORROSIVE, /média de Força e Instinto/i);
  assert.match(COMBAT_ROLE_DESCRIPTIONS.ACCUMULATOR, /média de Força e Agilidade/i);
});
