import assert from "node:assert/strict";
import { test } from "node:test";
import { newExpeditionState } from "./expedition-state";
import { generateTowerRoomGraph } from "./rooms";
import {
  discardPendingFloorDrops,
  planRewardSettlement,
  recordFloorDrop,
  secureFloorDrops,
  settleRunRewards,
  type RewardGrant,
} from "./reward-ledger";

function party() {
  return newExpeditionState(generateTowerRoomGraph("reward-ledger"), ["ana", "bruno", "caio"]);
}

test("death before the floor boss forfeits pending finds", () => {
  const found = recordFloorDrop(party(), 2, { id: "room-2-egg", kind: "EGG", eggType: "EVENT", quantity: 1, label: "Ovo de Evento" });
  const failed = discardPendingFloorDrops(found, 2);
  assert.equal(failed.rewardLedger[0].status, "LOST");
  assert.deepEqual(planRewardSettlement(failed, "run-1"), []);
});

test("floor 2 secured egg survives death on 3; downed receives it and AFK receives nothing", () => {
  let state = party();
  state.members.bruno.status = "DOWNED";
  state.members.caio.status = "AFK_ABANDONED";
  state = recordFloorDrop(state, 2, { id: "floor-2-egg", kind: "EGG", eggType: "EVENT", quantity: 1, label: "Ovo de Evento" });
  state = secureFloorDrops(state, 2);
  state = recordFloorDrop(state, 3, { id: "floor-3-coin", kind: "COINS", quantity: 50, label: "50 ZC" });
  state = discardPendingFloorDrops(state, 3);
  assert.deepEqual(state.rewardLedger.map((entry) => [entry.id, entry.status]), [
    ["floor-2-egg", "SECURED"], ["floor-3-coin", "LOST"],
  ]);
  assert.deepEqual(planRewardSettlement(state, "run-2").map((grant) => [grant.userId, grant.reward.id]), [
    ["ana", "floor-2-egg"], ["bruno", "floor-2-egg"],
  ]);
});

test("a second settlement cannot duplicate coins, eggs or items", async () => {
  let state = party();
  state = recordFloorDrop(state, 1, { id: "coins", kind: "COINS", quantity: 30, label: "30 ZC" });
  state = recordFloorDrop(state, 1, { id: "egg", kind: "EGG", eggType: "RARE", quantity: 1, label: "Ovo Raro" });
  state = recordFloorDrop(state, 1, { id: "item", kind: "ITEM", itemId: "event-item", quantity: 1, label: "Item" });
  state = secureFloorDrops(state, 1);
  const grants = planRewardSettlement(state, "run-3").filter((grant) => grant.userId === "ana");
  const applied = new Set<string>();
  const inventory: string[] = [];
  const store = {
    async grantOnce(runId: string, userId: string, rewardId: string, reward: RewardGrant["reward"]) {
      const key = `${runId}:${userId}:${rewardId}`;
      if (applied.has(key)) return false;
      applied.add(key);
      inventory.push(`${reward.kind}:${reward.quantity}`);
      return true;
    },
  };
  assert.deepEqual(await settleRunRewards(store, grants), { granted: 3, alreadyGranted: 0 });
  assert.deepEqual(await settleRunRewards(store, grants), { granted: 0, alreadyGranted: 3 });
  assert.deepEqual(inventory, ["COINS:30", "EGG:1", "ITEM:1"]);
});

test("re-recording one room's drop in the same run does not double its quantity", () => {
  const first = recordFloorDrop(party(), 1, { id: "same-room", kind: "COINS", quantity: 10, label: "10 ZC" });
  const repeated = recordFloorDrop(first, 1, { id: "same-room", kind: "COINS", quantity: 10, label: "10 ZC" });
  assert.equal(repeated.rewardLedger.length, 1);
  assert.equal(repeated.rewardLedger[0].quantity, 10);
});
