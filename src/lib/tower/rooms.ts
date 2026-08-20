export type TowerRoomKind = "ENTRANCE" | "PUZZLE" | "COMBAT" | "REST" | "EVENT" | "BOSS";

export type TowerPuzzle = {
  id: string;
  prompt: string;
  options: { id: string; label: string }[];
  answer: string;
  discovery: string;
};

export type TowerRoomNode = {
  id: string;
  index: number;
  kind: TowerRoomKind;
  title: string;
  description: string;
  backgroundUrl: string;
  connections: string[];
  puzzle?: TowerPuzzle;
  cleared: boolean;
};

export type TowerPressureModifier = {
  key: string;
  name: string;
  description: string;
  enemyMultiplier: number;
  healingMultiplier: number;
};

export type TowerExplorationState = {
  currentRoomId: string;
  visited: string[];
  graph: TowerRoomNode[];
  pressure: number;
  activeModifiers: TowerPressureModifier[];
  lastOutcome?: string;
  pendingReplay?: {
    winner: "A" | "B" | "DRAW";
    log: unknown[];
    lineupA: unknown[];
    lineupB: unknown[];
    teamASurvivors: number;
    teamBSurvivors: number;
    title: string;
  };
  countermeasures?: string[];
  pressureShield?: number;
  encounter?: { roomId: string; preparationTurns: number; enemies: { pokemonId: number; name: string; level: number }[] };
};

const BG = "/events/torre-dos-rebeldes/background.png";

const PUZZLES: TowerPuzzle[] = [
  {
    id: "bells",
    prompt: "Três sinos têm marcas de lua: crescente, cheia e minguante. Qual deve tocar primeiro?",
    options: [{ id: "full", label: "Lua cheia" }, { id: "wax", label: "Lua crescente" }, { id: "wane", label: "Lua minguante" }],
    answer: "wax",
    discovery: "Os sinos obedecem ao nascimento da lua: crescente, cheia, minguante.",
  },
  {
    id: "mirror",
    prompt: "O espelho mostra três portas, mas apenas uma não reflete a chama roxa. Qual você toca?",
    options: [{ id: "flame", label: "A porta em chamas" }, { id: "dark", label: "A porta sem reflexo" }, { id: "self", label: "O próprio espelho" }],
    answer: "dark",
    discovery: "Na Galeria dos Espelhos, a ausência de reflexo denuncia a passagem real.",
  },
  {
    id: "runes",
    prompt: "As runas dizem: força alimenta a torre, instinto a engana e carisma a acorda. O que oferecer?",
    options: [{ id: "force", label: "Força" }, { id: "instinct", label: "Instinto" }, { id: "charisma", label: "Carisma" }],
    answer: "instinct",
    discovery: "Runas rebeldes cedem ao Instinto; Força e Carisma aumentam a vigilância da Torre.",
  },
];

function hash(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function towerPressureModifiers(pressure: number): TowerPressureModifier[] {
  const all: Array<[number, TowerPressureModifier]> = [
    [2, { key: "WATCHFUL", name: "A Torre Observa", description: "Inimigos recebem +5% nos atributos.", enemyMultiplier: 1.05, healingMultiplier: 1 }],
    [4, { key: "HUNGER", name: "Fome do Vazio", description: "Curas realizadas na run perdem 15% de eficiência.", enemyMultiplier: 1, healingMultiplier: .85 }],
    [6, { key: "HUNT", name: "Caçada Rebelde", description: "Patrulhas reforçadas passam a proteger as rotas.", enemyMultiplier: 1.08, healingMultiplier: 1 }],
    [8, { key: "REVOLT", name: "Rebelião Total", description: "A Torre entra em alerta máximo: inimigos recebem mais 12%. Zah!", enemyMultiplier: 1.12, healingMultiplier: 1 }],
  ];
  return all.filter(([at]) => pressure >= at).map(([, mod]) => mod);
}

export function generateTowerRoomGraph(seed: string): TowerExplorationState {
  const puzzle = PUZZLES[hash(seed) % PUZZLES.length];
  const graph: TowerRoomNode[] = [
    { id: "entrance", index: 0, kind: "ENTRANCE", title: "Vestíbulo Rebelde", description: "A porta fecha atrás do grupo. Dois caminhos parecem seguros — o que costuma significar que nenhum é.", backgroundUrl: BG, connections: ["puzzle", "patrol"], cleared: true },
    { id: "puzzle", index: 1, kind: "PUZZLE", title: "Arquivo das Vozes", description: "Um mecanismo antigo bloqueia a passagem. A resposta errada alimentará a Torre.", backgroundUrl: BG, connections: ["rest", "gallery"], puzzle, cleared: false },
    { id: "patrol", index: 2, kind: "COMBAT", title: "Salão da Patrulha", description: "Passos ritmados ecoam adiante. Os rebeldes já perceberam a expedição.", backgroundUrl: BG, connections: ["gallery", "rest"], cleared: false },
    { id: "rest", index: 3, kind: "REST", title: "Capela Silenciosa", description: "Uma chama azul oferece descanso — ou uma armadilha muito educada.", backgroundUrl: BG, connections: ["gallery"], cleared: false },
    { id: "gallery", index: 4, kind: "COMBAT", title: "Galeria dos Desobedientes", description: "A guarda de elite protege o elevador quebrado.", backgroundUrl: BG, connections: ["boss"], cleared: false },
    { id: "boss", index: 5, kind: "BOSS", title: "Câmara do Chandelure", description: "O senhor do andar abre seu livro. A última aula será prática.", backgroundUrl: BG, connections: [], cleared: false },
  ];
  return { currentRoomId: "entrance", visited: ["entrance"], graph, pressure: 0, activeModifiers: [] };
}

export function currentTowerRoom(state: TowerExplorationState) {
  return state.graph.find((room) => room.id === state.currentRoomId) ?? state.graph[0];
}

export function applyTowerPressure(state: TowerExplorationState, amount = 1) {
  const absorbed = Math.min(Math.max(0, state.pressureShield ?? 0), amount);
  const pressure = Math.max(0, state.pressure + amount - absorbed);
  return { ...state, pressure, pressureShield: Math.max(0, (state.pressureShield ?? 0) - absorbed), activeModifiers: towerPressureModifiers(pressure) };
}

export function towerEncounterPreview(room: TowerRoomNode, averageLevel: number, allyCount: number) {
  const pool = room.kind === "BOSS" ? [609, 94, 197, 302] : [92, 198, 200, 353, 607, 215];
  const count = room.kind === "BOSS" ? Math.max(2, allyCount) : Math.max(2, Math.min(allyCount, 4));
  return Array.from({ length: count }, (_, index) => ({
    pokemonId: pool[(room.index + index) % pool.length],
    name: "", level: Math.max(1, averageLevel + room.index * 2),
  }));
}
