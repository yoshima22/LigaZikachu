import { fetchCardsByNames } from "./card-service";
import type { TcgCard } from "./card-service";
import type { DeckAnalysis } from "./deck-parser";

export type CardRole =
  | "DRAW" | "SEARCH" | "ENERGY_ACCELERATION"
  | "SWITCH" | "DISRUPTION" | "RECOVERY"
  | "MAIN_ATTACKER" | "SUPPORT";

export interface CardInfo extends TcgCard {
  role: CardRole;
}

export interface DeckSuggestion {
  card: TcgCard;
  reason: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
}

// ── Catálogo de cartas por função ─────────────────────────────────────────────
// A IA NUNCA decide o nome das cartas — elas vêm daqui e são buscadas na TCG API

const CATALOG: Record<CardRole, string[]> = {
  DRAW:               ["Professor's Research", "Iono", "Colress's Experiment", "Judge", "Cynthia"],
  SEARCH:             ["Nest Ball", "Ultra Ball", "Buddy-Buddy Poffin", "Arven", "Level Ball"],
  ENERGY_ACCELERATION:["Superior Energy Retrieval", "Dark Patch", "Magma Basin", "Earthen Vessel"],
  SWITCH:             ["Switch", "Switch Cart", "Escape Rope"],
  DISRUPTION:         ["Boss's Orders", "Iono", "Path to the Peak", "Lost Vacuum"],
  RECOVERY:           ["Night Stretcher", "Super Rod", "Rescue Board"],
  MAIN_ATTACKER:      [],  // depende do deck — preenchido contextualmente
  SUPPORT:            ["Rare Candy", "Technical Machine: Evolution", "Bravery Charm"]
};

// ── Mapear problemas do deck para sugestões ───────────────────────────────────

export async function buildSuggestions(analysis: DeckAnalysis): Promise<DeckSuggestion[]> {
  const cardNames: Array<{ name: string; reason: string; priority: DeckSuggestion["priority"] }> = [];

  if (analysis.drawCount < 3) {
    for (const name of CATALOG.DRAW.slice(0, 3)) {
      cardNames.push({ name, reason: `Aumenta compra de cartas (você tem ${analysis.drawCount})`, priority: "HIGH" });
    }
  }

  if (analysis.searchCount < 3) {
    for (const name of CATALOG.SEARCH.slice(0, 3)) {
      cardNames.push({ name, reason: `Melhora busca de Pokémon (você tem ${analysis.searchCount})`, priority: "HIGH" });
    }
  }

  if (analysis.categories.energy > 15) {
    for (const name of CATALOG.ENERGY_ACCELERATION.slice(0, 2)) {
      cardNames.push({ name, reason: `Substitui energias extras por aceleração (${analysis.categories.energy} energias)`, priority: "MEDIUM" });
    }
  }

  // Sem sugestões específicas → retornar set de consistência básico
  if (cardNames.length === 0) {
    const defaults = [...CATALOG.DRAW.slice(0, 2), ...CATALOG.SEARCH.slice(0, 2)];
    for (const name of defaults) {
      cardNames.push({ name, reason: "Cartas de consistência essenciais", priority: "LOW" });
    }
  }

  // Buscar cartas reais na TCG API
  const cards = await fetchCardsByNames(cardNames.map((c) => c.name));

  return cards.map((card, i) => ({
    card,
    reason: cardNames[i]?.reason ?? card.name,
    priority: cardNames[i]?.priority ?? "LOW"
  }));
}

// ── Sugestões para análise de combate ─────────────────────────────────────────

export interface MatchIssue {
  problem: string;
  suggestion: CardRole;
  cardNames: string[];
}

export function detectMatchIssues(matchSummary: string): MatchIssue[] {
  const lower = matchSummary.toLowerCase();
  const issues: MatchIssue[] = [];

  if (/sem atacante|sem básico|sem pokémon|mão vazia|hand vazia|não achei/.test(lower)) {
    issues.push({
      problem: "Dificuldade em encontrar Pokémon no início",
      suggestion: "SEARCH",
      cardNames: CATALOG.SEARCH.slice(0, 3)
    });
  }

  if (/muita energia|energia demais|energia sobrando|cheio de energia/.test(lower)) {
    issues.push({
      problem: "Excesso de energia na mão",
      suggestion: "ENERGY_ACCELERATION",
      cardNames: CATALOG.ENERGY_ACCELERATION.slice(0, 2)
    });
  }

  if (/carta de busca|não achei buscador|sem busca/.test(lower)) {
    issues.push({
      problem: "Falta de buscadores no deck",
      suggestion: "SEARCH",
      cardNames: CATALOG.SEARCH.slice(0, 3)
    });
  }

  if (/comprei pouco|não comprei|sem compra|draw ruim/.test(lower)) {
    issues.push({
      problem: "Pouca compra de cartas",
      suggestion: "DRAW",
      cardNames: CATALOG.DRAW.slice(0, 3)
    });
  }

  if (/preso|não consegui recuar|sem recuo|travado/.test(lower)) {
    issues.push({
      problem: "Dificuldade de recuar Pokémon",
      suggestion: "SWITCH",
      cardNames: CATALOG.SWITCH.slice(0, 2)
    });
  }

  if (/deck agressivo|adversário rápido|muito rápido|perdeu rápido|ko rápido/.test(lower)) {
    issues.push({
      problem: "Adversário muito agressivo",
      suggestion: "DISRUPTION",
      cardNames: CATALOG.DISRUPTION.slice(0, 3)
    });
  }

  return issues;
}

export async function fetchMatchSuggestions(issues: MatchIssue[]): Promise<DeckSuggestion[]> {
  if (issues.length === 0) return [];
  const names = issues.flatMap((i) => i.cardNames.slice(0, 2));
  const unique = [...new Set(names)].slice(0, 6);
  const cards = await fetchCardsByNames(unique);
  return cards.map((card, i) => ({
    card,
    reason: issues[Math.floor(i / 2)]?.problem ?? card.name,
    priority: "MEDIUM" as const
  }));
}
