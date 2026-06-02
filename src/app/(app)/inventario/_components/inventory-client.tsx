"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle, Circle } from "lucide-react";
import { equipItem } from "../../shop/actions";
import { TitleDisplay } from "@/components/ui/title-display";
import type { TitleRarity, TitleTheme } from "@/components/ui/title-display";

const rarityColors: Record<string, string> = {
  COMMON:    "border-slate-600/50",
  UNCOMMON:  "border-[#7AC74C]/40",
  RARE:      "border-[#6390F0]/40",
  EPIC:      "border-[#735797]/40",
  LEGENDARY: "border-[#FFCB05]/40",
  MYTHIC:    "border-yellow-400/50",
  RELIC:     "border-red-500/50",
};
const rarityLabel: Record<string, string> = {
  COMMON: "Comum", UNCOMMON: "Incomum", RARE: "Raro", EPIC: "Épico",
  LEGENDARY: "Lendário", MYTHIC: "Mítico", RELIC: "Relíquia",
};

interface InventoryItem {
  inventoryId: string;
  itemId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  rarity: string;
  type: string;
  equipped: boolean;
  theme?: string;
  flavorText?: string | null;
}

interface Props {
  titles: InventoryItem[];
  banners: InventoryItem[];
  frames: InventoryItem[];
}

function ItemSection({ title, items }: { title: string; items: InventoryItem[] }) {
  const [pending, startTransition] = useTransition();

  const handleEquip = (itemId: string, equip: boolean) => {
    startTransition(async () => {
      try {
        const result = await equipItem(itemId, equip);
        if (result.error) { toast.error(result.error); return; }
        toast.success(equip ? "Item equipado!" : "Item desequipado.");
      } catch { toast.error("Erro ao equipar item."); }
    });
  };

  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-slate-200">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.itemId}
            className={`rounded-xl border bg-slate-950/60 overflow-hidden ${
              item.equipped ? "border-[#FFCB05]/50 ring-1 ring-[#FFCB05]/20" : rarityColors[item.rarity]
            }`}
          >
            {item.imageUrl ? (
              item.type === "BANNER" ? (
                <div className="aspect-[3/1] w-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="flex h-20 items-center justify-center bg-slate-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.imageUrl} alt={item.name} className="max-h-16 object-contain" />
                </div>
              )
            ) : item.type === "TITLE" ? (
              <div className="flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 px-4 py-4 min-h-[68px]">
                <TitleDisplay
                  name={item.name}
                  rarity={item.rarity as TitleRarity}
                  theme={(item.theme ?? "NEUTRAL") as TitleTheme}
                  flavorText={item.flavorText ?? null}
                  context="inventory"
                />
              </div>
            ) : null}

            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-200 truncate">{item.name}</p>
                <span className="shrink-0 text-[10px] text-slate-500">{rarityLabel[item.rarity]}</span>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => handleEquip(item.itemId, !item.equipped)}
                className={`flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  item.equipped
                    ? "bg-[#FFCB05]/10 text-[#FFCB05] hover:bg-[#FFCB05]/20"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {item.equipped
                  ? <><CheckCircle size={12} /> Equipado — desequipar</>
                  : <><Circle size={12} /> Equipar</>
                }
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function InventoryClient({ titles, banners, frames }: Props) {
  return (
    <div className="space-y-8">
      <ItemSection title="Títulos" items={titles} />
      <ItemSection title="Banners" items={banners} />
      <ItemSection title="Molduras" items={frames} />
    </div>
  );
}
