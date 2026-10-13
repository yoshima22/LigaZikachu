const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { Prisma, PrismaClient } = require('@prisma/client');

// Transpile the actual modules, replacing framework boundaries for deterministic
// tests. The optional integration mode performs SELECTs only against configured DB.
function load(file, mocks = {}, modules = new Map()) {
  const absolute = path.resolve(file);
  if (modules.has(absolute)) return modules.get(absolute).exports;
  const module = { exports: {} }; modules.set(absolute, module);
  const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const requireLocal = name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.ts', mocks, modules);
    if (name.startsWith('.')) return load(path.resolve(path.dirname(absolute), name) + '.ts', mocks, modules);
    return require(name);
  };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: absolute })(requireLocal, module, module.exports);
  return module.exports;
}

function cacheMock() {
  const values = new Map();
  return { unstable_cache: (fn, keys) => async (...args) => {
    const key = JSON.stringify([keys, args]);
    if (!values.has(key)) values.set(key, Promise.resolve().then(() => fn(...args)));
    return values.get(key);
  } };
}

async function unit() {
  const boundedHistory = load('src/lib/refuge-history.ts', { '@/lib/prisma': { prisma: {
    $queryRaw: async sql => {
      assert.ok(sql.values.includes(25), 'history must limit each category to 25 in SQL');
      assert.ok(!sql.values.includes(450), 'older history must not be loaded');
      return [{ids:[],total:0,page:1}];
    },
  } }, 'next/cache':cacheMock() });
  await boundedHistory.getRefugeHistoryPage('GARDEN', 1, '', 'CONFLICT');
  let tickerCalls = 0;
  const ticker = load('src/lib/league-ticker.ts', { '@/lib/prisma': { prisma: {
    $queryRaw: async (strings, ...values) => {
      tickerCalls++;
      assert.ok(strings.join('?').includes('LIMIT 500'));
      assert.ok(!strings.join('?').includes("player'quoted"));
      assert.equal(values[0], values[1]);
      assert.equal(values[2], "player'quoted");
      assert.equal(values[3], [12, 20, 1, 12, 3][tickerCalls - 1]);
      return [];
    },
  } } });
  for (const limit of [undefined, 100, 0, NaN, 3.8]) {
    assert.deepEqual(await ticker.getPendingLeagueTickerEvents("player'quoted", limit), []);
  }
  assert.equal(tickerCalls, 5);
  const actionsSource = fs.readFileSync('src/app/(app)/combates/liga-semanal/actions.ts', 'utf8');
  const actionsAst = ts.createSourceFile('actions.ts', actionsSource, ts.ScriptTarget.Latest, true);
  for (const name of ['saveWeeklyPresetAction', 'deleteWeeklyPresetAction']) {
    const action = actionsAst.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.ok(action, name);
    assert.ok(!action.getText(actionsAst).includes('revalidateTag('), name);
    assert.ok(action.getText(actionsAst).includes('revalidatePath(PATH)'), name);
  }
  console.log('PASS: ticker parameterization/limits and preset page revalidation without global highlight invalidation');
  let queries = 0;
  const turn = { actorId: 'a', actorName: 'Alpha', actorOwnerId: 'p1', actorPokemonId: 25, actorRole: 'Atacante', targetId: 'b', targetName: 'Beta', targetOwnerId: 'p2', targetPokemonId: 1, action: 'ATTACK', damage: 100 };
  const match = { replayJson: [turn], resultJson: { lineupA: [{ id:'a', maxHp: 100 }], lineupB: [{ id:'b', maxHp: 80 }] }, playerAId:'p1', playerBId:'p2', winnerId:'p1' };
  const prisma = { weeklyMascotLeagueMatch: { findMany: async () => { queries++; return [match]; } }, player: { findMany: async () => [{ id:'p1', displayName:'Trainer' }] } };
  const highlights = load('src/lib/weekly-league-highlights.ts', { '@/lib/prisma': { prisma }, 'next/cache':cacheMock() });
  const first = await highlights.getWeeklyHighlights('league-a');
  assert.equal(first.find(x => x.id==='a').damageDealt, 100);
  assert.equal(first.find(x => x.id==='a').kosDealt, 1);
  assert.equal(first.find(x => x.id==='a').wins, 1);
  assert.equal(first.find(x => x.id==='b').damageTaken, 100);
  await highlights.getWeeklyHighlights('league-a'); assert.equal(queries,1);
  await highlights.getWeeklyHighlights('league-b'); assert.equal(queries,2);
  const champ = await highlights.getChampionHighlights('league-a','p1'); assert.equal(champ.topAttacker.damageDealt,100);
  await highlights.getChampionHighlights('league-a','p1'); assert.equal(queries,3);
  const backgrounds = load('src/lib/refuge-backgrounds.ts');
  assert.equal(backgrounds.refugeBackgroundUrl('https://custom/image.png'),'https://custom/image.png');
  assert.equal(backgrounds.refugeBackgroundUrl(null),'');
  for (const name of ['CampoDeTreinoLacos','DescansoLacos','HortaLacos','PatioLacos']) {
    const url=backgrounds.refugeBackgroundUrl(`https://fwxqywivezsixamietps.supabase.co/storage/v1/object/public/assets/Lacos/${name}.png`);
    assert.ok(url.startsWith('/refuge/')); assert.ok(fs.existsSync('public'+url));
    assert.ok(fs.statSync('public'+url).size<400000);
    const digest=require('node:crypto').createHash('sha256').update(fs.readFileSync('public'+url)).digest('hex').slice(0,12);
    assert.ok(url.includes(digest));
  }
  let session = null, replayQueries=0;
  const replay = load('src/app/(app)/combates/liga-semanal/replay-actions.ts', {
    '@/lib/session': {getAppSession:async()=>session}, '@/lib/prisma':{ prisma:{
      weeklyMascotLeagueMatch:{findFirst:async()=>{replayQueries++;return {...match,leagueId:'l',battleDate:'2026-10-01',battleSlot:1};}},
      mascot:{findMany:async()=>[{id:'a',level:7},{id:'b',level:9}]},
      weeklyMascotLeagueDailyTeam:{findFirst:async()=>{throw Error('Must use stored lineups');}},
    } }, '@/lib/mascot-data':{getPokemonName:id=>'Pokemon '+id}, '@/lib/combat-roles':{getCombatRoleLabel:x=>x,normalizeCombatRole:x=>x},
  });
  await assert.rejects(replay.getWeeklyReplayAction('m'),/Sessão/); assert.equal(replayQueries,0);
  session={user:{id:'u'}};
  await assert.rejects(replay.getWeeklyReplayAction(''),/inválida/); assert.equal(replayQueries,0);
  const payload=await replay.getWeeklyReplayAction('m');
  assert.equal(payload.replayJson[0].actorLevel,7); assert.equal(payload.replayLineupB[0].maxHp,80);
  assert.equal(turn.actorLevel,undefined);
  let legacyTeamReads=0;
  const legacy = load('src/app/(app)/combates/liga-semanal/replay-actions.ts', {
    '@/lib/session': {getAppSession:async()=>session}, '@/lib/prisma':{ prisma:{
      weeklyMascotLeagueMatch:{findFirst:async args=>{assert.equal(args.where.status,'RESOLVED');return {...match,resultJson:{},replayJson:[{...turn,actorLevel:42}],leagueId:'l',battleDate:'2026-09-30',battleSlot:2};}},
      mascot:{findMany:async()=>[{id:'a',level:7,pokemonId:25,nickname:null,statVitality:10},{id:'b',level:9,pokemonId:1,nickname:null,statVitality:12}]},
      weeklyMascotLeagueDailyTeam:{findFirst:async args=>{legacyTeamReads++;assert.equal(args.where.battleDate.lte,'2026-09-30');assert.equal(args.where.battleSlot,2);return {mascotIdsJson:[args.where.playerId==='p1'?'a':'b'],rolesJson:{a:'ATTACKER'}};}},
    } }, '@/lib/mascot-data':{getPokemonName:id=>'Pokemon '+id}, '@/lib/combat-roles':{getCombatRoleLabel:x=>x,normalizeCombatRole:x=>x},
  });
  const legacyPayload=await legacy.getWeeklyReplayAction('old-match');
  assert.equal(legacyTeamReads,2);assert.equal(legacyPayload.replayLineupA[0].id,'a');
  assert.equal(legacyPayload.replayJson[0].actorLevel,42);
  console.log('PASS: highlight totals/cache isolation, versioned assets, auth, lazy replay and level enrichment');
}

