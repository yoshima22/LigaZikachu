/**
 * Testa o Rebote do Miauvadão: regras puras (janela, bloqueios, preço) e, com --db,
 * o gatilho que mantém boundQuantity <= quantity (tudo dentro de uma transação revertida).
 *   npx tsx scripts/test-miauvadao-rebound.ts [--db]
 */
import assert from "node:assert/strict";
import { computeRebound, reboundPrice, REBOUND_DISCOUNT_DROP, REBOUND_WINDOW_MINUTES, type ReboundSlotOffer } from "../src/lib/miauvadao-rebound";

const start = new Date("2026-10-15T13:00:00.000Z");
const iso = start.toISOString();
const at = (min: number) => new Date(start.getTime() + min * 60_000);
const slot = (name: string, sold: number, discountPct = 40): ReboundSlotOffer =>
  ({ itemType: "MASCOT_FOOD", shopItemId: name, name, originalPrice: 1000, discountPct, finalPrice: 600, stock: 5, sold });
const offers = [slot("a", 5), slot("b", 2), slot("c", 5, 3)];

// Só slots esgotados aparecem; o item é o do slot atual.
let v = computeRebound({ offers, entry: null, rotationStart: start, now: at(1) });
assert.equal(v.block, null);
assert.deepEqual(v.offers.map((o) => o.index), [0, 2]);

// Desconto fica "levemente menor" e nunca negativo.
assert.equal(reboundPrice(offers[0]).discountPct, 40 - REBOUND_DISCOUNT_DROP);
assert.equal(reboundPrice(offers[0]).finalPrice, 650);
assert.equal(reboundPrice(offers[2]).discountPct, 0);

// Janela de 25 minutos.
assert.equal(computeRebound({ offers, entry: null, rotationStart: start, now: at(REBOUND_WINDOW_MINUTES - 0.1) }).block, null);
assert.equal(computeRebound({ offers, entry: null, rotationStart: start, now: at(REBOUND_WINDOW_MINUTES) }).block, "window_closed");

// Quem comprou slot global nesta rotação não tem Rebote; em outra rotação, tem.
assert.equal(computeRebound({ offers, entry: { globalBuyCycle: iso }, rotationStart: start, now: at(2) }).block, "bought_global");
assert.equal(computeRebound({ offers, entry: { globalBuyCycle: "2026-10-15T07:00:00.000Z" }, rotationStart: start, now: at(2) }).block, null);

// 1 cópia por slot e limite de 2 compras por rotação (zera na rotação seguinte).
v = computeRebound({ offers, entry: { reboundCycle: iso, reboundBought: ["0:a"] }, rotationStart: start, now: at(3) });
assert.equal(v.block, null);
assert.equal(v.offers.find((o) => o.index === 0)?.alreadyBought, true);
assert.equal(v.offers.find((o) => o.index === 2)?.alreadyBought, false);
v = computeRebound({ offers, entry: { reboundCycle: iso, reboundBought: ["0:a", "2:c"] }, rotationStart: start, now: at(3) });
assert.equal(v.block, "limit_reached");
v = computeRebound({ offers, entry: { reboundCycle: "2026-10-15T07:00:00.000Z", reboundBought: ["0:a", "2:c"] }, rotationStart: start, now: at(3) });
assert.equal(v.block, null);

// Troca de slot: o item novo gera nova chave, então o rebote acompanha o slot atual.
const swapped = [slot("z", 5), offers[1], offers[2]];
v = computeRebound({ offers: swapped, entry: { reboundCycle: iso, reboundBought: ["0:a"] }, rotationStart: start, now: at(3) });
assert.equal(v.offers.find((o) => o.index === 0)?.alreadyBought, false);

// Debug de admin lista todos os slots, mesmo com estoque.
v = computeRebound({ offers, entry: null, rotationStart: start, now: at(40), includeAll: true });
assert.equal(v.offers.length, 3);
assert.equal(v.offers.find((o) => o.index === 1)?.slotHasStock, true);
console.log("regras puras: ok");

async function dbTest() {
  const { prisma } = await import("../src/lib/prisma");
  const row = await prisma.playerInventory.findFirst({ select: { playerId: true, itemId: true } });
  const food = await prisma.mascotFoodItem.findFirst({ select: { playerId: true, type: true } });
  assert.ok(row && food, "preciso de ao menos 1 linha de inventário e 1 de comida para testar o gatilho");
  const ROLLBACK = new Error("rollback");
  try {
    await prisma.$transaction(async (tx) => {
      const key = { playerId_itemId: { playerId: row.playerId, itemId: row.itemId } };
      await tx.playerInventory.update({ where: key, data: { quantity: 5, boundQuantity: 2 } });
      let r = await tx.playerInventory.findUniqueOrThrow({ where: key });
      assert.equal(r.boundQuantity, 2, "5 itens, 2 vinculados");
      await tx.playerInventory.update({ where: key, data: { quantity: { decrement: 4 } } });
      r = await tx.playerInventory.findUniqueOrThrow({ where: key });
      assert.equal(r.quantity, 1);
      assert.equal(r.boundQuantity, 1, "consumo/escrow nunca deixa mais vinculados que a quantidade");
      await tx.playerInventory.update({ where: key, data: { quantity: { increment: 3 } } });
      r = await tx.playerInventory.findUniqueOrThrow({ where: key });
      assert.equal(r.boundQuantity, 1, "devolver/ganhar itens comuns não aumenta os vinculados");

      const fkey = { playerId_type: { playerId: food.playerId, type: food.type } };
      await tx.mascotFoodItem.update({ where: fkey, data: { quantity: 3, boundQuantity: 3 } });
      await tx.mascotFoodItem.update({ where: fkey, data: { quantity: { decrement: 1 } } });
      const f = await tx.mascotFoodItem.findUniqueOrThrow({ where: fkey });
      assert.equal(f.boundQuantity, 2);
      throw ROLLBACK;
    });
  } catch (error) {
    if (error !== ROLLBACK) throw error;
  }
  await prisma.$disconnect();
  console.log("gatilho de boundQuantity: ok (transação revertida)");
}

if (process.argv.includes("--db")) dbTest().catch((error) => { console.error(error); process.exit(1); });
