import assert from "node:assert/strict";
import { isRestrictedEventItem } from "../src/lib/restricted-event-items";

assert.equal(isRestrictedEventItem({ towerOnly: true, adminGrantOnly: true }), true, "item exclusivo da Torre não pode ser entregue por notícia");
assert.equal(isRestrictedEventItem({ towerOnly: true }), true, "qualquer item marcado para a Torre precisa ser protegido");
assert.equal(isRestrictedEventItem({}), false, "item comum permanece disponível para recompensas de notícia");

console.log("ok restricted event item");
