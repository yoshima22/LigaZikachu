import assert from "node:assert/strict";
import test from "node:test";
import { autoBuild } from "./auto-build";
import { buildRoundPlan, canTransition, freezeAt, lockAt, mondayOf } from "./schedule";
import { analyzeBattle } from "./scoring";
import { DEFAULT_CONFIG } from "./config";
import { makeBotRoster, makeSimPlayer, simulateWeek } from "./simulate";
import { applyBattleToState, chooseActives, freshDayState, validateFormation, type Formation, type MascotSnap } from "./team";
import { sumAggs } from "./scoring";
import { buildStandings, modifierPct, type Result, type StandRow } from "./standings";
import { mergeConfig } from "./config";

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

test("troca por vida: sai ao terminar com HP <= X% e entra o próximo da fila acima de X%", () => {
  const f: Formation = structuredClone(formation);
  f.slots[0].swapBelowPct = 50;
  f.slots[1].swapBelowPct = 0; // "até cair"
  const st = freshDayState(f, pool);
  const [t, r1, r2] = f.slots[0].mascotIds;
  const hp = (id: string, p: number) => Math.floor(st.mascots[id].max * p);
  // 60%: acima do limiar, fica.
  let next = applyBattleToState(f, st, { [t]: hp(t, 0.6) });
  assert.equal(next.active[0], t);
  // 50% (<=): sai; a reserva 1 (100%) assume; o ferido segue vivo, sem cura.
  next = applyBattleToState(f, st, { [t]: hp(t, 0.5) });
  assert.equal(next.active[0], r1);
  assert.ok(!next.mascots[t].dead && next.mascots[t].hp === hp(t, 0.5));
  // Se a próxima da fila também está <= limiar, passa para a seguinte acima do limiar.
  let two = applyBattleToState(f, st, { [t]: hp(t, 0.4), [r1]: hp(r1, 0.3) });
  assert.equal(two.active[0], r2);
  // Se ninguém está acima do limiar, ninguém entra (nunca troca por alguém pior).
  two = applyBattleToState(f, st, { [t]: hp(t, 0.4), [r1]: hp(r1, 0.3), [r2]: hp(r2, 0.2) });
  assert.equal(two.active[0], t);
  // Slot "até cair" nunca troca por vida.
  const s1 = f.slots[1].mascotIds[0];
  next = applyBattleToState(f, st, { [s1]: hp(s1, 0.1) });
  assert.equal(next.active[1], s1);
  // Sem oscilação: o ferido que saiu não volta enquanto a reserva está acima do limiar.
  let loop = applyBattleToState(f, st, { [t]: hp(t, 0.5) });
  loop = applyBattleToState(f, loop, { [r1]: hp(r1, 0.8) });
  assert.equal(loop.active[0], r1);
});

test("validação do limite de troca por vida", () => {
  const f: Formation = structuredClone(formation);
  f.slots[0].swapBelowPct = 5;
  assert.ok(validateFormation(f, pool).some((e) => e.includes("limite de troca")));
  f.slots[0].swapBelowPct = 55.5;
  assert.ok(validateFormation(f, pool).some((e) => e.includes("limite de troca")));
  f.slots[0].swapBelowPct = 70;
  assert.deepEqual(validateFormation(f, pool), []);
});

test("equipe sem mascotes perde sem luta e isso é registrado", () => {
  const players = Array.from({ length: 4 }, (_, i) => makeSimPlayer(i + 1, "BALANCED", "MEDIO", 0));
  // HP mínimo e limite longo: força esgotamento ao longo do dia.
  const sim = simulateWeek(players, { editionId: "exh", cfg: { hpMultiplier: 0.5, maxRounds: 150 } });
  assert.deepEqual(sim.metrics.errors, []);
  assert.ok(sim.metrics.emptyPctBySlot.some((v) => v > 0), "alguma rodada deve ter equipe zerada");
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

test("hpMultiplier escala o HP máximo do dia e maxRounds limita a luta", () => {
  const base = freshDayState(formation, pool);
  const tri = freshDayState(formation, pool, 3);
  const id = formation.slots[0].mascotIds[0];
  assert.equal(tri.mascots[id].max, Math.round(base.mascots[id].max * 3));
  assert.equal(tri.mascots[id].hp, tri.mascots[id].max);
  const players = Array.from({ length: 6 }, (_, i) => makeSimPlayer(i + 1, "BALANCED", "MEDIO", "KEEP"));
  const short = simulateWeek(players, { editionId: "cap", cfg: { maxRounds: 4, hpMultiplier: 3 } });
  assert.deepEqual(short.metrics.errors, []);
  const full = simulateWeek(players, { editionId: "cap" });
  assert.ok(short.metrics.avgKosPerMatch < full.metrics.avgKosPerMatch, "limite de rodadas + HP deve reduzir KOs");
});

test("Pressão/Calor só vêm de sequência de vitórias/derrotas, nunca da posição", () => {
  const cfg = mergeConfig({});
  const mk = (res: Record<string, Result>, prev: StandRow[] | null, score: Record<string, number>) =>
    buildStandings(["a", "b", "c", "d", "e"].map((pid) => ({ pid, name: pid, score: score[pid] ?? 0, wins: 0, losses: 0, draws: 0, byes: 0, damage: 0, lastResult: res[pid] ?? null })), prev, cfg);
  // "a" lidera desde a 1ª rodada (1 vitória): líder, mas sem sequência de 2 => nenhum ajuste.
  let rows = mk({ a: "W", e: "L" }, null, { a: 9000, b: 100 });
  const get = (pid: string) => rows.find((r) => r.pid === pid)!;
  assert.equal(get("a").rank, 1);
  assert.equal(modifierPct(get("a"), cfg), 0);
  assert.equal(modifierPct(get("e"), cfg), 0);
  // 2ª vitória seguida: −2%; 3ª: −4%; 5ª: limitado a −6%.
  rows = mk({ a: "W", e: "L" }, rows, { a: 9500 });
  assert.equal(modifierPct(get("a"), cfg), -2);
  assert.equal(modifierPct(get("e"), cfg), 2); // 2 derrotas seguidas: +2%
  rows = mk({ a: "W", e: "L" }, rows, { a: 9800 });
  assert.equal(modifierPct(get("a"), cfg), -4);
  assert.equal(modifierPct(get("e"), cfg), 4);
  rows = mk({ a: "W", e: "L" }, rows, { a: 9900 });
  rows = mk({ a: "W", e: "L" }, rows, { a: 9990 });
  assert.equal(modifierPct(get("a"), cfg), -6);
  assert.equal(modifierPct(get("e"), cfg), 4);
  // Folga mantém a sequência; empate zera; derrota/vitória quebra e o ajuste some.
  rows = mk({ a: "BYE" }, rows, { a: 9990 });
  assert.equal(modifierPct(get("a"), cfg), -6);
  rows = mk({ a: "L", e: "W" }, rows, { a: 9990 });
  assert.equal(modifierPct(get("a"), cfg), 0);
  assert.equal(modifierPct(get("e"), cfg), 0);
  // Quem está na base mas venceu a última NÃO ganha Calor só por posição.
  assert.equal(get("e").current, 0);
});
