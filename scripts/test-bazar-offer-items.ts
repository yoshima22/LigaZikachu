import assert from "node:assert/strict";
import {
  canonicalizeReservedInventoryOffer,
  directOfferItemKey,
  toDirectInventoryOffer,
} from "../src/lib/bazar-offer-items";

const laboratoryFeather = toDirectInventoryOffer({
  shopItemId: "laboratory-feather",
  type: "RAINBOW_FEATHER",
  name: "Pena Arco-Íris de Laboratório",
  quantity: 4,
});
const rareFeather = toDirectInventoryOffer({
  shopItemId: "rare-feather",
  type: "RAINBOW_FEATHER",
  name: "Pena Arco-Íris Rara",
  quantity: 1,
});

assert.equal(laboratoryFeather.shopItemId, "laboratory-feather");
assert.equal(laboratoryFeather.displayName, "Pena Arco-Íris de Laboratório");
assert.notEqual(directOfferItemKey(laboratoryFeather), directOfferItemKey(rareFeather));

const reservedRareFeather = canonicalizeReservedInventoryOffer(
  { ...laboratoryFeather, displayName: "Pena Arco-Íris de Laboratório" },
  { itemId: "rare-feather", name: "Pena Arco-Íris Rara" },
);
assert.equal(reservedRareFeather.shopItemId, "rare-feather");
assert.equal(reservedRareFeather.displayName, "Pena Arco-Íris Rara");

console.log("bazar direct-offer item selection: ok");
