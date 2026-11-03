import assert from "node:assert/strict";
import test from "node:test";
import { createStanceEngine, StanceEngine, type StanceMascot } from "./stance-effects";
import { runLeagueCombat, type LeagueMascot } from "./league-combat";
import type { ArenaMascot } from "./arena-z";

const m = (id: string, role: string, extra: Partial<StanceMascot> = {}): StanceMascot => ({
  id, name: id, level: 50, combatRole: role, hp: 1000, force: 200, agility: 200, instinct: 200, vitality: 200, charisma: 200, ...extra,
});
/** Primeira metade da lista = lado A, o resto = lado B. */
const mk = (list: StanceMascot[]) => {
  const hp = new Map(list.map((x) => [x.id, x.hp]));
  const half = Math.ceil(list.length / 2);
  const A = list.slice(0, half), B = list.slice(half);
  return { hp, eng: new StanceEngine(hp, { A, B }), A, B };
};

test("sem postura desbloqueável o motor nem é criado", () => {
  assert.equal(createStanceEngine(new Map(), { A: [m("a", "ATTACKER")], B: [m("b", "DEFENDER")] }), null);
});

test("Executor executa abaixo do limiar, só uma vez por round", () => {
  const { hp, eng, A, B } = mk([m("ex", "EXECUTOR"), m("e1", "DEFENDER")]);
  eng.roundStart(1, new Map());
  hp.set("e1", 100);
  assert.equal(eng.preHit(A[0], B[0], 5).damage, 100);
  assert.equal(eng.preHit(A[0], B[0], 5).damage, 5);
  eng.roundStart(2, new Map());
  hp.set("e1", 900);
  assert.equal(eng.preHit(A[0], B[0], 5).damage, 5);
});

test("Armadilheiro desliga bônus inimigos nos rounds 3 e 5 e só neles", () => {
  const { hp, eng, A, B } = mk([m("tr", "TRAPPER"), m("ex", "EXECUTOR")]);
  for (const [round, blocked] of [[1, false], [3, true], [4, false], [5, true]] as const) {
    eng.roundStart(round, new Map());
    hp.set("tr", 100);
    eng.state.execUsed = [];
    assert.equal(eng.preHit(B[0], A[0], 5).damage === 100, !blocked, `round ${round}`);
  }
});

test("Acumulador carrega 1 por round, libera na 4ª ação e zera", () => {
  const { eng, A, B } = mk([m("ac", "ACCUMULATOR"), m("e", "DEFENDER")]);
  const mults: number[] = [];
  for (let r = 1; r <= 4; r++) {
    eng.roundStart(r, new Map());
    mults.push(eng.beginAttack(A[0], B, B[0]).dmgMult);
    eng.roundEnd();
  }
  assert.deepEqual(mults.slice(0, 3), [1, 1, 1]);
  assert.ok(mults[3] > 1.15 && mults[3] <= 1.35);
  eng.roundStart(5, new Map());
  assert.equal(eng.beginAttack(A[0], B, B[0]).dmgMult, 1);
});

test("Explosivo: 3º ataque mira só o mais ágil, soma 100% da vida e se sacrifica", () => {
  const { hp, eng, A, B } = mk([m("bo", "EXPLOSIVE"), m("ally", "ATTACKER"), m("slow", "DEFENDER", { agility: 10 }), m("fast", "DEFENDER", { agility: 300 })]);
  eng.roundStart(1, new Map());
  const foes = B;
  assert.equal(eng.beginAttack(A[0], foes, foes[0]).target, null);
  eng.postHit(A[0], foes[0], 10);
  assert.equal(eng.beginAttack(A[0], foes, foes[0]).target, null);
  eng.postHit(A[0], foes[0], 10);
  const third = eng.beginAttack(A[0], foes, foes[0]);
  assert.equal(third.target?.id, "fast");
  assert.equal(third.rawAdd, 1000);
  const post = eng.postHit(A[0], foes[1], 400);
  assert.equal(hp.get("bo"), 0);
  assert.ok(post.reactions.some((r) => r.kind === "SELF_KO"));
  assert.equal(post.reactions.some((r) => r.kind === "HIT"), false, "a explosão não pode atingir os outros inimigos");
});

test("Sanguinário cura, limitado a 8% do HP máximo por round e reduzido pela Ferida", () => {
  const { hp, eng, A, B } = mk([m("bl", "BLOODTHIRSTY"), m("e", "DEFENDER")]);
  eng.roundStart(1, new Map());
  hp.set("bl", 500);
  const r1 = eng.postHit(A[0], B[0], 1000).reactions.find((r) => r.kind === "HEAL")!;
  assert.equal(r1.amount, 80);
  assert.equal(eng.postHit(A[0], B[0], 1000).reactions.some((r) => r.kind === "HEAL"), false);
  eng.roundStart(2, new Map());
  eng.state.wound.bl = { pct: 0.5, until: 3 };
  const r2 = eng.postHit(A[0], B[0], 200).reactions.find((r) => r.kind === "HEAL")!;
  assert.ok(r2.amount > 0 && r2.amount <= 200 * 0.2 * 0.5);
});

