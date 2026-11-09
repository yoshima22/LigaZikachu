import assert from "node:assert/strict";
import test from "node:test";
import { autoBuild } from "./auto-build";
import { buildRoundPlan, canTransition, freezeAt, lockAt, mondayOf } from "./schedule";
import { analyzeBattle } from "./scoring";
import { DEFAULT_CONFIG } from "./config";
import { makeBotRoster, makeSimPlayer, simulateWeek } from "./simulate";
import { applyBattleToState, chooseActives, freshDayState, validateFormation, type Formation, type MascotSnap } from "./team";
import { sumAggs } from "./scoring";

const roster = makeBotRoster("t", "MEDIO", 20);
const pool = new Map(roster.map((m) => [m.id, m]));
const built = autoBuild(roster, "BALANCED");
assert.ok(built.ok);
const formation = (built as { ok: true; formation: Formation }).formation;

test("montador automático gera 18 mascotes diferentes e válidos", () => {
  assert.deepEqual(validateFormation(formation, pool), []);
  assert.equal(new Set(formation.slots.flatMap((s) => s.mascotIds)).size, 18);
});

test("montador recusa quem tem menos de 18 mascotes", () => {
  const r = autoBuild(roster.slice(0, 12));
  assert.equal(r.ok, false);
});

test("postura avançada exige desbloqueio individual do mascote", () => {
  const f: Formation = structuredClone(formation);
  f.slots[0].role = "EXECUTOR";
  const errs = validateFormation(f, pool);
  assert.ok(errs.some((e) => e.includes("não desbloqueou")));
  const unlocked = new Map(roster.map((m) => [m.id, { ...m, unlocked: m.id === f.slots[0].mascotIds[0] ? ["EXECUTOR"] : [] } as MascotSnap]));
  assert.ok(validateFormation(f, unlocked).length > 0); // só um desbloqueou: os outros 2 do slot continuam inválidos
  const all = new Map(roster.map((m) => [m.id, { ...m, unlocked: ["EXECUTOR"] } as MascotSnap]));
  assert.deepEqual(validateFormation(f, all), []);
});

test("após o fechamento os 18 não podem ser trocados", () => {
  const locked = new Set(formation.slots.flatMap((s) => s.mascotIds));
  const extra = roster.find((m) => !locked.has(m.id))!;
  const f: Formation = structuredClone(formation);
  f.slots[0].mascotIds[2] = extra.id;
  const errs = validateFormation(f, pool, locked);
  assert.ok(errs.some((e) => e.includes("não faz parte dos 18")));
});

test("derrotado só é substituído para o PRÓXIMO combate; slots avançam sozinhos", () => {
  const st = freshDayState(formation, pool);
  const [a0, b0] = formation.slots[0].mascotIds;
  const s1 = formation.slots[1].mascotIds[0];
  const hp: Record<string, number> = { [a0]: 0, [s1]: Math.round(st.mascots[s1].max * 0.35) };
  const next = applyBattleToState(formation, st, hp, DEFAULT_CONFIG);
  assert.equal(next.active[0], b0); // slot 1 troca
  assert.equal(next.active[1], s1); // slot 2: sobrevivente ferido permanece (KEEP)
  assert.equal(next.mascots[a0].dead, true);
  assert.equal(next.mascots[s1].hp, hp[s1]); // HP preservado
});

test("derrotado nunca volta no mesmo dia; slot esgotado fica vazio", () => {
  let st = freshDayState(formation, pool);
  const ids = formation.slots[0].mascotIds;
  for (const id of ids) st = applyBattleToState(formation, st, { [id]: 0 }, DEFAULT_CONFIG);
  assert.equal(st.active[0], null);
  assert.ok(chooseActives(formation, st, DEFAULT_CONFIG)[0] === null);
});

test("PRESERVE troca por reserva mais saudável só acima do limiar", () => {
  const f: Formation = { ...structuredClone(formation), strategy: "PRESERVE" };
  const st = freshDayState(f, pool);
  const [t, r1] = f.slots[0].mascotIds;
  let next = applyBattleToState(f, st, { [t]: Math.round(st.mascots[t].max * 0.9) }, DEFAULT_CONFIG);
  assert.equal(next.active[0], t); // 90% vs 100%: diferença < 15
  next = applyBattleToState(f, st, { [t]: Math.round(st.mascots[t].max * 0.5) }, DEFAULT_CONFIG);
  assert.equal(next.active[0], r1);
  assert.ok(!next.mascots[t].dead && next.mascots[t].hp > 0); // ferido segue vivo e disponível, sem cura
});

