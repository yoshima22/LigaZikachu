/** Oportunista: npx tsx scripts/test-opportunist.ts */
import assert from "node:assert/strict";
import { splitOpportunistDebuff } from "../src/lib/combat-roles";
import { runArenaCombat, type ArenaMascot } from "../src/lib/arena-z";

const pcts = (t: number) => splitOpportunistDebuff(t).map((p) => `${p.stat}:${Math.round(p.pct * 100)}`);
assert.deepEqual(pcts(0.48), ["agility:24", "vitality:24"]);
assert.deepEqual(pcts(0.17), ["agility:9", "vitality:8"]);
assert.deepEqual(pcts(0.001), []);

const mk = (id: string, pokemonId: number, role: ArenaMascot["combatRole"], force: number, vit: number): ArenaMascot => ({
  id, ownerId: id[0], pokemonId, name: id, types: ["normal"], level: 50, force, agility: 100, vitality: vit, instinct: 150, charisma: 100,
  happiness: 70, hp: 400 + vit * 4, combatRole: role, personality: null,
});
const A = [mk("a1", 143, "OPPORTUNIST", 150, 150), mk("a2", 149, "OPPORTUNIST", 150, 150)];
const B = [mk("b1", 445, "ATTACKER", 150, 200), mk("b2", 6, "ATTACKER", 150, 200)];
const r = runArenaCombat(A, B, { seed: 3 });
const atk = r.log.filter((e) => e.action === "ATTACK" && e.actorId[0] === "a" && e.damage > 0);
assert.ok(atk.length > 0);
for (const e of atk) assert.ok((e.effect ?? "").includes("Oportunista reduziu Agilidade"), `ataque sem debuff: ${e.effect}`);
const d = r.runtime.debuffs;
for (const v of Object.values(d)) for (const k of Object.keys(v)) assert.ok(k === "agility" || k === "vitality", `atributo inesperado ${k}`);
console.log("ok", atk.length, "ataques com debuff");