test("Corrosivo fere o alvo; a cura recebida cai até o fim do próximo round", () => {
  const { eng, A, B } = mk([m("co", "CORROSIVE"), m("e", "DEFENDER")]);
  eng.roundStart(1, new Map());
  eng.postHit(A[0], B[0], 50);
  const f = eng.healFactor("e");
  assert.ok(f < 1 && f >= 0.4 - 1e-9);
  eng.roundStart(2, new Map());
  assert.equal(eng.healFactor("e"), f);
  eng.roundStart(3, new Map());
  assert.equal(eng.healFactor("e"), 1);
});

test("Inabalável renova escudo de 5% que absorve dano", () => {
  const { eng, A, B } = mk([m("un", "UNSHAKABLE"), m("e", "DEFENDER")]);
  eng.roundStart(1, new Map());
  eng.postHit(A[0], B[0], 10);
  assert.equal(eng.state.shield.un, 50);
  assert.equal(eng.preHit(B[0], A[0], 80).damage, 30);
  assert.equal(eng.preHit(B[0], A[0], 80).damage, 80);
});

test("Fortaleza ganha Vitalidade/Instinto e perde Força, com teto de 20%", () => {
  const { eng, A, B } = mk([m("fo", "FORTRESS"), m("e", "DEFENDER")]);
  eng.roundStart(1, new Map());
  for (let i = 0; i < 30; i++) eng.postHit(B[0], A[0], 1);
  assert.equal(eng.statMult("fo", "vitality"), 1.2);
  assert.equal(eng.statMult("fo", "instinct"), 1.2);
  assert.equal(eng.statMult("fo", "force"), 0.8);
});

test("Artilheiro: 1º ataque do round atinge o inimigo de menor HP; Revidador revida uma vez", () => {
  const { hp, eng, A, B } = mk([m("ar", "ARTILLERY"), m("re", "RETRIBUTOR"), m("t1", "DEFENDER"), m("t2", "DEFENDER")]);
  eng.roundStart(1, new Map());
  hp.set("t2", 300);
  const splash = eng.postHit(A[0], B[0], 100).reactions.find((r) => r.kind === "HIT")!;
  assert.equal(splash.targetId, "t2");
  assert.ok(splash.amount >= 7 && splash.amount <= 11);
  assert.equal(eng.postHit(A[0], B[0], 100).reactions.length, 0);
  hp.set("re", 840);
  const first = eng.postHit(B[0], A[1], 160);
  const second = eng.postHit(B[1], A[1], 50);
  assert.equal(first.reactions.filter((r) => r.actorId === "re").length, 1);
  assert.equal(first.reactions.find((r) => r.actorId === "re")!.targetId, "t1");
  assert.equal(second.reactions.length, 0);
});

test("Comandante: primeiro K.O. cria ordem; aliado foca o inimigo de menor HP uma vez", () => {
  const { hp, eng, A, B } = mk([m("cm", "COMMANDER"), m("al", "ATTACKER"), m("x", "ATTACKER"), m("e1", "DEFENDER"), m("e2", "DEFENDER"), m("e3", "DEFENDER")]);
  eng.roundStart(1, new Map());
  hp.set("e1", 0); hp.set("e3", 400);
  const post = eng.postHit(A[0], B[0], 100);
  assert.ok(post.notes.some((n) => n.includes("ordem")));
  const foes = [B[1], B[2]];
  assert.equal(eng.beginAttack(A[1], foes, foes[0]).target?.id, "e3");
  assert.equal(eng.beginAttack(A[1], foes, foes[0]).target, null);
});

test("Estrategista marca; primeiro aliado que acerta o alvo ganha Agilidade (máx 20%)", () => {
  const { eng, A, B } = mk([m("st", "STRATEGIST"), m("al", "ATTACKER"), m("e1", "DEFENDER"), m("e2", "DEFENDER")]);
  eng.roundStart(1, new Map());
  eng.postHit(A[0], B[0], 10);
  eng.postHit(A[1], B[0], 10);
  const bonus = eng.statMult("al", "agility");
  assert.ok(bonus > 1.009 && bonus <= 1.02);
  for (let r = 2; r < 12; r++) { eng.roundStart(r, new Map()); eng.postHit(A[0], B[0], 1); eng.postHit(A[1], B[0], 1); }
  assert.ok(eng.statMult("al", "agility") <= 1.2 + 1e-9);
});

test("Purificador remove até 2 reduções de Oportunista do aliado mais ferido e ganha Agilidade", () => {
  const { hp, eng } = mk([m("pu", "PURIFIER"), m("al", "ATTACKER"), m("e", "OPPORTUNIST")]);
  hp.set("al", 100);
  const debuffs = new Map([["al", { agility: 0.1, vitality: 0.1, force: 0.2 }]]);
  eng.tagOpportunist("al");
  eng.roundStart(1, debuffs as never);
  assert.deepEqual(debuffs.get("al"), { force: 0.2 });
  assert.ok(eng.statMult("pu", "agility") > 1);
});

