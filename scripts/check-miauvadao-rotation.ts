/**
 * Check do relogio da rotacao do Miauvadao — nao toca no banco.
 *
 * Protege duas coisas que quebram a vitrine se sairem de sincronia:
 *  1. As janelas de getMiauvadaoRotation() (BRT 04/10/16/22) baterem com o
 *     cron da Vercel `miauvadao-rotation` ("0,5 1,7,13,19 * * *", que roda em UTC).
 *  2. O predicado de expiracao usado por autoRefreshMiauvadaoIfNeeded(), que
 *     passou a decidir a rotacao lendo so `offersRefreshedAt`.
 *
 * Rodar: npx tsx scripts/check-miauvadao-rotation.ts
 */
import assert from "node:assert/strict";
import { getMiauvadaoRotation } from "../src/lib/miauvadao-rotation";

const CRON_UTC_HOURS = [1, 7, 13, 19]; // vercel.json → miauvadao-rotation
const brtHour = (d: Date) =>
  Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(d));

// 1. Toda janela comeca numa hora BRT de rotacao, e o ciclo dura 6h.
for (let h = 0; h < 24; h++) {
  const now = new Date(Date.UTC(2026, 8, 14, h, 30));
  const { start, next } = getMiauvadaoRotation(now);
  assert.ok([4, 10, 16, 22].includes(brtHour(start)), `janela invalida as ${h}h UTC: start BRT ${brtHour(start)}`);
  assert.equal(next.getTime() - start.getTime(), 6 * 60 * 60_000, "ciclo deve durar 6h");
  assert.ok(start <= now && now < next, `now fora da janela as ${h}h UTC`);
}

// 2. Cada disparo do cron cai exatamente numa virada de janela (start == hora do cron).
for (const h of CRON_UTC_HOURS) {
  const atCron = new Date(Date.UTC(2026, 8, 14, h, 0));
  const { start } = getMiauvadaoRotation(atCron);
  assert.equal(start.getTime(), atCron.getTime(), `cron ${h}h UTC nao coincide com a virada da janela`);
}

// 3. Predicado de expiracao de autoRefreshMiauvadaoIfNeeded.
const now = new Date(Date.UTC(2026, 8, 14, 14, 0));
const { start } = getMiauvadaoRotation(now);
const fresh = (stamp: Date | null) => Boolean(stamp && stamp >= start);
assert.equal(fresh(null), false, "sem offersRefreshedAt => tem de rodar a rotacao");
assert.equal(fresh(new Date(start.getTime() - 1)), false, "carimbo do ciclo anterior => tem de rodar");
assert.equal(fresh(start), true, "carimbo exatamente na virada => ja rodou neste ciclo");
assert.equal(fresh(new Date(start.getTime() + 60_000)), true, "carimbo dentro do ciclo => ja rodou");

console.log("ok — relogio da rotacao do Miauvadao consistente com o cron");
