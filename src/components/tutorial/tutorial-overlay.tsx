"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronRight } from "lucide-react";
import type { TutorialStep } from "@/lib/tutorial-config";

const norm = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

const isShown = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return el.offsetParent !== null && r.width > 4 && r.height > 4;
};

// Acha o alvo do passo: seletor (menu desktop/mobile repetem ids: pega o visível) ou texto de um
// título/botão da página (títulos expandem para o card que os contém).
function findTarget(step: TutorialStep): HTMLElement | null {
  if (step.target) {
    const all = Array.from(document.querySelectorAll<HTMLElement>(step.target));
    return all.find((el) => el.offsetParent !== null) ?? all[0] ?? null;
  }
  if (!step.find) return null;
  const q = norm(step.find);
  const root = document.querySelector<HTMLElement>("[data-tutorial='page-content']") ?? document.body;
  const els = Array.from(root.querySelectorAll<HTMLElement>("h1,h2,h3,h4,button,a,summary,[role='tab'],label,legend"));
  const hit = els.find((el) => isShown(el) && (el.textContent ?? "").length < 120 && norm(el.textContent ?? "").includes(q));
  if (!hit) return null;
  if (!/^H[1-4]$/.test(hit.tagName)) return hit;
  const base = hit.getBoundingClientRect().height;
  let node: HTMLElement | null = hit.parentElement;
  for (let i = 0; i < 6 && node && node !== root; i++, node = node.parentElement) {
    if (node.getBoundingClientRect().height > base + 60) return node;
  }
  return hit;
}

// No celular o card fica embaixo: rola o alvo para a parte de cima da tela.
function revealTarget(el: HTMLElement) {
  if (window.innerWidth >= 640) {
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    return;
  }
  const r = el.getBoundingClientRect();
  if (r.top >= 70 && r.bottom <= window.innerHeight * 0.5) return;
  window.scrollTo({ top: Math.max(0, window.scrollY + r.top - 84), behavior: "smooth" });
}

interface TutorialOverlayProps {
  steps: TutorialStep[];
  onComplete: () => void;
  onSkip: () => void;
}

