import { prisma } from "@/lib/prisma";
import narrativeCatalog from "./narrative-catalog.json";

export const TOWER_NARRATIVE_KEY = "tower_narrative_scenes";

export type TowerSceneTrigger =
  | "EVENT_FIRST_OPEN" | "LOBBY" | "RUN_START" | "FLOOR_ENTER" | "ROOM_ENTER"
  | "ENCOUNTER" | "ENCOUNTER_PREVIEW" | "WAIT" | "PRESSURE_MILESTONE"
  | "PUZZLE_SUCCESS" | "PUZZLE_FAILURE" | "EVENT_POSITIVE" | "EVENT_NEGATIVE"
  | "LUCK_POSITIVE" | "LUCK_NEGATIVE" | "REST" | "RESCUE" | "MASCOT_KO"
  | "PLAYER_SPECTATOR" | "MASCOT_LOST" | "CORRUPTED_MASCOT_ENCOUNTER"
  | "CORRUPTED_MASCOT_RESCUED" | "BOSS" | "BOSS_INTRO" | "BOSS_PLAYER_DEFEAT"
  | "BOSS_DEFEAT" | "FLOOR_VICTORY" | "RUN_FAILURE" | "STUDY_COMPLETED"
  | "LEGACY_MILESTONE" | "COMMUNITY_MILESTONE" | "LEADER_AS_ALLY"
  | "VICTORY" | "FINAL_VICTORY" | "POSTGAME";

export type TowerNarrativeScene = {
  id: string; groupId: string; groupTitle: string; trigger: TowerSceneTrigger;
  floor: number; title: string; speaker: string; secondarySpeaker?: string | null;
  text: string; followup?: string | null; backgroundUrl: string; characterUrl: string;
  characterSide: "LEFT" | "RIGHT"; tone?: string; oncePerPlayer?: boolean;
  conditionNotes?: string; enabled: boolean; order: number; minFailures?: number;
  knowledgeTitle?: string | null; knowledgeText?: string | null;
};

export const DEFAULT_TOWER_SCENES = narrativeCatalog as TowerNarrativeScene[];

function isScene(value: unknown): value is TowerNarrativeScene {
  if (!value || typeof value !== "object") return false;
  const scene = value as Partial<TowerNarrativeScene>;
  return typeof scene.id === "string" && typeof scene.text === "string" && typeof scene.trigger === "string";
}

export async function getTowerNarrativeScenes(): Promise<TowerNarrativeScene[]> {
  const row = await prisma.appSetting.findUnique({ where: { key: TOWER_NARRATIVE_KEY }, select: { value: true } }).catch(() => null);
  const saved = Array.isArray(row?.value) ? row.value.filter(isScene) : [];
  const savedById = new Map(saved.map((scene) => [scene.id, scene]));
  const merged = DEFAULT_TOWER_SCENES.map((scene) => ({ ...scene, ...savedById.get(scene.id) }));
  for (const scene of saved) if (!DEFAULT_TOWER_SCENES.some((entry) => entry.id === scene.id)) merged.push(scene);
  return merged.sort((a, b) => a.order - b.order);
}

export function unlockedTowerScenes(scenes: TowerNarrativeScene[], failures: number) {
  return scenes.filter((scene) => scene.enabled && failures >= Math.max(0, scene.minFailures ?? 0));
}

export function towerSceneFor(scenes: TowerNarrativeScene[], trigger: TowerSceneTrigger, floor = 1, failures = 0) {
  const unlocked = unlockedTowerScenes(scenes, failures);
  return unlocked.find((scene) => scene.trigger === trigger && scene.floor === floor)
    ?? unlocked.find((scene) => scene.trigger === trigger && scene.floor === 0)
    ?? unlocked.find((scene) => scene.trigger === trigger) ?? null;
}

export function nextTowerSceneFor(scenes: TowerNarrativeScene[], triggers: TowerSceneTrigger[], floor: number, failures: number, alreadyUnlocked: Set<string>) {
  const candidates = unlockedTowerScenes(scenes, failures).filter((scene) => triggers.includes(scene.trigger) && (scene.floor === 0 || scene.floor === floor));
  return candidates.find((scene) => !alreadyUnlocked.has(scene.id))
    ?? [...candidates].reverse().find((scene) => alreadyUnlocked.has(scene.id)) ?? null;
}

export async function recordTowerSceneUnlock(scene: TowerNarrativeScene | null, userId: string, runId?: string) {
  if (!scene) return;
  const data = { sceneId: scene.id, groupId: scene.groupId, groupTitle: scene.groupTitle, title: scene.title, speaker: scene.speaker, runId: runId ?? null };
  const shared = await prisma.towerCodexEntry.findFirst({ where: { userId: null, subjectType: "NARRATIVE_SCENE", subjectKey: scene.id }, select: { id: true } });
  if (shared)
    await prisma.towerCodexEntry.update({ where: { id: shared.id }, data: { discoveryLevel: 1, data } });
  else
    await prisma.towerCodexEntry.create({ data: { userId: null, subjectType: "NARRATIVE_SCENE", subjectKey: scene.id, discoveryLevel: 1, data } });
  const prior = await prisma.towerFeat.findFirst({ where: { userId, featKey: "TOWER_SCENE_UNLOCK", data: { path: ["sceneId"], equals: scene.id } }, select: { id: true } });
  if (!prior) await prisma.towerFeat.create({ data: { userId, runId, featKey: "TOWER_SCENE_UNLOCK", data } });
}

export function groupTowerScenes(scenes: TowerNarrativeScene[], unlockedIds: Set<string>, highestVisibleFloor = 1) {
  const groups = new Map<string, { id: string; title: string; scenes: Array<TowerNarrativeScene & { unlocked: boolean }> }>();
  for (const scene of scenes) {
    const unlocked = unlockedIds.has(scene.id);
    const future = scene.floor > 0 && scene.floor > highestVisibleFloor && !unlocked;
    const group = groups.get(scene.groupId) ?? { id: scene.groupId, title: future ? "???" : scene.groupTitle, scenes: [] };
    if (!future && group.title === "???") group.title = scene.groupTitle;
    group.scenes.push(future ? { ...scene, title: "???", speaker: "???", text: "", followup: null, conditionNotes: "", unlocked: false } : { ...scene, unlocked });
    groups.set(scene.groupId, group);
  }
  return [...groups.values()].sort((a, b) => a.id.localeCompare(b.id));
}
