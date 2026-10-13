/** Raid de Johto: npx tsx scripts/test-johto-raid.ts  (parte pura; --db também testa o UPDATE atômico num evento temporário) */
import assert from "node:assert/strict";
import { computeJohtoAwards, DEFAULT_JOHTO_REWARDS, JOHTO_LEADERS, readRewardConfig, simulateJohtoBattle, type JohtoMascotInput } from "../src/lib/johto-raid-sim";
import { mascotRaidPower } from "../src/lib/raid-event";

assert.equal(JOHTO_LEADERS.length, 8);
assert.equal(new Set(JOHTO_LEADERS.map((l) => l.key)).size, 8);
assert.deepEqual(readRewardConfig(null), DEFAULT_JOHTO_REWARDS);
assert.equal(readRewardConfig({ participationZc: -5 }).participationZc, DEFAULT_JOHTO_REWARDS.participationZc);

// Prêmios: top 3, maior golpe, mais ataques, presença e golpe final; quem não atacou não ganha.
const row = (id: string, dmg: number, atk: number, hit: number, fb = 0, leaders = 1) => ({ playerId: id, totalDamage: dmg, attackCount: atk, highestSingleDamage: hit, finalBlows: fb, leaders });
const { awards } = computeJohtoAwards([row("a", 900, 3, 400, 1, 4), row("b", 800, 9, 300, 0, 2), row("c", 100, 1, 50), row("d", 0, 0, 0)], DEFAULT_JOHTO_REWARDS);
const by = Object.fromEntries(awards.map((x) => [x.playerId, x]));
assert.equal(awards.length, 3, "só quem atacou recebe");
assert.ok(!by.d);
const c = DEFAULT_JOHTO_REWARDS;
assert.equal(by.a.zc, c.participationZc + c.topDamageZc[0] + c.biggestHitZc + c.mostLeadersZc + c.finalBlowZc);
assert.equal(by.b.zc, c.participationZc + c.topDamageZc[1] + c.mostAttacksZc);
assert.equal(by.c.zc, c.participationZc + c.topDamageZc[2]);

// Simulação: termina, causa dano e a vantagem de tipo importa (Gyarados/Pikachu contra Falkner/voador).
const mk = (id: string, pokemonId: number): JohtoMascotInput => ({ id, pokemonId, nickname: null, level: 60, statForce: 150, statAgility: 120, statInstinct: 120, statVitality: 140, statCharisma: 100 });
const run = (pokemonId: number, seed: number) => {
  let s = seed; const rng = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const team = Array.from({ length: 6 }, (_, i) => mk(`m${i}`, pokemonId));
  return simulateJohtoBattle(team, {}, { name: "Falkner", pokemonId: 18, type: "flying", position: 0, hpRemaining: 100_000_000, hpMax: 100_000_000 }, mascotRaidPower, rng);
};
const sum = (id: number) => Array.from({ length: 40 }, (_, i) => run(id, i + 1).rawDamage).reduce((a, b) => a + b, 0);
const electric = sum(25), normal = sum(143);
assert.ok(electric > normal, `elétrico (${electric}) deve causar mais que normal (${normal}) contra voador`);
const out = run(25, 7);
assert.ok(out.rawDamage > 0 && out.team.length === 6 && out.log.length > 0);
console.log("ok puro", { electric, normal });

if (process.argv.includes("--db")) {
  (async () => {
    const { config } = await import("dotenv"); config({ path: ".env.local" }); config();
    const { PrismaClient, Prisma } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const ev = await prisma.johtoRaidEvent.create({ data: { slug: `teste-${Date.now()}`, name: "teste", leaders: { create: [{ position: 0, key: "falkner", hpMax: 1000, hpCurrent: 1000 }] } }, include: { leaders: true } });
    try {
      const id = ev.leaders[0].id;
      const hit = (d: number) => prisma.$queryRaw<Array<{ before: number; after: number }>>(Prisma.sql`UPDATE johto_raid_leaders l SET "hpCurrent" = GREATEST(0, l."hpCurrent" - ${d}) FROM (SELECT id, "hpCurrent" AS before FROM johto_raid_leaders WHERE id = ${id} FOR UPDATE) p WHERE l.id = p.id RETURNING p.before AS before, l."hpCurrent" AS after`);
      const results = await Promise.all(Array.from({ length: 20 }, () => hit(70)));
      const rows = results.map((r) => r[0]);
      const final = await prisma.johtoRaidLeader.findUniqueOrThrow({ where: { id } });
      assert.equal(final.hpCurrent, 0, "20 x 70 > 1000 deve zerar");
      const killers = rows.filter((r) => r.before > 0 && r.after === 0);
      assert.equal(killers.length, 1, "exatamente um golpe final");
      assert.equal(rows.reduce((s, r) => s + (r.before - r.after), 0), 1000, "dano efetivo soma o HP exato (sem perda nem excesso)");
      console.log("ok db atômico");
    } finally {
      await prisma.johtoRaidEvent.delete({ where: { id: ev.id } });
      await prisma.$disconnect();
    }
  })().catch((e) => { console.error(e); process.exit(1); });
}
