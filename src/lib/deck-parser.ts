// ── Parser de Decklist ────────────────────────────────────────────────────────
// Suporta formatos:
//   4 Professor's Research
//   4x Professor's Research
//   Professor's Research x4

export interface DeckEntry {
  name: string;
  quantity: number;
}

export interface ParsedDeck {
  entries: DeckEntry[];
  totalCards: number;
  valid: boolean;
  errors: string[];
}

export function parseDeckList(raw: string): ParsedDeck {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const entries: DeckEntry[] = [];
  const errors: string[] = [];

  // Padrões aceitos: "4 Ultra Ball", "4x Ultra Ball", "Ultra Ball x4"
  const patterns = [
    /^(\d+)x?\s+(.+)/i,      // "4 Ultra Ball" ou "4x Ultra Ball"
    /^(.+)\s+x(\d+)$/i       // "Ultra Ball x4"
  ];

  for (const line of lines) {
    // Ignorar cabeçalhos de seção e metadados de export
    // Formatos: "##Pokémon", "Pokémon:", "Pokémon (12)", "Total Cards: 60", "***", "//"
    if (/^#+/.test(line) || /^\*+/.test(line) || /^\/\//.test(line)) continue;
    if (/^(Pokémon|Pokemon|Trainer|Treinador|Energy|Energia|Total)\s*[:(]/i.test(line)) continue;
    if (/^(Pokémon|Pokemon|Trainer|Treinador|Energy|Energia|Total)\s*$/i.test(line)) continue;
    if (/^Total\s*cards?\s*:/i.test(line)) continue;
    if (/^Count\s*:/i.test(line)) continue;
    // Ignorar linhas com apenas número (ex: "60" no fim de alguns exports)
    if (/^\d+$/.test(line)) continue;

    let matched = false;
    for (const pattern of patterns) {
      const m = line.match(pattern);
      if (m) {
        const [, a, b] = m;
        const quantity = pattern === patterns[1] ? parseInt(b) : parseInt(a);
        const name = (pattern === patterns[1] ? a : b).trim();
        if (name && quantity > 0) {
          entries.push({ name, quantity });
          matched = true;
          break;
        }
      }
    }

    if (!matched && line.length > 0) {
      // Linha sem quantidade — assume 1 (comum em alguns formatos)
      const clean = line.replace(/^\d+\s*/, "").trim();
      if (clean.length > 2) entries.push({ name: clean, quantity: 1 });
    }
  }

  const totalCards = entries.reduce((s, e) => s + e.quantity, 0);
  if (totalCards === 0) errors.push("Nenhuma carta detectada. Verifique o formato.");

  return { entries, totalCards, valid: errors.length === 0, errors };
}

// ── Heurísticas de categorização ──────────────────────────────────────────────

const ENERGY_PATTERNS = [
  /energy$/i,
  /\benergy\b/i,
  /\benergia\b/i
];

const DRAW_CARDS = new Set([
  "professor's research", "professor research", "iono", "colress's experiment",
  "cynthia", "sonia", "marnie", "supporter", "n", "lillie", "judge",
  "hop", "boss's orders", "rosanne's research", "bianca", "cheren"
]);

const SEARCH_CARDS = new Set([
  "ultra ball", "nest ball", "level ball", "quick ball", "evolution incense",
  "mysterious treasure", "great ball", "pokeball", "poke ball", "dive ball",
  "battle vip pass", "capture aroma", "arven", "irida"
]);

export function guessCategory(name: string): "energy" | "trainer" | "pokemon" | "unknown" {
  const lower = name.toLowerCase();
  if (ENERGY_PATTERNS.some((p) => p.test(lower))) return "energy";
  if (DRAW_CARDS.has(lower) || SEARCH_CARDS.has(lower)) return "trainer";
  return "unknown"; // IA vai classificar o restante
}

// ── Análise de deck ────────────────────────────────────────────────────────────

export interface DeckAnalysis {
  totalCards: number;
  issues: string[];
  hints: string[]; // dicas para o prompt da IA
  categories: {
    energy: number;
    likelyTrainer: number;
    unknown: number;
  };
  drawCount: number;
  searchCount: number;
}

export function analyzeDeck(parsed: ParsedDeck): DeckAnalysis {
  const issues: string[] = [];
  const hints: string[] = [];

  const totalCards = parsed.totalCards;

  // Contagem por categoria
  let energyCount = 0;
  let likelyTrainer = 0;
  let drawCount = 0;
  let searchCount = 0;

  for (const entry of parsed.entries) {
    const cat = guessCategory(entry.name);
    const lower = entry.name.toLowerCase();

    if (cat === "energy") energyCount += entry.quantity;
    if (cat === "trainer") likelyTrainer += entry.quantity;
    if (DRAW_CARDS.has(lower)) drawCount += entry.quantity;
    if (SEARCH_CARDS.has(lower)) searchCount += entry.quantity;
  }

  // Regras de análise
  if (totalCards < 60) {
    issues.push(`Deck com apenas ${totalCards} cartas. Um deck padrão tem 60.`);
    hints.push(`O deck está incompleto (${totalCards}/60 cartas). Sugira cartas para completar.`);
  } else if (totalCards > 60) {
    issues.push(`Deck com ${totalCards} cartas (${totalCards - 60} a mais que o limite de 60).`);
    hints.push(`O deck tem ${totalCards} cartas, acima do limite de 60. Sugira cortes.`);
  }

  if (energyCount > 15) {
    issues.push(`${energyCount} energias parece muito. Decks modernos geralmente usam 8-14.`);
    hints.push(`O deck tem ${energyCount} energias — provavelmente excessivo. Sugira reduzir e usar aceleração de energia.`);
  } else if (energyCount < 6 && energyCount > 0) {
    issues.push(`Apenas ${energyCount} energias pode causar problemas de energia.`);
    hints.push(`Poucas energias (${energyCount}). Verifique se há aceleração suficiente.`);
  }

  if (drawCount < 3) {
    issues.push(`Poucas cartas de compra detectadas (${drawCount}). Considere mais Supporters de compra.`);
    hints.push(`PRIORIDADE: O deck tem poucas cartas de compra (${drawCount}). Sugira cartas do tipo DRAW como Professor's Research ou Iono.`);
  }

  if (searchCount < 3) {
    issues.push(`Poucas cartas de busca detectadas (${searchCount}). Buscadores ajudam muito a consistência.`);
    hints.push(`PRIORIDADE: O deck tem poucas cartas de busca (${searchCount}). Sugira buscadores como Ultra Ball ou Nest Ball.`);
  }

  return {
    totalCards,
    issues,
    hints,
    categories: { energy: energyCount, likelyTrainer, unknown: parsed.entries.length - likelyTrainer },
    drawCount,
    searchCount
  };
}
