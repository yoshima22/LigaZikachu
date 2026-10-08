import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

for (const file of [".env", ".env.local"]) {
  const filePath = resolve(process.cwd(), file);
  if (!existsSync(filePath)) continue;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^(?:"|')|(?:"|')$/g, "");
    process.env[match[1]] ??= value;
  }
}

import { prisma } from "../src/lib/prisma";
import { ABILITY_TM_IMAGE, EVENT_EGG_IMAGE, LAB_EGG_IMAGE } from "../src/lib/item-image-assets";

async function main() {
  console.log("Synchronizing ability TM shop items...");
  const tm = await prisma.shopItem.updateMany({
    where: { type: "ABILITY_TM", imageUrl: { not: ABILITY_TM_IMAGE } },
    data: { imageUrl: ABILITY_TM_IMAGE },
  });
  console.log("Synchronizing laboratory egg shop item...");
  const labEgg = await prisma.shopItem.updateMany({
    where: { type: "EGG_LAB", imageUrl: { not: LAB_EGG_IMAGE } },
    data: { imageUrl: LAB_EGG_IMAGE },
  });
  console.log("Synchronizing event egg shop item...");
  const eventEgg = await prisma.shopItem.updateMany({
    where: { type: "EGG_EVENT", imageUrl: { not: EVENT_EGG_IMAGE } },
    data: { imageUrl: EVENT_EGG_IMAGE },
  });
  console.log("Counting existing inventories that reference these shop items...");
  const existingInventory = await prisma.playerInventory.count({
    where: { item: { type: { in: ["ABILITY_TM", "EGG_LAB"] } } },
  });
  console.log(JSON.stringify({ abilityTmsUpdated: tm.count, labEggsUpdated: labEgg.count, eventEggsUpdated: eventEgg.count, existingInventoryUsingUpdatedShopItems: existingInventory }, null, 2));
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
