/**
 * Efeitos novos de habilidades (planilha de planejamento, 2026-11): motor com host controlado.
 * Rodar: npx tsx scripts/test-abilities-new-effects.ts   (precisa do stub de server-only fora do Next)
 */
import assert from "node:assert/strict";
import type { ArenaMascot } from "../src/lib/arena-z";
import { ABILITIES } from "../src/lib/abilities/data.generated";
import { createAbilityEngine, type AbilityLineup } from "../src/lib/abilities/combat";
import { getAbilityInfo } from "../src/lib/abilities";

const mk = (id: string, name: string, types: string[], over: Partial<ArenaMascot> = {}): ArenaMascot => ({
  id, ownerId: "o", pokemonId: 25, name, types, level: 50, force: 200, agility: 100, instinct: 250, vitality: 250, charisma: 100, happiness: 70, hp: 1000, combatRole: "ATTACKER", personality: null, ...over,
});
const slugFor = (effect: string, param?: string) => {
  const hit = Object.entries(ABILITIES).find(([, d]) => d.effect === effect && (!param || (d.param ?? "").toLowerCase().includes(param)));
  assert.ok(hit, `sem habilidade com efeito ${effect}`);
  return hit[0];
};

function setup(opts: { A: ArenaMascot[]; D: ArenaMascot[]; lineup: AbilityLineup; rand?: () => number; round?: number; hp?: Record<string, number> }) {
  const hp = new Map<string, number>([...opts.A, ...opts.D].map((m) => [m.id, opts.hp?.[m.id] ?? m.hp]));
  let round = opts.round ?? 1;
  const engine = createAbilityEngine(opts.lineup, { attackers: opts.A, defenders: opts.D, hp, debuffs: new Map(), rand: opts.rand ?? (() => 0.01), typesOf: (m) => m.types, getRound: () => round });
  return { engine, hp, setRound: (r: number) => { round = r; } };
}
const L = (id: string, slug: string, factor = 1): AbilityLineup => ({ [id]: { slug, factor } });

// ── Poder puro (Pure Power): 2 golpes +35%, depois −15% até o fim ───────────────
{
  const a = mk("a", "Machamp", ["fighting"]), d = mk("d", "Alvo", ["normal"]);
  const { engine } = setup({ A: [a], D: [d], lineup: L("a", "pure-power") });
  const hit = () => engine.attackBonus({ actor: a, target: d, multiplier: 1, isLastOfSide: false });
  const offs = [hit().off, hit().off, hit().off, hit().off];
  assert.deepEqual(offs.map((v) => Math.round(v * 100)), [35, 35, -15, -15], `Pure Power: ${offs}`);
}

// ── Guarda absoluta (Wonder Guard): −30..40% sem vantagem; +50% se super efetivo ─
{
  const a = mk("a", "Atacante", ["fire"]), s = mk("s", "Shedinja", ["bug", "ghost"], { vitality: 250 });
  const { engine } = setup({ A: [a], D: [s], lineup: L("s", "wonder-guard") });
  const sup = engine.defense({ actor: a, target: s, multiplier: 1.4 });
  assert.equal(sup.factor, 1.5, "super efetivo = +50%");
  const normal = engine.defense({ actor: a, target: s, multiplier: 1 });
  assert.ok(Math.abs(normal.factor - 0.6) < 1e-9, `vit 250 => −40%: ${normal.factor}`);
  const resisted = engine.defense({ actor: a, target: s, multiplier: 0.8 });
  assert.ok(resisted.factor < 1, "resistido também reduz");
}

// ── Mira infalível (Mind's Eye): ignora Evasiva e confusão não o faz errar ───────
{
  const evasive = slugFor("EVASIVA");
  const a = mk("a", "Pidgeot", ["flying"]), d = mk("d", "Esquivo", ["normal"]);
  const base = setup({ A: [a], D: [d], lineup: L("d", evasive) });
  assert.ok(base.engine.defense({ actor: a, target: d, multiplier: 1 }).factor < 1, "Evasiva normalmente reduz o dano");
  const sure = setup({ A: [a], D: [d], lineup: { ...L("d", evasive), ...L("a", "minds-eye") } });
  const r = sure.engine.defense({ actor: a, target: d, multiplier: 1 });
  assert.equal(r.factor, 1, "Mira infalível ignora a esquiva");
  assert.ok(r.notes.some((n) => n.includes("ignorou a esquiva")));
}

// ── Despertar imediato (Early Bird): o sono não pega ────────────────────────────
{
  const spore = "effect-spore"; // 30%..: ao ser atingido, deixa o atacante paralisado/envenenado/dormindo (sorteado)
  const seq = () => { const q = [0.0, 0.5]; return () => (q.length ? q.shift()! : 0.0); }; // 1º: passa a chance; 2º: sorteia o 2º estado (dormindo)
  const bird = mk("a", "Doduo", ["normal", "flying"]), holder = mk("d", "Parasect", ["bug", "grass"]);
  const { engine } = setup({ A: [bird], D: [holder], lineup: { ...L("d", spore), ...L("a", "early-bird") }, rand: seq() });
  const notes = engine.afterHit({ actor: bird, target: holder, damage: 10 });
  assert.ok(notes.some((n) => n.includes("acordou na hora")), `esperava despertar imediato: ${notes.join(" | ")}`);
  assert.equal(engine.snapshot().status[bird.id], undefined, "nenhum estado de sono ficou ativo");
  // controle: sem Early Bird o sono pega
  const other = mk("c", "Normal", ["normal"]);
  const ctrl = setup({ A: [other], D: [holder], lineup: L("d", spore), rand: seq() });
  ctrl.engine.afterHit({ actor: other, target: holder, damage: 10 });
  assert.equal(ctrl.engine.snapshot().status[other.id]?.kind, "SLEEP", "controle: dormiu");
}

