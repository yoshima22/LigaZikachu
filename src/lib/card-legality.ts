import { searchCards } from "./card-service";
import type { TcgCard } from "./card-service";

// ── Configuração do Formato Standard ─────────────────────────────────────────
// Atualizar quando a Pokémon Company anunciar nova rotação.

export const STANDARD_CONFIG = {
  // Regulation marks aceitas no Standard atual (Escarlate & Violeta)
  allowedRegulationMarks: ["H", "I", "J"] as const,
  // Cartas banidas explicitamente no Standard (vazia por ora)
  bannedCards: [] as string[], // ex: ["Chip-Chip Ice Axe", "Forest of Giant Plants"]
  season: "2025"
};

// ── Status de legalidade ──────────────────────────────────────────────────────

export type LegalityStatus =
  | "LEGAL"             // Pode usar no Standard
  | "LEGAL_BY_REPRINT"  // A versão específica é antiga, mas há reimpressão legal
  | "BANNED"            // Banida explicitamente
  | "ROTATED_OUT"       // Saiu do Standard por rotação — NÃO é banimento
  | "NOT_LEGAL_IN_STANDARD" // Nunca foi legal no Standard
  | "UNKNOWN";          // Não foi possível determinar

export interface CardLegality {
  status: LegalityStatus;
  label: string;         // Texto amigável para exibir
  explanation: string;   // Explicação para o Professor
  reprintName?: string;  // Nome da reimpressão legal, se houver
}

// ── Verificação principal ─────────────────────────────────────────────────────

export async function checkCardLegality(card: TcgCard): Promise<CardLegality> {
  const cardName = card.name;

  // 1. Verificar banimento explícito na lista local
  if (STANDARD_CONFIG.bannedCards.includes(cardName)) {
    return {
      status: "BANNED",
      label: "Banida",
      explanation: `${cardName} está explicitamente banida no Standard.`
    };
  }

  // 2. Verificar via campo legalities da TCG API
  const stdLegality = card.legalities?.standard;

  if (stdLegality === "Banned") {
    return {
      status: "BANNED",
      label: "Banida",
      explanation: `${cardName} está banida no Standard pela Pokémon Company.`
    };
  }

  if (stdLegality === "Legal") {
    return {
      status: "LEGAL",
      label: "✅ Legal no Standard",
      explanation: `${cardName} é legal no Standard atual.`
    };
  }

  // 3. stdLegality é undefined/ausente — verificar pela Regulation Mark
  const regulationMark = (card as unknown as Record<string, unknown>).regulationMark as string | undefined;

  if (regulationMark) {
    const isAllowed = (STANDARD_CONFIG.allowedRegulationMarks as readonly string[]).includes(regulationMark);

    if (isAllowed) {
      return {
        status: "LEGAL",
        label: "✅ Legal no Standard",
        explanation: `${cardName} tem Regulation Mark "${regulationMark}", válida no Standard ${STANDARD_CONFIG.season}.`
      };
    }

    // Carta saiu por rotação — IMPORTANTE: não é banimento!
    // Verificar se existe reimpressão do mesmo nome que seja legal
    const reprint = await findLegalReprint(cardName);
    if (reprint) {
      return {
        status: "LEGAL_BY_REPRINT",
        label: "⚠️ Reimpressão legal disponível",
        explanation: `Esta versão de ${cardName} saiu do Standard por rotação (mark "${regulationMark}"), mas existe uma reimpressão legal no set ${reprint.set.name}.`,
        reprintName: reprint.set.name
      };
    }

    return {
      status: "ROTATED_OUT",
      label: "🔄 Fora do Standard (rotação)",
      explanation: `${cardName} saiu do Standard por rotação — Regulation Mark "${regulationMark}" não é mais válida. Isso NÃO é banimento, a carta pode ser usada em Expanded.`
    };
  }

  // 4. Sem legalities e sem regulation mark — tentar pelo set
  if (!stdLegality) {
    // Tenta buscar pelo nome para ver se há versão legal
    const reprint = await findLegalReprint(cardName);
    if (reprint) {
      return {
        status: "LEGAL_BY_REPRINT",
        label: "⚠️ Reimpressão legal disponível",
        explanation: `Esta versão de ${cardName} pode não ser legal, mas existe a versão do set ${reprint.set.name} que é.`,
        reprintName: reprint.set.name
      };
    }
  }

  return {
    status: "UNKNOWN",
    label: "❓ Legalidade desconhecida",
    explanation: `Não foi possível determinar a legalidade de ${cardName} no Standard. Verifique no site oficial da Pokémon Company.`
  };
}

// ── Buscar reimpressão legal de mesmo nome ────────────────────────────────────

async function findLegalReprint(cardName: string): Promise<TcgCard | null> {
  try {
    // Buscar todas as versões do mesmo nome
    const versions = await searchCards(cardName, 20);

    for (const version of versions) {
      const legality = version.legalities?.standard;
      const mark = (version as unknown as Record<string, unknown>).regulationMark as string | undefined;

      // Versão legal pela API
      if (legality === "Legal") return version;

      // Versão legal pela regulation mark
      if (mark && (STANDARD_CONFIG.allowedRegulationMarks as readonly string[]).includes(mark)) {
        return version;
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ── Gerar texto amigável para o Professor ─────────────────────────────────────

export function legalityToProf(legality: CardLegality, cardName: string): string {
  switch (legality.status) {
    case "LEGAL":
      return `${cardName} é legal no Standard atual — pode usar sem preocupação!`;

    case "LEGAL_BY_REPRINT":
      return `A versão antiga de ${cardName} saiu do Standard por rotação, mas existe uma reimpressão do set "${legality.reprintName}" que você pode usar!`;

    case "BANNED":
      return `${cardName} está banida no Standard. Não pode usar.`;

    case "ROTATED_OUT":
      return `${cardName} saiu do Standard por rotação — NÃO está banida, mas você só pode usar em Expanded. No Standard, procura uma alternativa!`;

    case "NOT_LEGAL_IN_STANDARD":
      return `${cardName} nunca foi legal no Standard.`;

    default:
      return `Não sei a legalidade de ${cardName} no Standard. Confere no site oficial!`;
  }
}

// ── Verificar lista de cartas sugeridas ───────────────────────────────────────

export async function filterLegalCards(
  cards: TcgCard[],
  allowRotated = false
): Promise<Array<TcgCard & { legality: CardLegality }>> {
  const results = await Promise.allSettled(
    cards.map(async (card) => ({ ...card, legality: await checkCardLegality(card) }))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<TcgCard & { legality: CardLegality }> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((c) => {
      if (allowRotated) return c.legality.status !== "BANNED" && c.legality.status !== "NOT_LEGAL_IN_STANDARD";
      return c.legality.status === "LEGAL" || c.legality.status === "LEGAL_BY_REPRINT";
    });
}
