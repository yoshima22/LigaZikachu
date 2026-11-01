// Teste de carga: N usuários logam (rampa) e navegam por tempo fixo.
// Uso: node scripts/loadtest/run.mjs [--base http://localhost:3000] [--users 200] [--ramp 60] [--duration 120]
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("base", "http://localhost:3000");
const USERS = +arg("users", 200), RAMP = +arg("ramp", 60), DURATION = +arg("duration", 120);
const PASSWORD = "LoadTest#2026";
const PAGES = [ // [path, peso]
  ["/dashboard", 10], ["/ranking", 4], ["/mascotes", 6], ["/jogadores", 3], ["/bazar", 4], ["/torneios", 2],
  ["/noticias", 2], ["/perfil", 2], ["/mensagens", 2], ["/inventario", 2], ["/arena-z", 2], ["/carteira", 1],
];
const POLLS = ["/api/league-ticker", "/api/maintenance-check"];
const total = PAGES.reduce((s, [, w]) => s + w, 0);
const pick = () => { let r = Math.random() * total; for (const [p, w] of PAGES) if ((r -= w) < 0) return p; return PAGES[0][0]; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const stats = new Map(); // rota -> { lat: [], err: {} }
const recent = []; let aborted = false; // freio: aborta se >15% das últimas 100 req falharem
const rec = (route, ms, err) => {
  recent.push(err ? 1 : 0); if (recent.length > 100) recent.shift();
  if (recent.length === 100 && recent.reduce((a, b) => a + b) > 15 && !aborted) { aborted = true; console.log("ABORTADO: >15% de erros nas últimas 100 requisições"); }
  const s = stats.get(route) ?? { lat: [], err: {} }; stats.set(route, s);
  s.lat.push(ms); if (err) s.err[err] = (s.err[err] ?? 0) + 1;
};

class Jar {
  c = new Map();
  absorb(res) { for (const l of res.headers.getSetCookie()) { const [kv] = l.split(";"); const i = kv.indexOf("="); this.c.set(kv.slice(0, i), kv.slice(i + 1)); } }
  get h() { return [...this.c].map(([k, v]) => `${k}=${v}`).join("; "); }
}

async function req(jar, route, path, init = {}) {
  const t = performance.now();
  try {
    const res = await fetch(BASE + path, { redirect: "manual", signal: AbortSignal.timeout(60_000), ...init, headers: { cookie: jar.h, ...init.headers } });
    res.raw = Buffer.from(await res.arrayBuffer()).toString(); jar.absorb(res);
    const loc = res.headers.get("location") ?? "";
    const err = res.status >= 500 ? `HTTP ${res.status}` : res.status >= 300 && res.status < 400 && /login|manutencao/.test(loc) ? `redirect ${loc.split("?")[0]}` : res.status >= 400 ? `HTTP ${res.status}` : null;
    rec(route, performance.now() - t, err); return res;
  } catch (e) { rec(route, performance.now() - t, e.name === "TimeoutError" ? "timeout" : "fetch error"); return null; }
}

async function login(jar, email) {
  const csrf = await req(jar, "login:csrf", "/api/auth/csrf");
  const csrfToken = (() => { try { return JSON.parse(csrf.raw).csrfToken; } catch { return null; } })();
  if (!csrfToken) return false;
  const body = new URLSearchParams({ csrfToken, identifier: email, password: PASSWORD, json: "true" });
  const res = await req(jar, "login:credentials", "/api/auth/callback/credentials", { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" } });
  return !!res && [...jar.c.keys()].some((k) => k.includes("session-token"));
}

let logged = 0, failedLogin = 0;
const endAt = Date.now() + (RAMP + DURATION) * 1000;
async function user(i) {
  await sleep((i / USERS) * RAMP * 1000); if (aborted) return;
  const jar = new Jar();
  if (!(await login(jar, `loadtest-${String(i + 1).padStart(3, "0")}@loadtest.invalid`))) { failedLogin++; return; }
  logged++;
  let nextPoll = Date.now() + 30_000;
  while (Date.now() < endAt && !aborted) {
    const page = pick();
    await req(jar, page, page);
    if (Date.now() > nextPoll) { for (const p of POLLS) await req(jar, "poll " + p, p); nextPoll = Date.now() + 30_000; }
    await sleep(3000 + Math.random() * 5000); // "pensando" 3-8s
  }
}

const q = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
console.log(`alvo ${BASE} | ${USERS} usuários | rampa ${RAMP}s | ${DURATION}s de navegação`);
const tick = setInterval(() => { const n = [...stats.values()].reduce((s, v) => s + v.lat.length, 0); process.stdout.write(`\r  logados ${logged}/${USERS} | requisições ${n}   `); }, 2000);
await Promise.all(Array.from({ length: USERS }, (_, i) => user(i)));
clearInterval(tick);

console.log(`\n\nlogins ok ${logged}, falhos ${failedLogin}\n`);
console.log("rota".padEnd(30), "n".padStart(6), "p50".padStart(7), "p95".padStart(7), "p99".padStart(7), "max".padStart(7), " erros");
let all = 0, bad = 0;
for (const [r, s] of [...stats].sort()) {
  const a = s.lat.sort((x, y) => x - y), e = Object.entries(s.err).map(([k, v]) => `${k}×${v}`).join(", ");
  all += a.length; bad += Object.values(s.err).reduce((x, y) => x + y, 0);
  console.log(r.padEnd(30), String(a.length).padStart(6), ...[.5, .95, .99, 1].map((p) => String(Math.round(q(a, p === 1 ? 0.9999 : p))).padStart(7)), " " + e);
}
console.log(`\ntotal ${all} req, ${bad} com erro (${((bad / all) * 100).toFixed(1)}%), ~${(all / (RAMP + DURATION)).toFixed(1)} req/s`);
