"use server";

// Torre dos Rebeldes — Fase 1 (shell admin-only).
// Segurança real no servidor: TODA action verifica isAdmin (ADMIN/SUPER_ADMIN).
// GM é explicitamente NEGADO — nunca usar isStaff aqui.

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import { getSessionPlayer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getPokemonName } from "@/lib/mascot-data";
import {
  getTowerConfig,
  TOWER_EXPEDITION_ROLES,
  TOWER_ROLE_BY_KEY,
  initialStanceFor,
  towerMaxHp,
  TOWER_SETTINGS_KEY,
  type TowerConfig,
} from "@/lib/tower/config";
import { Prisma, type TowerExpeditionRole, type TowerPaceMode } from "@prisma/client";
import { windowMsFor, resolveTowerTurnLocked, runLockKey, type TowerVolatile } from "@/lib/tower/turn";
import { generateEncounter, generateBossEncounter, visibleTiles, objectsView, type MemberMascotInput } from "@/lib/tower/encounter";
import { tileKey, manhattan } from "@/lib/tower/engine/grid";
import { normalizeCombatRole } from "@/lib/combat-roles";
import { uploadDataUrlAsset } from "@/lib/asset-storage";
import {
  getTowerNarrativeScenes,
  towerSceneFor,
  unlockedTowerScenes,
  TOWER_NARRATIVE_KEY,
  type TowerNarrativeScene,
  type TowerSceneTrigger,
} from "@/lib/tower/narrative";
import { TOWER_OBJECTS } from "@/lib/tower/objects";
import { currentTowerRoom, generateTowerRoomGraph } from "@/lib/tower/rooms";

const PATH = "/combates/torre-dos-rebeldes";

/** Membro de uma run ainda ativa (LOBBY/ACTIVE) do usuário, se houver. */
async function findActiveRunForUser(userId: string) {
  return prisma.towerRunMember.findFirst({
    where: { userId, afkRemoved: false, run: { status: { in: ["LOBBY", "ACTIVE"] } } },
    select: { run: { select: { id: true, status: true, pace: true, currentFloor: true } } },
  });
}

async function lastEntryAt(userId: string): Promise<number | null> {
  const [last, bypass] = await Promise.all([prisma.towerRunMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: "desc" },
    select: { run: { select: { createdAt: true } } },
  }), prisma.towerFeat.findFirst({ where: { userId, featKey: "ADMIN_COOLDOWN_BYPASS" }, orderBy: { achievedAt: "desc" }, select: { achievedAt: true } })]);
  const entryAt = last?.run.createdAt.getTime() ?? null;
  if (entryAt !== null && bypass && bypass.achievedAt.getTime() > entryAt) return null;
  return entryAt;
}

/** Retorna o usuário só se for ADMIN de plataforma; senão null (GM/USER negados). */
export async function requireTowerAdmin() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) return null;
  return user;
}

type TowerOverview =
  | { error: string }
  | { ok: true; status: "in_development"; message: string };

/** Visão geral da Torre (placeholder da Fase 1). Guardada por ADMIN. */
export async function getTowerOverviewAction(): Promise<TowerOverview> {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito à equipe ADMIN." };
  return {
    ok: true,
    status: "in_development",
    message: "Torre dos Rebeldes em desenvolvimento (Fase 1: shell admin-only).",
  };
}

export async function saveTowerConfigAction(input: TowerConfig) {
  const user=await requireTowerAdmin();
  if(!user)return {error:"Acesso restrito à equipe ADMIN."};
  const entryCooldownMinutes=Math.max(0,Math.min(10080,Math.trunc(Number(input.entryCooldownMinutes)||0)));
  const value:TowerConfig={entryCooldownMinutes,requireTicket:input.requireTicket===true};
  await prisma.appSetting.upsert({where:{key:TOWER_SETTINGS_KEY},create:{key:TOWER_SETTINGS_KEY,value},update:{value}});
  revalidatePath(PATH);
  return {ok:true as const,config:value};
}

export async function clearMyTowerCooldownAction() {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito à equipe ADMIN." };
  await prisma.towerFeat.create({ data: { userId: user.id, featKey: "ADMIN_COOLDOWN_BYPASS", data: { reason: "Liberação manual pelo painel da Torre" } } });
  revalidatePath(PATH);
  return { ok: true as const };
}

