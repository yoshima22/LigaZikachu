/** Raid de Johto: npx tsx scripts/test-johto-raid.ts [--db]  (--db roda um fluxo completo no banco com contas temporárias, apagadas no fim) */
import assert from "node:assert/strict";
import {
  applyComboBonus, buildLeaderTeam, comboBonusPct, computeLeaderRewards, DEFAULT_JOHTO_REWARDS, getJohtoLeader, JOHTO_LEADERS, readRewardConfig, runJohtoBattle,
} from "../src/lib/johto-raid-sim";
import { toLeagueMascot } from "../src/lib/league-combat";

// ── Dados ────────────────────────────────────────────────────────────────────
assert.equal(JOHTO_LEADERS.length, 8);
for (const leader of JOHTO_LEADERS) {
  assert.equal(leader.roster.length, 6, `${leader.key} precisa de 6 mascotes`);
  assert.equal(new Set(leader.roster.map((r) => r.pokemonId)).size, 6);
}
assert.equal(new Set(JOHTO_LEADERS.flatMap((l) => l.roster.map((r) => r.pokemonId))).size, 48, "sem espécies repetidas entre líderes");
assert.deepEqual(readRewardConfig(null), DEFAULT_JOHTO_REWARDS);

// ── Prêmios ──────────────────────────────────────────────────────────────────
const c = DEFAULT_JOHTO_REWARDS;
const stat = (playerId: string, damage: number, attackCount = 1) => ({ playerId, damage, attackCount });
// a=1º, b=2º, c=3º, d,e = participantes, z não atacou. d dá o golpe final (só participante): ovo no mesmo prêmio.
let rows = computeLeaderRewards([stat("a", 900), stat("b", 800), stat("c", 700), stat("d", 50), stat("e", 40), stat("z", 0, 0)], "d", c);
const by = (id: string) => rows.filter((r) => r.playerId === id);
assert.equal(rows.some((r) => r.playerId === "z"), false);
assert.deepEqual(by("a").map((r) => [r.tier, r.zc, r.mascotLevel]), [["TOP1", 10000, 85]]);
assert.deepEqual(by("b").map((r) => [r.tier, r.zc, r.mascotLevel]), [["TOP2", 8000, 75]]);
assert.deepEqual(by("c").map((r) => [r.tier, r.zc, r.mascotLevel]), [["TOP3", 6500, 65]]);
assert.deepEqual(by("d").map((r) => [r.tier, r.zc, r.mascotLevel, r.egg]), [["PARTICIPANT", 2500, 55, true]]);
assert.deepEqual(by("e").map((r) => [r.tier, r.zc, r.egg]), [["PARTICIPANT", 2500, false]]);
// golpe final de quem está no pódio: pódio + linha FINAL_BLOW (participante + ovo)
rows = computeLeaderRewards([stat("a", 900), stat("b", 800), stat("c", 700)], "b", c);
assert.deepEqual(rows.filter((r) => r.playerId === "b").map((r) => [r.tier, r.zc, r.egg]), [["TOP2", 8000, false], ["FINAL_BLOW", 2500, true]]);
// sem golpe final atribuído (admin/debug): ninguém ganha ovo
assert.equal(computeLeaderRewards([stat("a", 10)], null, c).some((r) => r.egg), false);

// ── Combo de grupo ───────────────────────────────────────────────────────────
assert.deepEqual([0, 1, 2, 3, 4, 9].map(comboBonusPct), [0, 2, 4, 6, 8, 8], "2% por treinador, máximo 8%");

