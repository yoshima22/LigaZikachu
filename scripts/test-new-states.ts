// Estados novos: Congelado em acúmulos, Amendrontado, Condenado. npx tsx scripts/test-new-states.ts
import assert from "node:assert/strict";
import { createAbilityEngine } from "../src/lib/abilities/combat";

const mk = (id: string, name: string, types: string[]) => ({ id, name, types, hp: 100, force: 100, agility: 100, charisma: 100, instinct: 100, vitality: 100, level: 50, ownerId: id, combatRole: "ATTACKER" }) as any;
function setup(cfg: Record<string, { slug: string; factor: number; typeChoice?: string }>) {
  const a = mk("a", "Aqua", ["ice"]), b = mk("b", "Bolt", ["electric"]);
  const hp = new Map([["a", 100], ["b", 100]]);
  let round = 1;
  const host: any = { attackers: [a], defenders: [b], hp, debuffs: new Map(), rand: () => 0, typesOf: (m: any) => m.types, getRound: () => round };
  const eng = createAbilityEngine(cfg, host);
  return { a, b, hp, eng, debuffs: host.debuffs as Map<string, any>, setRound: (r: number) => { round = r; } };
}

// Congelado: 3 acúmulos (rodadas 1-3 do granizo) -> trava na rodada 4 -> some na 5.
{
  const t = setup({ a: { slug: "snow-warning", factor: 1 } });
  t.eng.onBattleStart();
  t.setRound(1); t.eng.onRoundStart(1);
  t.setRound(2); assert.equal(Math.round((1 - t.eng.agilityMult("b")) * 100), 10, "1 acúmulo ativo na rodada 2 = -10% de Agilidade");
  assert.equal(Math.round((1 - t.eng.statMult("b", "force")) * 100), 5, "e -5% de Força");
  t.eng.onRoundStart(2);
  t.setRound(3); t.eng.onRoundStart(3);
  t.setRound(4); t.eng.onRoundStart(4);
  assert.equal(t.eng.onActionStart(t.b, 0).skip, true, "3 acúmulos: perde a rodada 4");
  assert.ok(t.eng.flushStandalone().some((e) => /totalmente congelado/.test(e.text)));
  t.setRound(5); t.eng.onRoundStart(5);
  assert.equal(t.eng.onActionStart(t.b, 0).skip, false, "o gelo some depois da rodada travada");
  assert.equal(t.eng.agilityMult("b"), 1);
}

// Amendrontado (Stench): só pega quem ainda não agiu na rodada.
{
  const t = setup({ a: { slug: "stench", factor: 1 } });
  t.eng.onBattleStart(); t.setRound(1); t.eng.onRoundStart(1);
  t.eng.afterHit({ actor: t.a, target: t.b, damage: 10 }); // b ainda não agiu
  assert.equal(t.eng.onActionStart(t.b, 0).skip, true);
  t.setRound(2); t.eng.onRoundStart(2);
  t.eng.onActionStart(t.b, 0); // b age primeiro
  t.eng.afterHit({ actor: t.a, target: t.b, damage: 10 });
  assert.equal(t.eng.onActionStart(t.b, 1).skip, false, "já agiu: não perde a ação");
}

// Condenado (Perish Body): o 1º atacante cai 1 rodada depois do portador.
{
  const t = setup({ b: { slug: "perish-body", factor: 1 } });
  t.eng.onBattleStart(); t.setRound(1); t.eng.onRoundStart(1);
  t.eng.afterHit({ actor: t.a, target: t.b, damage: 10 }); // a ataca o portador b
  t.hp.set("b", 0);
  t.eng.afterHit({ actor: t.a, target: t.b, damage: 10 }); // b cai
  t.setRound(2); t.eng.onRoundStart(2);
  assert.equal(t.hp.get("a"), 0, "o condenado cai 1 rodada depois");
}
// Buffs de atributo (Pokédex): passivo, ao abater, Download, Firme, Pressão.
{
  const t = setup({ a: { slug: "huge-power", factor: 1 } });
  t.eng.onBattleStart();
  assert.ok(t.eng.statMult("a", "force") > 1, "Huge Power sobe a Força");
  assert.equal(t.eng.statMult("a", "instinct"), 1);
}
{
  const t = setup({ a: { slug: "moxie", factor: 1 } });
  t.eng.onBattleStart(); t.setRound(1); t.eng.onRoundStart(1);
  t.hp.set("b", 0);
  t.eng.afterHit({ actor: t.a, target: t.b, damage: 10 });
  assert.ok(t.eng.statMult("a", "force") > 1, "Moxie: Força sobe ao derrotar");
}
{
  const t = setup({ a: { slug: "download", factor: 1 } });
  t.eng.onBattleStart();
  assert.ok(t.eng.statMult("a", "force") > 1, "Download: Vitalidade <= Carisma do rival sobe a Força");
}
{
  const t = setup({ a: { slug: "arena-trap", factor: 1 }, b: { slug: "suction-cups", factor: 1 } });
  t.eng.onBattleStart();
  assert.equal(t.debuffs.get("b")?.agility ?? 0, 0, "Suction Cups: imune a redução de Agilidade");
  const u = setup({ a: { slug: "arena-trap", factor: 1 } });
  u.eng.onBattleStart();
  assert.ok((u.debuffs.get("b")?.agility ?? 0) > 0, "Arena Trap reduz a Agilidade do rival mais rápido");
}
// Ditto (Transform): assume sprite e tipos do rival mais forte. Mew (Mimic): copia a habilidade de quem ataca.
{
  const t = setup({ a: { slug: "transform", factor: 1 } });
  (t.b as any).pokemonId = 25; (t.b as any).force = 999;
  t.eng.onBattleStart(); t.setRound(1); t.eng.onRoundStart(1);
  t.eng.onActionStart(t.a, 0);
  const ev = t.eng.flushStandalone().find((e) => e.transform);
  assert.equal(ev?.transform?.pokemonId, 25, "Ditto assume o sprite do rival mais forte");
  assert.deepEqual(t.a.types, t.b.types, "e os tipos dele");
  assert.equal(t.a.force, 100, "mantendo os próprios atributos");
}
{
  const t = setup({ a: { slug: "mimic", factor: 1 }, b: { slug: "huge-power", factor: 1 } });
  t.eng.onBattleStart(); t.setRound(1); t.eng.onRoundStart(1);
  t.eng.afterHit({ actor: t.a, target: t.b, damage: 10 });
  assert.equal(t.eng.snapshot().copied.a, "huge-power", "Mew copiou a habilidade do atacado");
}
// Tipo à escolha (Arceus/Silvally): o tipo do card vale em combate.
{
  const t = setup({ a: { slug: "multitype", factor: 1, typeChoice: "fire" } });
  t.eng.onBattleStart();
  assert.deepEqual(t.a.types, ["fire"]);
  const u = setup({ a: { slug: "intimidate", factor: 1, typeChoice: "fire" } });
  u.eng.onBattleStart();
  assert.deepEqual(u.a.types, ["ice"], "sem a habilidade de tipo à escolha, o tipo não muda");
}
console.log("ok");
