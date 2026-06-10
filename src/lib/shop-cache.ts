"use server";
/**
 * shop-cache.ts — Queries de shop_items com cache agressivo.
 * Dados de shop raramente mudam; não faz sentido ir ao banco a cada page render.
 *
 * Tags:
 *   "shop-item-images"  — invalidar quando imageUrl de algum item mudar
 *   "shop-items-active" — invalidar quando itens forem criados/editados/ativados no admin
 */
import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ShopItemType } from "@prisma/client";

/** Retorna { type → imageUrl } para os tipos solicitados. Cache de 1h. */
export const getShopItemImages = unstable_cache(
  async (types: string[]): Promise<Record<string, string>> => {
    const rows = await prisma.shopItem.findMany({
      where: {
        type: { in: types as ShopItemType[] },
        imageUrl: { not: null },
      },
      select: { type: true, imageUrl: true },
    });
    const map: Record<string, string> = {};
    for (const row of rows) {
      if (row.imageUrl) map[row.type] = row.imageUrl;
    }
    return map;
  },
  ["shop-item-images"],
  { revalidate: 3600, tags: ["shop-item-images"] },
);

/** Lista todos os itens ativos do shop. Cache de 5 min — invalidado quando admin edita. */
export const getActiveShopItems = unstable_cache(
  async () => {
    return prisma.shopItem.findMany({
      where: { active: true },
      orderBy: [{ type: "asc" }, { rarity: "asc" }, { price: "asc" }],
      select: {
        id: true, type: true, name: true, description: true, imageUrl: true,
        rarity: true, price: true, sortOrder: true, theme: true,
        metadata: true, flavorText: true, entranceEffect: true,
      },
    });
  },
  ["shop-items-active"],
  { revalidate: 300, tags: ["shop-items-active"] },
);

/** Lista os pacotes de figurinhas ativos. Cache de 10 min — invalidado quando admin edita. */
export const getActiveStickerPacks = unstable_cache(
  async () => {
    return prisma.stickerPack.findMany({
      where: { active: true },
      orderBy: { price: "asc" },
    });
  },
  ["sticker-packs-active"],
  { revalidate: 600, tags: ["sticker-packs-active"] },
);

/** Chame após qualquer mutação de shop_items no admin para invalidar o cache. */
export async function invalidateShopCache() {
  revalidateTag("shop-items-active");
  revalidateTag("shop-item-images");
  revalidateTag("sticker-packs-active");
}
