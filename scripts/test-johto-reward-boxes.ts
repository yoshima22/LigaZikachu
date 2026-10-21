import assert from "node:assert/strict";
import { getJohtoPrize, JOHTO_BOXES, rollJohtoBox } from "../src/lib/johto-reward-boxes";

// Catch treating item chances as mutually exclusive, losing guarantees, or excluding range endpoints.
const commonMin = rollJohtoBox("common", { random: () => 0 });
assert.equal(commonMin.length, 11, "all items can drop together");
assert.equal(commonMin.find((r) => r.id === "protein")?.quantity, 3);
assert.equal(commonMin.find((r) => r.id === "special-egg")?.quantity, 1);
const commonMax = rollJohtoBox("common", { random: () => 0.999999 });
assert.deepEqual(commonMax.map((r) => r.id), ["food", "sweet"], "guaranteed items survive bad luck");
const forced = rollJohtoBox("special", { random: () => 0.999999, guaranteeAll: true });
assert.equal(forced.length, 11);
assert.equal(forced.find((r) => r.id === "protein")?.quantity, 9);
assert.equal(forced.find((r) => r.id === "loot")?.quantity, 12);
assert.equal(forced.find((r) => r.id === "lab-egg")?.quantity, 3);
assert.equal(forced.find((r) => r.id === "lab-egg")?.boostPercent, 20);
assert.equal(rollJohtoBox("remembrance", { random: () => 0.009 }).find((r) => r.id === "lab-egg")?.boostPercent, 65);
assert.equal(rollJohtoBox("remembrance", { random: () => 0.01 }).some((r) => r.id === "lab-egg"), false, "1% drop boundary is exclusive");
assert.equal(rollJohtoBox("remembrance", { random: () => 0, guaranteeAll: true }).some((r) => r.id === "loot"), false, "disabled prizes stay disabled even in forced mode");

// Catch skipping one item's independent roll or rolling quantity before deciding its drop.
const draws = [0.9, 0.9, 0.9, 0.96, 0.59, 0.99, 0.51, 0.86, 0.46, 0.61, 0.16, 0.81];
const independent = rollJohtoBox("common", { random: () => {
  const next = draws.shift();
  assert.notEqual(next, undefined, "unexpected extra random draw");
  return next!;
} });
assert.equal(independent.find((r) => r.id === "protein")?.quantity, 4);
assert.equal(independent.some((r) => r.id === "coins"), false);
assert.equal(independent.some((r) => r.id === "special-egg"), false);
assert.equal(draws.length, 0);

for (const tier of Object.keys(JOHTO_BOXES) as Array<keyof typeof JOHTO_BOXES>) {
  const box = JOHTO_BOXES[tier];
  assert.ok(box.items.every((r) => r.chance >= 0 && r.chance <= 1 && r.min >= 0 && r.max >= r.min));
  assert.ok(!box.items.some((r) => r.kind === "egg" && /raro/i.test(r.label)), "no rare eggs");
  const result = rollJohtoBox(tier, { random: () => 0.5 });
  assert.ok(result.every((r) => Number.isInteger(r.quantity) && r.quantity > 0));
}

const champion = getJohtoPrize("title-first");
assert.deepEqual(champion.boxes, ["remembrance", "special"]);
assert.equal(champion.items.find((r) => r.id === "lab-egg")?.quantity, 3);
assert.equal(champion.items.find((r) => r.id === "special-egg")?.boostPercent, 25);
assert.deepEqual(getJohtoPrize("title-second").boxes, ["remembrance", "rare", "rare"], "vice-champion receives two rare boxes plus the universal remembrance");
for (const placement of ["title-first", "title-second", "title-third", "title-fourth"] as const) {
  const prize = getJohtoPrize(placement);
  assert.equal(prize.cosmeticsPending, true, "exclusive title and banner wait for the user's definitions");
  assert.ok(!prize.items.some((r) => r.kind === "cosmetic"), "undefined cosmetics must not appear as claimable rewards");
}
const cup = getJohtoPrize("cup-first");
assert.deepEqual(cup.boxes, ["remembrance", "rare"]);
assert.equal(cup.items.find((r) => r.id === "lab-egg")?.boostPercent, 5);
assert.equal(cup.items.find((r) => r.id === "protein")?.quantity, 1);
assert.equal(cup.cosmeticsPending, false);
const vice = getJohtoPrize("cup-second");
assert.deepEqual(vice.boxes, ["remembrance", "common", "common"]);
assert.equal(vice.items.find((r) => r.id === "special-egg")?.quantity, 2);
assert.deepEqual(getJohtoPrize("cup-first-round").boxes, ["remembrance", "remembrance"]);
assert.equal(getJohtoPrize("cup-first-round").items.find((r) => r.id === "vacation")?.quantity, 3);
assert.equal(getJohtoPrize("cup-semi").items.find((r) => r.id === "special-egg")?.quantity, 1);
console.log("Johto rewards: independent drops, inclusive quantities, guarantees and placement packages passed.");
