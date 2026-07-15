import { prisma } from "@/lib/prisma";
import { invalidateShopCache } from "@/lib/shop-cache";
import { buildMegaStoneMetadata, getMegaStoneDescription, MEGA_STONES } from "@/lib/mega-evolution";

function getMegaStoneImageUrl(megaPokemonId: number) {
  return `/sprites/pokemon/${megaPokemonId}.png`;
}

async function safeInvalidateShopCache() {
  try {
    await invalidateShopCache();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("static generation store missing")) throw error;
  }
}

export async function ensureMegaStoneShopItems(active = false) {
  let changed = false;
  const existingItems = await prisma.shopItem.findMany({
    where: { type: { in: MEGA_STONES.map((stone) => stone.type) } },
    select: {
      id: true,
      type: true,
      name: true,
      description: true,
      imageUrl: true,
      rarity: true,
      price: true,
      active: true,
      sortOrder: true,
      metadata: true,
    },
  });
  const existingByType = new Map(existingItems.map((item) => [item.type, item]));

  for (const stone of MEGA_STONES) {
    const data = {
      type: stone.type,
      name: stone.stoneName,
      description: getMegaStoneDescription(stone),
      imageUrl: getMegaStoneImageUrl(stone.megaPokemonId),
      rarity: "LEGENDARY" as const,
      price: stone.price,
      active,
      sortOrder: 1600 + stone.megaPokemonId,
      metadata: buildMegaStoneMetadata(stone),
    };
    const existing = existingByType.get(stone.type);
    if (existing) {
      const nextActive = active || existing.active;
      const nextMetadata = data.metadata;
      const currentMetadata = existing.metadata;
      const metadataChanged = JSON.stringify(currentMetadata ?? null) !== JSON.stringify(nextMetadata);
      const needsUpdate =
        existing.name !== data.name ||
        existing.description !== data.description ||
        existing.imageUrl !== data.imageUrl ||
        existing.rarity !== data.rarity ||
        existing.price !== data.price ||
        existing.active !== nextActive ||
        existing.sortOrder !== data.sortOrder ||
        metadataChanged;
      if (needsUpdate) {
        await prisma.shopItem.update({
          where: { id: existing.id },
          data: { ...data, active: nextActive },
        });
        changed = true;
      }
    } else {
      await prisma.shopItem.create({ data });
      changed = true;
    }
  }
  if (changed) await safeInvalidateShopCache();
}

export async function activateMegaStoneShopItems() {
  await ensureMegaStoneShopItems(false);
  await prisma.shopItem.updateMany({
    where: { type: { in: MEGA_STONES.map((stone) => stone.type) } },
    data: { active: true },
  });
  await safeInvalidateShopCache();
}

export async function isMegaStoneShopUnlocked() {
  const event = await prisma.raidEvent.findUnique({
    where: { slug: "ordem-da-trapaca" },
    select: { phase: true },
  }).catch(() => null);
  return event?.phase === "RAID_DEFEATED" || event?.phase === "ENDED";
}