async function integration() {
  require('dotenv').config({quiet:true}); require('dotenv').config({path:'.env.local',quiet:true});
  const prisma = new PrismaClient();
  try {
    const ticker = load('src/lib/league-ticker.ts', { '@/lib/prisma': { prisma } });
    const viewers = await prisma.leagueTickerView.findMany({select:{playerId:true},distinct:['playerId'],take:3});
    for (const playerId of ['__egress_test_no_views__', ...viewers.map(row => row.playerId)]) {
      const viewed = await prisma.leagueTickerView.findMany({where:{playerId},select:{eventId:true},orderBy:{seenAt:'desc'},take:500});
      const now = new Date();
      const expected = await prisma.leagueTickerEvent.findMany({where:{startsAt:{lte:now},expiresAt:{gt:now},id:viewed.length?{notIn:viewed.map(row=>row.eventId)}:undefined},orderBy:[{priority:'desc'},{createdAt:'desc'}],take:12,select:{id:true,type:true,message:true,href:true,priority:true,createdAt:true}});
      const actual = await ticker.getPendingLeagueTickerEvents(playerId);
      assert.deepEqual(actual, expected, 'ticker matches previous query');
    }
    console.log(`PASS: read-only ticker comparison for ${viewers.length + 1} viewer samples`);
    const history = load('src/lib/refuge-history.ts', { '@/lib/prisma':{prisma},'next/cache':cacheMock() });
    let oldBytes=0,newBytes=0;
    for (const location of ['GARDEN','TRAINING','REST','YARD']) {
      const baseline=await prisma.mascotBondMemory.findMany({where:{...history.publicRefugeWhere,metadata:{path:['location'],equals:location}},include:history.refugeMemoryInclude,orderBy:[{createdAt:'desc'},{id:'desc'}],take:450});
      const stories=baseline.map(history.refugeStory);
      const recent=stories.slice(0,25);
      const report=await history.getRefugeReport(location);
      assert.equal(report.total,recent.length);assert.equal(report.conflicts,recent.filter(x=>x.conflict).length);
      assert.equal(report.scoreUp,recent.reduce((n,s)=>n+Math.max(0,s.scoreDelta??0),0));
      assert.equal(report.scoreDown,recent.reduce((n,s)=>n+Math.max(0,-(s.scoreDelta??0)),0));
      const term=stories[0]?.participants ?? '';
      for(const options of [{page:1,full:false,kind:'ALL',q:''},{page:2,full:true,kind:'ALL',q:''},{page:50,full:false,kind:'ALL',q:''},{page:1,full:true,kind:'CONFLICT',q:''},{page:1,full:true,kind:'SOCIAL',q:''},{page:1,full:true,kind:'ALL',q:term},{page:1,full:true,kind:'ALL',q:'%_no-match'}]) {
        const expected=stories.filter(s=>options.kind==='ALL'||(options.kind==='CONFLICT'?s.conflict:!s.conflict)).slice(0,25).filter(s=>`${s.participants} ${s.owners} ${s.title} ${s.description}`.toLocaleLowerCase('pt-BR').includes(options.q.toLocaleLowerCase('pt-BR')));
        const actual=await history.getRefugeHistoryPage(location,options.page,options.q,options.kind);
        assert.ok(actual.total<=25);
        assert.equal(typeof actual.page,'number');
        const page=Math.min(options.page,Math.max(1,Math.ceil(expected.length/9)));
        assert.equal(actual.total,expected.length,`${location} ${JSON.stringify(options)} total`);
        assert.deepEqual(actual.stories.map(s=>s.id),expected.slice((page-1)*9,page*9).map(s=>s.id));
        if(options.page===1&&!options.full){oldBytes+=Buffer.byteLength(JSON.stringify(baseline));newBytes+=Buffer.byteLength(JSON.stringify(actual));}
      }
      console.log(`PASS: ${location} pagination/search matches the original retained history`);
    }
    console.log('PASS: read-only DB pagination, window boundaries, search, conflict/social filters and regional reports');
    console.log(JSON.stringify({fourRegionsBaselineJsonBytes:oldBytes,fourFirstPagesJsonBytes:newBytes,reductionPct:Number((100*(1-newBytes/oldBytes)).toFixed(1))}));
  } finally { await prisma.$disconnect(); }
}

(async()=>{await unit();if(process.argv.includes('--live-readonly'))await integration();})().catch(error=>{console.error(error);process.exitCode=1;});
