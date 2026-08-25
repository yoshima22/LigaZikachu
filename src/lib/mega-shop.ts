import { prisma } from "@/lib/prisma";
import { invalidateShopCache } from "@/lib/shop-cache";
import { buildMegaStoneMetadata, getMegaStoneDescription, MEGA_STONES, getMegaStoneForMegaPokemon } from "@/lib/mega-evolution";
import { CUSTOM_MEGA_POKEMON_IDS } from "@/lib/extra-mega-stones";

// Pedras das formas mega custom: visibilidade controlada pelo toggle do admin
// (EggPokemonToggle), não pelo evento da Ordem da Trapaça.
const CUSTOM_MEGA_SET = new Set(CUSTOM_MEGA_POKEMON_IDS);

// Conjunto de megas custom desligados (fora do drop) — a pedra fica inativa.
async function getDisabledCustomMegaIds(): Promise<Set<number>> {
  if (CUSTOM_MEGA_POKEMON_IDS.length === 0) return new Set();
  const rows = await prisma.eggPokemonToggle.findMany({
    where: { pokemonId: { in: CUSTOM_MEGA_POKEMON_IDS }, disabled: true },
    select: { pokemonId: true },
  });
  return new Set(rows.map((r) => r.pokemonId));
}

const MEGA_STONE_ASSET_BASE = (process.env.NEXT_PUBLIC_MEGA_STONE_ASSET_BASE_URL ?? "https://fwxqywivezsixamietps.supabase.co/storage/v1/object/public/assets/shop/mega-stones")
  .replace(/\/$/, "");

const CUSTOM_MEGA_STONE_IMAGES: Record<number, string> = {
  10301: `${MEGA_STONE_ASSET_BASE}/mega-feraligatr-10301.png`,
  10302: `${MEGA_STONE_ASSET_BASE}/mega-hawlucha-10302.png`,
};

function getMegaStoneImageUrl(megaPokemonId: number) {
  if (CUSTOM_MEGA_STONE_IMAGES[megaPokemonId]) return CUSTOM_MEGA_STONE_IMAGES[megaPokemonId];
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
  const disabledCustom = await getDisabledCustomMegaIds();

  for (const stone of MEGA_STONES) {
    // Pedra custom: ativa apenas se o mega correspondente estiver LIGADO no admin.
    // Pedra oficial: segue o parâmetro `active` (evento da Ordem da Trapaça).
    const isCustom = CUSTOM_MEGA_SET.has(stone.megaPokemonId);
    const stoneActive = isCustom ? !disabledCustom.has(stone.megaPokemonId) : active;
    const data = {
      type: stone.type,
      name: stone.stoneName,
      description: getMegaStoneDescription(stone),
      imageUrl: getMegaStoneImageUrl(stone.megaPokemonId),
      rarity: "LEGENDARY" as const,
      price: stone.price,
      active: stoneActive,
      sortOrder: 1600 + stone.megaPokemonId,
      metadata: buildMegaStoneMetadata(stone),
    };
    const existing = existingByType.get(stone.type);
    if (existing) {
      // Custom: estado exato do toggle (desligar precisa desativar de verdade).
      // Oficial: mantém "sticky on" (uma vez ativa pelo evento, permanece).
      const nextActive = isCustom ? stoneActive : (active || existing.active);
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
  // Ativa apenas as pedras OFICIAIS. As custom seguem só o toggle do admin.
  const officialTypes = MEGA_STONES.filter((stone) => !CUSTOM_MEGA_SET.has(stone.megaPokemonId)).map((stone) => stone.type);
  await prisma.shopItem.updateMany({
    where: { type: { in: officialTypes } },
    data: { active: true },
  });
  await safeInvalidateShopCache();
}

// Liga/desliga a pedra de uma forma mega custom no shop/bazar, refletindo o
// toggle do admin. Cria a ShopItem se ainda não existir.
export async function syncCustomMegaStoneShopItem(megaPokemonId: number, enabled: boolean) {
  const stone = getMegaStoneForMegaPokemon(megaPokemonId);
  if (!stone || !CUSTOM_MEGA_SET.has(megaPokemonId)) return;
  const existing = await prisma.shopItem.findFirst({ where: { type: stone.type }, select: { id: true } });
  if (existing) {
    await prisma.shopItem.update({ where: { id: existing.id }, data: { active: enabled } });
  } else {
    await prisma.shopItem.create({
      data: {
        type: stone.type,
        name: stone.stoneName,
        description: getMegaStoneDescription(stone),
        imageUrl: getMegaStoneImageUrl(stone.megaPokemonId),
        rarity: "LEGENDARY",
        price: stone.price,
        active: enabled,
        sortOrder: 1600 + stone.megaPokemonId,
        metadata: buildMegaStoneMetadata(stone),
      },
    });
  }
  await safeInvalidateShopCache();
}

export async function isMegaStoneShopUnlocked() {
  const event = await prisma.raidEvent.findUnique({
    where: { slug: "ordem-da-trapaca" },
    select: { phase: true },
  }).catch(() => null);
  return event?.phase === "RAID_DEFEATED" || event?.phase === "ENDED";
}
