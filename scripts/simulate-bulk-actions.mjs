// Isolated functional simulation: actual action source, PostgreSQL WASM, synthetic accounts.
// Never loads .env, never constructs PrismaClient, never connects to the deployed database.
import { PGlite } from '../.codex-tmp/performance/node_modules/@electric-sql/pglite/dist/index.js';
import ts from 'typescript';
import { Prisma, GiftStatus, FoodType, EggType, ZikaCoinTxType } from '@prisma/client';
import { z } from 'zod';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const db = new PGlite();
const session = new AsyncLocalStorage();
const realRequire = createRequire(import.meta.url);
let queries = 0;
const report = { environment: 'PGlite in-memory; no HTTP/Vercel/network latency; Prisma adapter and auth mocked; EXP execution excluded', tests: [], load: [] };
const query = async (connection, sql, params = []) => {
  queries++;
  return (await connection.query(sql, params)).rows;
};
await db.exec(`
CREATE TYPE "MascotMood" AS ENUM ('HAPPY', 'NEUTRAL');
CREATE TABLE "mascots" (id text PRIMARY KEY, "playerId" text, happiness integer, mood "MascotMood", "lastFedAt" timestamp(3), "arenaState" text, "isEquipped" boolean, "isFavorite" boolean, level integer, personality text);
CREATE TABLE foods ("playerId" text, type text, quantity integer CHECK(quantity >= 0), PRIMARY KEY("playerId",type));
CREATE TABLE gifts (id text PRIMARY KEY, "playerId" text, status text DEFAULT 'UNCLAIMED', type text DEFAULT 'CUSTOM', title text DEFAULT 'Synthetic', payload jsonb, "createdAt" timestamp DEFAULT now());
CREATE TABLE jobs (id text PRIMARY KEY, "playerId" text, "idempotencyKey" text UNIQUE, payload jsonb);
CREATE TABLE audit (id serial PRIMARY KEY, gift text);
`);

