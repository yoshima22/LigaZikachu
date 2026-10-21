"use client";

import { useState, type CSSProperties } from "react";
import { Check, ChevronDown, FlaskConical, Gift, RotateCcw, Sparkles, Trophy } from "lucide-react";
import { getJohtoPrize, JOHTO_BOXES, JOHTO_PLACEMENTS, rollJohtoBox, type JohtoBoxTier, type JohtoPlacement, type JohtoReward } from "@/lib/johto-reward-boxes";
import { JohtoBoxArt } from "./johto-box-art";
import { JohtoRewardOpening } from "./johto-reward-opening";
import styles from "./johto-rewards.module.css";

type Opening = { title: string; message: string; color: string; rewards: JohtoReward[]; tier?: JohtoBoxTier; forced: boolean; onStart?: () => void };
const tiers: JohtoBoxTier[] = ["remembrance", "common", "rare", "special"];

export function JohtoRewardsPreview({ tournamentName }: { tournamentName: string }) {
  const [forced, setForced] = useState(false);
  const [placement, setPlacement] = useState<JohtoPlacement>("title-first");
  const [opening, setOpening] = useState<Opening | null>(null);
  const [opened, setOpened] = useState<number[]>([]);
  const [claimed, setClaimed] = useState(false);
  const prize = getJohtoPrize(placement);
  const scenario = JOHTO_PLACEMENTS.find((p) => p.id === placement)!;

  function openBox(tier: JohtoBoxTier, receivedIndex?: number) {
    const box = JOHTO_BOXES[tier];
    setOpening({ title: box.name, message: scenario.message, color: box.color, tier, rewards: rollJohtoBox(tier, { guaranteeAll: forced }), forced, onStart: receivedIndex === undefined ? undefined : () => setOpened((prev) => prev.includes(receivedIndex) ? prev : [...prev, receivedIndex]) });
  }

  return <section id="testes-caixas-johto" className={styles.panel}>
    <div className={styles.panelHeading}>
      <div><p className={styles.eyebrow}><FlaskConical size={14} /> LABORATÓRIO DE RECOMPENSAS</p><h2>Uma conquista. Muitas surpresas.</h2><p>Teste as caixas e a celebração de {tournamentName} antes de liberar para os jogadores.</p></div>
      <span className={styles.testBadge}>Somente teste · sem entrega real</span>
    </div>
    <div className={styles.controls}>
      <p>Cada item tem seu próprio sorteio. Quantidades com intervalo são sorteadas depois que o item cai.</p>
      <label className={styles.forceControl}><input type="checkbox" checked={forced} onChange={(e) => setForced(e.target.checked)} /><span>Forçar todos os drops <small>Somente para conferir as revelações</small></span></label>
    </div>
    <div className={styles.boxGrid}>{tiers.map((tier) => {
      const box = JOHTO_BOXES[tier];
      return <article key={tier} className={styles.boxTile} style={{ "--johto-accent": box.color } as CSSProperties}>
        <JohtoBoxArt tier={tier} small /><h3>{box.name}</h3><p>{box.subtitle}</p>
        <button type="button" className={styles.boxButton} onClick={() => openBox(tier)}><Sparkles size={15} /> Testar {box.name.replace("Caixa ", "")} </button>
        <details className={styles.contents}><summary>Conteúdo e chances <ChevronDown size={14} /></summary><ul>{box.items.filter((r) => r.chance > 0).map((r) => <li key={r.id}><span>{r.label}{r.boostPercent !== undefined ? ` (+${r.boostPercent}%)` : ""}</span><strong>{r.min === r.max ? r.min : `${r.min}~${r.max}`} · {Math.round(r.chance * 100)}%</strong></li>)}</ul></details>
      </article>;
    })}</div>

    <div className={styles.scenario}>
      <div className={styles.scenarioHeader}><div><h3><Trophy size={18} /> Prévia da premiação por resultado</h3><p>Simule a retirada dos prêmios fixos e abra cada caixa recebida.</p></div><button type="button" className={styles.resetButton} onClick={() => { setOpened([]); setClaimed(false); }}><RotateCcw size={14} /> Reiniciar prévia</button></div>
      <label className={styles.scenarioLabel}>Resultado de teste<select value={placement} onChange={(e) => { setPlacement(e.target.value as JohtoPlacement); setOpened([]); setClaimed(false); }}>{JOHTO_PLACEMENTS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
      <p className={styles.congratulations}>{scenario.message}</p>
      {prize.cosmeticsPending && <p className={styles.cosmeticsPending}>Banner e título exclusivos: aguardando definição. Não entram na retirada de teste.</p>}
      <div className={styles.prizeLayout}>
        <div className={styles.fixedPrizes}><h4>Prêmios fixos</h4><ul>{prize.items.map((r) => <li key={r.id}><span>{r.quantity.toLocaleString("pt-BR")} × {r.label}</span>{r.boostPercent !== undefined && <small>+{r.boostPercent}%</small>}</li>)}</ul><button type="button" disabled={claimed} className={styles.claimButton} onClick={() => setOpening({ title: "Parabéns pelo seu desempenho!", message: scenario.message, color: "#ffd273", rewards: prize.items, forced: false, onStart: () => setClaimed(true) })}>{claimed ? <Check size={16} /> : <Gift size={16} />}{claimed ? "Prêmios fixos testados" : "Testar retirada dos prêmios fixos"}</button></div>
        <div className={styles.receivedBoxes}><h4>Suas caixas de teste</h4><p>Inclui 1 Lembrança universal. Cada caixa tem sua própria abertura.</p>{prize.boxes.map((tier, i) => <div key={`${placement}-${i}`} className={styles.receivedBox} style={{ "--johto-accent": JOHTO_BOXES[tier].color } as CSSProperties}><Gift size={24} /><span>{JOHTO_BOXES[tier].name}<small>{i === 0 ? "Presente para todos os jogadores" : "Prêmio pelo resultado"}</small></span><button type="button" disabled={opened.includes(i)} onClick={() => openBox(tier, i)}>{opened.includes(i) ? "Testada" : "Abrir teste"}</button></div>)}</div>
      </div>
    </div>
    {opening && <JohtoRewardOpening {...opening} onClose={() => setOpening(null)} />}
  </section>;
}
