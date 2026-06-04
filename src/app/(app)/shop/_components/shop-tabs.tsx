"use client";

import { useState } from "react";
import { ShoppingBag, Crown, Image, Package, Egg, Heart } from "lucide-react";

interface Tab { id: string; label: string; icon: React.ReactNode; count: number }

interface Props {
  tabs: Tab[];
  children: (activeTab: string) => React.ReactNode;
}

export function ShopTabs({ tabs, children }: Props) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");

  const visibleTabs = tabs.filter(t => t.count > 0);
  if (visibleTabs.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-4">
        {visibleTabs.map(tab => (
          <button key={tab.id} type="button"
            onClick={() => setActive(tab.id)}
            className={`flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
              active === tab.id
                ? "border-[#FFCB05]/50 bg-[#FFCB05]/10 text-[#FFCB05]"
                : "border-border text-slate-400 hover:text-slate-200 hover:border-slate-600"
            }`}>
            {tab.icon}
            {tab.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              active === tab.id ? "bg-[#FFCB05]/20 text-[#FFCB05]" : "bg-slate-800 text-slate-500"
            }`}>{tab.count}</span>
          </button>
        ))}
      </div>
      {/* Content */}
      {children(active)}
    </div>
  );
}

export const TAB_ICONS = {
  titles:   <Crown size={14} />,
  banners:  <Image size={14} />,
  frames:   <Package size={14} />,
  tickets:  <ShoppingBag size={14} />,
  mascots:  <Egg size={14} />,
  buffs:    <Heart size={14} />,
};
