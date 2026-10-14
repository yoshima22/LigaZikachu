/** Verificação do motor de habilidades: npx tsx scripts/test-abilities-engine.ts */
import assert from "node:assert/strict";
import { runArenaCombat, type ArenaMascot } from "../src/lib/arena-z";
import { evaluateTeamAbilities, getAbilityInfo, resolveAbilitySlug } from "../src/lib/abilities";
import type { AbilityLineup } from "../src/lib/abilities/combat";

const base = { ownerId: "o", happiness: 70, charisma: 120, instinct: 120 };
const mk = (id: string, pokemonId: number, name: string, types: string[], role: ArenaMascot["combatRole"], force: number, vitality: number, agility = 100): ArenaMascot => ({
  ...base, id, pokemonId, name, types, level: 50, force, agility, vitality, hp: 55 + 50 * 6 + vitality * 4, combatRole: role, personality: null,
});
const A = [
  mk("a1", 130, "Gyarados", ["water", "flying"], "ATTACKER", 220, 150),
  mk("a2", 25, "Pikachu", ["electric"], "FLANK", 150, 90, 160),
  mk("a3", 6, "Charizard", ["fire", "flying"], "ATTACKER", 200, 130),
  mk("a4", 143, "Snorlax", ["normal"], "DEFENDER", 140, 220),
];
const B = [
  mk("b1", 448, "Lucario", ["fighting", "steel"], "OPPORTUNIST", 210, 140),
  mk("b2", 445, "Garchomp", ["dragon", "ground"], "ATTACKER", 230, 150),
  mk("b3", 149, "Dragonite", ["dragon", "flying"], "ATTACKER", 220, 160),
  mk("b4", 212, "Scizor", ["bug", "steel"], "DEFENDER", 170, 190),
];
const pick = (id: number, choice?: string) => resolveAbilitySlug({ pokemonId: id, choice, hiddenUnlocked: true, mode: "REAL" });
const lineup = (team: ArenaMascot[], choices: Record<number, string> = {}): AbilityLineup => {
  const slugs = team.map((m) => pick(m.pokemonId, choices[m.pokemonId]));
  const slots = evaluateTeamAbilities(slugs);
  return Object.fromEntries(team.map((m, i) => [m.id, { slug: slugs[i] ?? "", factor: slots[i].factor }]).filter(([, v]) => (v as { slug: string }).slug));
};
const cfg: AbilityLineup = { ...lineup(A, { 130: "intimidate", 25: "static", 6: "blaze", 143: "thick-fat" }), ...lineup(B, { 448: "justified", 445: "rough-skin", 149: "multiscale", 212: "technician" }) };

// 1) Sem habilidades o resultado é idêntico (regressão para os outros modos).
const plain = runArenaCombat(A, B, { seed: 7 });
const empty = runArenaCombat(A, B, { seed: 7, abilities: {} });
// (o engine só acrescenta dados de debuff e texto; números e ordem têm de ser os mesmos)
const core = (log: typeof plain.log) => log.map((e) => [e.turn, e.actorId, e.targetId, e.action, e.damage, e.targetHpAfter]);
assert.deepEqual(core(empty.log), core(plain.log), "engine vazio não pode mudar o combate");

// 2) Com habilidades: roda até o fim, respeita ativações e registra debuffs com origem.
const full = runArenaCombat(A, B, { seed: 7, abilities: cfg });
assert.ok(full.finished, "luta deve terminar");
const uses = full.runtime.abilities!.uses;
for (const [id, n] of Object.entries(uses)) {
  const slug = cfg[id].slug;
  const info = getAbilityInfo(slug)!;
  assert.ok(info.activations === 0 || n <= info.activations, `${id}/${slug}: ${n} ativações > limite ${info.activations}`);
}
for (const e of full.log) assert.ok(e.damage >= 0 && e.damage < 100000);
const dbg = full.log.flatMap((e) => e.debuffEvents ?? []);
assert.ok(dbg.some((d) => d.label.includes("Intimidate") && d.stat === "force" && d.kind === "APPLY"), "Intimidate deve gerar debuff de Força com origem");
for (const d of dbg) assert.ok(d.pct <= 0.2 + 1e-9, `debuff acima de 20%: ${d.pct}`);
assert.ok(full.log.some((e) => e.action === "ABILITY"), "deve haver eventos de habilidade");
const stepIds = new Set<string>();
for (const e of full.log) stepIds.add(e.actorId);
assert.ok(full.log.every((e) => e.turn >= 1));

// 3) Retomar por segmentos dá o mesmo resultado da luta inteira (janelas do Draft).
let runtime = undefined as typeof full.runtime | undefined;
const parts: typeof full.log = [];
for (const stop of [20, 35, 45, undefined]) {
  const seg = runArenaCombat(A, B, { seed: 7, abilities: cfg, runtime, stopAtTurn: stop });
  parts.push(...seg.log);
  runtime = seg.runtime;
  if (seg.finished) break;
}
assert.deepEqual(parts.map((e) => [e.turn, e.actorId, e.targetId, e.damage, e.action]), full.log.map((e) => [e.turn, e.actorId, e.targetId, e.damage, e.action]), "segmentos devem reproduzir a luta inteira");