// ── Combate 6x6 equilibrado ──────────────────────────────────────────────────
const ROLES = ["ATTACKER", "DEFENDER", "FLANK", "HEALER", "OPPORTUNIST", "GUARDIAN"] as const;
const mk = (i: number, pokemonId: number) => toLeagueMascot({
  id: `m${i}`, playerId: "p", pokemonId, nickname: null, level: 55, statForce: 150, statAgility: 120, statInstinct: 120, statVitality: 140, statCharisma: 100,
}, i, ROLES[i]);
const team = [25, 6, 143, 94, 130, 150].map(mk);
const falkner = getJohtoLeader("falkner")!;
const MASCOT_HP = 416_666;
const alive = (slots: number[]) => slots.map((slot) => ({ slot, hpMax: MASCOT_HP, hpCurrent: MASCOT_HP }));
const leaderTeam = buildLeaderTeam(falkner, alive([0, 1, 2, 3, 4, 5]), team, 0);
assert.ok(leaderTeam.every((m) => m.hp === MASCOT_HP), "o mascote do líder entra com a vida global completa");
assert.equal(leaderTeam.length, 6);
const power = (m: { force: number; agility: number; instinct: number; vitality: number; charisma: number }) => m.force + m.agility + m.instinct + m.vitality + m.charisma;
const ratio = leaderTeam.reduce((s, m) => s + power(m), 0) / team.reduce((s, m) => s + power(m), 0);
assert.ok(ratio > 0.9 && ratio < 1.1, `líder deve ter poder próximo ao do time (razão ${ratio.toFixed(2)})`);
assert.equal(buildLeaderTeam(falkner, alive([2, 5]), team, 0).length, 2, "só os mascotes vivos entram");
assert.ok(leaderTeam.every((m) => m.personality), "cada mascote do líder tem personalidade");
const boosted = applyComboBonus(team, 8);
assert.equal(boosted[0].force, Math.round(team[0].force * 1.08));
assert.equal(applyComboBonus(team, 0), team);

let wins = 0, global = 0, fell = 0;
const N = 60;
for (let i = 0; i < N; i++) {
  const o = runJohtoBattle(team, falkner, 0, alive([0, 1, 2, 3, 4, 5]), 1);
  if (o.win) wins++;
  assert.notEqual(o.battle.winner, "DRAW", "a luta vai até um dos lados cair");
  global += o.totalGlobalDamage;
  fell += o.perSlot.filter((p) => p.fellInBattle).length;
  for (const p of o.perSlot) {
    assert.equal(p.globalDamage, p.battleDamage, "escala ×1: dano real = dano global");
    // Dano causado é bruto: pode passar do HP do mascote porque o Cuidador do líder o cura no meio da luta.
    assert.ok(p.battleDamage >= 0 && (p.fellInBattle || p.battleDamage < leaderTeam.find((m) => m.slot === p.slot)!.hp * 3));
  }
}
console.log("ok puro", { winRate: wins / N, avgGlobalDamage: Math.round(global / N), avgLeaderFallen: (fell / N).toFixed(2) });
assert.equal(wins, 0, "com a vida global completa o time do jogador sempre cai");
assert.equal(fell, 0, "nenhum mascote do líder cai numa luta só");
assert.ok(global / N > 0, "mas causa dano persistente");
// Mascote quase sem vida: o dano é limitado ao que resta e ele pode cair na luta.
const weak = runJohtoBattle(team, falkner, 0, [{ slot: 0, hpMax: MASCOT_HP, hpCurrent: 50 }, { slot: 1, hpMax: MASCOT_HP, hpCurrent: 50 }], 1);
assert.ok(weak.perSlot.every((x) => x.fellInBattle) && weak.win, "time quase morto cai e o jogador vence a luta");

