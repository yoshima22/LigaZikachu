// Uses the same isolated jsdom installation as simulate-bulk-ui.mjs.
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
const modules = {};
function load(path) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => modules[name] ?? require(name), window, document, localStorage: window.localStorage }, { filename: path });
  return module.exports;
}
modules['./site-theme-assets'] = load('src/lib/site-theme-assets.ts');
const themes = load('src/lib/site-theme.ts');
modules['@/lib/site-theme'] = themes;
const { SiteThemeSettings } = load('src/components/site-theme-settings.tsx');
const boot = storage => vm.runInNewContext(themes.THEME_INIT_SCRIPT, { document, localStorage: storage });
let root;
try {
  // Server-rendered role gate + CSS scoping protect regular accounts even when
  // an admin previously saved a theme on the same browser.
  const layout = readFileSync('src/app/(app)/layout.tsx', 'utf8');
  const profile = readFileSync('src/app/(app)/perfil/page.tsx', 'utf8');
  assert.match(layout, /const isPlatformAdmin = isAdmin\(user.role\)/);
  assert.match(layout, /data-theme-access=\{isPlatformAdmin \? "admin" : undefined\}/);
  assert.match(profile, /\{adminUser && <SiteThemeSettings \/>\}/);
  const css = readFileSync('src/app/themes.css', 'utf8');
  const themedSelectors = [...css.matchAll(/(html\[data-theme[^{}]+)\{/g)].map(match => match[1].trim()).filter(selector => selector.includes('.site-'));
  assert.equal(themedSelectors.length, 5);
  const fixture = document.createElement('div');
  fixture.innerHTML = '<div class="site-shell"><header class="site-header"><span class="site-brand-themed"></span><span class="site-brand-original"></span></header><main><div class="site-card bg-slate-950/70"></div></main></div>';
  document.body.append(fixture);
  document.documentElement.dataset.theme = 'claro';
  for (const selector of themedSelectors) assert.equal(document.querySelector(selector), null);
  fixture.firstChild.dataset.themeAccess = 'admin';
  for (const selector of themedSelectors) assert.ok(document.querySelector(selector));
  fixture.remove();
  console.log('PASS: non-admin CSS isolation, saved-theme account switch and server selector gate');
  for (const value of [null, 'invalid', 'tecnologico', 'claro', 'competitivo', 'padrao']) {
    boot({ getItem: () => value });
    assert.equal(document.documentElement.dataset.theme, themes.normalizeSiteTheme(value));
  }
  boot({ getItem: () => { throw new Error('blocked'); } });
  assert.equal(document.documentElement.dataset.theme, 'padrao');
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(SiteThemeSettings)));
  assert.equal(document.querySelectorAll('input[type="radio"]').length, 4);
  const next = () => [...document.querySelectorAll('.theme-pagination button')].find(button => button.textContent === 'Próxima');
  assert.equal(themes.SITE_THEMES.length, 10);
  assert.deepEqual(Array.from(themes.SITE_THEMES, theme => theme.id), ['padrao', 'tecnologico', 'claro', 'competitivo', 'aurora', 'oceano', 'esmeralda', 'por-do-sol', 'rubi', 'monocromatico']);
  assert.equal(document.querySelector('[value="aurora"]'), null);
  assert.equal(document.querySelectorAll('[style*="url("]').length, 0);
  for (const { id } of themes.SITE_THEMES) {
    if (!document.querySelector(`input[value="${id}"]`)) await act(async () => next().click());
    await act(async () => document.querySelector(`input[value="${id}"]`).click());
    assert.equal(document.documentElement.dataset.theme, id);
    assert.equal(document.querySelector('input:checked').value, id);
    // Initial default is already selected; changing other choices persists.
    if (id !== 'padrao') assert.equal(window.localStorage.getItem(themes.THEME_STORAGE_KEY), id);
  }
  boot(window.localStorage);
  assert.equal(document.documentElement.dataset.theme, 'monocromatico');
  assert.equal(document.querySelectorAll('input[type="radio"]').length, 2);
  assert.equal(next().disabled, true);
  await act(async () => document.querySelector('button.theme-reset').click());
  assert.equal(document.querySelector('input:checked').value, 'padrao');
  assert.equal(document.querySelectorAll('input[type="radio"]').length, 4);
  assert.equal(window.localStorage.getItem(themes.THEME_STORAGE_KEY), 'padrao');
  console.log('PASS: ten CSS-only themes, pagination boundaries, no remote art, restore from last page');
  await act(async () => window.dispatchEvent(new window.StorageEvent('storage', { key: themes.THEME_STORAGE_KEY, newValue: 'claro' })));
  assert.equal(document.querySelector('input:checked').value, 'claro');
  const original = dom.window.Storage.prototype.setItem;
  dom.window.Storage.prototype.setItem = () => { throw new Error('blocked'); };
  await act(async () => document.querySelector('input[value="tecnologico"]').click());
  assert.equal(document.documentElement.dataset.theme, 'tecnologico');
  assert.match(document.querySelector('[role="status"]').textContent, /bloqueou/);
  dom.window.Storage.prototype.setItem = original;
  await act(async () => document.querySelector('button.theme-reset').click());
  assert.equal(document.documentElement.dataset.theme, 'padrao');
  assert.equal(window.localStorage.getItem(themes.THEME_STORAGE_KEY), 'padrao');
  assert.equal(document.querySelector('input:checked').value, 'padrao');
  for (const selector of themedSelectors) assert.equal(document.querySelector(selector), null);
  boot(window.localStorage);
  assert.equal(document.documentElement.dataset.theme, 'padrao');
  console.log('PASS: explicit restore button resets and persists original appearance');
  await act(async () => window.dispatchEvent(new window.StorageEvent('storage', { key: null })));
  assert.equal(document.querySelector('input:checked').value, 'padrao');
  console.log('PASS: boot whitelist, blocked storage, immediate application, persistence, cross-tab updates and storage reset');
} finally {
  if (root) await act(async () => root.unmount());
  dom.window.close();
}
