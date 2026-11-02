import assert from "node:assert/strict";
import { EVENT_BONUS_CHANCE, getExpeditionOdds, getMascotStatusGrowthMultiplier, rollEventBonus } from "../src/lib/mascot-data";

// Bônus de Ovo de Evento: sem bônus acima da chance; com bônus, +3..+6 em um atributo válido.
assert.equal(rollEventBonus(() => EVENT_BONUS_CHANCE), null);
const seq = [0.1, 0.5, 0.99];
let i = 0;
const bonus = rollEventBonus(() => seq[i++ % seq.length]);
assert.deepEqual(bonus, { stat: "statCharisma", value: 6 });
for (let n = 0; n < 500; n++) {
  const b = rollEventBonus();
  if (b) assert.ok(b.value >= 3 && b.value <= 6);
}

// Amuleto: +50% de chance de Pedra de Mega em Itens 6h.
const base = getExpeditionOdds({ duration: "6h", mode: "ITEMS", level: 50, instinct: 40 });
const lucky = getExpeditionOdds({ duration: "6h", mode: "ITEMS", level: 50, instinct: 40, luckBuff: true });
assert.ok(Math.abs(lucky.megaStone - base.megaStone * 1.5) < 1e-9);

// Penas "comuns": Mewtwo (lendário) e Dratini (pseudo) fora; Pikachu dentro.
assert.equal(getMascotStatusGrowthMultiplier(25), 1);
assert.notEqual(getMascotStatusGrowthMultiplier(150), 1);
assert.notEqual(getMascotStatusGrowthMultiplier(147), 1);
console.log("item rebalance: ok");