if (process.argv.includes("--db")) {
  (async () => {
    const { config } = await import("dotenv"); config({ path: ".env.local" }); config();
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const lib = await import("../src/lib/johto-raid");
    const tag = `zz_johto_${Date.now()}`;
    lib.useJohtoEventSlugForTests(`teste-${Date.now()}`); // não toca no evento real
    const mkPlayer = async (n: string) => {
      const user = await prisma.user.create({ data: { email: `${tag}_${n}@test.local`, role: "PLAYER", status: "ACTIVE" } });
      const player = await prisma.player.create({ data: { userId: user.id, displayName: `Teste ${n}` } });
      const ids: string[] = [];
      for (let i = 0; i < 6; i++) ids.push((await prisma.mascot.create({ data: { playerId: player.id, pokemonId: [25, 6, 143, 94, 130, 150][i], personality: "CURIOUS", level: 50, statForce: 120, statAgility: 100, statInstinct: 100, statVitality: 120, statCharisma: 80 } as never })).id);
      return { user, player, ids, roles: Object.fromEntries(ids.map((id, i) => [id, ROLES[i]])) };
    };
    const A = await mkPlayer("a"), B = await mkPlayer("b"), C = await mkPlayer("c");
    // HP minúsculo por mascote (60) para o líder cair em poucos ataques.
    const event = await lib.createJohtoEvent({ reset: false, hpPerLeader: 360 });
    try {
      await prisma.johtoRaidEvent.update({ where: { id: event.id }, data: { active: true, cooldownMinutes: 0 } });
      await lib.openNextLeaderWindow(event.id);
      let state = await lib.getJohtoRaidState(A.player.id);
      assert.equal(state.current?.key, "falkner");
      assert.equal(state.current?.mascots.length, 6);
      assert.ok(state.current?.expiresAt);

      const r1 = await lib.runJohtoRaidAttack(A.user.id, A.ids, A.roles);
      assert.ok(r1.ok, JSON.stringify(r1)); if (!r1.ok) return;
      console.log("ataque A:", { damage: r1.damage, win: r1.win, ko: r1.koSlots.length, leaderDefeated: r1.leaderDefeated, feridos: r1.fallenMascots.length });
      assert.ok(r1.damage > 0 && r1.damage <= 360);

      // B e C atacam ao mesmo tempo o que restou (mascotes do A podem estar feridos; B e C estão livres).
      state = await lib.getJohtoRaidState(B.player.id);
      if (state.current?.key === "falkner") {
        const results = await Promise.all([lib.runJohtoRaidAttack(B.user.id, B.ids, B.roles), lib.runJohtoRaidAttack(C.user.id, C.ids, C.roles)]);
        for (const r of results) assert.ok(r.ok, JSON.stringify(r));
      }
      const falkner1 = await prisma.johtoRaidLeader.findFirstOrThrow({ where: { eventId: event.id, key: "falkner" }, include: { mascots: true } });
      assert.equal(falkner1.hpCurrent, falkner1.mascots.reduce((s, m) => s + m.hpCurrent, 0), "HP do líder = soma dos mascotes");
      assert.ok(falkner1.mascots.every((m) => m.hpCurrent >= 0));
      const dealt = (await prisma.johtoRaidLeaderStat.findMany({ where: { leaderId: falkner1.id } })).reduce((s, x) => s + x.damage, 0);
      assert.equal(dealt + falkner1.hpCurrent, 360, "dano registrado + HP restante = HP total (nada perdido nem criado)");
      console.log("líder Falkner:", { hpRestante: falkner1.hpCurrent, derrotado: Boolean(falkner1.defeatedAt) });
      if (falkner1.defeatedAt) {
        assert.ok(falkner1.rewardsGrantedAt, "prêmios entregues ao cair o líder");
        const rewards = await prisma.johtoRaidReward.findMany({ where: { leaderKey: "falkner", eventId: event.id } });
        assert.ok(rewards.length >= 1);
        const mine = rewards.find((r) => r.playerId === A.player.id);
        if (mine) {
          const pick = getJohtoLeader("falkner")!.roster[2].pokemonId;
          const claim = await lib.claimJohtoMascotReward(A.user.id, mine.id, pick);
          assert.ok(claim.ok, claim.message);
          assert.equal((await lib.claimJohtoMascotReward(A.user.id, mine.id, pick)).ok, false, "só uma escolha por prêmio");
          assert.ok(await prisma.mascot.findFirst({ where: { playerId: A.player.id, pokemonId: pick, level: mine.mascotLevel } }), "mascote criado no nível da faixa");
          assert.equal((await lib.claimJohtoMascotReward(B.user.id, mine.id, pick)).ok, false, "prêmio de outro jogador");
        }
        assert.equal((await lib.grantLeaderRewards(falkner1.id)).granted, 0, "reentrega é idempotente");
        state = await lib.getJohtoRaidState(A.player.id);
        assert.equal(state.current?.key, "bugsy", "próximo líder assume");
      }
      state = await lib.getJohtoRaidState(A.player.id);
      assert.ok(state.recent.length >= 1 && state.recent.length <= 20);
      const replay = await lib.getJohtoReplay(state.recent[0].id);
      assert.ok(replay && replay.log.length > 0 && replay.lineupA.length === 6 && replay.lineupB.length >= 1, "replay disponível");
      // cooldown real
      await prisma.johtoRaidEvent.update({ where: { id: event.id }, data: { cooldownMinutes: 30 } });
      assert.equal((await lib.runJohtoRaidAttack(A.user.id, A.ids, A.roles)).ok, false);
      // laboratório (sem gravar)
      const sim = await lib.simulateJohtoTest(A.user.id, A.ids, A.roles, "clair", 5);
      assert.ok(sim.ok && sim.summary.runs === 5 && sim.summary.perSlot.length === 6);
      console.log("E2E ok");
    } finally {
      await prisma.johtoRaidEvent.delete({ where: { id: event.id } }).catch(() => null);
      await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
      await prisma.$disconnect();
    }
  })().catch((e) => { console.error(e); process.exit(1); });
}