// 3b) Efeitos novos (ex-"sem efeito"): rodam sem estourar limites e geram eventos.
const cfg2: AbilityLineup = {
  a1: { slug: "bad-dreams", factor: 1 }, a2: { slug: "serene-grace", factor: 1 }, a3: { slug: "slow-start", factor: 1 }, a4: { slug: "magician", factor: 1 },
  b1: { slug: "air-lock", factor: 1 }, b2: { slug: "dark-aura", factor: 1 }, b3: { slug: "truant", factor: 1 }, b4: { slug: "pickpocket", factor: 0.7 },
};
const novo = runArenaCombat(A, B, { seed: 11, abilities: cfg2 });
assert.ok(novo.finished);
for (const [id, n] of Object.entries(novo.runtime.abilities!.uses)) {
  const info = getAbilityInfo(cfg2[id].slug)!;
  assert.ok(n <= info.activations, `${id}/${cfg2[id].slug}: ${n} > ${info.activations}`);
}
assert.ok(novo.log.every((e) => e.targetHpAfter === undefined || e.targetHpAfter >= 0));
for (const m of [...A, ...B]) assert.ok((novo.runtime.hp[m.id] ?? 0) <= m.hp, "HP acima do máximo");

// 3c) Estados alterados: aparecem, respeitam imunidades de tipo/habilidade e nunca acumulam.
const statusCfg: AbilityLineup = {
  a1: { slug: "flame-body", factor: 1 }, a2: { slug: "static", factor: 1 }, a3: { slug: "poison-point", factor: 1 }, a4: { slug: "effect-spore", factor: 1 },
  b1: { slug: "poison-touch", factor: 1 }, b2: { slug: "cursed-body", factor: 1 }, b3: { slug: "guts", factor: 1 }, b4: { slug: "insomnia", factor: 1 },
};
const kinds = new Set<string>();
for (let seed = 1; seed <= 80; seed++) {
  const run = runArenaCombat(A, B, { seed, abilities: statusCfg });
  assert.ok(run.finished, "luta com estados deve terminar");
  const text = run.log.filter((e) => e.action === "ABILITY").map((e) => e.effect ?? "").join(" | ");
  for (const k of ["queimado", "paralisado", "envenenado", "dormindo", "confuso", "amaldiçoado"]) if (text.includes(k)) kinds.add(k);
  assert.ok(!text.includes("Pikachu ficou paralisado"), "Elétrico é imune a paralisia");
  assert.ok(!text.includes("Charizard ficou queimado"), "Fogo é imune a queimadura");
  assert.ok(!text.includes("Scizor ficou envenenado"), "Metal/Veneno são imunes a veneno");
  assert.ok(!text.includes("Scizor ficou dormindo"), "Insomnia impede o sono");
  for (const e of run.log) assert.ok(e.targetHpAfter === undefined || e.targetHpAfter >= 0, "HP nunca fica negativo");
  for (const m of [...A, ...B]) assert.ok((run.runtime.hp[m.id] ?? 0) <= m.hp && (run.runtime.hp[m.id] ?? 0) >= 0);
  const st = run.runtime.abilities!.status;
  for (const [id, v] of Object.entries(st)) assert.ok(v.until >= v.since, `estado inválido em ${id}`);
}
assert.ok(kinds.size >= 4, `os estados devem aparecer nas lutas (viu: ${[...kinds].join(", ")})`);

// 3d) Retomar por segmentos com estados dá o mesmo resultado da luta inteira.
{
  const whole = runArenaCombat(A, B, { seed: 5, abilities: statusCfg });
  let rt2 = undefined as typeof whole.runtime | undefined;
  const parts2: typeof whole.log = [];
  for (const stop of [12, 25, undefined]) {
    const seg = runArenaCombat(A, B, { seed: 5, abilities: statusCfg, runtime: rt2, stopAtTurn: stop });
    parts2.push(...seg.log);
    rt2 = seg.runtime;
    if (seg.finished) break;
  }
  assert.deepEqual(parts2.map((e) => [e.turn, e.actorId, e.targetId, e.damage, e.action]), whole.log.map((e) => [e.turn, e.actorId, e.targetId, e.damage, e.action]), "segmentos com estados devem reproduzir a luta inteira");
}

// 4) Limite de time: 3º Dano desligado, 2º reduzido.
const ev = evaluateTeamAbilities(["blaze", "moxie", "technician", "static"]);
assert.deepEqual(ev.map((s) => s.state), ["ACTIVE", "REDUCED", "OFF", "ACTIVE"]);
assert.equal(ev[1].factor, 0.7);
assert.deepEqual(evaluateTeamAbilities(["sturdy", "sturdy"]).map((s) => s.state), ["ACTIVE", "OFF"]);

console.log(`ok: ${full.log.length} eventos, ${dbg.length} debuffs, ativações`, uses);

if (process.env.PEEK) for (const e of full.log.filter((x) => x.action === "ABILITY" || (x.effect ?? "").includes("✨"))) console.log(`T${e.turn} ${e.actorName}→${e.targetName} [${e.action}] ${e.damage}: ${e.effect}`);
