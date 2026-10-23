"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Award, Candy, Check, ChevronRight, Coins, Egg, Feather, Gift, Pill, Sparkles, Ticket, Utensils, X } from "lucide-react";
import { type JohtoBoxTier, type JohtoReward, type JohtoRewardKind } from "@/lib/johto-reward-boxes";
import { JohtoBoxArt } from "./johto-box-art";
import styles from "./johto-rewards.module.css";

const icons = { coins: Coins, food: Utensils, sweet: Candy, ticket: Ticket, protein: Pill, feather: Feather, egg: Egg, cosmetic: Award };
export function RewardIcon({ kind, size = 36 }: { kind: JohtoRewardKind; size?: number }) {
  const Icon = icons[kind];
  return <Icon size={size} strokeWidth={1.5} aria-hidden="true" />;
}

/**
 * Abertura de caixa/prêmios de Johto. Prévia do admin: `rewards` já sorteados.
 * Entrega real: `loadRewards` resgata no servidor ao clicar em abrir; a
 * animação espera a resposta e mostra exatamente o que entrou na conta.
 */
export function JohtoRewardOpening({ title, message, color, rewards: previewRewards = [], tier, forced = false, onClose, onStart, loadRewards }: {
  title: string; message: string; color: string; rewards?: JohtoReward[]; tier?: JohtoBoxTier; forced?: boolean; onClose: () => void; onStart?: () => void;
  loadRewards?: () => Promise<JohtoReward[]>;
}) {
  const live = Boolean(loadRewards);
  const [phase, setPhase] = useState<"sealed" | "opening" | "reveal" | "summary">("sealed");
  const [index, setIndex] = useState(0);
  const [rewards, setRewards] = useState<JohtoReward[] | null>(live ? null : previewRewards);
  const [animationDone, setAnimationDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    el?.showModal();
    primary.current?.focus();
    return () => { el?.close(); document.body.style.overflow = overflow; };
  }, []);
  useEffect(() => {
    if (phase !== "opening") { primary.current?.focus(); return; }
    // A useful exit remains focused while the opening animation runs.
    close.current?.focus();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setAnimationDone(true), reduced ? 50 : 1600);
    return () => window.clearTimeout(timer);
  }, [phase]);
  // Revela quando a animação terminou E os prêmios chegaram do servidor.
  useEffect(() => {
    if (phase === "opening" && animationDone && rewards) setPhase(rewards.length ? "reveal" : "summary");
  }, [phase, animationDone, rewards]);

  const start = () => {
    onStart?.();
    setError(null);
    setAnimationDone(false);
    setPhase("opening");
    if (!loadRewards) return;
    loadRewards().then(setRewards, (err: unknown) => {
      setError(err instanceof Error ? err.message : "Não foi possível abrir agora. Tente de novo.");
      setPhase("sealed");
    });
  };

  const list = rewards ?? [];
  const current = list[index];
  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="johto-opening-title" aria-describedby="johto-opening-message" onCancel={(e) => { e.preventDefault(); onClose(); }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ "--johto-accent": color } as CSSProperties}>
      <div className={styles.dialogInner}>
        <button ref={close} type="button" onClick={onClose} className={styles.close} aria-label={live ? "Fechar" : "Fechar teste de recompensa"}><X size={20} /></button>
        {!live && <div className={styles.previewBadge}>PRÉVIA ADMIN · SEM ENTREGA REAL{forced ? " · DROPS FORÇADOS" : ""}</div>}
        <header className={styles.modalHeader}>
          <p className={styles.eyebrow}>LIGA ZIKACHU · JOHTO</p>
          <h2 id="johto-opening-title">{phase === "summary" ? "Sua jornada merece esse momento." : title}</h2>
          <p id="johto-opening-message">{message}</p>
        </header>
        <p className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
          {phase === "reveal" && current ? `Recompensa ${index + 1} de ${list.length}: ${current.quantity} ${current.label}${current.boostPercent !== undefined ? `, chance aumentada +${current.boostPercent}%` : ""}.` : ""}
        </p>

        {(phase === "sealed" || phase === "opening") && <div className={styles.sealedStage}>
          <div className={styles.orbit} /><div className={styles.orbitInner} />
          {tier ? <JohtoBoxArt tier={tier} opening={phase === "opening"} /> : <div className={`${styles.fixedSeal} ${phase === "opening" ? styles.fixedSealOpening : ""}`}><Award size={92} strokeWidth={1} /><span>JOHTO</span></div>}
          <p className={styles.stageCaption}>{phase === "opening" ? "Um novo capítulo está se revelando…" : tier ? "Toque para descobrir o que Johto guardou para você." : "Seus prêmios de colocação estão prontos para ser revelados."}</p>
        </div>}

        {phase === "reveal" && current && <div className={styles.revealStage}>
          <div className={styles.particles} aria-hidden="true">{Array.from({ length: 16 }, (_, i) => <i key={`${index}-${i}`} style={{ "--i": i } as CSSProperties} />)}</div>
          <p className={styles.eyebrow}>RECOMPENSA {index + 1} DE {list.length}</p>
          <div key={index} className={`${styles.revealCard} ${current.kind === "egg" ? styles.eggCard : ""}`}>
            <div className={styles.rewardMedallion}><RewardIcon kind={current.kind} size={76} /></div>
            {current.id === "lab-egg" && <span className={styles.rareBadge}><Sparkles size={13} /> ACHADO DE LABORATÓRIO</span>}
            <p className={styles.rewardQuantity}>×{current.quantity.toLocaleString("pt-BR")}</p>
            <h3>{current.label}</h3>
            {current.boostPercent !== undefined && <span className={styles.boostBadge}>Chance aumentada +{current.boostPercent}%</span>}
          </div>
          <div className={styles.progress} aria-label={`${index + 1} de ${list.length} recompensas reveladas`}>{list.map((r, i) => <span key={r.id} className={i <= index ? styles.progressActive : ""} />)}</div>
        </div>}

        {phase === "summary" && <div className={styles.summary}>
          <div className={styles.summaryHeading}><Check size={20} /><span>{list.length} tipos de recompensa revelados</span></div>
          <div className={styles.summaryGrid}>{list.map((r) => <div key={r.id} className={styles.summaryItem}><RewardIcon kind={r.kind} size={26} /><div><strong>{r.quantity.toLocaleString("pt-BR")} × {r.label}</strong>{r.boostPercent !== undefined && <small>Chance aumentada +{r.boostPercent}%</small>}</div></div>)}</div>
          <p className={styles.simulationNote}>{live ? (list.length ? "Tudo já foi adicionado à sua conta." : "Desta vez a caixa veio vazia — mas a jornada valeu cada passo.") : "Simulação concluída. Nenhum item ou ZC foi adicionado à conta."}</p>
        </div>}

        <footer className={styles.modalFooter} aria-live="polite">
          {phase === "sealed" && error && <p role="alert" className={styles.openingStatus}>{error}</p>}
          {phase === "sealed" && <button ref={primary} type="button" className={styles.primary} onClick={start}><Gift size={18} />{live ? (tier ? "Abrir caixa" : "Retirar prêmios") : (tier ? "Abrir caixa de teste" : "Retirar prêmios de teste")}<ChevronRight size={18} /></button>}
          {phase === "opening" && <p role="status" className={styles.openingStatus}>Abrindo sua recompensa…</p>}
          {phase === "reveal" && <><button ref={primary} type="button" className={styles.primary} onClick={() => index + 1 < list.length ? setIndex(index + 1) : setPhase("summary")}>{index + 1 < list.length ? "Revelar próximo prêmio" : "Ver todos os prêmios"}<ChevronRight size={18} /></button><button type="button" className={styles.secondary} onClick={() => setPhase("summary")}>Revelar todos agora</button></>}
          {phase === "summary" && <button ref={primary} type="button" className={styles.primary} onClick={onClose}>{live ? "Concluir" : "Concluir prévia"} <Check size={18} /></button>}
        </footer>
      </div>
    </dialog>
  );
}