// ── Ventosa (Suction Cups): reduz a Agilidade do rival mais ágil ─────────────────
{
  const holder = mk("h", "Octillery", ["water"]);
  const slow = mk("s", "Lento", ["normal"], { agility: 50 }), fast = mk("f", "Rapido", ["normal"], { agility: 300 });
  const { engine } = setup({ A: [holder], D: [slow, fast], lineup: L("h", "suction-cups") });
  engine.onBattleStart();
  const logs = engine.flushStandalone();
  assert.equal(logs.length, 1);
  assert.equal(logs[0].target?.id, "f", "alvo = maior Agilidade");
  assert.ok(logs[0].text.includes("Agilidade"));
  assert.ok((logs[0].events ?? []).some((e) => e.kind === "APPLY" && e.targetId === "f" && e.stat === "agility"));
}

// ── Múmia (Mummy): anula a habilidade de quem ataca por 3 rodadas ────────────────
{
  const mummy = mk("m", "Cofagrigus", ["ghost"]), atk = mk("a", "Atacante", ["normal"]);
  const lineup = { ...L("m", "mummy"), ...L("a", slugFor("GOLPE_FELIZ")) };
  const { engine, setRound } = setup({ A: [atk], D: [mummy], lineup, rand: () => 0.0 });
  const hit = () => engine.attackBonus({ actor: atk, target: mummy, multiplier: 1, isLastOfSide: false });
  assert.ok(hit().off > 0, "antes da Múmia o golpe feliz funciona");
  const notes = engine.afterHit({ actor: atk, target: mummy, damage: 10 });
  assert.ok(notes.some((n) => n.includes("anulou")), `Múmia deveria anular: ${notes.join(" | ")}`);
  assert.equal(hit().off, 0, "habilidade anulada na rodada 1");
  setRound(3);
  assert.equal(hit().off, 0, "ainda anulada na rodada 3");
  setRound(4);
  assert.ok(hit().off > 0, "volta na rodada 4");
  // só uma vez por luta
  const again = engine.afterHit({ actor: atk, target: mummy, damage: 10 });
  assert.ok(!again.some((n) => n.includes("anulou")), "1 ativação por luta");
}

// ── Contra-vampirismo (Liquid Ooze): quem se cura ao atacar sofre o mesmo dano ────
{
  const ooze = mk("o", "Tentacruel", ["water", "poison"]), vamp = mk("v", "Vampiro", ["normal"]);
  const lineup = { ...L("o", "liquid-ooze"), ...L("v", slugFor("VAMPIRISMO")) };
  const { engine, hp } = setup({ A: [vamp], D: [ooze], lineup, hp: { v: 500 } });
  const before = hp.get("v")!;
  const notes = engine.afterHit({ actor: vamp, target: ooze, damage: 300 });
  const after = hp.get("v")!;
  const healed = notes.find((n) => n.includes("recuperou"));
  assert.ok(healed, "o roubo de vida acontece");
  assert.ok(notes.some((n) => n.includes("sofreu o mesmo valor de dano")), "Liquid Ooze devolve a cura como dano");
  assert.equal(after, before - 0, "curou X e perdeu X: HP líquido igual ao inicial");
  // controle: sem Liquid Ooze o HP sobe
  const ctrl = setup({ A: [vamp], D: [ooze], lineup: L("v", slugFor("VAMPIRISMO")), hp: { v: 500 } });
  ctrl.engine.afterHit({ actor: vamp, target: ooze, damage: 300 });
  assert.ok(ctrl.hp.get("v")! > 500, "controle: sem Liquid Ooze o HP sobe");
  // roubo de vida da postura Sanguinário
  const s = setup({ A: [vamp], D: [ooze], lineup: L("o", "liquid-ooze"), hp: { v: 800 } });
  s.engine.onLifesteal(vamp, 60);
  assert.equal(s.hp.get("v"), 740, "postura Sanguinário também é punida");
}

// ── Estrela da vitória (Victory Star): +2..5 pp na chance de habilidades dos aliados ─
{
  const lucky = slugFor("GOLPE_FELIZ"); // chance base 30%
  const a = mk("a", "Feliz", ["normal"]), v = mk("v", "Victini", ["psychic", "fire"], { instinct: 250 }), d = mk("d", "Alvo", ["normal"]);
  const rand = () => 0.33; // 33%: falha sem bônus (30%), passa com +5 pp (35%)
  const without = setup({ A: [a, v], D: [d], lineup: L("a", lucky), rand });
  assert.equal(without.engine.attackBonus({ actor: a, target: d, multiplier: 1, isLastOfSide: false }).off, 0, "sem Victory Star falha");
  const withStar = setup({ A: [a, v], D: [d], lineup: { ...L("a", lucky), ...L("v", "victory-star") }, rand });
  assert.ok(withStar.engine.attackBonus({ actor: a, target: d, multiplier: 1, isLastOfSide: false }).off > 0, "com Victory Star passa");
  const info = getAbilityInfo("victory-star")!;
  assert.equal(info.min, 0.02);
  assert.equal(info.max, 0.05);
}

// ── Ajustes de valores (planilha) ───────────────────────────────────────────────
{
  const pct = (slug: string) => { const i = getAbilityInfo(slug)!; return [i.min! * 100, i.max! * 100]; };
  assert.deepEqual(pct("marvel-scale"), [10, 15]);
  assert.deepEqual(pct("toxic-debris"), [6, 10]);
  assert.deepEqual(pct("multiscale"), [12, 25]);
  assert.deepEqual(pct("perish-body"), [8, 15]);
  assert.deepEqual(pct("levitate"), [20, 30]);
}
console.log("OK: efeitos novos de habilidades");
