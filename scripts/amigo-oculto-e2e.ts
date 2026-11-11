// E2E do Amigo Oculto contra o banco (edição de teste, apagada no fim). NODE_PATH precisa de stub de server-only.
import "dotenv/config";
import * as s from "../src/lib/amigo-oculto/service";
import { loadPackages, giftPayload } from "../src/lib/amigo-oculto/catalog-db";
import { prisma } from "../src/lib/prisma";
import assert from "node:assert/strict";

const ok = (r: unknown) => assert.ok(r && typeof r === "object" && !("error" in (r as object)), JSON.stringify(r));
const err = (r: unknown) => assert.ok(r && typeof r === "object" && "error" in (r as object), "esperava erro: " + JSON.stringify(r));

(async () => {
  let giftId: string | null = null;
  const day = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const c = (await s.createEdition({ name: "E2E", startsOn: day, deliverAt: new Date(Date.now() + 3600_000).toISOString() })) as { id: string };
  assert.ok(c.id);
  try {
    // pacotes reais da loja, com imagens
    const packs = await loadPackages();
    for (const t of [1, 2, 3, 4]) assert.ok(packs.filter((p) => p.tier === t).length >= 3, `nível ${t} sem 3 pacotes resolvidos`);
    console.log("pacotes:", packs.length, "| itens com imagem:", packs.flatMap((p) => p.items).filter((i) => i.imageUrl).length, "/", packs.flatMap((p) => p.items).length);

    err(await s.runDraw(c.id));                       // poucos inscritos
    await s.addBots(c.id, 7);
    const real = await prisma.player.findFirstOrThrow({ select: { id: true, displayName: true } });
    ok(await s.register(c.id, real.id, real.displayName));
    ok(await s.runDraw(c.id));
    const ed = await prisma.secretSantaEdition.findUniqueOrThrow({ where: { id: c.id }, include: { participants: true } });
    assert.equal(ed.phase, "COLLECTING");
    assert.equal(new Set(ed.participants.map((p) => p.recipientId)).size, 8);        // cada um é tirado 1 vez
    assert.ok(ed.participants.every((p) => p.recipientId && p.recipientId !== p.id)); // ninguém tira a si
    // a restrição do banco impede repetir recebedor
    await assert.rejects(prisma.secretSantaParticipant.update({ where: { id: ed.participants[0].id }, data: { recipientId: ed.participants[1].recipientId } }));

    const p0 = ed.participants[0];
    assert.equal(((await s.checkin(p0.id)) as { counted: boolean }).counted, true);
    assert.equal(((await s.checkin(p0.id)) as { counted: boolean }).counted, false);  // 1 por dia
    const card = { greeting: "g1", lines: ["l1", "f1"], closing: "c1", background: "noite", sticker: "🎄", image: "ceia" };
    err(await s.saveBuild(p0.id, ["guloseimas", "torcedor", "visual"], card));         // nível 0: bloqueado
    ok(await s.saveBuild(p0.id, [], card));                                            // só o cartão
    ok(await s.debugCheckins(c.id, "fill"));                                           // laços cheios -> nível 4
    err(await s.saveBuild(p0.id, ["guloseimas", "torcedor"], card));                   // exige 3
    for (const p of ed.participants) ok(await s.saveBuild(p.id, ["tm-poder", "especial", "laboratorio"], card));

    // entrega automática ao acessar depois do horário
    await prisma.secretSantaEdition.update({ where: { id: c.id }, data: { deliverAt: new Date(Date.now() - 60_000) } });
    const v = await s.playerView(c.id, real.id);
    assert.equal(v!.edition.phase, "DELIVERED");
    assert.equal(v!.gallery.length, 8);
    assert.ok(v!.me && v!.me.recipient);
    const done = await prisma.secretSantaParticipant.findMany({ where: { editionId: c.id } });
    for (const p of done) assert.ok(["tm-poder", "especial", "laboratorio"].includes(p.giftKey!), "sorteio fora das 3 opções");
    err(await s.deliver(c.id));                                                       // idempotente: segunda entrega não faz nada

    // recebedor real abre o cartão -> presente na Caixa com itens reais
    const realP = done.find((p) => p.playerId === real.id)!;
    const o = (await s.openCard(realP.id)) as unknown as { card: unknown; pkg: { name: string; items: unknown[] }; giftId: string | null };
    giftId = o.giftId;
    assert.ok(o.card && o.pkg.name && giftId);
    const g = await prisma.playerGift.findUniqueOrThrow({ where: { id: giftId! } });
    const pl = g.payload as { shopItems?: unknown[]; eggs?: unknown[] };
    assert.ok((pl.shopItems?.length ?? 0) + (pl.eggs?.length ?? 0) > 0);
    const again = (await s.openCard(realP.id)) as unknown as { giftId: string | null };
    assert.equal(again.giftId, giftId);                                               // reabrir não duplica o presente
    assert.equal(await prisma.playerGift.count({ where: { playerId: real.id, title: g.title, createdAt: { gte: g.createdAt } } }), 1);
    console.log("openCard:", o.pkg.name, "| payload:", JSON.stringify(giftPayload(packs.find((p) => p.name === o.pkg.name)!, false)).slice(0, 160));
    console.log("E2E OK");
  } finally {
    if (giftId) await prisma.playerGift.delete({ where: { id: giftId } }).catch(() => {});
    await s.resetEdition(c.id);
    await prisma.$disconnect();
  }
})().catch((e) => { console.error(e); process.exit(1); });
