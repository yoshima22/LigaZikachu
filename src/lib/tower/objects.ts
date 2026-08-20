// Torre dos Rebeldes — catálogo de objetos/mecanismos interativos (data-driven).
// Cada objeto tem raio de interação, progresso necessário e um efeito claro. Os
// de supressão fortalecem os inimigos enquanto ativos; resolvê-los remove o bônus
// e conta para liberar a câmara do boss (spec §36).

export type TowerObjectStat = "vitality" | "force" | "agility" | "instinct" | "charisma";

export type TowerObjectDef = {
  key: string;
  name: string;
  radius: number;
  required: number;
  suppression: boolean;
  effect: string;
  /** Enquanto ativo, aplica este buff a TODOS os inimigos do encounter. */
  activeEnemyBuff?: { stat: TowerObjectStat; value: number };
};

export const TOWER_OBJECTS: Record<string, TowerObjectDef> = {
  ALTAR: {
    key: "ALTAR", name: "Altar Amaldiçoado", radius: 1, required: 3, suppression: true,
    effect: "+25% de Vitalidade aos inimigos enquanto ativo. Purificar remove o bônus e enfraquece o boss.",
    activeEnemyBuff: { stat: "vitality", value: 0.25 },
  },
  TOTEM: {
    key: "TOTEM", name: "Totem", radius: 1, required: 2, suppression: true,
    effect: "+20% de Força aos inimigos enquanto ativo. Destruir remove o bônus.",
    activeEnemyBuff: { stat: "force", value: 0.2 },
  },
  GENERATOR: {
    key: "GENERATOR", name: "Gerador Rotom", radius: 1, required: 3, suppression: true,
    effect: "+15% de Agilidade aos inimigos enquanto ativo. Desativar remove o bônus.",
    activeEnemyBuff: { stat: "agility", value: 0.15 },
  },
  CHEST: {
    key: "CHEST", name: "Cofre do Mordomo", radius: 1, required: 1, suppression: false,
    effect: "Recompensa da sala (em breve).",
  },
};

export const objectEffectId = (key: string) => `obj:${key}`;