function adapter(connection) {
  const rows = (sql, params) => query(connection, sql, params);
  const foodKey = w => w.playerId_type ?? w;
  const giftWhere = w => [w.id, w.playerId];
  return {
    $queryRaw: async (strings, ...values) => {
      const sql = Prisma.sql(strings, ...values);
      return rows(sql.text, sql.values);
    },
    player: { findUnique: async ({ where }) => ({ id: where.userId }) },
    mascotFoodItem: {
      findUnique: async ({ where }) => { const k = foodKey(where); return (await rows('SELECT * FROM foods WHERE "playerId"=$1 AND type=$2', [k.playerId, k.type]))[0] ?? null; },
      findUniqueOrThrow: async ({ where }) => { const k = foodKey(where); const [r] = await rows('SELECT * FROM foods WHERE "playerId"=$1 AND type=$2', [k.playerId, k.type]); if (!r) throw Error('Missing food'); return r; },
      updateMany: async ({ where, data }) => ({ count: (await rows('UPDATE foods SET quantity=quantity-$3 WHERE "playerId"=$1 AND type=$2 AND quantity >= $3 RETURNING *', [where.playerId, where.type, data.quantity.decrement])).length }),
      upsert: async ({ create, update }) => (await rows('INSERT INTO foods VALUES ($1,$2,$3) ON CONFLICT ("playerId",type) DO UPDATE SET quantity=foods.quantity+$4 RETURNING *', [create.playerId, create.type, create.quantity, update.quantity.increment]))[0],
    },
    mascot: {
      findMany: async ({ where, take }) => rows('SELECT * FROM mascots WHERE "playerId"=$1 AND "arenaState" NOT IN (\'ARENA\',\'INJURED\') AND ("lastFedAt" IS NULL OR ("isEquipped" AND "lastFedAt" <= $2) OR (NOT "isEquipped" AND "lastFedAt" <= $3)) AND ($4::boolean IS NULL OR "isFavorite"=$4) ORDER BY "isEquipped" DESC,"isFavorite" DESC,level DESC LIMIT $5', [where.playerId, where.OR[1].lastFedAt.lte, where.OR[2].lastFedAt.lte, where.isFavorite ?? null, take]),
      count: async ({ where }) => (await adapter(connection).mascot.findMany({ where, take: 100000 })).length,
    },
    mascotInteractionJob: { createMany: async ({ data }) => {
      for (const j of data) await rows('INSERT INTO jobs VALUES($1,$2,$3,$4)', [j.id, j.playerId, j.idempotencyKey, JSON.stringify(j.resultJson)]);
    } },
    playerGift: {
      findUnique: async ({ where }) => (await rows('SELECT * FROM gifts WHERE id=$1', [where.id]))[0],
      findFirst: async ({ where }) => (await rows('SELECT * FROM gifts WHERE id=$1 AND "playerId"=$2 AND status=\'UNCLAIMED\'', giftWhere(where)))[0],
      findMany: async ({ where, take }) => rows('SELECT * FROM gifts WHERE "playerId"=$1 AND status=\'UNCLAIMED\' ORDER BY "createdAt",id LIMIT $2', [where.playerId, take]),
      count: async ({ where }) => Number((await rows('SELECT count(*) AS n FROM gifts WHERE "playerId"=$1 AND status=\'UNCLAIMED\'', [where.playerId]))[0].n),
      updateMany: async ({ where }) => ({ count: (await rows('UPDATE gifts SET status=\'CLAIMED\' WHERE id=$1 AND "playerId"=$2 AND status=\'UNCLAIMED\' RETURNING id', giftWhere(where))).length }),
    },
    pokemonCard: { findUnique: async () => null },
    auditLog: { create: async ({ data }) => {
      if (session.getStore()?.failAudit) throw new Error('Injected audit failure');
      await rows('INSERT INTO audit(gift) VALUES($1)', [data.entityId]);
    } },
  };
}
const prisma = { ...adapter(db), $transaction: callback => db.transaction(tx => callback(adapter(tx))) };
const stubs = {
  '@prisma/client': { Prisma, GiftStatus, FoodType, EggType, ZikaCoinTxType },
  zod: { z },
  'next/cache': { revalidatePath() {}, revalidateTag() {} },
  'next/server': { after() {} },
  '@/lib/prisma': { prisma },
  '@/lib/auth/permissions': { getSessionUser: async () => session.getStore()?.id ? { id: session.getStore().id } : null },
  '@/lib/session': { getSessionPlayer: async id => ({ id }) },
  '@/lib/mascot-data': { feedBaseExp: () => 30, POKEMON_ELEMENT: {} },
  '@/lib/player-activity': { recordPlayerActivity: async () => {} },
  '@/lib/shop-config': { UNIQUE_ITEM_TYPES: new Set() },
  '@/app/(app)/passe-apoiador/pack-opener': { openStickerPackByName: async (id, name, tx) => {
    assert.ok(tx && tx !== prisma, 'Pack must use the caller transaction');
    await tx.mascotFoodItem.upsert({ create: { playerId: id, type: 'SWEET', quantity: 1 }, update: { quantity: { increment: 1 } } });
    return name === 'invalid' ? { error: 'Unavailable pack' } : {};
  } },
};
function loadAction(path) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const sandbox = { module, exports: module.exports, require: name => {
    if (name in stubs) return stubs[name];
    if (name.startsWith('@/')) return {}; // Fail if an unimplemented dependency is actually invoked.
    return realRequire(name);
  }, console: { ...console, info() {}, warn() {}, error() {} }, crypto: globalThis.crypto, Date, setTimeout };
  vm.runInNewContext(code, sandbox, { filename: path });
  return module.exports;
}
const gifts = loadAction('src/app/(app)/caixa-de-presentes/actions.ts');
const mascots = loadAction('src/app/(app)/mascotes/actions.ts');
const as = (id, fn, extra = {}) => session.run({ id, ...extra }, fn);
const scalar = async (sql, params = []) => Number((await query(db, sql, params))[0].n);
const seedGifts = async (id, count, payload = { rewardKind: 'MASCOT_FOOD', foodType: 'FOOD', quantity: 1 }) => {
  await query(db, 'INSERT INTO gifts(id,"playerId",payload) SELECT $1||\'-\'||n,$1,$3::jsonb FROM generate_series(1,$2) n', [id, count, JSON.stringify(payload)]);
};
const seedMascots = async (id, count, food = count) => {
  await query(db, 'INSERT INTO foods VALUES($1,\'FOOD\',$2)', [id, food]);
  await query(db, `INSERT INTO mascots SELECT $1||'-'||n,$1,50,'NEUTRAL',NULL,'FREE',true,false,1,'BRAVE' FROM generate_series(1,$2) n`, [id, count]);
};
async function test(name, fn) { await fn(); report.tests.push({ name, passed: true }); console.log('PASS', name); }
try {
  await test('Authentication and ownership reject writes', async () => {
    assert.ok((await gifts.claimAllGifts({ playerId: 'none' })).error);
    assert.ok((await as('a', () => gifts.claimAllGifts({ playerId: 'b' }))).error);
  });
  await test('61 gifts drain in 25/25/11 batches, no duplicate on retry', async () => {
    await seedGifts('batch', 61);
    for (const n of [25,25,11]) assert.equal((await as('batch', () => gifts.claimAllGifts({ playerId: 'batch', deferRefresh: true }))).claimed, n);
    assert.equal((await as('batch', () => gifts.claimAllGifts({ playerId: 'batch' }))).claimed, 0);
    assert.equal(await scalar('SELECT quantity AS n FROM foods WHERE "playerId"=\'batch\''), 61);
  });
  await test('Audit failure rolls back reward and gift status', async () => {
    await seedGifts('rollback', 1);
    const r = await as('rollback', () => gifts.claimGift({ giftId: 'rollback-1' }), { failAudit: true });
    assert.ok(r.error);
    assert.equal(await prisma.playerGift.count({ where: { playerId: 'rollback' } }), 1);
    assert.equal(await scalar('SELECT count(*) AS n FROM foods WHERE "playerId"=\'rollback\''), 0);
  });
  await test('Pack failure and later audit failure use the same rollback', async () => {
    for (const name of ['invalid','valid']) {
      await seedGifts('pack-'+name, 1, { rewardKind: 'STICKER_PACK', packName: name });
      const r = await as('pack-'+name, () => gifts.claimGift({ giftId: 'pack-'+name+'-1' }), { failAudit: name === 'valid' });
      assert.ok(r.error);
      assert.equal(await scalar('SELECT count(*) AS n FROM foods WHERE "playerId"=$1', ['pack-'+name]), 0);
    }
  });
  await test('20 concurrent claims of one gift deliver exactly once', async () => {
    await seedGifts('race', 1);
    const results = await Promise.all(Array.from({length:20}, () => as('race', () => gifts.claimGift({ giftId: 'race-1' }))));
    assert.equal(results.filter(r => r.success).length, 1);
    assert.equal(await scalar('SELECT quantity AS n FROM foods WHERE "playerId"=\'race\''), 1);
  });
  await test('205 mascots feed in 100/100/5 batches with matching stock and jobs', async () => {
    await seedMascots('feed', 205);
    for (const n of [100,100,5]) {
      const r = await as('feed', () => mascots.feedAllAction());
      assert.equal(r.fed, n, JSON.stringify(r));
      assert.equal(r.fedMascots.length, n);
      assert.equal(r.fedMascots[0].happiness, 70);
    }
    assert.equal(await scalar('SELECT quantity AS n FROM foods WHERE "playerId"=\'feed\''), 0);
    assert.equal(await scalar('SELECT count(*) AS n FROM jobs WHERE "playerId"=\'feed\''), 205);
  });
  await test('Concurrent feeding does not double charge or double grant jobs', async () => {
    await seedMascots('feed-race', 5, 20);
    const results = await Promise.all(Array.from({length:10}, () => as('feed-race', () => mascots.feedAllAction())));
    assert.equal(results.reduce((sum,r) => sum+r.fed, 0), 5);
    assert.equal(await scalar('SELECT quantity AS n FROM foods WHERE "playerId"=\'feed-race\''), 15);
    assert.equal(await scalar('SELECT count(*) AS n FROM jobs WHERE "playerId"=\'feed-race\''), 5);
  });
  for (const players of [50,200,500]) {
    for (let i=0;i<players;i++) await seedGifts(`load-${players}-${i}`, 3);
    const before = queries;
    const start = performance.now();
    const durations = [];
    const results = await Promise.all(Array.from({length:players}, (_,i) => as(`load-${players}-${i}`, async () => {
      const begin = performance.now();
      const result = await gifts.claimAllGifts({ playerId: `load-${players}-${i}`, deferRefresh: true });
      durations.push(performance.now()-begin);
      return result;
    })));
    const elapsed = performance.now()-start;
    assert.equal(results.reduce((n,r)=>n+(r.claimed??0),0),players*3);
    assert.ok(results.every(r=>!r.error && !r.failed));
    durations.sort((a,b)=>a-b);
    const sample = { players, gifts: players*3, elapsedMs: Math.round(elapsed), p95Ms: Math.round(durations[Math.ceil(players*.95)-1]), queries: queries-before, errors:0 };
    report.load.push(sample);
    console.log('SIMULATION', JSON.stringify(sample));
  }
} finally {
  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/bulk-actions-simulation.json', JSON.stringify(report,null,2));
  await db.close();
}
