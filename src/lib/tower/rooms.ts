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
  runReport?: TowerRunReport;
};

export type TowerRunMascotReport = {
  mascotId: string;
  ownerUserId: string;
  name: string;
  pokemonId: number;
  level: number;
  damageDealt: number;
  damageReceived: number;
  healing: number;
  kos: number;
};

export type TowerRunReport = {
  mascots: Record<string, TowerRunMascotReport>;
  monstersDefeated: number;
  bossesDefeated: number;
  alliesRecovered: number;
  talentPoints: number;
  roomsCleared: number;
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
  const room = (id: string, index: number, kind: TowerRoomKind, title: string, description: string, connections: string[], x: number, y: number, cleared = false, roomPuzzle?: TowerPuzzle): TowerRoomNode => ({ id, index, kind, title, description, backgroundUrl: BG, connections, x, y, cleared, puzzle: roomPuzzle });
  const kinds: TowerRoomKind[] = ["COMBAT","PUZZLE","EVENT","REST","COMBAT","LUCK","COMBAT","RESCUE"];
  const names: Record<TowerRoomKind,string[]> = {
    ENTRANCE:["Vestíbulo Rebelde"], BOSS:["Câmara do Regente"],
    COMBAT:["Patrulha Errante","Galeria dos Desobedientes","Portão da Consciência","Escadaria Hostil"],
    PUZZLE:["Arquivo das Vozes","Observatório Partido","Sala dos Sinos","Galeria de Espelhos"],
    EVENT:["Cripta Lacrada","Arsenal Rebelde","Oficina Rotom","Câmara das Correntes"],
    REST:["Capela Silenciosa","Jardim Noturno","Biblioteca Adormecida"],
    RESCUE:["Sala Anti-Psicose","Ala de Contenção"], LUCK:["Relicário Instável","Cofre do Acaso"],
  };
  const graph: TowerRoomNode[] = [];
  for(let column=0;column<13;column++) for(let row=0;row<3;row++) {
    const id=column===0&&row===1?"entrance":column===12&&row===1?"boss":`f${floor}-c${column}-r${row}`;
    let kind:TowerRoomKind=column===0&&row===1?"ENTRANCE":column===12&&row===1?"BOSS":kinds[hash(`${seed}:${floor}:${column}:${row}`)%kinds.length];
    const next:string[]=[];
    if(column<12){
      const same=column+1===12&&row===1?"boss":`f${floor}-c${column+1}-r${row}`; next.push(same);
      const other=(row+(hash(`${seed}:branch:${column}:${row}`)%2?1:2))%3;
      next.push(column+1===12&&other===1?"boss":`f${floor}-c${column+1}-r${other}`);
    }
    if(column===12&&row!==1)next.push("boss");
    const title=kind==="ENTRANCE"?`Entrada do ${floor}º andar`:kind==="BOSS"?`Câmara do Chefe ${floor}/7`:names[kind][hash(`${id}:name`)%names[kind].length];
    const description=kind==="BOSS"?`O regente do ${floor}º andar aguarda com seus seguidores.`:kind==="PUZZLE"?"Um mecanismo pode abrir ou cortar caminhos adiante.":kind==="RESCUE"?"Jaulas de contenção guardam mascotes perdidos em outras runs.":"A função real desta sala só fica clara ao atravessá-la.";
    graph.push(room(id,column*3+row,kind,title,description,[...new Set(next)],[18,50,82][row],4+column*7.6,kind==="ENTRANCE",kind==="PUZZLE"?PUZZLES[hash(`${id}:puzzle`)%PUZZLES.length]:undefined));
  }
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
