/**
 * RarityShimmer — envolve qualquer elemento com um feixo de luz diagonal
 * animado para itens RARE, EPIC e LEGENDARY.
 *
 * O brilho só aparece em ~28% do ciclo (a maior parte do tempo é invisível),
 * evitando repetição excessiva.
 *
 * Uso:
 *   <RarityShimmer rarity="LEGENDARY">
 *     <img src="..." />
 *   </RarityShimmer>
 */

import type { ReactNode } from "react";

// Gradiente do feixo de luz por raridade
const GLINT_GRADIENT: Record<string, string> = {
  RARE:      "linear-gradient(105deg, transparent 25%, rgba(147,197,253,0.20) 42%, rgba(255,255,255,0.55) 50%, rgba(147,197,253,0.20) 58%, transparent 75%)",
  EPIC:      "linear-gradient(105deg, transparent 25%, rgba(192,132,252,0.22) 42%, rgba(255,255,255,0.55) 50%, rgba(192,132,252,0.22) 58%, transparent 75%)",
  LEGENDARY: "linear-gradient(105deg, transparent 25%, rgba(253,224,71,0.25)  42%, rgba(255,255,255,0.65) 50%, rgba(253,224,71,0.25)  58%, transparent 75%)",
};

// Classe de animação por raridade (definida em globals.css)
const GLINT_CLASS: Record<string, string> = {
  RARE:      "glint-rare",
  EPIC:      "glint-epic",
  LEGENDARY: "glint-legendary",
};

interface Props {
  rarity: string;
  children?: ReactNode;
  className?: string;
}

export function RarityShimmer({ rarity, children, className }: Props) {
  const gradient = GLINT_GRADIENT[rarity];
  const animClass = GLINT_CLASS[rarity];

  // Sem brilho para raridades comuns
  if (!gradient || !animClass) {
    return children ? <div className={className}>{children}</div> : null;
  }

  // Modo overlay puro (sem children) — usado sobre banners como `absolute inset-0`
  if (!children) {
    return (
      <div
        aria-hidden="true"
        className={`pointer-events-none ${animClass} ${className ?? ""}`}
        style={{ background: gradient }}
      />
    );
  }

  // Modo wrapper — envolve o conteúdo com o brilho por cima
  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      {children}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 ${animClass}`}
        style={{ background: gradient }}
      />
    </div>
  );
}
