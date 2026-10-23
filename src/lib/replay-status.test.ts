import assert from "node:assert/strict";
import test from "node:test";
import { shortEffectLabel, statusesAt } from "./replay-status";
import type { ReplayData, ReplayTurn } from "@/components/replay/replay-canvas";

const mon = (id: string, side: "A" | "B") => ({ id, name: id, pokemonId: 1, type: "normal", sprite: "", maxHp: 100, side });
const turn = (t: Partial<ReplayTurn>): ReplayTurn => ({ turn: 1, actorId: "a", targetId: "b", action: "ATTACK", damage: 10, targetHpAfter: 50, ...t });
const data = (turns: ReplayTurn[]): ReplayData => ({ teams: [mon("a", "A"), mon("b", "B")], turns });
const apply = { kind: "APPLY", targetId: "b", stat: "force", pct: 0.08, sourceId: "a", sourceName: "a", label: "Intimidação", round: 1 };

test("debuff de habilidade persiste com origem até o REMOVE", () => {
  const d = data([
    turn({ action: "ABILITY", damage: 0, debuffEvents: [apply] }),
    turn({}), turn({}), turn({}),
    turn({ action: "ABILITY", damage: 0, debuffEvents: [{ ...apply, kind: "REMOVE" }] }),
  ]);
  const at3 = statusesAt(d, 3).get("b");
  assert.equal(at3?.[0].label, "Intimidação");
  assert.equal(at3?.[0].source, "a");
  assert.equal(at3?.[0].detail, "−8% de Força");
  assert.equal(at3?.[0].since, 0);
  assert.equal(statusesAt(d, 4).has("b"), false);
});

test("efeito de frase vale no turno e expira depois", () => {
  const d = data([turn({ effect: "Encorajador: +5%." }), turn({}), turn({}), turn({})]);
  assert.equal(statusesAt(d, 0).get("a")?.[0].kind, "buff");
  assert.equal(statusesAt(d, 1).has("a"), true);
  assert.equal(statusesAt(d, 2).has("a"), false);
});

test("nocaute limpa os efeitos do mascote", () => {
  const d = data([turn({ action: "ABILITY", damage: 0, debuffEvents: [apply] }), turn({ targetHpAfter: 0 })]);
  assert.equal(statusesAt(d, 0).has("b"), true);
  assert.equal(statusesAt(d, 1).has("b"), false);
});

test("condições: aplicar, reforçar, remover e nomes parecidos", () => {
  const d: ReplayData = {
    teams: [mon("a", "A"), { ...mon("g", "B"), name: "Gyarados" }, { ...mon("mg", "B"), name: "Mega Gyarados" }],
    turns: [
      turn({ action: "ABILITY", damage: 0, effect: "❄️ Mega Gyarados ficou congelado por 2 rodadas (Nevasca, de a)." }),
      turn({ action: "ABILITY", damage: 0, effect: "⚡ Gyarados está paralisado e não conseguiu agir." }),
      turn({ action: "ABILITY", damage: 0, effect: "❄️ Mega Gyarados deixou de estar congelado (descongelou)." }),
    ],
  };
  const at0 = statusesAt(d, 0);
  assert.equal(at0.get("mg")?.[0].condition, "FREEZE");
  assert.equal(at0.get("mg")?.[0].source, "a");
  assert.equal(at0.has("g"), false);
  assert.equal(statusesAt(d, 1).get("g")?.some((s) => s.condition === "PARALYSIS"), true);
  assert.equal(statusesAt(d, 2).get("mg")?.some((s) => s.condition === "FREEZE") ?? false, false);
});

test("rótulo flutuante é curto, nunca a frase inteira", () => {
  assert.equal(shortEffectLabel("✨ Intimidação de Gyarados: reduziu 8% da Força de Pikachu por 2 rodadas."), "✨ Intimidação de Gyarados");
  assert.ok(shortEffectLabel("x".repeat(80)).length <= 26);
});
