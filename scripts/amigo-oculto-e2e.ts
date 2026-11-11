// E2E do Amigo Oculto contra o banco (edição de teste, apagada no fim). NODE_PATH precisa de stub de server-only.
import "dotenv/config";
import * as s from "../src/lib/amigo-oculto/service";
import { prisma } from "../src/lib/prisma";
import assert from "node:assert/strict";

(async () => {
  const day = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const c = (await s.createEdition({ name: "E2E", startsOn: day, deliverAt: new Date(Date.now() + 3600_000).toISOString() })) as { id: string };
  assert.ok(c.id);
  assert.ok("error" in (await s.runDraw(c.id)));           // sem inscritos suficientes
  await s.addBots(c.id, 8);
  assert.ok("ok" in (await s.runDraw(c.id)));
  const ed = await prisma.secretSantaEdition.findUniqueOrThrow({ where: { id: c.id }, include: { participants: true } });
  assert.equal(ed.phase, "COLLECTING");
  assert.equal(new Set(ed.participants.map((p) => p.recipientId)).size, 8);
  const p0 = ed.participants[0];
  assert.equal(((await s.checkin(p0.id)) as { counted: boolean }).counted, true);
  assert.equal(((await s.checkin(p0.id)) as { counted: boolean }).counted, false); // 1 por dia
  const card = { greeting: "g1", lines: ["l1", "l2"], closing: "c1", background: "noite", sticker: "🎄" };
  assert.ok("error" in (await s.saveBuild(p0.id, "ovo-raro", card)));   // nível ainda 0
  assert.ok("error" in (await s.saveBuild(p0.id, "cesta", card)));        // tier 1 exige nível 1
  assert.ok("ok" in (await s.saveBuild(p0.id, "", card)));               // só o cartão pode
  assert.ok("ok" in (await s.deliver(c.id)));
  const rec = ed.participants.find((p) => p.id === p0.recipientId)!;
  const o = (await s.openCard(rec.id)) as { card: unknown; gift: { name: string } };
  assert.ok(o.card && o.gift.name);
  console.log("openCard:", o.gift.name, "| view ok:", Boolean((await s.getView(c.id)).edition));
  assert.ok("ok" in (await s.resetEdition(c.id)));
  console.log("E2E OK");
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
