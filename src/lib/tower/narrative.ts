import { prisma } from "@/lib/prisma";

export const TOWER_NARRATIVE_KEY = "tower_narrative_scenes";

export type TowerSceneTrigger = "LOBBY" | "RUN_START" | "ENCOUNTER" | "BOSS" | "VICTORY";

export type TowerNarrativeScene = {
  id: string;
  trigger: TowerSceneTrigger;
  floor: number;
  title: string;
  speaker: string;
  text: string;
  backgroundUrl: string;
  characterUrl: string;
  characterSide: "LEFT" | "RIGHT";
  enabled: boolean;
  order: number;
  minFailures?: number;
  knowledgeTitle?: string;
  knowledgeText?: string;
};

export const DEFAULT_TOWER_SCENES: TowerNarrativeScene[] = [
  {
    id: "tower-lobby-welcome",
    trigger: "LOBBY",
    floor: 1,
    title: "O convite dos Rebeldes",
    speaker: "Meowth, o Mordomo",
    text: "A Torre não recebe visitantes. Ela escolhe intrusos. Traga dois mascotes e talvez eu permita que encontrem a primeira escada.",
    backgroundUrl: "/events/torre-dos-rebeldes/background.png",
    characterUrl: "/events/torre-dos-rebeldes/leaders/06_meowth_rebelde.png",
    characterSide: "RIGHT",
    enabled: true,
    order: 0,
  },
  {
    id: "tower-run-start",
    trigger: "RUN_START",
    floor: 1,
    title: "A porta se fechou",
    speaker: "Meowth, o Mordomo",
    text: "Cada passo acorda a Torre. Cada mecanismo ignorado fortalece quem os espera lá em cima. Escolham com cuidado.",
    backgroundUrl: "/events/torre-dos-rebeldes/background.png",
    characterUrl: "/events/torre-dos-rebeldes/leaders/06_meowth_rebelde.png",
    characterSide: "RIGHT",
    enabled: true,
    order: 10,
  },
  {
    id: "tower-first-encounter",
    trigger: "ENCOUNTER",
    floor: 1,
    title: "Passos no escuro",
    speaker: "Chandelure, o Arquivista",
    text: "Contato hostil. O combate acontece no próprio salão: paredes, distância, posturas e mecanismos continuam valendo.",
    backgroundUrl: "/events/torre-dos-rebeldes/background.png",
    characterUrl: "/events/torre-dos-rebeldes/chandelure.png",
    characterSide: "LEFT",
    enabled: true,
    order: 20,
  },
  {
    id: "tower-boss-meowth",
    trigger: "BOSS",
    floor: 1,
    title: "A Câmara do Mordomo",
    speaker: "Meowth, o Mordomo",
    text: "Chegaram até minha porta carregando todos os erros que cometeram pelo caminho. Vamos conferir a conta.",
    backgroundUrl: "/events/torre-dos-rebeldes/background.png",
    characterUrl: "/events/torre-dos-rebeldes/leaders/06_meowth_rebelde.png",
    characterSide: "RIGHT",
    enabled: true,
    order: 30,
  },
];

function isScene(value: unknown): value is TowerNarrativeScene {
  if (!value || typeof value !== "object") return false;
  const scene = value as Partial<TowerNarrativeScene>;
  return typeof scene.id === "string" && typeof scene.text === "string" && typeof scene.trigger === "string";
}

export async function getTowerNarrativeScenes(): Promise<TowerNarrativeScene[]> {
  const row = await prisma.appSetting.findUnique({ where: { key: TOWER_NARRATIVE_KEY }, select: { value: true } }).catch(() => null);
  const saved = Array.isArray(row?.value) ? row.value.filter(isScene) : [];
  return (saved.length ? saved : DEFAULT_TOWER_SCENES).sort((a, b) => a.order - b.order);
}

export function unlockedTowerScenes(scenes: TowerNarrativeScene[], failures: number) {
  return scenes.filter((scene) => scene.enabled && failures >= Math.max(0, scene.minFailures ?? 0));
}

export function towerSceneFor(scenes: TowerNarrativeScene[], trigger: TowerSceneTrigger, floor = 1, failures = 0) {
  const unlocked = unlockedTowerScenes(scenes, failures);
  return unlocked.filter((scene) => scene.trigger === trigger && scene.floor === floor).at(-1)
    ?? unlocked.filter((scene) => scene.trigger === trigger).at(-1)
    ?? null;
}
