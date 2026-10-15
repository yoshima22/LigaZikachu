const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Execute production functions with database/framework boundaries substituted.
// No production writes or real purchases are performed.
function functions(file, names, context) {
  const source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const selected = ast.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name?.text));
  assert.equal(selected.length, names.length);
  const code = ts.transpileModule(selected.map(n => n.getText(ast).replace(/^export /, '')).join('\n'), {
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS},
  }).outputText;
  return vm.runInNewContext(`${code}; ({${names.join(',')}})`, context);
}

async function purchase({sold = false, balance = 100, failDelivery = false} = {}) {
  const effects = [];
  const listing = {id:'listing',status:'ACTIVE',listingType:'SALE',playerId:'seller',priceCoins:50,priceLigaCash:5,category:'ITEM',payload:{displayName:'Item'},updatedAt:new Date(),player:{id:'seller',displayName:'Seller',userId:'seller-user'}};
  const tx = {
    $executeRaw: async()=>{},
    bazarListing:{
      update:async()=>effects.push('sold'),
      updateMany:async({where})=>{
        assert.equal(where.status,'ACTIVE');
        assert.equal(where.priceCoins,50);
        if(sold)return {count:0};effects.push('sold');return {count:1};
      },
    },
    zikaCoinWallet:{
      update:async()=>effects.push('debit'),
      updateMany:async({where})=>{assert.equal(where.balance.gte,50);if(balance<50)return {count:0};effects.push('debit');return {count:1};},
      upsert:async()=>effects.push('credit'),
    },
    bazarProposal:{findMany:async()=>[],updateMany:async()=>({count:0})},
    bazarTransaction:{create:async()=>effects.push('log')},
  };
  const prisma={
    bazarListing:{findUnique:async()=>listing},
    economySettings:{upsert:async()=>({allowLcBazar:true})},
    zikaCoinWallet:{findUnique:async()=>({balance:100})},
    $transaction:async fn=>{try{return await fn(tx);}catch(e){effects.length=0;throw e;}},
  };
  const {buyListing}=functions('src/app/(app)/bazar/actions.ts',['buyListing'],{
    prisma,getSessionUser:async()=>({id:'user'}),getSessionPlayer:async()=>({id:'buyer',displayName:'Buyer'}),
    assertBazarPairAllowed:async()=>{},creditMiauvadaoVaultFromPlayerTransaction:async()=>effects.push('vault'),
    _transferItem:async()=>{if(failDelivery)throw Error('delivery failed');effects.push('delivery');},
    recordPlayerActivity:async()=>effects.push('activity'),createPlayerNotification:async()=>effects.push('notification'),
    listingDisplayName:()=> 'Item',revalidateBazar:()=>{},revalidateTag:()=>{},after:()=>{},
    console,Date,Promise,
  });
  return {result:await buyListing('listing'),effects};
}

async function packs() {
  let reads;
  const cards=[{id:'drawn',nationalId:1,displayName:'One',rarity:'COMMON',imageUrl:null},{id:'other',nationalId:2,displayName:'Two',rarity:'COMMON',imageUrl:null}];
  const tx={stickerPack:{findFirst:async()=>({name:'Pack',generation:null,cardCount:1})},pokemonCard:{findMany:async()=>cards},playerSticker:{
    findMany:async args=>{reads=args;return [];},create:async()=>{},
  }};
  const {openStickerPackByName}=functions('src/app/(app)/passe-apoiador/pack-opener.ts',['openStickerPackByName'],{
    EMPTY:{cards:[],totalCoinsEarned:0,packName:''},pickRarity:()=> 'COMMON',pickCardFromPool:pool=>pool[0],Map,Set,
  });
  const result=await openStickerPackByName('p','Pack',tx);
  assert.equal(result.cards.length,1);
  assert.deepEqual(Array.from(reads.where.cardId?.in??[]),['drawn'],'Only drawn cards should be read from inventory');
}

async function gifts() {
  let reads=0,grants=0,claims=0;
  const gift={id:'gift',type:'CUSTOM',title:'Gift',payload:{rewardKind:'ZC',amount:1}};
  const tx={
    playerGift:{findFirst:async()=>{reads++;return gift;},updateMany:async()=>{claims++;return {count:1};}},
    $queryRaw:async(strings,...values)=>{claims++;assert.ok(values.includes('gift'));assert.ok(values.includes('p'));return claims===1?[gift]:[];},
    auditLog:{create:async()=>{}},
  };
  const {claimAllGifts}=functions('src/app/(app)/caixa-de-presentes/actions.ts',['claimAllGifts'],{
    getSessionUser:async()=>({id:'u'}),claimAllGiftsSchema:{parse:x=>x},GIFT_CLAIM_BATCH_SIZE:25,GiftStatus:{UNCLAIMED:'UNCLAIMED'},
    prisma:{player:{findUnique:async()=>({id:'p'})},playerGift:{findMany:async()=>[gift],count:async()=>0},$transaction:async fn=>fn(tx)},
    applyGiftReward:async()=>{grants++;return {};},recordPlayerActivity:async()=>{},revalidateGiftTargets:()=>{},console:{info:()=>{},error:console.error},Date,
  });
  await claimAllGifts({playerId:'p'});
  await claimAllGifts({playerId:'p'});
  assert.equal(reads,0,'Claim should retrieve the authoritative reward in the conditional UPDATE, not a separate SELECT');
  assert.equal(grants,1,'A stale/repeated batch must not deliver the same gift twice');
}

async function navigation() {
  const file='src/app/(app)/layout.tsx';
  const source=fs.readFileSync(file,'utf8');
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const node=ast.statements.find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(ast)==='getNavData'));
  let started=0;
  const read=value=>{started++;return new Promise(resolve=>setTimeout(()=>{assert.equal(started,4,'Independent nav reads must start together');resolve(value);},0));};
  const code=ts.transpileModule(node.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const getNavData=vm.runInNewContext(`${code};getNavData`,{unstable_cache:fn=>fn,prisma:{
    player:{findUnique:async()=>({id:'p'})},playerGift:{count:()=>read(2)},zikaCoinWallet:{findUnique:()=>read({balance:7})},ligaCoinWallet:{findUnique:()=>read({balance:8})},newsPost:{findMany:()=>read([{id:'news'}])},newsRead:{count:async()=>0},
  }});
  const result=await getNavData('u');assert.equal(result.giftCount,2);assert.equal(result.wallet.balance,7);assert.equal(result.unreadNews,1);
}

(async()=>{
  const sold=await purchase({sold:true});assert.ok(sold.result.error,'Stale ACTIVE listing must not be sold twice');assert.equal(sold.effects.length,0);
  const poor=await purchase({balance:10});assert.ok(poor.result.error,'Concurrent spend must not overdraw wallet');assert.equal(poor.effects.length,0);
  const failed=await purchase({failDelivery:true});assert.ok(failed.result.error);assert.equal(failed.effects.length,0);
  const ok=await purchase();assert.ok(!ok.result.error,ok.result.error);assert.equal(ok.effects.at(-1),'vault','Global vault lock must be acquired last');
  await packs();
  await gifts();
  await navigation();
  console.log('PASS: stale sale rejection, conditional debit, delivery rollback, late vault write, bounded sticker inventory');
})().catch(e=>{console.error(e);process.exitCode=1;});
