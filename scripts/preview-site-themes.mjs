// Local-only visual fixture: actual theme selector/CSS, no auth or player data.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
const result = await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {SiteThemeSettings} from './src/components/site-theme-settings'; createRoot(document.getElementById('settings')).render(React.createElement(SiteThemeSettings));`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' } });
const css = await readFile('src/app/themes.css', 'utf8');
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1:4175');
  if (url.pathname === '/bundle.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(result.outputFiles[0].text); return; }
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (url.pathname === '/mobile') { response.end('<iframe title="Mobile preview" src="/?theme=mewtwo" style="width:390px;height:844px;border:1px solid #555"></iframe>'); return; }
  const theme = ['padrao', 'alakazam', 'mewtwo', 'sudowoodo'].includes(url.searchParams.get('theme')) ? url.searchParams.get('theme') : 'padrao';
  const access = url.searchParams.get('admin') === 'false' ? '' : 'data-theme-access="admin"';
  response.end(`<!doctype html><html lang="pt-BR" data-theme="${theme}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;color:#f8fafc;background:#0f0f1a;font-family:Arial,sans-serif}button,input{font:inherit}button{cursor:pointer;color:inherit}fieldset{border:0;padding:0}h2,p{margin:0}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}.site-shell{min-height:100vh;background:#0f0f1a}.site-header{position:sticky;top:0;z-index:40;background:#1a1a2e;padding:12px 24px;display:flex;align-items:center;justify-content:space-between}.site-shell>main{max-width:1280px;margin:auto;padding:24px}.site-card{padding:24px;border:1px solid #334155;border-radius:16px;margin-bottom:16px;background:#020617e0}.site-card h2{margin-bottom:10px}${css}</style></head><body><div class="site-shell" ${access}><header class="site-header"><img class="site-brand-logo" width="600" height="200" alt="Liga Zikachu" src="https://fwxqywivezsixamietps.supabase.co/storage/v1/object/public/assets/site-themes/logo-logo-12b7c35d5be9.webp"><span>Perfil</span></header><main><div class="site-card bg-slate-950/70"><h2>Perfil · Configurações</h2><p>Prévia local — sem dados de jogadores.</p></div><div id="settings"></div></main></div><script src="/bundle.js"></script></body></html>`);
});
server.listen(4175, '127.0.0.1', () => console.log('Theme visual fixture: http://127.0.0.1:4175/?theme=alakazam'));