export function TutorialOverlay({ steps, onComplete, onSkip }: TutorialOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [visible, setVisible] = useState(false);
  const rafRef = useRef<number>(0);

  const step = steps[currentStep];

  const updateTargetRect = useCallback(() => {
    if (!step?.target && !step?.find) {
      setTargetRect(null);
      return;
    }
    const el = findTarget(step);
    if (!el) {
      setTargetRect(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    // Alvo oculto/colapsado (ex.: item dentro de um menu fechado) tem tamanho ~0
    // e geraria um "quadradinho de destaque" desalinhado. Nesse caso, não destaca
    // nada (mostra o card central) em vez de apontar para o lugar errado.
    setTargetRect(isShown(el) ? rect : null);
  }, [step]);

  useEffect(() => {
    // Slight delay to let the page render
    const timeout = setTimeout(() => {
      setVisible(true);
      if ((step?.target || step?.find) && step.position !== "center") {
        const el = findTarget(step);
        if (el) revealTarget(el);
      }
      updateTargetRect();
    }, 300);
    return () => clearTimeout(timeout);
  }, [step?.target, step?.find, step?.position, updateTargetRect]);

  useEffect(() => {
    if (!visible || (!step?.target && !step?.find) || step.position === "center") return;
    const el = findTarget(step);
    if (el) revealTarget(el);
    const timeout = setTimeout(updateTargetRect, 360);
    return () => clearTimeout(timeout);
  }, [currentStep, step?.target, step?.find, step?.position, updateTargetRect, visible]);

  useEffect(() => {
    updateTargetRect();
    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateTargetRect);
    };
    const onResize = () => updateTargetRect();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [updateTargetRect]);

  const next = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      onComplete();
    }
  };

  if (!visible || !step) return null;

  const PADDING = 8;
  const hasTarget = targetRect && step?.position !== "center";
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  // Card position calculation
  let cardStyle: React.CSSProperties = {};
  let spotlightRect: { x: number; y: number; width: number; height: number } | null = null;
  if (hasTarget && targetRect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isMobile = vw < 640;
    const cardW = isMobile ? Math.max(280, vw - 32) : 320;
    const cardH = isMobile ? 170 : 170;
    const gap = PADDING + 8;

    const rawSpotlight = {
      x: targetRect.left - PADDING,
      y: targetRect.top - PADDING,
      width: targetRect.width + PADDING * 2,
      height: targetRect.height + PADDING * 2,
    };
    spotlightRect = {
      x: clamp(rawSpotlight.x, 8, Math.max(8, vw - 16)),
      y: clamp(rawSpotlight.y, 8, Math.max(8, vh - 16)),
      width: Math.min(rawSpotlight.width, vw - 16),
      height: Math.min(rawSpotlight.height, vh - 16),
    };
    spotlightRect.width = Math.max(24, Math.min(spotlightRect.width, vw - spotlightRect.x - 8));
    spotlightRect.height = Math.max(24, Math.min(spotlightRect.height, vh - spotlightRect.y - 8));

    if (isMobile) {
      const targetLow = targetRect.top + targetRect.height / 2 > vh * 0.55;
      cardStyle = targetLow
        ? { position: "fixed", left: 12, right: 12, top: 12, width: "auto" }
        : { position: "fixed", left: 12, right: 12, bottom: "calc(12px + env(safe-area-inset-bottom))", width: "auto" };
    } else if (step.position === "bottom" || !step.position) {
      const preferredTop = targetRect.bottom + gap;
      const fallbackTop = targetRect.top - cardH - gap;
      cardStyle = {
        position: "fixed",
        top: clamp(preferredTop <= vh - cardH - 16 ? preferredTop : fallbackTop, 16, vh - cardH - 16),
        left: clamp(targetRect.left, 16, vw - cardW - 16),
        width: cardW
      };
    } else if (step.position === "top") {
      const preferredTop = targetRect.top - cardH - gap;
      const fallbackTop = targetRect.bottom + gap;
      cardStyle = {
        position: "fixed",
        top: clamp(preferredTop >= 16 ? preferredTop : fallbackTop, 16, vh - cardH - 16),
        left: clamp(targetRect.left, 16, vw - cardW - 16),
        width: cardW
      };
    } else if (step.position === "right") {
      const preferredLeft = targetRect.right + gap;
      const fallbackLeft = targetRect.left - cardW - gap;
      cardStyle = {
        position: "fixed",
        top: clamp(targetRect.top, 16, vh - cardH - 16),
        left: clamp(preferredLeft <= vw - cardW - 16 ? preferredLeft : fallbackLeft, 16, vw - cardW - 16),
        width: cardW
      };
    } else if (step.position === "left") {
      const preferredLeft = targetRect.left - cardW - gap;
      const fallbackLeft = targetRect.right + gap;
      cardStyle = {
        position: "fixed",
        top: clamp(targetRect.top, 16, vh - cardH - 16),
        left: clamp(preferredLeft >= 16 ? preferredLeft : fallbackLeft, 16, vw - cardW - 16),
        width: cardW
      };
    }
  } else {
    // Center card — responsive width respecting small screens
    cardStyle = {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: "min(360px, calc(100vw - 32px))"
    };
  }

  // Clicking anywhere on the dark backdrop skips the tutorial
  const handleBackdropClick = (e: React.MouseEvent) => {
    // Only trigger if the click was on the backdrop itself, not on the card
    if (e.target === e.currentTarget) onSkip();
  };

  return (
    <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: "auto" }} onClick={handleBackdropClick}>
      {/* Overlay */}
      {hasTarget && spotlightRect ? (
        // Spotlight overlay using SVG clip path
        <svg
          className="fixed inset-0 w-full h-full"
          style={{ pointerEvents: "none" }}
        >
          <defs>
            <mask id="tutorial-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={spotlightRect.x}
                y={spotlightRect.y}
                width={spotlightRect.width}
                height={spotlightRect.height}
                rx="8"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.75)"
            mask="url(#tutorial-mask)"
          />
          {/* Highlight border around target */}
          <rect
            x={spotlightRect.x}
            y={spotlightRect.y}
            width={spotlightRect.width}
            height={spotlightRect.height}
            rx="8"
            fill="none"
            stroke="#FFCB05"
            strokeWidth="2"
            strokeDasharray="6 3"
          />
        </svg>
      ) : (
        // Full dark overlay for center steps — clickable to skip
        <div
          className="fixed inset-0 bg-black/75"
          onClick={onSkip}
          style={{ cursor: "pointer" }}
        />
      )}

      {/* Tutorial card — stopPropagation so clicks inside don't skip */}
      <div
        style={cardStyle}
        className="z-[10000] rounded-2xl border border-[#FFCB05]/40 bg-[#1A1A2E] shadow-2xl p-4 sm:p-5 space-y-2.5 sm:space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-pixel text-sm text-[#FFCB05] leading-snug">{step.title}</h3>
          <button
            onClick={onSkip}
            className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
            aria-label="Pular tutorial"
          >
            <X size={16} />
          </button>
        </div>

        {/* Description */}
        <p className="text-[13px] sm:text-sm text-slate-300 leading-snug sm:leading-relaxed">{step.description}</p>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          {/* Progress */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentStep
                    ? "w-4 bg-[#FFCB05]"
                    : i < currentStep
                    ? "w-2 bg-[#FFCB05]/40"
                    : "w-2 bg-slate-700"
                }`}
              />
            ))}
            <span className="ml-1 text-[10px] text-slate-500">
              {currentStep + 1}/{steps.length}
            </span>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onSkip}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-3 py-2"
            >
              Pular
            </button>
            <button
              onClick={next}
              className="flex items-center gap-1 rounded-lg bg-[#FFCB05] px-4 py-2 text-xs font-semibold text-[#1A1A2E] hover:bg-[#FFD700] transition-colors"
            >
              {currentStep === steps.length - 1 ? "Concluir" : "Próximo"}
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
