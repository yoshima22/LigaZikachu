"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { getRecentUnlockedAchievements } from "@/app/(app)/conquistas/actions";

const STORAGE_KEY = "achievement_seen_ids";

const rarityEmoji: Record<string, string> = {
  COMMON:    "🏅",
  UNCOMMON:  "🥈",
  RARE:      "💎",
  EPIC:      "✨",
  LEGENDARY: "👑",
  SECRET:    "🔮"
};

const rarityColor: Record<string, string> = {
  COMMON:    "#94a3b8",
  UNCOMMON:  "#7AC74C",
  RARE:      "#6390F0",
  EPIC:      "#735797",
  LEGENDARY: "#FFCB05",
  SECRET:    "#64748b"
};

export function AchievementNotifier() {
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const check = async () => {
      try {
        const recent = await getRecentUnlockedAchievements();
        if (recent.length === 0) return;

        const seen = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as string[]);
        const newOnes = recent.filter(a => !seen.has(a.id));
        if (newOnes.length === 0) return;

        // Marcar como visto
        const updatedSeen = [...seen, ...newOnes.map(a => a.id)].slice(-50);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSeen));

        // Mostrar toast para cada conquista nova (com delay entre eles)
        for (let i = 0; i < newOnes.length; i++) {
          const ach = newOnes[i];
          setTimeout(() => {
            toast.custom(() => (
              <div
                style={{ borderColor: rarityColor[ach.rarity] }}
                className="flex items-center gap-3 rounded-2xl border-2 bg-[#0f0f1a] px-4 py-3 shadow-2xl"
              >
                <div className="text-2xl leading-none">{rarityEmoji[ach.rarity]}</div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: rarityColor[ach.rarity] }}>
                    Conquista desbloqueada!
                  </p>
                  <p className="text-sm font-bold text-white leading-tight">{ach.name}</p>
                  {ach.iconUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ach.iconUrl} alt="" className="mt-1 h-5 w-5 object-contain" />
                  )}
                </div>
              </div>
            ), { duration: 6000, position: "bottom-right" });
          }, i * 1500);
        }
      } catch { /* silencioso */ }
    };

    // Checar após 2s para não bloquear o carregamento
    setTimeout(check, 2000);
  }, []);

  return null;
}
