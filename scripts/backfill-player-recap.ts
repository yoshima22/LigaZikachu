/**
 * Backfill dos contadores do recap (player_recap_counters) a partir do histórico.
 *
 *   npx tsx scripts/backfill-player-recap.ts            -> dry-run (só imprime totais)
 *   npx tsx scripts/backfill-player-recap.ts --apply    -> grava
 *
 * Rode ANTES de subir os ganchos em produção: o script grava valores absolutos
 * (set), então refazer antes do deploy é seguro. Depois do deploy os ganchos
 * somam por cima, e o script se recusa a rodar de novo (backfilledAt preenchido).
 * Ligas contam por finalRank != null, o mesmo critério dos ganchos (finalRank nulo
 * = ainda não contado), então não há dupla contagem.
 *
 * Não recuperável do histórico (ficará 0 até os ganchos): mascotsRecycled.
 * Limite conhecido: proteínas/penas vêm de mascotBuff/mascotEvent, que somem junto
 * com o mascote (cascade) — são piso, não total.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const YEAR = 2026;
const YEAR_START = new Date(Date.UTC(YEAR, 0, 1, 3, 0, 0)); // 00:00 BRT
const CUTOFF = new Date();

type Row = Record<string, number>;
const rows = new Map<string, Row>();
const row = (playerId: string | null | undefined): Row | null => {
  if (!playerId) return null;
  let r = rows.get(playerId);
  if (!r) { r = {}; rows.set(playerId, r); }
  return r;
};
const add = (playerId: string | null | undefined, key: string, value: number) => {
  const r = row(playerId);
  if (r && value) r[key] = (r[key] ?? 0) + value;
};
const total = (key: string) => [...rows.values()].reduce((s, r) => s + (r[key] ?? 0), 0);

// Faixa de atributo sorteada pela Pena → tier (ver EGG_STAT_RANGES em mascot-data.ts).
const FEATHER_BY_RANGE: Record<string, string> = {
  "8–14": "feathersCommon", "11–17": "feathersRare", "13–20": "feathersSpecial", "17–26": "feathersLab", "12–19": "feathersEvent",
};

async function main() {
  const t0 = Date.now();

  // ── Ligas (só edições já finalizadas: finalRank != null e partidas jogadas) ──
  const weekly = await prisma.weeklyMascotLeagueParticipant.findMany({
    where: { finalRank: { not: null } },
    select: { playerId: true, wins: true, losses: true, draws: true, woLosses: true, byes: true, damageDealt: true, damageTaken: true },
  });
  for (const p of weekly) {
    if (p.wins + p.losses + p.draws + p.woLosses + p.byes === 0) continue;
    add(p.playerId, "weeklyLeagues", 1); add(p.playerId, "weeklyWins", p.wins); add(p.playerId, "weeklyLosses", p.losses + p.woLosses);
    add(p.playerId, "weeklyDraws", p.draws); add(p.playerId, "weeklyDamageDealt", p.damageDealt); add(p.playerId, "weeklyDamageTaken", p.damageTaken);
  }
  const rush = await prisma.rushLeagueParticipant.findMany({
    where: { finalRank: { not: null } },
    select: { playerId: true, wins: true, losses: true, draws: true, damageDealt: true, damageTaken: true },
  });
  for (const p of rush) {
    if (p.wins + p.losses + p.draws === 0) continue;
    add(p.playerId, "rushLeagues", 1); add(p.playerId, "rushWins", p.wins); add(p.playerId, "rushLosses", p.losses);
    add(p.playerId, "rushDraws", p.draws); add(p.playerId, "rushDamageDealt", p.damageDealt); add(p.playerId, "rushDamageTaken", p.damageTaken);
  }

  // ── Arena Z: contagem por prisma, dano somado no banco (não trafega turnLog) ──
  const bot = await prisma.arenaBattle.groupBy({ by: ["attackerPlayerId"], where: { type: "BOT", createdAt: { gte: YEAR_START, lt: CUTOFF } }, _count: { _all: true } });
  for (const b of bot) add(b.attackerPlayerId, "arenaPveBattles", b._count._all);
  const pvpA = await prisma.arenaBattle.groupBy({ by: ["attackerPlayerId"], where: { type: "PVP", createdAt: { gte: YEAR_START, lt: CUTOFF } }, _count: { _all: true } });
  for (const b of pvpA) add(b.attackerPlayerId, "arenaPvpAttacks", b._count._all);
  const pvpD = await prisma.arenaBattle.groupBy({ by: ["defenderPlayerId"], where: { type: "PVP", createdAt: { gte: YEAR_START, lt: CUTOFF } }, _count: { _all: true } });
  for (const b of pvpD) add(b.defenderPlayerId, "arenaPvpDefenses", b._count._all);

  const dmg = await prisma.$queryRawUnsafe<{ pid: string; dealt: bigint; taken: bigint }[]>(`
    select pid, sum(dealt)::bigint dealt, sum(taken)::bigint taken from (
      select t->>'actorOwnerId' pid, coalesce((t->>'damage')::int, 0) dealt, 0 taken
        from arena_battles b, jsonb_array_elements(b."turnLog") t
       where b."createdAt" >= $1 and b."createdAt" < $2 and b.type in ('BOT', 'PVP') and t->>'action' = 'ATTACK'
      union all
      select t->>'targetOwnerId', 0, coalesce((t->>'damage')::int, 0)
        from arena_battles b, jsonb_array_elements(b."turnLog") t
       where b."createdAt" >= $1 and b."createdAt" < $2 and b.type in ('BOT', 'PVP') and t->>'action' = 'ATTACK'
    ) x where pid is not null group by pid`, YEAR_START, CUTOFF);
  for (const d of dmg) { add(d.pid, "arenaDamageDealt", Number(d.dealt)); add(d.pid, "arenaDamageTaken", Number(d.taken)); }

  // ── Ovos chocados (EGG_HATCHED do extrato) ──
  const eggs = await prisma.playerActivityLog.groupBy({ by: ["playerId"], where: { category: "EGG", action: "EGG_HATCHED", createdAt: { gte: YEAR_START, lt: CUTOFF } }, _count: { _all: true } });
  for (const e of eggs) add(e.playerId, "eggsHatched", e._count._all);

  // ── Proteínas Zika e Penas Arco-Íris (pisos: somem com o mascote) ──
  const prot = await prisma.$queryRawUnsafe<{ pid: string; n: number }[]>(
    `select m."playerId" pid, count(*)::int n from mascot_buffs b join mascots m on m.id = b."mascotId" where b.type = 'STAT_BOOST' and b."expiresAt" > '2090-01-01' and b."createdAt" >= $1 and b."createdAt" < $2 group by 1`, YEAR_START, CUTOFF);
  for (const p of prot) add(p.pid, "proteinsUsed", p.n);
  const feathers = await prisma.$queryRawUnsafe<{ pid: string; rng: string | null; n: number }[]>(
    `select m."playerId" pid, substring(e.description from 'intervalo ([0-9]+–[0-9]+)') rng, count(*)::int n from mascot_events e join mascots m on m.id = e."mascotId" where e.description like 'Pena Arco-Íris usada!%' and e."createdAt" >= $1 and e."createdAt" < $2 group by 1, 2`, YEAR_START, CUTOFF);
  let featherUnmapped = 0;
  for (const f of feathers) {
    add(f.pid, "feathersUsed", f.n);
    const key = f.rng ? FEATHER_BY_RANGE[f.rng] : undefined;
    if (key) add(f.pid, key, f.n); else featherUnmapped += f.n;
  }

  // ── ZC: ganho/gasto do ano até agora + marca da carteira ──
  const wallets = await prisma.zikaCoinWallet.findMany({ select: { id: true, playerId: true, totalEarned: true, totalSpent: true } });
  const walletPlayer = new Map(wallets.map((w) => [w.id, w.playerId]));
  const earned = await prisma.zikaCoinTransaction.groupBy({ by: ["walletId"], where: { amount: { gt: 0 }, status: "COMPLETED", createdAt: { gte: YEAR_START, lt: CUTOFF } }, _sum: { amount: true } });
  const spent = await prisma.zikaCoinTransaction.groupBy({ by: ["walletId"], where: { amount: { lt: 0 }, status: "COMPLETED", createdAt: { gte: YEAR_START, lt: CUTOFF } }, _sum: { amount: true } });
  for (const e of earned) add(walletPlayer.get(e.walletId), "zcEarnedAtMark", e._sum.amount ?? 0);
  for (const s of spent) add(walletPlayer.get(s.walletId), "zcSpentAtMark", -(s._sum.amount ?? 0));
  for (const w of wallets) { add(w.playerId, "zcWalletEarnedMark", w.totalEarned); add(w.playerId, "zcWalletSpentMark", w.totalSpent); }

  // ── Relatório ──
  const keys = ["weeklyLeagues", "weeklyWins", "weeklyLosses", "weeklyDamageDealt", "weeklyDamageTaken", "rushLeagues", "rushWins", "rushLosses", "rushDamageDealt", "rushDamageTaken",
    "arenaPveBattles", "arenaPvpAttacks", "arenaPvpDefenses", "arenaDamageDealt", "arenaDamageTaken", "eggsHatched", "proteinsUsed", "feathersUsed", "feathersCommon", "feathersRare", "feathersSpecial", "feathersLab", "feathersEvent",
    "zcEarnedAtMark", "zcSpentAtMark", "zcWalletEarnedMark", "zcWalletSpentMark"];
  console.log(JSON.stringify({ players: rows.size, featherUnmapped, ...Object.fromEntries(keys.map((k) => [k, total(k)])), secs: (Date.now() - t0) / 1000 }, null, 1));

  if (!APPLY) { console.log("dry-run: nada gravado (use --apply)."); return; }
  const already = await prisma.playerRecapCounter.count({ where: { year: YEAR, backfilledAt: { not: null } } });
  if (already > 0 && !process.argv.includes("--rerun-before-deploy")) { console.log(`ABORTADO: ${already} linhas já têm backfilledAt. Os ganchos podem estar ativos.`); return; }
  const entries = [...rows.entries()];
  for (let i = 0; i < entries.length; i += 100) {
    await prisma.$transaction(entries.slice(i, i + 100).map(([playerId, r]) =>
      prisma.playerRecapCounter.upsert({
        where: { playerId_year: { playerId, year: YEAR } },
        create: { playerId, year: YEAR, ...r, backfilledAt: new Date() },
        update: { ...r, backfilledAt: new Date() },
      })));
  }
  console.log(`gravadas ${entries.length} linhas (${YEAR}).`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
