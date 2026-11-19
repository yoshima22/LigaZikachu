// E2E da carteira/caixas do Rei do Rio contra o banco (cria dados temporários e apaga no fim). NODE_PATH precisa de stub de server-only.
import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { creditEditionPoints, claimBox, loadBoxesView } from "../src/lib/rei-do-rio/wallet";

(async () => {
  const player = await prisma.player.findFirstOrThrow({ select: { id: true } });
  const pid = player.id;
  assert.equal(await prisma.reiRioWallet.count({ where: { playerId: pid } }), 0, "jogador de teste já tem carteira");
  const ed = await prisma.reiRioEdition.create({ data: { name: "E2E carteira", isTest: false, mondayDate: "2026-01-05", phase: "FINISHED", finishedAt: new Date() } });
  let giftId: string | null = null;
  try {
    await prisma.reiRioParticipant.createMany({ data: [
      { editionId: ed.id, playerKey: pid, displayName: "E2E", originalJson: {}, totalScore: 123_456 }, // 1.234,56 pts
      { editionId: ed.id, playerKey: "bot-x", displayName: "Bot", isBot: true, originalJson: {}, totalScore: 99_999 },
    ] });
    // crédito: só jogador real, e só uma vez por edição
    assert.equal((await prisma.$transaction((tx) => creditEditionPoints(tx, ed.id))).credited, 1);
    assert.equal((await prisma.$transaction((tx) => creditEditionPoints(tx, ed.id))).credited, 0);
    let w = await prisma.reiRioWallet.findUniqueOrThrow({ where: { playerId: pid } });
    assert.equal(w.balance, 123_456);
    // edição de teste não credita
    await prisma.reiRioEdition.update({ where: { id: ed.id }, data: { isTest: true } });
    await prisma.reiRioCredit.deleteMany({ where: { editionId: ed.id } });
    assert.equal((await prisma.$transaction((tx) => creditEditionPoints(tx, ed.id))).credited, 0);

    // resgate: saldo insuficiente, sucesso, repetição bloqueada
    assert.equal((await claimBox(pid, "trono", "mega")).ok, false);
    const ok = await claimBox(pid, "bengala", "ovo");
    assert.ok(ok.ok, JSON.stringify(ok));
    giftId = ok.ok ? ok.giftId : null;
    assert.equal((await claimBox(pid, "bengala", "mel")).ok, false);          // 1 vez por caixa
    assert.equal((await claimBox(pid, "bengala", "nao-existe")).ok, false);
    w = await prisma.reiRioWallet.findUniqueOrThrow({ where: { playerId: pid } });
    assert.equal(w.balance, 123_456 - 10_000);
    assert.equal(w.spent, 10_000);
    const g = await prisma.playerGift.findUniqueOrThrow({ where: { id: giftId! } });
    const pl = g.payload as { eggs?: unknown[]; rareSweet?: number; food?: number };
    assert.ok((pl.eggs?.length ?? 0) === 1 && pl.rareSweet === 3 && pl.food === 20, JSON.stringify(pl));
    // concorrência: 5 resgates simultâneos da mesma caixa -> só 1 passa
    const par = await Promise.all(Array.from({ length: 5 }, () => claimBox(pid, "meia", "ovo")));
    assert.equal(par.filter((r) => r.ok).length, 1);
    const view = await loadBoxesView(pid);
    assert.equal(view.boxes.filter((b) => b.claimed).length, 2);
    assert.ok(view.boxes.every((b) => b.options.length === 3 && b.options.every((o) => o.items.length >= 3)));
    console.log("saldo final:", view.balance / 100, "| caixas:", view.boxes.length);
    console.log("WALLET E2E OK");
  } finally {
    const gifts = (await prisma.reiRioBoxClaim.findMany({ where: { playerId: pid }, select: { giftId: true } })).map((c) => c.giftId).filter((x): x is string => !!x);
    await prisma.playerGift.deleteMany({ where: { id: { in: gifts } } });
    await prisma.reiRioBoxClaim.deleteMany({ where: { playerId: pid } });
    await prisma.reiRioCredit.deleteMany({ where: { editionId: ed.id } });
    await prisma.reiRioWallet.deleteMany({ where: { playerId: pid } });
    await prisma.reiRioEdition.delete({ where: { id: ed.id } });
    await prisma.$disconnect();
  }
})().catch((e) => { console.error(e); process.exit(1); });
