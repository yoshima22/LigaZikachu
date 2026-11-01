// Conta queries Prisma por página (RTT-independente). Requer `next dev` com stdout em --log.
// Uso: node scripts/loadtest/queries.mjs --log <arquivo> [--base http://localhost:3000]
import { readFileSync } from "node:fs";
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("base", "http://localhost:3000"), LOG = arg("log");
const PAGES = ["/dashboard", "/ranking", "/mascotes", "/jogadores", "/bazar", "/torneios", "/noticias", "/perfil", "/mensagens", "/inventario", "/arena-z", "/carteira"];
const count = () => (readFileSync(LOG, "utf8").match(/prisma:query/g) ?? []).length;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jar = new Map();
const absorb = (r) => { for (const l of r.headers.getSetCookie()) { const [kv] = l.split(";"); const i = kv.indexOf("="); jar.set(kv.slice(0, i), kv.slice(i + 1)); } };
const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
const csrfRes = await fetch(BASE + "/api/auth/csrf"); absorb(csrfRes);
const { csrfToken } = await csrfRes.json();
absorb(await fetch(BASE + "/api/auth/callback/credentials", { method: "POST", redirect: "manual", headers: { cookie: cookie(), "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken, identifier: "loadtest-001@loadtest.invalid", password: "LoadTest#2026", json: "true" }) }));
console.log("rota".padEnd(16), "queries", "  tempo(ms)");
for (const p of PAGES) {
  await fetch(BASE + p, { headers: { cookie: cookie() }, redirect: "manual" }); // aquece compilação
  await sleep(1500);
  const before = count(), t = performance.now();
  const r = await fetch(BASE + p, { headers: { cookie: cookie() }, redirect: "manual" }); await r.arrayBuffer();
  const ms = Math.round(performance.now() - t); await sleep(1500);
  console.log(p.padEnd(16), String(count() - before).padStart(7), String(ms).padStart(10), r.status !== 200 ? ` (HTTP ${r.status} ${r.headers.get("location") ?? ""})` : "");
}
