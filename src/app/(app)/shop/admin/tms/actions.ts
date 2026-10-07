"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/permissions";
import { ensureAbilityTmShopItems, setAbilityTmsActive } from "@/lib/ability-tm-shop";

export async function setAbilityTmsActiveAction(active: boolean, abilityKeys?: string[]): Promise<{ error?: string; count?: number }> {
  try {
    await requireAdmin();
    const count = await setAbilityTmsActive(active, abilityKeys);
    revalidatePath("/shop");
    revalidatePath("/shop/admin/tms");
    return { count };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao atualizar os TMs." };
  }
}

export async function ensureAbilityTmsAction(): Promise<{ error?: string; total?: number; changed?: number }> {
  try {
    await requireAdmin();
    const res = await ensureAbilityTmShopItems(false);
    revalidatePath("/shop/admin/tms");
    return res;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao criar os TMs." };
  }
}