/** Interações de metaprogressão feitas fora das runs. Cada estudo vale uma vez por dia. */
export async function contributeTowerPreparationAction(metricKey: "WARD" | "INSIGHT" | "MAP") {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito à equipe ADMIN." };
  if (!(["WARD", "INSIGHT", "MAP"] as const).includes(metricKey)) return { error: "Preparação inválida." };
  const day = new Date().toISOString().slice(0, 10);
  const featKey = `TOWER_PREP:${metricKey}:${day}`;
  const used = await prisma.towerFeat.findFirst({ where: { userId: user.id, featKey }, select: { id: true } });
  if (used) return { error: "Você já contribuiu com este estudo hoje." };
  await prisma.$transaction([
    prisma.towerFeat.create({ data: { userId: user.id, featKey, data: { metricKey, day } } }),
    prisma.towerCommunityProgress.upsert({ where: { floorId_metricKey: { floorId: 1, metricKey } }, create: { floorId: 1, metricKey, value: 1 }, update: { value: { increment: 1 } } }),
  ]);
  revalidatePath(PATH);
  return { ok: true as const };
}

// ── Fase 4 · Lobby & entrada ──────────────────────────────────────────────────

/** Dados para montar o lobby: run ativa, cooldown, mascotes elegíveis, Funções. */
export async function getTowerLobbyDataAction() {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito à equipe ADMIN." };
  const player = await getSessionPlayer(user.id);
  if (!player) return { error: "Jogador não encontrado." };

  const config = await getTowerConfig();
  const scenes = await getTowerNarrativeScenes();
  const failures = await prisma.towerRunMember.count({ where: { userId: user.id, run: { status: { in: ["FAILED", "ABANDONED"] } } } });
  const [communityProgress, communityCodex] = await Promise.all([
    prisma.towerCommunityProgress.findMany({ where: { floorId: 1 }, orderBy: { metricKey: "asc" } }),
    prisma.towerCodexEntry.findMany({ where: { userId: null }, orderBy: { updatedAt: "desc" }, take: 30 }),
  ]);
  const active = await findActiveRunForUser(user.id);
  const openRuns = await prisma.towerRun.findMany({
    where: { status: "LOBBY" }, orderBy: { createdAt: "desc" }, take: 20,
    include: { members: { select: { userId: true } } },
  });
  const roomUserIds = [...new Set(openRuns.flatMap((run) => run.members.map((member) => member.userId)))];
  const roomUsers = new Map((await prisma.user.findMany({ where: { id: { in: roomUserIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name ?? "Jogador"]));
  const lastAt = await lastEntryAt(user.id);
  const nextEntryMs = lastAt !== null ? lastAt + config.entryCooldownMinutes * 60_000 : 0;

  const mascots = await prisma.mascot.findMany({
    where: {
      playerId: player.id,
      arenaState: "FREE",
      bazarListed: false,
      expeditions: { none: { status: "ACTIVE" } },
    },
    orderBy: [{ level: "desc" }, { nickname: "asc" }],
    take: 300,
    select: {
      id: true, pokemonId: true, nickname: true, level: true, preferredCombatRole: true,
      statForce: true, statAgility: true, statInstinct: true, statVitality: true, statCharisma: true,
    },
  });

  return {
    ok: true as const,
    config,
    scenes,
    lobbyScene: towerSceneFor(scenes, "LOBBY", 1, failures),
    failures,
    communityProgress,
    communityCodex,
    knowledge: unlockedTowerScenes(scenes, failures).filter((scene) => scene.knowledgeTitle?.trim()).map((scene) => ({ id: scene.id, title: scene.knowledgeTitle!, text: scene.knowledgeText || scene.text, floor: scene.floor })),
    activeRun: active?.run ?? null,
    nextEntryAt: nextEntryMs > Date.now() ? new Date(nextEntryMs).toISOString() : null,
    roles: TOWER_EXPEDITION_ROLES.map((r) => ({
      key: r.key, label: r.label, exploration: r.exploration, benefit: r.benefit, stances: r.stances,
    })),
    mascots: mascots.map((m) => ({ ...m, name: m.nickname ?? getPokemonName(m.pokemonId) })),
    rooms: openRuns.filter((run) => run.members.length < 3).map((run) => {
      const lobby = ((run.volatileState ?? {}) as { lobby?: { code?: string; hostId?: string; ready?: Record<string, boolean> } }).lobby;
      return { id: run.id, code: lobby?.code ?? run.id.slice(-6).toUpperCase(), pace: run.pace, host: roomUsers.get(lobby?.hostId ?? run.members[0]?.userId ?? "") ?? "Jogador", members: run.members.map((m) => ({ userId: m.userId, name: roomUsers.get(m.userId) ?? "Jogador", ready: Boolean(lobby?.ready?.[m.userId]) })) };
    }),
  };
}

/** Editor narrativo data-driven. Imagens enviadas são persistidas no Storage. */
export async function saveTowerNarrativeScenesAction(input: TowerNarrativeScene[]) {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito à equipe ADMIN." };
  if (!Array.isArray(input) || input.length > 50) return { error: "Lista de cenas inválida." };
  const validTriggers = new Set<TowerSceneTrigger>(["LOBBY", "RUN_START", "ENCOUNTER", "BOSS", "VICTORY"]);
  const scenes: TowerNarrativeScene[] = [];
  for (let index = 0; index < input.length; index++) {
    const raw = input[index];
    if (!raw || !validTriggers.has(raw.trigger) || !raw.speaker?.trim() || !raw.text?.trim()) {
      return { error: `A cena ${index + 1} possui campos obrigatórios inválidos.` };
    }
    const id = raw.id?.trim() || `tower-scene-${Date.now()}-${index}`;
    const backgroundUrl = raw.backgroundUrl?.startsWith("data:image/")
      ? await uploadDataUrlAsset(raw.backgroundUrl, "events/tower/scenes", `${id}-background`)
      : raw.backgroundUrl?.trim() || "/events/torre-dos-rebeldes/background.png";
    const characterUrl = raw.characterUrl?.startsWith("data:image/")
      ? await uploadDataUrlAsset(raw.characterUrl, "events/tower/scenes", `${id}-character`)
      : raw.characterUrl?.trim() || "/events/torre-dos-rebeldes/leaders/06_meowth_rebelde.png";
    scenes.push({
      id, trigger: raw.trigger, floor: Math.max(1, Math.min(7, Math.trunc(raw.floor || 1))),
      title: raw.title?.trim() || "Cena da Torre", speaker: raw.speaker.trim(), text: raw.text.trim(),
      backgroundUrl, characterUrl, characterSide: raw.characterSide === "LEFT" ? "LEFT" : "RIGHT",
      enabled: raw.enabled !== false, order: Number.isFinite(raw.order) ? Math.trunc(raw.order) : index * 10,
      minFailures: Math.max(0, Math.trunc(raw.minFailures ?? 0)),
      knowledgeTitle: raw.knowledgeTitle?.trim() || undefined,
      knowledgeText: raw.knowledgeText?.trim() || undefined,
    });
  }
  await prisma.appSetting.upsert({
    where: { key: TOWER_NARRATIVE_KEY },
    create: { key: TOWER_NARRATIVE_KEY, value: scenes as unknown as Prisma.InputJsonValue },
    update: { value: scenes as unknown as Prisma.InputJsonValue },
  });
  revalidatePath(PATH);
  return { ok: true as const, scenes };
}

/** Cria a expedição (host/solo). Valida cooldown, run única e 2 mascotes elegíveis. */
export async function createTowerRunAction(input: {
  pace: TowerPaceMode;
  expeditionRole: TowerExpeditionRole;
  mascotIds: string[];
  stanceByMascot?: Record<string, string>;
}): Promise<{ error: string } | { ok: true; runId: string }> {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito à equipe ADMIN." };
  const player = await getSessionPlayer(user.id);
  if (!player) return { error: "Jogador não encontrado." };
  const config = await getTowerConfig();

  if (input.pace !== "ONLINE" && input.pace !== "SLOW") return { error: "Ritmo inválido." };
  if (!TOWER_ROLE_BY_KEY[input.expeditionRole]) return { error: "Função de Expedição inválida." };
  const ids = [...new Set(input.mascotIds ?? [])];
  if (ids.length !== 2) return { error: "Selecione exatamente 2 mascotes." };

  if (await findActiveRunForUser(user.id)) return { error: "Você já possui uma expedição ativa na Torre." };

  const lastAt = await lastEntryAt(user.id);
  if (lastAt !== null) {
    const nextAt = lastAt + config.entryCooldownMinutes * 60_000;
    if (Date.now() < nextAt) {
      return { error: `Cooldown de entrada ativo — disponível às ${new Date(nextAt).toLocaleTimeString("pt-BR")}.` };
    }
  }

  const mascots = await prisma.mascot.findMany({
    where: {
      id: { in: ids }, playerId: player.id, arenaState: "FREE", bazarListed: false,
      expeditions: { none: { status: "ACTIVE" } },
    },
    select: { id: true, level: true, statVitality: true, preferredCombatRole: true },
  });
  if (mascots.length !== 2) return { error: "Um ou mais mascotes não estão disponíveis." };

  // Ticket da Torre: exigência configurável — desligada em desenvolvimento.
  // if (config.requireTicket) { /* consumir Ticket da Torre do inventário */ }

  const seed = randomBytes(12).toString("base64url");
  const allowedStances = TOWER_ROLE_BY_KEY[input.expeditionRole].stances;
  const run = await prisma.$transaction(async (tx) => {
    const created = await tx.towerRun.create({
      data: { pace: input.pace, seed, status: "LOBBY", resolutionOrder: [user.id], volatileState: { lobby: { code: randomBytes(3).toString("hex").toUpperCase(), hostId: user.id, ready: { [user.id]: false } } } },
    });
    const member = await tx.towerRunMember.create({
      data: { runId: created.id, userId: user.id, expeditionRole: input.expeditionRole, resolutionIndex: 0 },
    });
    for (const m of mascots) {
      const maxHp = towerMaxHp(m.level, m.statVitality);
      await tx.towerRunMascot.create({
        data: {
          memberId: member.id, mascotId: m.id, ownerUserId: user.id,
          currentHp: maxHp, maxHp,
          currentStance: allowedStances.includes(normalizeCombatRole(input.stanceByMascot?.[m.id])) ? normalizeCombatRole(input.stanceByMascot?.[m.id]) : initialStanceFor(input.expeditionRole, m.preferredCombatRole),
          allowedStances, state: "IN_TOWER",
        },
      });
    }
    return created;
  });
  revalidatePath(PATH);
  return { ok: true as const, runId: run.id };
}

/** Entra em uma sala aberta. Cada integrante leva sua própria classe, posturas e dois mascotes. */
export async function joinTowerRoomAction(input: { runId: string; expeditionRole: TowerExpeditionRole; mascotIds: string[]; stanceByMascot?: Record<string,string> }) {
  const user=await requireTowerAdmin(); if(!user)return {error:"Acesso restrito à equipe ADMIN."};
  const player=await getSessionPlayer(user.id); if(!player)return {error:"Jogador não encontrado."};
  if(await findActiveRunForUser(user.id))return {error:"Você já participa de uma expedição ativa."};
  const role=TOWER_ROLE_BY_KEY[input.expeditionRole]; if(!role)return {error:"Classe inválida."};
  const ids=[...new Set(input.mascotIds??[])]; if(ids.length!==2)return {error:"Selecione exatamente 2 mascotes."};
  const mascots=await prisma.mascot.findMany({where:{id:{in:ids},playerId:player.id,arenaState:"FREE",bazarListed:false,expeditions:{none:{status:"ACTIVE"}}},select:{id:true,level:true,statVitality:true,preferredCombatRole:true}});
  if(mascots.length!==2)return {error:"Um dos mascotes não está disponível."};
  await prisma.$transaction(async tx=>{
    const run=await tx.towerRun.findUnique({where:{id:input.runId},include:{members:true}});
    if(!run||run.status!=="LOBBY"||run.members.length>=3)throw new Error("Sala indisponível ou cheia.");
    const member=await tx.towerRunMember.create({data:{runId:run.id,userId:user.id,expeditionRole:input.expeditionRole,resolutionIndex:run.members.length}});
    for(const m of mascots){const maxHp=towerMaxHp(m.level,m.statVitality);const requested=normalizeCombatRole(input.stanceByMascot?.[m.id]);await tx.towerRunMascot.create({data:{memberId:member.id,mascotId:m.id,ownerUserId:user.id,currentHp:maxHp,maxHp,currentStance:role.stances.includes(requested)?requested:initialStanceFor(input.expeditionRole,m.preferredCombatRole),allowedStances:role.stances,state:"IN_TOWER"}})}
    const vol=(run.volatileState??{}) as {lobby?:{code?:string;hostId?:string;ready?:Record<string,boolean>}};
    await tx.towerRun.update({where:{id:run.id},data:{resolutionOrder:[...run.members.map(m=>m.userId),user.id],volatileState:{...vol,lobby:{...vol.lobby,hostId:vol.lobby?.hostId??run.members[0]?.userId,ready:{...(vol.lobby?.ready??{}),[user.id]:false}}} as Prisma.InputJsonValue}});
  });
  revalidatePath(PATH);return {ok:true as const,runId:input.runId};
}

/** Confirma ou reabre a preparação. Iniciar só é permitido ao host com todos prontos. */
export async function setTowerReadyAction(runId:string,ready:boolean){
 const user=await requireTowerAdmin();if(!user)return {error:"Acesso restrito."};
 const run=await prisma.towerRun.findUnique({where:{id:runId},include:{members:true}});if(!run||run.status!=="LOBBY"||!run.members.some(m=>m.userId===user.id))return {error:"Sala não encontrada."};
 const vol=(run.volatileState??{}) as {lobby?:{code?:string;hostId?:string;ready?:Record<string,boolean>}};
 await prisma.towerRun.update({where:{id:runId},data:{volatileState:{...vol,lobby:{...vol.lobby,hostId:vol.lobby?.hostId??run.members[0]?.userId,ready:{...(vol.lobby?.ready??{}),[user.id]:ready}}} as Prisma.InputJsonValue}});revalidatePath(PATH);return {ok:true as const};
}

/** Encerra/abandona a expedição do usuário (uso em dev enquanto não há gameplay). */
export async function abandonTowerRunAction(runId: string): Promise<{ error: string } | { ok: true }> {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito à equipe ADMIN." };
  const member = await prisma.towerRunMember.findFirst({ where: { runId, userId: user.id }, select: { id: true } });
  if (!member) return { error: "Você não participa desta expedição." };
  await prisma.towerRun.update({ where: { id: runId }, data: { status: "ABANDONED", endedAt: new Date() } });
  revalidatePath(PATH);
  return { ok: true as const };
}

// ── Fase 5 · Turn Engine (janela global; Online 120s / Lento 4h) ──────────────
// Núcleo em @/lib/tower/turn (compartilhado com o cron; não exposto como action).

/** Inicia a expedição no grafo de salas, LOBBY → ACTIVE e abre a 1ª janela. */
export async function startTowerExpeditionAction(runId: string): Promise<{ error: string } | { ok: true }> {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito à equipe ADMIN." };
  const run = await prisma.towerRun.findUnique({
    where: { id: runId },
    select: {
      id: true, status: true, pace: true, seed: true, volatileState: true,
      members: { select: { userId: true, resolutionIndex: true, mascots: { select: { mascotId: true, currentStance: true } } } },
    },
  });
  if (!run) return { error: "Expedição não encontrada." };
  if (!run.members.some((m) => m.userId === user.id)) return { error: "Você não participa desta expedição." };
  if (run.status !== "LOBBY") return { error: "Esta expedição já foi iniciada." };
  const lobby=((run.volatileState??{}) as {lobby?:{hostId?:string;ready?:Record<string,boolean>}}).lobby;
  if((lobby?.hostId??run.members[0]?.userId)!==user.id)return {error:"Somente o criador da sala pode iniciar."};
  if(!run.members.every(m=>lobby?.ready?.[m.userId]))return {error:"Todos os jogadores precisam marcar Pronto."};

  const progress = await prisma.towerCommunityProgress.findMany({ where: { floorId: 1 } });
  const unlocked = progress.filter((entry) => entry.value >= 5).map((entry) => entry.metricKey);
  const exploration = { ...generateTowerRoomGraph(run.seed), countermeasures: unlocked, pressureShield: unlocked.includes("WARD") ? 2 : 0 };
  const order = [...run.members].sort((a, b) => a.resolutionIndex - b.resolutionIndex).map((m) => m.userId);
  await prisma.towerRun.update({
    where: { id: runId },
    data: {
      status: "ACTIVE", startedAt: new Date(), globalTurn: 1, resolutionOrder: order,
      nextDeadline: new Date(Date.now() + windowMsFor(run.pace)),
      volatileState: { ...(run.volatileState as object ?? {}), submissions: {}, roomIndex: 1, log: ["A porta se fechou. O mapa da Torre começou a se desenhar."], exploration } as unknown as Prisma.InputJsonValue,
    },
  });
  revalidatePath(PATH);
  return { ok: true as const };
}

/** Avança para o Boss após vencer o encounter. Objetivos ignorados o reforçam. */
export async function advanceToBossAction(runId: string): Promise<{ error: string } | { ok: true }> {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito à equipe ADMIN." };
  const run = await prisma.towerRun.findUnique({
    where: { id: runId },
    select: {
      id: true, status: true, pace: true, seed: true, volatileState: true,
      members: { select: { userId: true, mascots: { select: { mascotId: true, currentHp: true, currentStance: true, state: true } } } },
    },
  });
  if (!run) return { error: "Expedição não encontrada." };
  if (!run.members.some((m) => m.userId === user.id)) return { error: "Você não participa desta expedição." };
  if (run.status !== "ACTIVE") return { error: "A expedição não está ativa." };
  const vol = (run.volatileState ?? {}) as TowerVolatile;
  const b = vol.battle;
  if (!b || !b.encounterOver || b.outcome !== "WIN") return { error: "Vença o encounter atual antes de enfrentar o boss." };
  if (b.isBoss) return { error: "Você já está enfrentando o boss." };

  const unresolved = b.objects.filter((o) => o.suppression && !o.resolved).length;
  const nextRoom=(vol.roomIndex??1)+1;

  const mascotIds = run.members.flatMap((m) => m.mascots.map((x) => x.mascotId));
  const rows = await prisma.mascot.findMany({
    where: { id: { in: mascotIds } },
    select: { id: true, pokemonId: true, nickname: true, level: true, statForce: true, statAgility: true, statInstinct: true, statVitality: true, statCharisma: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const members = run.members.map((m) => ({
    userId: m.userId,
    mascots: m.mascots.flatMap((mm): MemberMascotInput[] => {
      const r = byId.get(mm.mascotId);
      if (!r) return [];
      return [{
        id: r.id, pokemonId: r.pokemonId, name: r.nickname ?? getPokemonName(r.pokemonId), level: r.level,
        force: r.statForce, agility: r.statAgility, instinct: r.statInstinct, vitality: r.statVitality, charisma: r.statCharisma,
        stance: normalizeCombatRole(mm.currentStance), currentHp: mm.currentHp,
      }];
    }),
  }));
  const survivors = members.reduce((s, m) => s + m.mascots.filter((mm) => (mm.currentHp ?? 1) > 0).length, 0);
  if (survivors === 0) return { error: "Nenhum mascote sobreviveu para enfrentar o boss." };

  const isBossRoom=nextRoom>3;
  const battle = isBossRoom?generateBossEncounter(run.seed, members, unresolved):generateEncounter(`${run.seed}:room:${nextRoom}`,members);
  const log = [...((vol.log ?? [])), isBossRoom?`Câmara do boss! ${unresolved} mecanismo(s) ignorado(s) reforçam o líder.`:`Sala ${nextRoom} revelada. A arquitetura da Torre mudou.`].slice(-50);
  await prisma.towerRun.update({
    where: { id: runId },
    data: {
      globalTurn: run.status === "ACTIVE" ? { increment: 1 } : undefined,
      nextDeadline: new Date(Date.now() + windowMsFor(run.pace)),
      volatileState: { ...vol, submissions: {}, roomIndex: nextRoom, log, battle } as unknown as Prisma.InputJsonValue,
    },
  });
  revalidatePath(PATH);
  return { ok: true as const };
}

/** Estado atual da run (para polling). Resolve o turno se o deadline já passou. */
export async function getTowerRunStateAction(runId: string) {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito à equipe ADMIN." };

  let run = await prisma.towerRun.findUnique({ where: { id: runId }, include: { members: true } });
  if (!run) return { error: "Expedição não encontrada." };
  if (!run.members.some((m) => m.userId === user.id)) return { error: "Você não participa desta expedição." };

  // Auto-resolução ao acessar após o deadline (além do cron).
  if (run.status === "ACTIVE" && run.nextDeadline && run.nextDeadline.getTime() <= Date.now()) {
    await resolveTowerTurnLocked(runId).catch(() => null);
    run = await prisma.towerRun.findUnique({ where: { id: runId }, include: { members: true } });
    if (!run) return { error: "Expedição não encontrada." };
  }

  const vol = (run.volatileState ?? {}) as TowerVolatile;
  const lobby = (run.volatileState as { lobby?: { code?: string; hostId?: string; ready?: Record<string,boolean> } } | null)?.lobby;
  const submissions = vol.submissions ?? {};
  const scenes = await getTowerNarrativeScenes();
  const priorFailures = await prisma.towerRunMember.count({ where: { userId: user.id, run: { status: { in: ["FAILED", "ABANDONED"] }, id: { not: run.id } } } });
  const userNames = new Map((await prisma.user.findMany({
    where: { id: { in: run.members.map((member) => member.userId) } },
    select: { id: true, name: true },
  })).map((member) => [member.id, member.name ?? "Jogador"]));

  // View do combate com fog de time: aliados sempre; inimigos só se visíveis.
  type ObjView = { id: string; key: string; name: string; x: number; y: number; radius: number; progress: number; required: number; resolved: boolean; suppression: boolean; interactable: boolean; spriteUrl: string; effect: string };
  let battle: null | {
    room: { width: number; height: number; blocked: string[]; wallTiles?: string[]; doorTiles?: string[]; trapTiles?: string[] };
    discovered: string[]; visible: string[];
    units: { id: string; team: string; ownerId: string | null; name: string; pokemonId: number; level: number; types: string[]; x: number; y: number; hp: number; maxHp: number; role: string; shield: number; agility: number; effects: { id: string; label: string; kind: string; value: number; duration: number }[] }[];
    objects: ObjView[];
    suppression: { resolved: number; total: number };
    isBoss: boolean;
    over: boolean; outcome: "WIN" | "LOSS" | null;
  } = null;
  let myMascots: { id: string; name: string; hp: number; maxHp: number; role: string }[] = [];
  if (vol.battle) {
    const b = vol.battle;
    const vis = visibleTiles(b);
    const myAllies = b.units.filter((u) => u.team === "ALLY" && u.ownerId === user.id && u.hp > 0);
    const objects: ObjView[] = objectsView(b, vis).map((o) => ({
      ...o, spriteUrl: TOWER_OBJECTS[o.key]?.spriteUrl ?? "/events/torre-dos-rebeldes/objects/19_pedra_runica.png",
      effect: TOWER_OBJECTS[o.key]?.effect ?? "Mecanismo desconhecido.",
      interactable: !o.resolved && myAllies.some((u) => manhattan(u, o) <= o.radius),
    }));
    const suppTotal = b.objects.filter((o) => o.suppression).length;
    const suppResolved = b.objects.filter((o) => o.suppression && o.resolved).length;
    battle = {
      room: b.room, discovered: b.discovered, visible: [...vis],
      units: b.units
        .filter((u) => u.team === "ALLY" || vis.has(tileKey(u.x, u.y)))
        .map((u) => ({ id: u.id, team: u.team, ownerId: u.ownerId, name: u.name, pokemonId: u.pokemonId, level: u.level, types: u.types, x: u.x, y: u.y, hp: u.hp, maxHp: u.maxHp, role: u.role, shield: u.shield, agility: u.agility, effects: u.effects })),
      objects,
      suppression: { resolved: suppResolved, total: suppTotal },
      isBoss: b.isBoss ?? false,
      over: b.encounterOver, outcome: b.outcome ?? null,
    };
    myMascots = b.units
      .filter((u) => u.team === "ALLY" && u.ownerId === user.id)
      .map((u) => ({ id: u.id, name: u.name, hp: u.hp, maxHp: u.maxHp, role: u.role }));
  }

  const exploration = vol.exploration;
  const room = exploration ? currentTowerRoom(exploration) : null;
  const communityDiscoveries = exploration ? await prisma.towerCodexEntry.findMany({
    where: { userId: null, subjectType: "PUZZLE" },
    select: { subjectKey: true, discoveryLevel: true, data: true },
    orderBy: { updatedAt: "desc" }, take: 20,
  }) : [];
  if (exploration) {
    const snapshots = await prisma.towerRunMascot.findMany({ where: { member: { runId, userId: user.id } } });
    const names = new Map((await prisma.mascot.findMany({ where: { id: { in: snapshots.map((m) => m.mascotId) } }, select: { id: true, nickname: true, pokemonId: true } })).map((m) => [m.id, m.nickname ?? getPokemonName(m.pokemonId)]));
    myMascots = snapshots.map((m) => ({ id: m.mascotId, name: names.get(m.mascotId) ?? "Mascote", hp: m.currentHp, maxHp: m.maxHp, role: m.currentStance }));
  }

  return {
    ok: true as const,
    run: {
      id: run.id, status: run.status, pace: run.pace, currentFloor: run.currentFloor,
      globalTurn: run.globalTurn, nextDeadline: run.nextDeadline?.toISOString() ?? null,
      roomIndex: vol.roomIndex ?? 1,
    },
    order: (Array.isArray(run.resolutionOrder) ? (run.resolutionOrder as string[]) : []),
    members: run.members.map((m) => ({
      userId: m.userId, name: userNames.get(m.userId) ?? "Jogador", expeditionRole: m.expeditionRole, afkRemoved: m.afkRemoved,
      consecutiveMisses: m.consecutiveMisses, confirmed: Boolean(submissions[m.userId]),
    })),
    mine: { userId: user.id, confirmed: Boolean(submissions[user.id]) },
    lobby: { code: lobby?.code ?? run.id.slice(-6).toUpperCase(), hostId: lobby?.hostId ?? run.members[0]?.userId ?? "", ready: lobby?.ready ?? {} },
    battle,
    exploration: exploration && room ? {
      currentRoom: { ...room, puzzle: room.puzzle ? { id: room.puzzle.id, prompt: room.puzzle.prompt, options: room.puzzle.options, hint: exploration.countermeasures?.includes("INSIGHT") ? "O Arquivo recomenda observar a sequência, não a intensidade." : null } : undefined },
      rooms: exploration.graph.map((node) => { const known = exploration.visited.includes(node.id) || exploration.countermeasures?.includes("MAP"); return { id: node.id, title: known ? node.title : "Sala desconhecida", kind: known ? node.kind : "UNKNOWN", visited: exploration.visited.includes(node.id), current: node.id === room.id, cleared: node.cleared }; }),
      routes: room.connections.map((id) => {
        const node = exploration.graph.find((candidate) => candidate.id === id);
        return node ? { id: node.id, title: exploration.countermeasures?.includes("MAP") ? node.title : "Rota desconhecida", kind: exploration.countermeasures?.includes("MAP") ? node.kind : "UNKNOWN", visited: exploration.visited.includes(node.id), cleared: node.cleared } : null;
      }).filter(Boolean),
      pressure: exploration.pressure,
      modifiers: exploration.activeModifiers,
      countermeasures: exploration.countermeasures ?? [],
      pressureShield: exploration.pressureShield ?? 0,
      lastOutcome: exploration.lastOutcome ?? null,
      replay: exploration.pendingReplay ?? null,
      communityDiscoveries,
    } : null,
    myMascots,
    log: (vol.log ?? []).slice(-12),
    lastEvents: vol.lastEvents ?? [],
    lastResolvedTurn: vol.lastResolvedTurn ?? null,
    scene: towerSceneFor(
      scenes,
      battle?.isBoss ? "BOSS" : run.globalTurn <= 1 ? "RUN_START" : "ENCOUNTER",
      run.currentFloor,
      priorFailures,
    ),
  };
}

/** Submete/confirma a ação do turno. Resolve na hora se todos os ativos confirmarem. */
export async function submitTowerActionAction(runId: string, actions: unknown): Promise<{ error: string } | { ok: true; resolved: boolean }> {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito à equipe ADMIN." };

  const resolvedNow = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${runLockKey(runId)})`;
    const run = await tx.towerRun.findUnique({ where: { id: runId }, include: { members: true } });
    if (!run) throw new Error("Expedição não encontrada.");
    if (run.status !== "ACTIVE") throw new Error("A expedição não está aceitando ações.");
    const me = run.members.find((m) => m.userId === user.id);
    if (!me || me.afkRemoved) throw new Error("Você não está ativo nesta expedição.");

    const vol = (run.volatileState ?? {}) as TowerVolatile;
    const submissions = { ...(vol.submissions ?? {}) };
    submissions[user.id] = { confirmedAt: new Date().toISOString(), actions: actions ?? null };
    await tx.towerRun.update({ where: { id: runId }, data: { volatileState: { ...vol, submissions } as unknown as Prisma.InputJsonValue } });

    const active = run.members.filter((m) => !m.afkRemoved);
    return active.every((m) => Boolean(submissions[m.userId]));
  }, { timeout: 15000 });

  if (resolvedNow) await resolveTowerTurnLocked(runId).catch(() => null);
  revalidatePath(PATH);
  return { ok: true as const, resolved: resolvedNow };
}
