"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronRight } from "lucide-react";
import type { TutorialStep } from "@/lib/tutorial-config";

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
    if (!step?.target) {
      setTargetRect(null);
      return;
    }
    const el = document.querySelector(step.target);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [step]);

  useEffect(() => {
    // Slight delay to let the page render
    const timeout = setTimeout(() => {
      setVisible(true);
      updateTargetRect();
    }, 300);
    return () => clearTimeout(timeout);
  }, [updateTargetRect]);

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

  if (!visible) return null;

  const PADDING = 8;
  const hasTarget = targetRect && step?.position !== "center";

  // Card position calculation
  let cardStyle: React.CSSProperties = {};
  if (hasTarget && targetRect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cardW = 320;
    const cardH = 160;

    if (step.position === "bottom" || !step.position) {
      cardStyle = {
        position: "fixed",
        top: Math.min(targetRect.bottom + PADDING + 8, vh - cardH - 16),
        left: Math.min(Math.max(targetRect.left, 16), vw - cardW - 16),
        width: cardW
      };
    } else if (step.position === "top") {
      cardStyle = {
        position: "fixed",
        top: Math.max(targetRect.top - cardH - PADDING - 8, 16),
        left: Math.min(Math.max(targetRect.left, 16), vw - cardW - 16),
        width: cardW
      };
    } else if (step.position === "right") {
      cardStyle = {
        position: "fixed",
        top: Math.min(Math.max(targetRect.top, 16), vh - cardH - 16),
        left: Math.min(targetRect.right + PADDING + 8, vw - cardW - 16),
        width: cardW
      };
    } else if (step.position === "left") {
      cardStyle = {
        position: "fixed",
        top: Math.min(Math.max(targetRect.top, 16), vh - cardH - 16),
        left: Math.max(targetRect.left - cardW - PADDING - 8, 16),
        width: cardW
      };
    }
  } else {
    // Center card
    cardStyle = {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: 360
    };
  }

  return (
    <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: "auto" }}>
      {/* Overlay */}
      {hasTarget && targetRect ? (
        // Spotlight overlay using SVG clip path
        <svg
          className="fixed inset-0 w-full h-full"
          style={{ pointerEvents: "none" }}
        >
          <defs>
            <mask id="tutorial-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={targetRect.left - PADDING}
                y={targetRect.top - PADDING}
                width={targetRect.width + PADDING * 2}
                height={targetRect.height + PADDING * 2}
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
            x={targetRect.left - PADDING}
            y={targetRect.top - PADDING}
            width={targetRect.width + PADDING * 2}
            height={targetRect.height + PADDING * 2}
            rx="8"
            fill="none"
            stroke="#FFCB05"
            strokeWidth="2"
            strokeDasharray="6 3"
          />
        </svg>
      ) : (
        // Full dark overlay for center steps
        <div
          className="fixed inset-0 bg-black/75"
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* Tutorial card */}
      <div
        style={cardStyle}
        className="z-[10000] rounded-2xl border border-[#FFCB05]/40 bg-[#1A1A2E] shadow-2xl p-5 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200"
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
        <p className="text-sm text-slate-300 leading-relaxed">{step.description}</p>

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
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1"
            >
              Pular
            </button>
            <button
              onClick={next}
              className="flex items-center gap-1 rounded-lg bg-[#FFCB05] px-3 py-1.5 text-xs font-semibold text-[#1A1A2E] hover:bg-[#FFD700] transition-colors"
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
