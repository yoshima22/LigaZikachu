"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Gift, Sparkles, Trophy } from "lucide-react";
import { JOHTO_BOXES, type JohtoBoxTier } from "@/lib/johto-reward-boxes";
import { JohtoRewardOpening } from "@/app/(app)/torneios/[slug]/admin/_components/johto-reward-opening";
import styles from "@/app/(app)/torneios/[slug]/admin/_components/johto-rewards.module.css";
import { claimGift } from "../actions";

export type JohtoGiftView = { id: string; title: string; message: string; tier: JohtoBoxTier | null };

export function JohtoPrizeSection({ gifts }: { gifts: JohtoGiftView[] }) {
  const router = useRouter();
  const [opening, setOpening] = useState<JohtoGiftView | null>(null);
  const prize = gifts.find((g) => !g.tier);
  const boxes = gifts.filter((g) => g.tier);
  const message = (prize ?? boxes[boxes.length - 1])?.message;

  const loadRewards = (giftId: string) => async () => {
    const result = await claimGift({ giftId });
    if (result.error) throw new Error(result.error);
    return result.rewards ?? [];
  };

  return (
    <section className={styles.scenario}>
      <div className={styles.scenarioHeader}>
        <div>
          <h3><Trophy size={18} /> Premiação de Johto</h3>
          {message && <p className={styles.congratulations}>{message}</p>}
        </div>
      </div>
      <div className={styles.prizeLayout}>
        {prize && (
          <div className={styles.fixedPrizes}>
            <h4>Prêmios da sua colocação</h4>
            <p>{prize.title}</p>
            <button type="button" className={styles.claimButton} onClick={() => setOpening(prize)}>
              <Gift size={16} /> Retirar prêmios
            </button>
          </div>
        )}
        {boxes.length > 0 && (
          <div className={styles.receivedBoxes}>
            <h4>Suas caixas</h4>
            <p>Cada caixa tem sua própria abertura.</p>
            {boxes.map((box) => (
              <div key={box.id} className={styles.receivedBox} style={{ "--johto-accent": JOHTO_BOXES[box.tier!].color } as CSSProperties}>
                <Gift size={24} />
                <span>{box.title}</span>
                <button type="button" onClick={() => setOpening(box)}><Sparkles size={14} /> Abrir</button>
              </div>
            ))}
          </div>
        )}
      </div>
      {opening && (
        <JohtoRewardOpening
          title={opening.tier ? JOHTO_BOXES[opening.tier].name : "Parabéns pelo seu desempenho!"}
          message={opening.message}
          color={opening.tier ? JOHTO_BOXES[opening.tier].color : "#ffd273"}
          tier={opening.tier ?? undefined}
          loadRewards={loadRewards(opening.id)}
          onClose={() => { setOpening(null); router.refresh(); }}
        />
      )}
    </section>
  );
}