// ── Integração com os motores ────────────────────────────────────────────────
const league = (id: string, owner: string, role: string): LeagueMascot => ({
  id, ownerId: owner, pokemonId: 25, types: ["electric"], name: id, level: 60, force: 150, agility: 150, instinct: 150,
  vitality: 150, charisma: 150, hp: 900, combatRole: role as never, slot: 1, personality: null,
});
const ROLES: Record<string, string> = {
  EXECUTOR: "Executor", COMMANDER: "Comandante", PURIFIER: "Purificador", BLOODTHIRSTY: "Sanguinário", ARTILLERY: "Artilheiro",
  RETRIBUTOR: "Revidador", CORROSIVE: "Corrosivo", STRATEGIST: "Estrategista", UNSHAKABLE: "Inabalável", FORTRESS: "Fortaleza",
  ACCUMULATOR: "Acumulador", EXPLOSIVE: "Explosivo", TRAPPER: "Armadilheiro",
};

test("Liga: cada postura entra em combate real sem quebrar e deixa rastro no log", () => {
  const seen = new Set<string>();
  for (let run = 0; run < 60; run++) for (const [role, label] of Object.entries(ROLES)) {
    const a = [league("a1", "pa", role), league("a2", "pa", "ATTACKER"), league("a3", "pa", "HEALER")];
    const b = [league("b1", "pb", "DEFENDER"), league("b2", "pb", "OPPORTUNIST"), league("b3", "pb", "ATTACKER")];
    const res = runLeagueCombat(a, b);
    assert.ok(res.rounds > 0);
    for (const e of res.log) {
      assert.ok(Number.isFinite(e.damage));
      if ((e.effect ?? "").includes(label)) seen.add(role);
    }
  }
  // Armadilheiro e Purificador só agem de forma visível em situações específicas; as outras 11 precisam deixar rastro.
  for (const role of Object.keys(ROLES).filter((r) => r !== "TRAPPER" && r !== "PURIFIER")) assert.ok(seen.has(role), `${role} nunca apareceu no log`);
});

test("Liga: combate sem posturas desbloqueáveis não gera eventos de reação", () => {
  for (let i = 0; i < 20; i++) {
    const res = runLeagueCombat([league("a", "pa", "ATTACKER"), league("a2", "pa", "HEALER")], [league("b", "pb", "DEFENDER"), league("b2", "pb", "OPPORTUNIST")]);
    assert.equal(res.log.some((e) => e.reaction), false);
  }
});

test("Liga: HP reconstruído pelo log fecha com o HP final do combate", () => {
  for (let run = 0; run < 40; run++) for (const role of ["ARTILLERY", "RETRIBUTOR", "EXPLOSIVE", "BLOODTHIRSTY", "UNSHAKABLE", "EXECUTOR"]) {
    const a = [league("a1", "pa", role), league("a2", "pa", "ATTACKER")];
    const b = [league("b1", "pb", "DEFENDER"), league("b2", "pb", "ATTACKER")];
    const res = runLeagueCombat(a, b, null, [], [], { includeFinalHp: true });
    const all = [...res.lineupA, ...res.lineupB];
    const hp = new Map(all.map((x) => [x.id, x.hp]));
    for (const e of res.log) {
      if (!e.turn) continue;
      const max = all.find((x) => x.id === e.targetId)!.hp;
      if (e.action === "HEAL") hp.set(e.targetId, Math.min(max, (hp.get(e.targetId) ?? 0) + e.damage));
      else if (e.action === "ATTACK") hp.set(e.targetId, Math.max(0, (hp.get(e.targetId) ?? 0) - e.damage));
    }
    for (const [id, final] of Object.entries(res.finalHpById ?? {})) assert.equal(hp.get(id), final, `${role}: ${id}`);
  }
});

test("Arena-Z: posturas entram no motor e o runtime guarda o estado", async (t) => {
  // arena-z importa módulos "server-only" do Next; fora do Next o import falha e o teste é pulado.
  const arenaMod = await import("./arena-z").catch(() => null);
  if (!arenaMod) return t.skip("arena-z indisponível fora do Next");
  const { runArenaCombat } = arenaMod;
  const arena = (id: string, owner: string, role: string): ArenaMascot => ({
    id, ownerId: owner, pokemonId: 25, types: ["electric"], name: id, level: 60, force: 150, agility: 150, instinct: 150,
    vitality: 150, charisma: 150, happiness: 100, hp: 900, combatRole: role as never, personality: null,
  });
  let hadStance = false;
  for (const role of Object.keys(ROLES)) {
    const res = runArenaCombat([arena("a1", "pa", role), arena("a2", "pa", "ATTACKER")], [arena("b1", "pb", "DEFENDER"), arena("b2", "pb", "ATTACKER")]);
    assert.ok(res.log.length > 0);
    if (res.runtime.stance) hadStance = true;
  }
  assert.ok(hadStance);
});
