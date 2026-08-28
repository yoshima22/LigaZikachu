// Árvore de talentos da Torre dos Rebeldes (Legado das Runs).
// Catálogo compartilhado + resolver de efeitos agregados. Os efeitos são fiados
// em 4 pontos seguros do motor: multiplicador de atributos dos aliados, escala
// de Pressão dos inimigos, escudo de Pressão inicial e penalidade de dividir a
// equipe no mapa. Cada talento vai do rank 0 ao 5.

export type TowerTalentCategory = "STATUS" | "PRESSAO" | "MOVIMENTO";

export type TowerTalent = {
  key: string;
  name: string;
  category: TowerTalentCategory;
  /** Descrição por rank (o texto já cita o efeito unitário). */
  description: string;
  maxRank: number;
  // Contribuições POR RANK (somadas):
  force?: number;      // +% Força
  agility?: number;    // +% Agilidade
  instinct?: number;   // +% Instinto
  vitality?: number;   // +% Vitalidade
  boss?: number;       // +% em todos os atributos SÓ contra chefes
  shield?: number;     // +escudo de Pressão no início da run
  scaleRed?: number;   // reduz o fator de crescimento inimigo por Pressão (base 0.03)
  splitRed?: number;   // reduz a penalidade de dividir a equipe (base 2, mínimo 1)
};

// Os 5 talentos originais continuam com o efeito antigo, fiado direto no motor
// (COMBAT/BOSS nos atributos, PRESSURE no escudo, LUCK/RESCUE em objetos/resgate).
// Aqui ficam APENAS os 15 novos, cujos efeitos passam pelo resolver abaixo.
export const TOWER_TALENTS: TowerTalent[] = [
  // ── Status ──────────────────────────────────────────────────────────────
  { key: "FORCE",       name: "Fúria disciplinada", category: "STATUS", maxRank: 5, force: 0.025,    description: "+2,5% de Força dos seus mascotes por rank nos combates da Torre." },
  { key: "AGILITY",     name: "Reflexos afiados",   category: "STATUS", maxRank: 5, agility: 0.025,   description: "+2,5% de Agilidade por rank (mais iniciativa nos encontros)." },
  { key: "VITALITY",    name: "Couro rúnico",       category: "STATUS", maxRank: 5, vitality: 0.025,  description: "+2,5% de Vitalidade por rank (mais fôlego contra a Pressão alta)." },
  { key: "INSTINCT",    name: "Faro para o perigo", category: "STATUS", maxRank: 5, instinct: 0.025,  description: "+2,5% de Instinto por rank." },
  { key: "VIGOR",       name: "Vigor comunitário",  category: "STATUS", maxRank: 5, force: 0.015, agility: 0.015, instinct: 0.015, vitality: 0.015, description: "+1,5% em TODOS os atributos por rank." },
  { key: "FEROCITY",    name: "Caça aos regentes",  category: "STATUS", maxRank: 5, boss: 0.02,       description: "+2% em todos os atributos por rank SÓ nas batalhas contra chefes de andar." },
  // ── Pressão ─────────────────────────────────────────────────────────────
  { key: "BULWARK",     name: "Muralha rebelde",    category: "PRESSAO", maxRank: 5, shield: 1,        description: "+1 de escudo de Pressão no início de cada run por rank (absorve os primeiros pontos)." },
  { key: "FORTITUDE",   name: "Têmpera coletiva",   category: "PRESSAO", maxRank: 5, shield: 1,        description: "+1 de escudo de Pressão inicial por rank." },
  { key: "STOICISM",    name: "Serenidade",         category: "PRESSAO", maxRank: 5, shield: 1,        description: "+1 de escudo de Pressão inicial por rank." },
  { key: "COMPOSURE",   name: "Sangue-frio",        category: "PRESSAO", maxRank: 5, scaleRed: 0.005,  description: "A Pressão fortalece menos os inimigos: −0,5% por rank no bônus que a Pressão dá a eles." },
  { key: "RESOLVE",     name: "Determinação",       category: "PRESSAO", maxRank: 5, scaleRed: 0.004,  description: "−0,4% por rank no quanto a Pressão fortalece os inimigos." },
  // ── Movimento / mapa ────────────────────────────────────────────────────
  { key: "PATHFINDER",  name: "Desbravador",        category: "MOVIMENTO", maxRank: 5, splitRed: 0.4,  description: "Dividir a equipe pesa menos: −0,4 por rank na Pressão extra de seguir rotas diferentes (mínimo 1)." },
  { key: "SURVEYOR",    name: "Topógrafo",          category: "MOVIMENTO", maxRank: 5, splitRed: 0.3,  description: "−0,3 por rank na penalidade de dividir a equipe pelo mapa." },
  { key: "VANGUARD",    name: "Vanguarda",          category: "MOVIMENTO", maxRank: 5, agility: 0.02,  description: "+2% de Agilidade por rank — ajuda a agir e alcançar aliados primeiro." },
  { key: "WARDEN",      name: "Sentinela",          category: "MOVIMENTO", maxRank: 5, shield: 1, scaleRed: 0.002, description: "+1 de escudo inicial e −0,2% no bônus da Pressão aos inimigos, por rank." },
];

export const TOWER_TALENT_KEYS = TOWER_TALENTS.map((t) => t.key);
export const TOWER_TALENT_BY_KEY = Object.fromEntries(TOWER_TALENTS.map((t) => [t.key, t])) as Record<string, TowerTalent>;

export type TowerTalentEffects = {
  forceMult: number;
  agilityMult: number;
  instinctMult: number;
  vitalityMult: number;
  /** Multiplicador extra aplicado SÓ contra chefes. */
  bossMult: number;
  /** Escudo de Pressão somado no início da run. */
  pressureShieldStart: number;
  /** Fator de crescimento inimigo por Pressão (base 0.03, nunca abaixo de 0.01). */
  enemyPressureScale: number;
  /** Penalidade efetiva de dividir a equipe (base 2, nunca abaixo de 1). */
  splitPenalty: number;
};

/** Agrega os efeitos dos 15 talentos novos a partir dos ranks atuais. */
export function resolveTowerTalents(rankOf: (key: string) => number): TowerTalentEffects {
  let force = 0, agility = 0, instinct = 0, vitality = 0, boss = 0;
  let shield = 0, scaleRed = 0, splitRed = 0;
  for (const talent of TOWER_TALENTS) {
    const rank = Math.max(0, Math.min(talent.maxRank, rankOf(talent.key) || 0));
    if (rank <= 0) continue;
    force += (talent.force ?? 0) * rank;
    agility += (talent.agility ?? 0) * rank;
    instinct += (talent.instinct ?? 0) * rank;
    vitality += (talent.vitality ?? 0) * rank;
    boss += (talent.boss ?? 0) * rank;
    shield += (talent.shield ?? 0) * rank;
    scaleRed += (talent.scaleRed ?? 0) * rank;
    splitRed += (talent.splitRed ?? 0) * rank;
  }
  return {
    forceMult: 1 + force,
    agilityMult: 1 + agility,
    instinctMult: 1 + instinct,
    vitalityMult: 1 + vitality,
    bossMult: 1 + boss,
    pressureShieldStart: Math.round(shield),
    enemyPressureScale: Math.max(0.01, 0.03 - scaleRed),
    splitPenalty: Math.max(1, 2 - splitRed),
  };
}