test("calendário: 20 rodadas, 5 por dia, 09h-21h BRT", () => {
  const plan = buildRoundPlan("2026-11-09");
  assert.equal(plan.length, 20);
  assert.equal(plan[0].at.toISOString(), "2026-11-10T12:00:00.000Z"); // terça 09h BRT
  assert.equal(plan[19].at.toISOString(), "2026-11-14T00:00:00.000Z"); // sexta 21h BRT
  assert.equal(lockAt("2026-11-09").toISOString(), "2026-11-10T00:00:00.000Z");
  assert.equal(freezeAt("2026-11-09", 2).toISOString(), "2026-11-11T11:00:00.000Z");
  assert.equal(mondayOf(new Date("2026-11-12T15:00:00Z")), "2026-11-09");
});

test("máquina de estados recusa transições inválidas", () => {
  assert.ok(canTransition("PREPARATION", "LOCKED"));
  assert.ok(!canTransition("PREPARATION", "RUNNING"));
  assert.ok(!canTransition("FINISHED", "REST"));
});

test("pontuação: soma por mascote bate com o total e respeita o orçamento", () => {
  const players = Array.from({ length: 8 }, (_, i) => makeSimPlayer(i + 1, (["BALANCED", "OFFENSIVE", "ENDURANCE", "CONTROL"] as const)[i % 4], "MEDIO", i % 2 ? "PRESERVE" : "KEEP"));
  const sim = simulateWeek(players, { editionId: "t1" });
  assert.deepEqual(sim.metrics.errors, []);
  assert.equal(sim.metrics.rounds, 20);
  for (const rt of sim.runtimes) {
    const fromRows = sim.standings.find((r) => r.pid === rt.pid)!.score;
    assert.equal(fromRows, sumAggs(rt.aggs));
    for (const a of Object.values(rt.aggs)) assert.equal(a.total, Object.values(a.points).reduce((x, y) => x + y, 0));
    assert.ok(rt.wins + rt.losses + rt.draws + rt.byes <= 20);
  }
  // teto: no máximo ~103 pts por combate e equipe (100 de orçamento + 3 de topo)
  const maxPerMatch = 103 * 100 + 6;
  for (const rt of sim.runtimes) assert.ok(sumAggs(rt.aggs) <= maxPerMatch * 20);
});

test("determinismo: mesma semana + mesma seed = mesmo resultado (replay reproduzível)", () => {
  const mk = () => Array.from({ length: 6 }, (_, i) => makeSimPlayer(i + 1, "BALANCED", "MEDIO", "KEEP"));
  const a = simulateWeek(mk(), { editionId: "det" });
  const b = simulateWeek(mk(), { editionId: "det" });
  assert.deepEqual(a.standings.map((r) => [r.pid, r.score]), b.standings.map((r) => [r.pid, r.score]));
});

test("modificadores respeitam limites (−6% topo, +4% base)", () => {
  const players = Array.from({ length: 10 }, (_, i) => makeSimPlayer(i + 1, "BALANCED", i < 3 ? "FORTE" : "MEDIO", "KEEP"));
  const sim = simulateWeek(players, { editionId: "mod" });
  for (const rt of sim.runtimes) void rt;
  assert.ok(sim.history.every((rows) => rows.every((r) => r.pressure <= 3 && r.current <= 2 && !(r.pressure > 0 && r.current > 0))));
});

test("análise: dano excedente e cura acima do HP perdido não geram pontos", () => {
  const f = (id: string) => ({ id, name: id, pokemonId: 25, role: "Atacante", slot: 1, maxHp: 100, startHp: 100 });
  const log = [
    { turn: 1, round: 1, actorId: "a", actorName: "a", actorOwnerId: "A", targetId: "b", targetName: "b", targetOwnerId: "B", action: "ATTACK", damage: 999, attackerType: "x", defenderType: "x", multiplier: 1, advantageApplied: false },
    { turn: 2, round: 1, actorId: "a", actorName: "a", actorOwnerId: "A", targetId: "a", targetName: "a", targetOwnerId: "A", action: "HEAL", damage: 500, attackerType: "x", defenderType: "x", multiplier: 1, advantageApplied: false },
  ] as never;
  const r = analyzeBattle({ log, sideA: [f("a")], sideB: [f("b")], finalHp: { a: 100, b: 0 }, rounds: 1, winner: "A", cfg: DEFAULT_CONFIG });
  assert.equal(r.A.get("a")!.damageDealt, 100);
  assert.equal(r.A.get("a")!.healing, 0);
  assert.equal(r.A.get("a")!.kos, 1);
});
