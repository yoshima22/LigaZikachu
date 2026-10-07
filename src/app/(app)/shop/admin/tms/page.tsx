import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { getPokemonName } from "@/lib/mascot-data";
import { getAbilityInfo } from "@/lib/abilities";
import { getAbilityTmDefs, readAbilityTmKey } from "@/lib/abilities/tm";
import { AbilityTmAdmin } from "./tm-admin";

export const dynamic = "force-dynamic";

export default async function AbilityTmAdminPage() {
  await requireAdmin();
  const items = await prisma.shopItem.findMany({
    where: { type: "ABILITY_TM" },
    select: { id: true, metadata: true, active: true, price: true, _count: { select: { ownerships: true } } },
  });
  const byKey = new Map(items.map((item) => [readAbilityTmKey(item.metadata), item]));
  const rows = getAbilityTmDefs().map((def) => {
    const item = byKey.get(def.abilityKey);
    const info = getAbilityInfo(def.abilityKey)!;
    return {
      abilityKey: def.abilityKey,
      name: def.name,
      category: info.category ?? "",
      effectName: info.effectName ?? "",
      species: def.pokemonIds.length,
      sample: def.pokemonIds.slice(0, 3).map((id) => getPokemonName(id)).join(", "),
      created: Boolean(item),
      active: item?.active ?? false,
      price: item?.price ?? null,
      owners: item?._count.ownerships ?? 0,
    };
  });
  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-xs text-slate-500">
        <Link href="/shop" className="hover:text-slate-300">ZikaShop</Link><ChevronRight size={12} />
        <Link href="/shop/admin" className="hover:text-slate-300">Admin</Link><ChevronRight size={12} />
        <span className="text-slate-300">TMs de habilidade</span>
      </nav>
      <div>
        <h1 className="font-pixel text-base text-[#FFCB05]">TMs de Habilidade Oculta</h1>
        <p className="mt-1 text-sm text-slate-400">
          Libere os TMs aos poucos. TM ligado aparece na ZikaShop e entra nas ofertas do Bazar (no máximo 1 TM por rotação do Miauvadão, desconto de até 20%).
          Preço e descrição individuais ficam em Gerenciar ZikaShop.
        </p>
      </div>
      <AbilityTmAdmin rows={rows} />
    </div>
  );
}
