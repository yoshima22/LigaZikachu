"use client";

import { useState } from "react";
import { ShoppingBag, Crown, ImageIcon, Package, Egg, Heart } from "lucide-react";

export interface ShopTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  count: number;
  content: React.ReactNode;
}

export function ShopTabs({ tabs }: { tabs: ShopTab[] }) {
  const visible = tabs.filter(t => t.count > 0);
  const [active, setActive] = useState(visible[0]?.id ?? "");

  if (visible.length === 0) return null;

  const current = visible.find(t => t.id === active) ?? visible[0];

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-4">
        {visible.map(tab => (
          <button key={tab.id} type="button" onClick={() => setActive(tab.id)}
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
      {/* Active content */}
      <div>{current?.content}</div>
    </div>
  );
}

export const TAB_ICONS = {
  titles:  <Crown size={14} />,
  banners: <ImageIcon size={14} />,
  frames:  <Package size={14} />,
  tickets: <ShoppingBag size={14} />,
  mascots: <Egg size={14} />,
  buffs:   <Heart size={14} />,
};
