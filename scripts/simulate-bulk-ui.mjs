import { JSDOM } from '../.codex-tmp/performance/node_modules/jsdom/lib/api.js';
import React, { act } from 'react';
import ts from 'typescript';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const require = createRequire(import.meta.url);
const messages = [];
let refreshes = 0;
const actions = {};
const mock = {
  'next/navigation': { useRouter: () => ({ refresh: () => refreshes++ }) },
  sonner: { toast: Object.fromEntries(['success','info','warning','error'].map(key => [key, value => messages.push({ key, value })])) },
  '../actions': actions,
  '@/components/ui/button': { Button: props => React.createElement('button',props) },
  './mascot-card': Object.fromEntries(['clearPlayed','clearPetted','hydrateInteractionCooldown','markPlayed','markPetted','isPlayOnCooldown','isPetOnCooldown'].map(key => [key, () => false])),
  '@/hooks/use-timer-expiry': { formatRemaining: () => '' },
  './sweet-kind-menu': { RARE_SWEET_IMAGE_URL: '/fake.png' },
};
function load(path) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(path,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { module, exports:module.exports, require: name => mock[name] ?? require(name), window:dom.window, CustomEvent:dom.window.CustomEvent, setTimeout, setInterval, clearInterval, console, Date }, { filename:path });
  return module.exports;
}
const { ClaimAllGiftsButton, GiftClaimButton } = load('src/app/(app)/caixa-de-presentes/_components/GiftClaimButton.tsx');
const { BulkInteractPanel } = load('src/app/(app)/mascotes/_components/bulk-interact-panel.tsx');
let root;
const mount = async element => { root = createRoot(document.getElementById('root')); await act(async()=>root.render(element)); };
const unmount = async () => act(async()=>root.unmount());
const click = text => [...document.querySelectorAll('button')].find(button=>button.textContent.includes(text)).click();
const delay = ms=>new Promise(resolve=>setTimeout(resolve,ms));
try {
  let resolveFirst;
  let calls = 0;
  actions.claimAllGifts = async () => {
    calls++;
    if(calls===1) return new Promise(resolve=>{ resolveFirst=resolve; });
    return { success:true, claimed:5, remaining:0 };
  };
  await mount(React.createElement(ClaimAllGiftsButton,{playerId:'synthetic',count:30}));
  await act(async()=>click('Receber todos'));
  assert.match(document.body.textContent,/Recebendo/);
  assert.equal(document.querySelector('button').disabled,true);
  await act(async()=>{ resolveFirst({success:true,claimed:25,remaining:5}); await delay(400); });
  assert.equal(calls,2);
  assert.ok(messages.some(m=>m.value==='30 presentes recebidos.'));
  assert.equal(refreshes,1);
  await unmount();
  console.log('PASS gifts: immediate pending state, automatic continuation, final refresh');

  calls=0;
  actions.claimAllGifts=async()=>{ calls++; return {success:true,claimed:0,remaining:5,failed:1}; };
  await mount(React.createElement(ClaimAllGiftsButton,{playerId:'synthetic',count:5}));
  await act(async()=>{ click('Receber todos'); await delay(350); });
  assert.equal(calls,1);
  assert.ok(messages.some(m=>m.key==='warning'));
  await unmount();
  console.log('PASS gifts: failed batch stops without infinite retry');

  actions.claimGift=async()=>({error:'Synthetic failure'});
  await mount(React.createElement(GiftClaimButton,{giftId:'synthetic'}));
  await act(async()=>click('Receber presente'));
  assert.ok(messages.some(m=>m.key==='error' && m.value==='Synthetic failure'));
  await unmount();
  console.log('PASS gift: individual errors are visible');

  const fed=[]; const stock=[];
  window.addEventListener('mascots-fed',e=>fed.push(e.detail));
  window.addEventListener('mascot-food-inventory',e=>stock.push(e.detail));
  calls=0;
  actions.feedAllAction=async()=>{
    calls++;
    return {fed:1,fedIds:['m'+calls],fedMascots:[{id:'m'+calls,happiness:70}],fedAt:'2026-09-29T12:00:00.000Z',inventoryRemaining:calls===1?1:0,remainingEligible:calls===1?1:0,noFood:false};
  };
  await mount(React.createElement(BulkInteractPanel,{scope:'ALL',mascotIds:['m1','m2']}));
  await act(async()=>{click('Alimentar Todos'); await delay(400);});
  assert.equal(calls,2);
  assert.equal(fed.length,2);
  assert.equal(fed[0].fedAt,Date.parse('2026-09-29T12:00:00.000Z'));
  assert.equal(fed[0].mascots[0].happiness,70);
  assert.equal(stock[1].remaining,0);
  await unmount();
  console.log('PASS feed: automatic continuation and confirmed card/inventory events');
} finally {
  dom.window.close();
}
