import { prisma } from "@/lib/prisma";
import { invalidateShopCache } from "@/lib/shop-cache";
import { describeAbility, getAbilityInfo } from "@/lib/abilities";
import { ABILITY_TM_IMAGE, ABILITY_TM_PRICE, ABILITY_TM_TYPE, abilityTmItemName, abilityTmMetadata, getAbilityTmDefs, readAbilityTmKey } from "@/lib/abilities/tm";

function tmDescription(abilityKey: string) {
  const info = getAbilityInfo(abilityKey)!;
  // Sem lista de mascotes: ela muda conforme o painel de admin (use o botão "Quem pode usar").
  return `Libera a habilidade oculta ${info.name} (${info.effectName}) para um mascote que a tenha como oculta. ${describeAbility(info)} O TM é consumido ao usar.`;
}

async function safeInvalidate() {
  try { await invalidateShopCache(); } catch (error) {
    if (!(error instanceof Error ? error.message : String(error)).includes("static generation store missing")) throw error;
  }
}

/**
 * Garante um ShopItem por TM de habilidade. Só CRIA e corrige textos: nunca mexe em
 * `active` nem em preço de itens existentes (o admin controla a liberação gradual).
 */
export async function ensureAbilityTmShopItems(activeOnCreate = false) {
  const defs = getAbilityTmDefs();
  const existing = await prisma.shopItem.findMany({
    where: { type: ABILITY_TM_TYPE },
    select: { id: true, name: true, description: true, imageUrl: true, metadata: true },
  });
  const byKey = new Map(existing.map((item) => [readAbilityTmKey(item.metadata), item]));
  let changed = 0;
  for (const [index, def] of defs.entries()) {
    const name = abilityTmItemName(def.abilityKey);
    const description = tmDescription(def.abilityKey);
    const found = byKey.get(def.abilityKey);
    if (found) {
      if (found.name !== name || found.description !== description || found.imageUrl !== ABILITY_TM_IMAGE) {
        await prisma.shopItem.update({ where: { id: found.id }, data: { name, description, imageUrl: ABILITY_TM_IMAGE } });
        changed++;
      }
    } else {
      await prisma.shopItem.create({
        data: {
          type: ABILITY_TM_TYPE,
          name,
          description,
          imageUrl: ABILITY_TM_IMAGE,
          rarity: "EPIC",
          price: ABILITY_TM_PRICE,
          active: activeOnCreate,
          sortOrder: 1800 + index,
          metadata: abilityTmMetadata(def.abilityKey),
        },
      });
      changed++;
    }
  }
  if (changed) await safeInvalidate();
  return { total: defs.length, changed };
}

/** Espécies desligadas no painel de admin (EggPokemonToggle): suas informações de habilidade ficam ocultas. */
export async function getDisabledSpeciesIds(): Promise<Set<number>> {
  const rows = await prisma.eggPokemonToggle.findMany({ where: { disabled: true }, select: { pokemonId: true } });
  return new Set(rows.map((row) => row.pokemonId));
}

/** TMs sem nenhuma espécie compatível ligada no painel não devem aparecer nem ser vendidos. */
export async function getUnavailableTmKeys(): Promise<Set<string>> {
  const disabled = await getDisabledSpeciesIds();
  return new Set(
    getAbilityTmDefs().filter((def) => def.pokemonIds.every((id) => disabled.has(id))).map((def) => def.abilityKey),
  );
}

export async function filterAvailableTmItems<T extends { type: string; metadata?: unknown }>(items: T[]): Promise<T[]> {
  if (!items.some((item) => item.type === ABILITY_TM_TYPE)) return items;
  const hidden = await getUnavailableTmKeys();
  return items.filter((item) => {
    if (item.type !== ABILITY_TM_TYPE) return true;
    const key = readAbilityTmKey(item.metadata);
    return !key || !hidden.has(key);
  });
}

/** Liga/desliga TMs (liberação gradual). `abilityKeys` vazio = todos. */
export async function setAbilityTmsActive(active: boolean, abilityKeys?: string[]) {
  const items = await prisma.shopItem.findMany({ where: { type: ABILITY_TM_TYPE }, select: { id: true, metadata: true } });
  const keys = abilityKeys ? new Set(abilityKeys) : null;
  const ids = items.filter((item) => { const key = readAbilityTmKey(item.metadata); return key && (!keys || keys.has(key)); }).map((item) => item.id);
  if (!ids.length) return 0;
  const res = await prisma.shopItem.updateMany({ where: { id: { in: ids } }, data: { active } });
  await safeInvalidate();
  return res.count;
}
