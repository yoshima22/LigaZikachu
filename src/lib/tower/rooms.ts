export type TowerRoomKind = "ENTRANCE" | "PUZZLE" | "COMBAT" | "REST" | "EVENT" | "RESCUE" | "LUCK" | "BOSS";

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
  x: number;
  y: number;
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
  relics?: { key: string; name: string; description: string }[];
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

export function generateTowerRoomGraph(seed: string, floor = 1): TowerExplorationState {
  const puzzle = PUZZLES[hash(`${seed}:${floor}`) % PUZZLES.length];
  const room = (id: string, index: number, kind: TowerRoomKind, title: string, description: string, connections: string[], x: number, y: number, cleared = false, roomPuzzle?: TowerPuzzle): TowerRoomNode => ({ id, index, kind, title, description, backgroundUrl: BG, connections, x, y, cleared, puzzle: roomPuzzle });
  const graph: TowerRoomNode[] = [
    room("entrance",0,"ENTRANCE",`Entrada do ${floor}º andar`,"As escadas se dividem em várias alas.",["archive","patrol","crypt"],6,50,true),
    room("archive",1,"PUZZLE","Arquivo das Vozes","Um mecanismo bloqueia atalhos futuros.",["sanctuary","reliquary"],22,18,false,puzzle),
    room("patrol",2,"COMBAT","Salão da Patrulha","Passos rebeldes ecoam adiante.",["sanctuary","crossroads"],22,50),
    room("crypt",3,"EVENT","Cripta Lacrada","Há algo útil — ou faminto — atrás das correntes.",["rescue","crossroads"],22,82),
    room("sanctuary",4,"REST","Capela Silenciosa","Uma chama desconhecida oferece descanso.",["observatory","gate"],42,14),
    room("reliquary",5,"LUCK","Relicário Instável","Uma relíquia pode ajudar a run ou reagir contra o grupo.",["observatory","crossroads"],42,34),
    room("crossroads",6,"COMBAT","Encruzilhada Rebelde","Uma tropa móvel protege três passagens.",["observatory","rescue","gate"],43,60),
    room("rescue",7,"RESCUE","Sala Anti-Psicose","Jaulas de contenção guardam mascotes perdidos.",["crossroads","gate"],43,84),
    room("observatory",8,"PUZZLE","Observatório Partido","Resolver o mecanismo desativa reforços do chefe.",["gate","armory"],63,22,false,PUZZLES[(hash(seed)+floor+1)%PUZZLES.length]),
    room("armory",9,"EVENT","Arsenal Rebelde","Itens ativos podem fortalecer ou sabotar encontros.",["gate","elite"],64,45),
    room("gate",10,"COMBAT","Portão da Consciência","A última patrulha bloqueia o acesso ao líder.",["elite"],64,70),
    room("elite",11,"COMBAT","Escadaria do Regente","A guarda pessoal do chefe não respeita combate justo.",["boss"],82,55),
    room("boss",12,"BOSS",`Câmara do Chefe ${floor}/7`,`O regente do ${floor}º andar aguarda com seus seguidores.`,[],95,55),
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
