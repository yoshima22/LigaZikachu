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
import {
  resolveTowerTalents,
  TOWER_TALENTS,
  TOWER_TALENT_KEYS,
} from "@/lib/tower/talents";
import {
  MascotPersonality,
  Prisma,
  type TowerExpeditionRole,
  type TowerPaceMode,
} from "@prisma/client";
import {
  windowMsFor,
  resolveTowerTurnLocked,
  runLockKey,
  type TowerVolatile,
} from "@/lib/tower/turn";
import {
  generateEncounter,
  generateBossEncounter,
  visibleTiles,
  objectsView,
  type MemberMascotInput,
} from "@/lib/tower/encounter";
import { tileKey, manhattan } from "@/lib/tower/engine/grid";
import { normalizeCombatRole } from "@/lib/combat-roles";
import { uploadDataUrlAsset } from "@/lib/asset-storage";
import {
  getTowerNarrativeScenes,
  groupTowerScenes,
  nextTowerSceneFor,
  recordTowerSceneUnlock,
  unlockedTowerScenes,
  TOWER_NARRATIVE_KEY,
  type TowerNarrativeScene,
  type TowerSceneTrigger,
} from "@/lib/tower/narrative";
import { TOWER_OBJECTS } from "@/lib/tower/objects";
import { currentTowerRoom, generateTowerRoomGraph } from "@/lib/tower/rooms";
import { computeProceduralStats } from "@/lib/mascot";
import {
  ensureTowerExclusiveSpecies,
  TOWER_EXCLUSIVE_MASCOTS,
} from "@/lib/tower/exclusive-mascots";
import {
  isTowerStudyKey,
  TOWER_STUDY_TARGET,
  type TowerStudyKey,
} from "@/lib/tower/studies";

const PATH = "/combates/torre-dos-rebeldes";
const TOWER_TICKET_ID = "tower-entry-ticket";

async function ensureTowerTicket() {
  return prisma.shopItem.upsert({
    where: { id: TOWER_TICKET_ID },
    create: {
      id: TOWER_TICKET_ID,
      type: "VACATION_TICKET",
      name: "Ticket da Torre",
      description: "Consumido somente quando a expedição realmente começa.",
      price: 0,
      active: false,
      inventoryEnabled: true,
      metadata: { towerOnly: true, adminGrantOnly: true },
    },
    update: {
      name: "Ticket da Torre",
      description: "Consumido somente quando a expedição realmente começa.",
      inventoryEnabled: true,
    },
  });
}

/** Membro de uma run ainda ativa (LOBBY/ACTIVE) do usuário, se houver. */
async function findActiveRunForUser(userId: string) {
  return prisma.towerRunMember.findFirst({
    where: {
      userId,
      afkRemoved: false,
      run: { status: { in: ["LOBBY", "ACTIVE"] } },
    },
    select: {
      run: {
        select: { id: true, status: true, pace: true, currentFloor: true },
      },
    },
  });
}

async function lastEntryAt(userId: string): Promise<number | null> {
  const [last, bypass] = await Promise.all([
    prisma.towerRunMember.findFirst({
      where: { userId },
      orderBy: { joinedAt: "desc" },
      select: { run: { select: { createdAt: true } } },
    }),
    prisma.towerFeat.findFirst({
      where: { userId, featKey: "ADMIN_COOLDOWN_BYPASS" },
      orderBy: { achievedAt: "desc" },
      select: { achievedAt: true },
    }),
  ]);
  const entryAt = last?.run.createdAt.getTime() ?? null;
  if (entryAt !== null && bypass && bypass.achievedAt.getTime() > entryAt)
    return null;
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
    message:
      "Torre dos Rebeldes em desenvolvimento (Fase 1: shell admin-only).",
  };
}

export async function saveTowerConfigAction(input: TowerConfig) {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito à equipe ADMIN." };
  const entryCooldownMinutes = Math.max(
    0,
    Math.min(10080, Math.trunc(Number(input.entryCooldownMinutes) || 0)),
  );
  const value: TowerConfig = {
    entryCooldownMinutes,
    requireTicket: input.requireTicket === true,
  };
  await prisma.appSetting.upsert({
    where: { key: TOWER_SETTINGS_KEY },
    create: { key: TOWER_SETTINGS_KEY, value },
    update: { value },
  });
  revalidatePath(PATH);
  return { ok: true as const, config: value };
}

export async function clearMyTowerCooldownAction() {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito à equipe ADMIN." };
  await prisma.towerFeat.create({
    data: {
      userId: user.id,
      featKey: "ADMIN_COOLDOWN_BYPASS",
      data: { reason: "Liberação manual pelo painel da Torre" },
    },
  });
  revalidatePath(PATH);
  return { ok: true as const };
}

export async function adminReviveTowerMascotAction(mascotId: string) {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito." };
  const lost = await prisma.towerLostMascot.findUnique({ where: { mascotId } });
  if (!lost || lost.recoveredAt)
    return { error: "Mascote não está sob controle da Torre." };
  const sourceRun = await prisma.towerRun.findUnique({
    where: { id: lost.lostRunId },
    select: { status: true },
  });
  const restoredState =
    sourceRun?.status === "ACTIVE" ? "IN_TOWER" : "RECOVERED";
  await prisma.$transaction([
    prisma.towerLostMascot.update({
      where: { mascotId },
      data: { recoveredAt: new Date(), recoveredById: user.id },
    }),
    prisma.towerRunMascot.updateMany({
      where: { mascotId },
      data: { state: restoredState, currentHp: 1 },
    }),
  ]);
  revalidatePath(PATH);
  return { ok: true as const };
}

export async function adminResetTowerEventAction(confirmation: string) {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito." };
  if (confirmation !== "RESETAR TORRE")
    return { error: "Confirmação inválida." };
  await prisma.$transaction([
    prisma.towerLostMascot.deleteMany(),
    prisma.towerRun.deleteMany(),
    prisma.towerCodexEntry.deleteMany(),
    prisma.towerFeat.deleteMany({
      where: { featKey: { startsWith: "TOWER_" } },
    }),
    prisma.towerCommunityProgress.deleteMany(),
  ]);
  revalidatePath(PATH);
  return { ok: true as const };
}

/** Interações de metaprogressão feitas fora das runs. Cada estudo vale uma vez por dia. */
export async function contributeTowerPreparationAction(
  metricKey: TowerStudyKey,
) {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito à equipe ADMIN." };
  if (!isTowerStudyKey(metricKey)) return { error: "Preparação inválida." };
  const day = new Date().toISOString().slice(0, 10);
  const featKey = `TOWER_PREP:${day}`;
  const [used, progress] = await Promise.all([
    prisma.towerFeat.findFirst({
      where: { userId: user.id, featKey },
      select: { id: true },
    }),
    prisma.towerCommunityProgress.findUnique({
      where: { floorId_metricKey: { floorId: 1, metricKey } },
      select: { value: true },
    }),
  ]);
  if ((progress?.value ?? 0) >= TOWER_STUDY_TARGET)
    return { error: "Este reforço comunitário já está ativo." };
  if (used)
    return { error: "Você já gastou sua contribuição comunitária de hoje." };
  await prisma.$transaction([
    prisma.towerFeat.create({
      data: { userId: user.id, featKey, data: { metricKey, day } },
    }),
    prisma.towerCommunityProgress.upsert({
      where: { floorId_metricKey: { floorId: 1, metricKey } },
      create: { floorId: 1, metricKey, value: 1 },
      update: { value: { increment: 1 } },
    }),
  ]);
  revalidatePath(PATH);
  return { ok: true as const };
}

// ── Fase 4 · Lobby & entrada ──────────────────────────────────────────────────

/** Dados para montar o lobby: run ativa, cooldown, mascotes elegíveis, Funções. */
export async function getTowerLobbyDataAction() {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito à equipe ADMIN." };
  await ensureTowerExclusiveSpecies();
  await ensureTowerTicket();
  const player = await getSessionPlayer(user.id);
  if (!player) return { error: "Jogador não encontrado." };

  const config = await getTowerConfig();
  const scenes = await getTowerNarrativeScenes();
  const failures = await prisma.towerRunMember.count({
    where: {
      userId: user.id,
      run: { status: { in: ["FAILED", "ABANDONED"] } },
    },
  });
  const narrativeUnlockRows = await prisma.towerCodexEntry.findMany({
    where: { userId: null, subjectType: "NARRATIVE_SCENE" },
    select: { subjectKey: true },
  });
  const narrativeUnlockedIds = new Set(narrativeUnlockRows.map((row) => row.subjectKey));
  const lobbyScene = nextTowerSceneFor(
    scenes,
    narrativeUnlockedIds.size === 0 ? ["EVENT_FIRST_OPEN", "LOBBY"] : ["LOBBY", "EVENT_FIRST_OPEN"],
    1,
    failures,
    narrativeUnlockedIds,
  );
  if (lobbyScene && !narrativeUnlockedIds.has(lobbyScene.id))
    await recordTowerSceneUnlock(lobbyScene, user.id);
  if (lobbyScene) narrativeUnlockedIds.add(lobbyScene.id);
  const [communityProgress, communityCodex, controlledEntries] =
    await Promise.all([
      prisma.towerCommunityProgress.findMany({
        where: { floorId: 1 },
        orderBy: { metricKey: "asc" },
      }),
      prisma.towerCodexEntry.findMany({
        where: { userId: null, subjectType: { not: "NARRATIVE_SCENE" } },
        orderBy: { updatedAt: "desc" },
        take: 30,
      }),
      prisma.towerLostMascot.findMany({
        where: { recoveredAt: null },
        orderBy: { createdAt: "desc" },
        take: 60,
      }),
    ]);
  const progressValue = (key: string) =>
    communityProgress.find((entry) => entry.metricKey === key)?.value ?? 0;
  const talentRanks = Object.fromEntries(
    [
      ...["PRESSURE", "COMBAT", "BOSS", "LUCK", "RESCUE"],
      ...TOWER_TALENT_KEYS,
    ].map((key) => [key, progressValue(`TALENT:${key}`)]),
  );
  const talentSpent = Object.values(talentRanks).reduce(
    (sum, value) => sum + Number(value),
    0,
  );
  const controlledMascotRows = await prisma.mascot.findMany({
    where: { id: { in: controlledEntries.map((entry) => entry.mascotId) } },
    select: { id: true, pokemonId: true, nickname: true, level: true },
  });
  const controlledMascotsById = new Map(
    controlledMascotRows.map((mascot) => [mascot.id, mascot]),
  );
  const controlledOwners = new Map(
    (
      await prisma.user.findMany({
        where: {
          id: { in: controlledEntries.map((entry) => entry.ownerUserId) },
        },
        select: { id: true, name: true },
      })
    ).map((owner) => [owner.id, owner.name ?? "Jogador"]),
  );
  const [entryGroups, rescueGroups, talentGroups] = await Promise.all([
    prisma.towerRunMember.groupBy({
      by: ["userId"],
      _count: { _all: true },
      orderBy: { _count: { userId: "desc" } },
      take: 50,
    }),
    prisma.towerLostMascot.groupBy({
      by: ["recoveredById"],
      where: { recoveredById: { not: null } },
      _count: { _all: true },
    }),
    prisma.towerFeat.groupBy({
      by: ["userId"],
      where: { featKey: "TOWER_TALENT_CONTRIBUTION" },
      _count: { _all: true },
    }),
  ]);
  const rankingUserIds = [
    ...new Set([
      ...entryGroups.map((row) => row.userId),
      ...rescueGroups.flatMap((row) =>
        row.recoveredById ? [row.recoveredById] : [],
      ),
      ...talentGroups.map((row) => row.userId),
    ]),
  ];
  const rankingNames = new Map(
    (
      await prisma.user.findMany({
        where: { id: { in: rankingUserIds } },
        select: { id: true, name: true },
      })
    ).map((row) => [row.id, row.name ?? "Jogador"]),
  );
  const active = await findActiveRunForUser(user.id);
  const sessionPlayerForTicket = await getSessionPlayer(user.id);
  const towerTicketQuantity = sessionPlayerForTicket
    ? ((
        await prisma.playerInventory.findUnique({
          where: {
            playerId_itemId: {
              playerId: sessionPlayerForTicket.id,
              itemId: TOWER_TICKET_ID,
            },
          },
          select: { quantity: true },
        })
      )?.quantity ?? 0)
    : 0;
  const pendingMascotRewards = await prisma.towerFeat.findMany({
    where: {
      userId: user.id,
      featKey: "TOWER_MASCOT_PENDING",
      data: { path: ["pokemonId"], equals: 210008 },
    },
    orderBy: { achievedAt: "asc" },
  });
  const bossChoicePending = await prisma.towerFeat.findFirst({
    where: { userId: user.id, featKey: "TOWER_BOSS_CHOICE_PENDING" },
    orderBy: { achievedAt: "asc" },
  });
  const openRuns = await prisma.towerRun.findMany({
    where: { status: "LOBBY" },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      members: {
        select: {
          userId: true,
          expeditionRole: true,
          mascots: { select: { mascotId: true, currentStance: true } },
        },
      },
    },
  });
  const roomUserIds = [
    ...new Set(
      openRuns.flatMap((run) => run.members.map((member) => member.userId)),
    ),
  ];
  const roomUsers = new Map(
    (
      await prisma.user.findMany({
        where: { id: { in: roomUserIds } },
        select: { id: true, name: true },
      })
    ).map((u) => [u.id, u.name ?? "Jogador"]),
  );
  // Detalhes dos mascotes de cada membro das salas abertas (para mostrar quem
  // leva o quê antes de entrar).
  const roomMascotIds = [
    ...new Set(
      openRuns.flatMap((run) =>
        run.members.flatMap((member) =>
          member.mascots.map((mascot) => mascot.mascotId),
        ),
      ),
    ),
  ];
  const roomMascotById = new Map(
    (
      await prisma.mascot.findMany({
        where: { id: { in: roomMascotIds } },
        select: { id: true, pokemonId: true, nickname: true, level: true },
      })
    ).map((m) => [m.id, m]),
  );
  const lastAt = await lastEntryAt(user.id);
  const nextEntryMs =
    lastAt !== null ? lastAt + config.entryCooldownMinutes * 60_000 : 0;

  const lostMascotIds = (
    await prisma.towerLostMascot.findMany({
      where: { ownerUserId: user.id, recoveredAt: null },
      select: { mascotId: true },
    })
  ).map((entry) => entry.mascotId);
  const mascots = await prisma.mascot.findMany({
    where: {
      playerId: player.id,
      id: { notIn: lostMascotIds },
      arenaState: "FREE",
      bazarListed: false,
      expeditions: { none: { status: "ACTIVE" } },
    },
    orderBy: [{ level: "desc" }, { nickname: "asc" }],
    take: 300,
    select: {
      id: true,
      pokemonId: true,
      nickname: true,
      level: true,
      preferredCombatRole: true,
      statForce: true,
      statAgility: true,
      statInstinct: true,
      statVitality: true,
      statCharisma: true,
    },
  });

  return {
    ok: true as const,
    config,
    scenes,
    lobbyScene,
    narrativeGroups: groupTowerScenes(scenes, narrativeUnlockedIds),
    failures,
    communityProgress,
    communityCodex,
    talents: {
      points: Math.max(0, progressValue("TALENT_POINTS") - talentSpent),
      ranks: talentRanks,
      catalog: TOWER_TALENTS,
    },
    controlledMascots: controlledEntries
      .map((entry) => {
        const mascot = controlledMascotsById.get(entry.mascotId);
        return mascot
          ? {
              id: mascot.id,
              pokemonId: mascot.pokemonId,
              name: mascot.nickname ?? getPokemonName(mascot.pokemonId),
              level: mascot.level,
              owner: controlledOwners.get(entry.ownerUserId) ?? "Jogador",
              floor: entry.floor,
            }
          : null;
      })
      .filter(Boolean),
    ranking: rankingUserIds.map((userId) => ({
      userId,
      name: rankingNames.get(userId) ?? "Jogador",
      entries:
        entryGroups.find((row) => row.userId === userId)?._count._all ?? 0,
      rescues:
        rescueGroups.find((row) => row.recoveredById === userId)?._count._all ??
        0,
      talentPoints:
        talentGroups.find((row) => row.userId === userId)?._count._all ?? 0,
    })),
    pendingMascotRewards: pendingMascotRewards.map((feat) => {
      const reward = feat.data as {
        pokemonId: number;
        basePokemonId: number;
        name: string;
        floor?: number;
        reason?: string;
      };
      return {
        id: feat.id,
        ...reward,
        sprite:
          TOWER_EXCLUSIVE_MASCOTS.find(
            (entry) => entry.pokemonId === reward.pokemonId,
          )?.sprite ?? "",
      };
    }),
    bossChoice: bossChoicePending
      ? {
          id: bossChoicePending.id,
          options: TOWER_EXCLUSIVE_MASCOTS.slice(0, 7),
        }
      : null,
    exclusiveMascotCodes: TOWER_EXCLUSIVE_MASCOTS.map(
      ({ code, pokemonId, name }) => ({ code, pokemonId, name }),
    ),
    towerTicketQuantity,
    knowledge: unlockedTowerScenes(scenes, failures)
      .filter((scene) => scene.knowledgeTitle?.trim())
      .map((scene) => ({
        id: scene.id,
        title: scene.knowledgeTitle!,
        text: scene.knowledgeText || scene.text,
        floor: scene.floor,
      })),
    activeRun: active?.run ?? null,
    nextEntryAt:
      nextEntryMs > Date.now() ? new Date(nextEntryMs).toISOString() : null,
    roles: TOWER_EXPEDITION_ROLES.map((r) => ({
      key: r.key,
      label: r.label,
      exploration: r.exploration,
      benefit: r.benefit,
      gameplayTip: r.gameplayTip,
      stances: r.stances,
    })),
    mascots: mascots.map((m) => ({
      ...m,
      name: m.nickname ?? getPokemonName(m.pokemonId),
    })),
    rooms: openRuns
      .filter((run) => run.members.length < 3)
      .map((run) => {
        const lobby = (
          (run.volatileState ?? {}) as {
            lobby?: {
              code?: string;
              hostId?: string;
              ready?: Record<string, boolean>;
            };
          }
        ).lobby;
        const host =
          run.members.find((member) => member.userId === lobby?.hostId) ??
          run.members[0];
        return {
          id: run.id,
          code: lobby?.code ?? run.id.slice(-6).toUpperCase(),
          pace: run.pace,
          hostId: host?.userId ?? null,
          host: roomUsers.get(host?.userId ?? "") ?? "Jogador",
          hostSetup: host
            ? {
                expeditionRole: host.expeditionRole,
                stances: host.mascots.map((mascot) => mascot.currentStance),
              }
            : null,
          members: run.members.map((m) => ({
            userId: m.userId,
            name: roomUsers.get(m.userId) ?? "Jogador",
            ready: Boolean(lobby?.ready?.[m.userId]),
            expeditionRole: m.expeditionRole,
            roleLabel:
              TOWER_ROLE_BY_KEY[m.expeditionRole]?.label ?? m.expeditionRole,
            mascots: m.mascots.map((mascot) => {
              const detail = roomMascotById.get(mascot.mascotId);
              return {
                pokemonId: detail?.pokemonId ?? 0,
                name:
                  detail?.nickname ??
                  (detail ? getPokemonName(detail.pokemonId) : "Mascote"),
                level: detail?.level ?? 0,
                stance: mascot.currentStance,
              };
            }),
          })),
        };
      }),
  };
}

export async function claimTowerMascotRewardAction(
  featId: string,
  personality: MascotPersonality,
) {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito." };
  if (!Object.values(MascotPersonality).includes(personality))
    return { error: "Personalidade inválida." };
  await ensureTowerExclusiveSpecies();
  const player = await getSessionPlayer(user.id);
  if (!player) return { error: "Jogador não encontrado." };
  const feat = await prisma.towerFeat.findFirst({
    where: { id: featId, userId: user.id, featKey: "TOWER_MASCOT_PENDING" },
  });
  if (!feat) return { error: "Esta recompensa já foi recebida ou não existe." };
  const data = feat.data as {
    pokemonId: number;
    basePokemonId: number;
    name: string;
  };
  const species = TOWER_EXCLUSIVE_MASCOTS.find(
    (entry) => entry.pokemonId === data.pokemonId,
  );
  if (!species) return { error: "Mascote exclusivo não reconhecido." };
  const stats = computeProceduralStats(
    species.basePokemonId,
    55,
    personality,
    [17, 26],
  );
  await prisma.$transaction(async (tx) => {
    const recheck = await tx.towerFeat.findFirst({
      where: { id: featId, userId: user.id, featKey: "TOWER_MASCOT_PENDING" },
    });
    if (!recheck) throw new Error("Recompensa já resgatada.");
    const mascot = await tx.mascot.create({
      data: {
        playerId: player.id,
        pokemonId: species.pokemonId,
        nickname: species.name,
        speciesNameOverride: species.name,
        primaryTypeOverride: species.primaryType,
        secondaryTypeOverride:
          "secondaryType" in species ? species.secondaryType : null,
        staticSpriteUrlOverride: species.sprite,
        animatedSpriteUrlOverride: species.sprite,
        generationOverride: 0,
        level: 55,
        personality,
        ...stats,
        hatchedFromEggType: "LAB",
        hatchedFromEggOrigin: "TOWER_REBEL_LAB",
        hatchedPokemonId: species.pokemonId,
        happiness: 70,
      },
    });
    await tx.playerPokemonDex.upsert({
      where: {
        playerId_pokemonId: {
          playerId: player.id,
          pokemonId: species.pokemonId,
        },
      },
      create: {
        playerId: player.id,
        pokemonId: species.pokemonId,
        source: "TOWER_REWARD",
      },
      update: {},
    });
    await tx.towerFeat.update({
      where: { id: featId },
      data: {
        featKey: "TOWER_MASCOT_CLAIMED",
        data: { ...data, personality, mascotId: mascot.id },
      },
    });
  });
  revalidatePath(PATH);
  revalidatePath("/mascotes");
  return {
    ok: true as const,
    mascot: {
      name: species.name,
      pokemonId: species.pokemonId,
      sprite: species.sprite,
      level: 55,
      personality,
      stats,
      origin: "Ovo de Laboratório · Torre dos Rebeldes",
    },
  };
}

/** Escolha única entre os sete regentes, liberada ao concluir o último andar. */
export async function claimTowerBossChoiceAction(
  featId: string,
  pokemonId: number,
  personality: MascotPersonality,
) {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito." };
  if (!Object.values(MascotPersonality).includes(personality)) return { error: "Personalidade inválida." };
  const species = TOWER_EXCLUSIVE_MASCOTS.slice(0, 7).find((entry) => entry.pokemonId === pokemonId);
  if (!species) return { error: "Escolha um dos sete regentes da Torre." };
  await ensureTowerExclusiveSpecies();
  const player = await getSessionPlayer(user.id);
  if (!player) return { error: "Jogador não encontrado." };
  const stats = computeProceduralStats(species.basePokemonId, 55, personality, [17, 26]);
  const simulated = await prisma.$transaction(async (tx) => {
    const pending = await tx.towerFeat.findFirst({ where: { id: featId, userId: user.id, featKey: "TOWER_BOSS_CHOICE_PENDING" } });
    if (!pending) throw new Error("Esta escolha já foi utilizada ou não existe.");
    if ((pending.data as { debug?: boolean } | null)?.debug) {
      await tx.towerFeat.delete({ where: { id: pending.id } });
      return true;
    }
    const mascot = await tx.mascot.create({
      data: {
        playerId: player.id, pokemonId: species.pokemonId, nickname: species.name,
        speciesNameOverride: species.name, primaryTypeOverride: species.primaryType,
        secondaryTypeOverride: "secondaryType" in species ? species.secondaryType : null,
        staticSpriteUrlOverride: species.sprite, animatedSpriteUrlOverride: species.sprite,
        generationOverride: 0, level: 55, personality, ...stats,
        hatchedFromEggType: "LAB", hatchedFromEggOrigin: "TOWER_REBEL_LAB",
        hatchedPokemonId: species.pokemonId, happiness: 70,
      },
    });
    await tx.playerPokemonDex.upsert({
      where: { playerId_pokemonId: { playerId: player.id, pokemonId: species.pokemonId } },
      create: { playerId: player.id, pokemonId: species.pokemonId, source: "TOWER_FINAL_CHOICE" }, update: {},
    });
    await tx.towerFeat.update({
      where: { id: featId },
      data: { featKey: "TOWER_BOSS_CHOICE_CLAIMED", data: { pokemonId, name: species.name, personality, mascotId: mascot.id } },
    });
    return false;
  });
  revalidatePath(PATH); revalidatePath("/mascotes");
  return { ok: true as const, mascot: { name: species.name, pokemonId, sprite: species.sprite, level: 55, personality, stats, origin: simulated ? "Simulação administrativa · nada foi entregue" : "Ovo de Laboratório · Escolha do último andar" } };
}

/** Debug: abre a escolha final real para a própria conta admin, sem concluir uma run. */
export async function debugGrantTowerBossChoiceAction() {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito." };
  const existing = await prisma.towerFeat.findFirst({ where: { userId: user.id, featKey: "TOWER_BOSS_CHOICE_PENDING" } });
  if (!existing)
    await prisma.towerFeat.create({ data: { userId: user.id, featKey: "TOWER_BOSS_CHOICE_PENDING", data: { debug: true, unlockedAtFloor: 7 } } });
  revalidatePath(PATH);
  return { ok: true as const };
}

/** Simula o nascimento exclusivo sem criar mascote nem registrar progresso. */
export async function debugTowerMascotRewardPreviewAction(
  pokemonId: number,
  personality: MascotPersonality,
) {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito." };
  if (!Object.values(MascotPersonality).includes(personality))
    return { error: "Personalidade inválida." };
  const species = TOWER_EXCLUSIVE_MASCOTS.find(
    (entry) => entry.pokemonId === pokemonId,
  );
  if (!species) return { error: "Mascote exclusivo não reconhecido." };
  await ensureTowerExclusiveSpecies();
  const stats = computeProceduralStats(
    species.basePokemonId,
    55,
    personality,
    [17, 26],
  );
  const records = await prisma.towerFeat.findMany({
    where: {
      userId: user.id,
      featKey: { in: ["TOWER_MASCOT_PENDING", "TOWER_MASCOT_CLAIMED"] },
      data: { path: ["pokemonId"], equals: species.pokemonId },
    },
    select: { featKey: true },
  });
  return {
    ok: true as const,
    mascot: {
      pokemonId: species.pokemonId,
      basePokemonId: species.basePokemonId,
      name: species.name,
      code: species.code,
      sprite: species.sprite,
      level: 55,
      personality,
      stats,
      origin: "Ovo de Laboratório · Torre dos Rebeldes",
      alreadyClaimed: records.some(
        (record) => record.featKey === "TOWER_MASCOT_CLAIMED",
      ),
      pending: records.some(
        (record) => record.featKey === "TOWER_MASCOT_PENDING",
      ),
    },
  };
}

const LEGACY_TALENT_KEYS = [
  "PRESSURE",
  "COMBAT",
  "BOSS",
  "LUCK",
  "RESCUE",
] as const;
export async function spendTowerTalentAction(key: string, requested = 1) {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito." };
  const isLegacy = (LEGACY_TALENT_KEYS as readonly string[]).includes(key);
  const catalog = TOWER_TALENTS.find((talent) => talent.key === key);
  if (!isLegacy && !catalog) return { error: "Talento inválido." };
  const maxRank = catalog?.maxRank ?? 5;
  const rows = await prisma.towerCommunityProgress.findMany({
    where: { floorId: 1, metricKey: { startsWith: "TALENT" } },
  });
  const value = (metric: string) =>
    rows.find((row) => row.metricKey === metric)?.value ?? 0;
  const earned = value("TALENT_POINTS");
  const spent = rows
    .filter((row) => row.metricKey.startsWith("TALENT:"))
    .reduce((sum, row) => sum + row.value, 0);
  const rank = value(`TALENT:${key}`);
  const available = Math.max(0, Math.floor(earned - spent));
  if (available <= 0)
    return { error: "Você não possui pontos de talento disponíveis." };
  if (rank >= maxRank)
    return { error: "Este talento já atingiu o nível máximo." };
  const amount = Math.max(
    1,
    Math.min(available, maxRank - Math.floor(rank), Math.floor(requested || 1)),
  );
  await prisma.towerCommunityProgress.upsert({
    where: { floorId_metricKey: { floorId: 1, metricKey: `TALENT:${key}` } },
    create: { floorId: 1, metricKey: `TALENT:${key}`, value: amount },
    update: { value: { increment: amount } },
  });
  revalidatePath(PATH);
  return { ok: true as const, amount };
}

/** Editor narrativo data-driven. Imagens enviadas são persistidas no Storage. */
export async function saveTowerNarrativeScenesAction(
  input: TowerNarrativeScene[],
) {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito à equipe ADMIN." };
  if (!Array.isArray(input) || input.length > 250)
    return { error: "Lista de cenas inválida." };
  const scenes: TowerNarrativeScene[] = [];
  for (let index = 0; index < input.length; index++) {
    const raw = input[index];
    if (
      !raw ||
      !raw.trigger ||
      !raw.speaker?.trim() ||
      !raw.text?.trim()
    ) {
      return {
        error: `A cena ${index + 1} possui campos obrigatórios inválidos.`,
      };
    }
    const id = raw.id?.trim() || `tower-scene-${Date.now()}-${index}`;
    const backgroundUrl = raw.backgroundUrl?.startsWith("data:image/")
      ? await uploadDataUrlAsset(
          raw.backgroundUrl,
          "events/tower/scenes",
          `${id}-background`,
        )
      : raw.backgroundUrl?.trim() ||
        "/events/torre-dos-rebeldes/background.png";
    const characterUrl = raw.characterUrl?.startsWith("data:image/")
      ? await uploadDataUrlAsset(
          raw.characterUrl,
          "events/tower/scenes",
          `${id}-character`,
        )
      : raw.characterUrl?.trim() ||
        "/events/torre-dos-rebeldes/leaders/06_meowth_rebelde.png";
    scenes.push({
      id,
      groupId: raw.groupId?.trim() || "PERSONALIZADO",
      groupTitle: raw.groupTitle?.trim() || "Cenas personalizadas",
      trigger: raw.trigger,
      floor: Math.max(0, Math.min(7, Math.trunc(raw.floor || 0))),
      title: raw.title?.trim() || "Cena da Torre",
      speaker: raw.speaker.trim(),
      secondarySpeaker: raw.secondarySpeaker?.trim() || null,
      text: raw.text.trim(),
      followup: raw.followup?.trim() || null,
      backgroundUrl,
      characterUrl,
      characterSide: raw.characterSide === "LEFT" ? "LEFT" : "RIGHT",
      tone: raw.tone?.trim() || "misterioso",
      oncePerPlayer: raw.oncePerPlayer !== false,
      conditionNotes: raw.conditionNotes?.trim() || "",
      enabled: raw.enabled !== false,
      order: Number.isFinite(raw.order) ? Math.trunc(raw.order) : index * 10,
      minFailures: Math.max(0, Math.trunc(raw.minFailures ?? 0)),
      knowledgeTitle: raw.knowledgeTitle?.trim() || undefined,
      knowledgeText: raw.knowledgeText?.trim() || undefined,
    });
  }
  await prisma.appSetting.upsert({
    where: { key: TOWER_NARRATIVE_KEY },
    create: {
      key: TOWER_NARRATIVE_KEY,
      value: scenes as unknown as Prisma.InputJsonValue,
    },
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

  if (input.pace !== "ONLINE" && input.pace !== "SLOW")
    return { error: "Ritmo inválido." };
  if (!TOWER_ROLE_BY_KEY[input.expeditionRole])
    return { error: "Função de Expedição inválida." };
  const ids = [...new Set(input.mascotIds ?? [])];
  if (ids.length !== 2) return { error: "Selecione exatamente 2 mascotes." };

  if (await findActiveRunForUser(user.id))
    return { error: "Você já possui uma expedição ativa na Torre." };

  const lastAt = await lastEntryAt(user.id);
  if (lastAt !== null) {
    const nextAt = lastAt + config.entryCooldownMinutes * 60_000;
    if (Date.now() < nextAt) {
      return {
        error: `Cooldown de entrada ativo — disponível às ${new Date(nextAt).toLocaleTimeString("pt-BR")}.`,
      };
    }
  }

  const mascots = await prisma.mascot.findMany({
    where: {
      id: { in: ids },
      playerId: player.id,
      arenaState: "FREE",
      bazarListed: false,
      expeditions: { none: { status: "ACTIVE" } },
    },
    select: {
      id: true,
      level: true,
      statVitality: true,
      preferredCombatRole: true,
    },
  });
  if (mascots.length !== 2)
    return { error: "Um ou mais mascotes não estão disponíveis." };

  // Ticket da Torre: exigência configurável — desligada em desenvolvimento.
  // if (config.requireTicket) { /* consumir Ticket da Torre do inventário */ }

  const seed = randomBytes(12).toString("base64url");
  const allowedStances = TOWER_ROLE_BY_KEY[input.expeditionRole].stances;
  const run = await prisma.$transaction(async (tx) => {
    const created = await tx.towerRun.create({
      data: {
        pace: input.pace,
        seed,
        status: "LOBBY",
        resolutionOrder: [user.id],
        volatileState: {
          lobby: {
            code: randomBytes(3).toString("hex").toUpperCase(),
            hostId: user.id,
            ready: { [user.id]: false },
          },
        },
      },
    });
    const member = await tx.towerRunMember.create({
      data: {
        runId: created.id,
        userId: user.id,
        expeditionRole: input.expeditionRole,
        resolutionIndex: 0,
      },
    });
    for (const m of mascots) {
      const maxHp = towerMaxHp(m.level, m.statVitality);
      await tx.towerRunMascot.create({
        data: {
          memberId: member.id,
          mascotId: m.id,
          ownerUserId: user.id,
          currentHp: maxHp,
          maxHp,
          currentStance: allowedStances.includes(
            normalizeCombatRole(input.stanceByMascot?.[m.id]),
          )
            ? normalizeCombatRole(input.stanceByMascot?.[m.id])
            : initialStanceFor(input.expeditionRole, m.preferredCombatRole),
          allowedStances,
          state: "IN_TOWER",
        },
      });
    }
    return created;
  });
  revalidatePath(PATH);
  return { ok: true as const, runId: run.id };
}

/** Entra em uma sala aberta. Cada integrante leva sua própria classe, posturas e dois mascotes. */
export async function joinTowerRoomAction(input: {
  runId: string;
  expeditionRole: TowerExpeditionRole;
  mascotIds: string[];
  stanceByMascot?: Record<string, string>;
}) {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito à equipe ADMIN." };
  const player = await getSessionPlayer(user.id);
  if (!player) return { error: "Jogador não encontrado." };
  if (await findActiveRunForUser(user.id))
    return { error: "Você já participa de uma expedição ativa." };
  const role = TOWER_ROLE_BY_KEY[input.expeditionRole];
  if (!role) return { error: "Classe inválida." };
  const ids = [...new Set(input.mascotIds ?? [])];
  if (ids.length !== 2) return { error: "Selecione exatamente 2 mascotes." };
  const mascots = await prisma.mascot.findMany({
    where: {
      id: { in: ids },
      playerId: player.id,
      arenaState: "FREE",
      bazarListed: false,
      expeditions: { none: { status: "ACTIVE" } },
    },
    select: {
      id: true,
      level: true,
      statVitality: true,
      preferredCombatRole: true,
    },
  });
  if (mascots.length !== 2)
    return { error: "Um dos mascotes não está disponível." };
  await prisma.$transaction(async (tx) => {
    const run = await tx.towerRun.findUnique({
      where: { id: input.runId },
      include: { members: true },
    });
    if (!run || run.status !== "LOBBY" || run.members.length >= 3)
      throw new Error("Sala indisponível ou cheia.");
    const member = await tx.towerRunMember.create({
      data: {
        runId: run.id,
        userId: user.id,
        expeditionRole: input.expeditionRole,
        resolutionIndex: run.members.length,
      },
    });
    for (const m of mascots) {
      const maxHp = towerMaxHp(m.level, m.statVitality);
      const requested = normalizeCombatRole(input.stanceByMascot?.[m.id]);
      await tx.towerRunMascot.create({
        data: {
          memberId: member.id,
          mascotId: m.id,
          ownerUserId: user.id,
          currentHp: maxHp,
          maxHp,
          currentStance: role.stances.includes(requested)
            ? requested
            : initialStanceFor(input.expeditionRole, m.preferredCombatRole),
          allowedStances: role.stances,
          state: "IN_TOWER",
        },
      });
    }
    const vol = (run.volatileState ?? {}) as {
      lobby?: {
        code?: string;
        hostId?: string;
        ready?: Record<string, boolean>;
      };
    };
    await tx.towerRun.update({
      where: { id: run.id },
      data: {
        resolutionOrder: [...run.members.map((m) => m.userId), user.id],
        volatileState: {
          ...vol,
          lobby: {
            ...vol.lobby,
            hostId: vol.lobby?.hostId ?? run.members[0]?.userId,
            ready: { ...(vol.lobby?.ready ?? {}), [user.id]: false },
          },
        } as Prisma.InputJsonValue,
      },
    });
  });
  revalidatePath(PATH);
  return { ok: true as const, runId: input.runId };
}

/** Confirma ou reabre a preparação. Iniciar só é permitido ao host com todos prontos. */
export async function setTowerReadyAction(runId: string, ready: boolean) {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito." };
  const run = await prisma.towerRun.findUnique({
    where: { id: runId },
    include: { members: true },
  });
  if (
    !run ||
    run.status !== "LOBBY" ||
    !run.members.some((m) => m.userId === user.id)
  )
    return { error: "Sala não encontrada." };
  const vol = (run.volatileState ?? {}) as {
    lobby?: { code?: string; hostId?: string; ready?: Record<string, boolean> };
  };
  await prisma.towerRun.update({
    where: { id: runId },
    data: {
      volatileState: {
        ...vol,
        lobby: {
          ...vol.lobby,
          hostId: vol.lobby?.hostId ?? run.members[0]?.userId,
          ready: { ...(vol.lobby?.ready ?? {}), [user.id]: ready },
        },
      } as Prisma.InputJsonValue,
    },
  });
  revalidatePath(PATH);
  return { ok: true as const };
}

export async function removeTowerLobbyMemberAction(
  runId: string,
  targetUserId: string,
) {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito." };
  const run = await prisma.towerRun.findUnique({
    where: { id: runId },
    include: { members: true },
  });
  if (!run || run.status !== "LOBBY") return { error: "Sala indisponível." };
  const vol = (run.volatileState ?? {}) as {
    lobby?: { hostId?: string; ready?: Record<string, boolean> };
  };
  const hostId = vol.lobby?.hostId ?? run.members[0]?.userId;
  if (hostId !== user.id)
    return { error: "Somente o dono pode remover jogadores." };
  if (targetUserId === hostId)
    return { error: "O dono deve cancelar a sala para sair." };
  const target = run.members.find((member) => member.userId === targetUserId);
  if (!target) return { error: "Jogador não está na sala." };
  const ready = { ...(vol.lobby?.ready ?? {}) };
  delete ready[targetUserId];
  await prisma.$transaction([
    prisma.towerRunMember.delete({ where: { id: target.id } }),
    prisma.towerRun.update({
      where: { id: runId },
      data: {
        resolutionOrder: run.members
          .filter((member) => member.userId !== targetUserId)
          .map((member) => member.userId),
        volatileState: {
          ...vol,
          lobby: { ...vol.lobby, hostId, ready },
        } as Prisma.InputJsonValue,
      },
    }),
  ]);
  revalidatePath(PATH);
  return { ok: true as const };
}

/** Um membro (não-dono) sai da sala por conta própria, sem encerrar a run. */
export async function leaveTowerRoomAction(runId: string) {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito." };
  const run = await prisma.towerRun.findUnique({
    where: { id: runId },
    include: { members: true },
  });
  if (!run || run.status !== "LOBBY") return { error: "Sala indisponível." };
  const vol = (run.volatileState ?? {}) as {
    lobby?: { hostId?: string; ready?: Record<string, boolean> };
  };
  const hostId = vol.lobby?.hostId ?? run.members[0]?.userId;
  const me = run.members.find((member) => member.userId === user.id);
  if (!me) return { error: "Você não está nesta sala." };
  if (hostId === user.id)
    return { error: "O dono deve cancelar a sala para sair." };
  const ready = { ...(vol.lobby?.ready ?? {}) };
  delete ready[user.id];
  await prisma.$transaction([
    prisma.towerRunMember.delete({ where: { id: me.id } }),
    prisma.towerRun.update({
      where: { id: runId },
      data: {
        resolutionOrder: run.members
          .filter((member) => member.userId !== user.id)
          .map((member) => member.userId),
        volatileState: {
          ...vol,
          lobby: { ...vol.lobby, hostId, ready },
        } as Prisma.InputJsonValue,
      },
    }),
  ]);
  revalidatePath(PATH);
  return { ok: true as const };
}

export async function updateTowerLobbyClassAction(
  runId: string,
  expeditionRole: TowerExpeditionRole,
) {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito." };
  const role = TOWER_ROLE_BY_KEY[expeditionRole];
  if (!role) return { error: "Classe inválida." };
  const run = await prisma.towerRun.findUnique({
    where: { id: runId },
    include: { members: { include: { mascots: true } } },
  });
  const member = run?.members.find((entry) => entry.userId === user.id);
  if (!run || run.status !== "LOBBY" || !member)
    return { error: "A classe só pode ser alterada no lobby." };
  const lobby = (
    (run.volatileState ?? {}) as { lobby?: { ready?: Record<string, boolean> } }
  ).lobby;
  if (lobby?.ready?.[user.id])
    return { error: "Cancele o Pronto antes de trocar de classe." };
  await prisma.$transaction([
    prisma.towerRunMember.update({
      where: { id: member.id },
      data: { expeditionRole },
    }),
    ...member.mascots.map((mascot) =>
      prisma.towerRunMascot.update({
        where: { id: mascot.id },
        data: {
          allowedStances: role.stances,
          currentStance: role.stances.includes(
            normalizeCombatRole(mascot.currentStance),
          )
            ? mascot.currentStance
            : role.stances[0],
        },
      }),
    ),
  ]);
  revalidatePath(PATH);
  return { ok: true as const };
}

export async function updateTowerLobbyMascotsAction(
  runId: string,
  mascotIds: string[],
  stanceByMascot: Record<string, string> = {},
) {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito." };
  const player = await getSessionPlayer(user.id);
  if (!player) return { error: "Jogador não encontrado." };
  const ids = [...new Set(mascotIds)];
  if (ids.length !== 2) return { error: "Selecione exatamente dois mascotes." };
  const run = await prisma.towerRun.findUnique({
    where: { id: runId },
    include: { members: { include: { mascots: true } } },
  });
  const member = run?.members.find((entry) => entry.userId === user.id);
  if (!run || run.status !== "LOBBY" || !member)
    return { error: "Equipe só pode ser alterada no lobby." };
  const lobby = (
    (run.volatileState ?? {}) as { lobby?: { ready?: Record<string, boolean> } }
  ).lobby;
  if (lobby?.ready?.[user.id])
    return { error: "Cancele o Pronto antes de atualizar os mascotes." };
  const mascots = await prisma.mascot.findMany({
    where: {
      id: { in: ids },
      playerId: player.id,
      arenaState: "FREE",
      bazarListed: false,
      expeditions: { none: { status: "ACTIVE" } },
    },
    select: {
      id: true,
      level: true,
      statVitality: true,
      preferredCombatRole: true,
    },
  });
  if (mascots.length !== 2)
    return { error: "Um dos mascotes não está disponível." };
  const role = TOWER_ROLE_BY_KEY[member.expeditionRole];
  await prisma.$transaction(async (tx) => {
    await tx.towerRunMascot.deleteMany({ where: { memberId: member.id } });
    for (const mascot of mascots) {
      const maxHp = towerMaxHp(mascot.level, mascot.statVitality);
      const requested = normalizeCombatRole(stanceByMascot[mascot.id]);
      await tx.towerRunMascot.create({
        data: {
          memberId: member.id,
          mascotId: mascot.id,
          ownerUserId: user.id,
          currentHp: maxHp,
          maxHp,
          currentStance: role.stances.includes(requested)
            ? requested
            : initialStanceFor(
                member.expeditionRole,
                mascot.preferredCombatRole,
              ),
          allowedStances: role.stances,
          state: "IN_TOWER",
        },
      });
    }
  });
  revalidatePath(PATH);
  return { ok: true as const };
}

export async function updateTowerLobbyStanceAction(
  runId: string,
  mascotId: string,
  stance: string,
) {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito." };
  const snapshot = await prisma.towerRunMascot.findFirst({
    where: { mascotId, member: { runId, userId: user.id } },
    include: { member: { include: { run: true } } },
  });
  if (!snapshot || snapshot.member.run.status !== "LOBBY")
    return { error: "Postura só pode ser alterada no lobby." };
  const lobby = (
    (snapshot.member.run.volatileState ?? {}) as {
      lobby?: { ready?: Record<string, boolean> };
    }
  ).lobby;
  if (lobby?.ready?.[user.id])
    return { error: "Cancele o Pronto antes de alterar posturas." };
  const normalized = normalizeCombatRole(stance);
  const allowed = Array.isArray(snapshot.allowedStances)
    ? snapshot.allowedStances.map(String)
    : [];
  if (!allowed.includes(normalized))
    return { error: "Postura incompatível com sua classe." };
  await prisma.towerRunMascot.update({
    where: { id: snapshot.id },
    data: { currentStance: normalized },
  });
  revalidatePath(PATH);
  return { ok: true as const };
}

/** Encerra/abandona a expedição do usuário (uso em dev enquanto não há gameplay). */
export async function abandonTowerRunAction(
  runId: string,
): Promise<{ error: string } | { ok: true }> {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito à equipe ADMIN." };
  const member = await prisma.towerRunMember.findFirst({
    where: { runId, userId: user.id },
    select: { id: true },
  });
  if (!member) return { error: "Você não participa desta expedição." };
  await prisma.towerRun.update({
    where: { id: runId },
    data: { status: "ABANDONED", endedAt: new Date() },
  });
  revalidatePath(PATH);
  return { ok: true as const };
}

// ── Turn Engine (janela global; Online 5min / Lento 4h) ──────────────────────
// Núcleo em @/lib/tower/turn (compartilhado com o cron; não exposto como action).

/** Inicia a expedição no grafo de salas, LOBBY → ACTIVE e abre a 1ª janela. */
export async function startTowerExpeditionAction(
  runId: string,
): Promise<{ error: string } | { ok: true }> {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito à equipe ADMIN." };
  const run = await prisma.towerRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      status: true,
      pace: true,
      seed: true,
      volatileState: true,
      members: {
        select: {
          userId: true,
          resolutionIndex: true,
          expeditionRole: true,
          mascots: { select: { mascotId: true, currentStance: true } },
        },
      },
    },
  });
  if (!run) return { error: "Expedição não encontrada." };
  if (!run.members.some((m) => m.userId === user.id))
    return { error: "Você não participa desta expedição." };
  if (run.status !== "LOBBY")
    return { error: "Esta expedição já foi iniciada." };
  const lobby = (
    (run.volatileState ?? {}) as {
      lobby?: { hostId?: string; ready?: Record<string, boolean> };
    }
  ).lobby;
  if ((lobby?.hostId ?? run.members[0]?.userId) !== user.id)
    return { error: "Somente o criador da sala pode iniciar." };
  if (!run.members.every((m) => lobby?.ready?.[m.userId]))
    return { error: "Todos os jogadores precisam marcar Pronto." };
  const config = await getTowerConfig();
  await ensureTowerTicket();
  const memberPlayers = await prisma.player.findMany({
    where: { userId: { in: run.members.map((member) => member.userId) } },
    select: { id: true, userId: true },
  });
  if (config.requireTicket) {
    const inventories = await prisma.playerInventory.findMany({
      where: {
        playerId: { in: memberPlayers.map((player) => player.id) },
        itemId: TOWER_TICKET_ID,
      },
      select: { playerId: true, quantity: true },
    });
    const missing = memberPlayers.filter(
      (player) =>
        (inventories.find((inventory) => inventory.playerId === player.id)
          ?.quantity ?? 0) < 1,
    );
    if (missing.length)
      return {
        error: `${missing.length} jogador(es) não possuem Ticket da Torre. Nada foi consumido.`,
      };
  }

  const progress = await prisma.towerCommunityProgress.findMany({
    where: { floorId: 1 },
  });
  const unlocked = progress
    .filter((entry) => entry.value >= TOWER_STUDY_TARGET)
    .map((entry) => entry.metricKey);
  const roleCounters = [
    ...new Set(run.members.map((member) => `ROLE:${member.expeditionRole}`)),
  ];
  const pressureTalent =
    progress.find((row) => row.metricKey === "TALENT:PRESSURE")?.value ?? 0;
  const talentFx = resolveTowerTalents(
    (key) =>
      progress.find((row) => row.metricKey === `TALENT:${key}`)?.value ?? 0,
  );
  const exploration = {
    ...generateTowerRoomGraph(run.seed),
    countermeasures: [...unlocked, ...roleCounters],
    pressureShield:
      (unlocked.includes("WARD") ? 2 : 0) +
      (unlocked.includes("BULWARK") ? 1 : 0) +
      pressureTalent +
      talentFx.pressureShieldStart,
  };
  const order = [...run.members]
    .sort((a, b) => a.resolutionIndex - b.resolutionIndex)
    .map((m) => m.userId);
  await prisma.$transaction(async (tx) => {
    if (config.requireTicket)
      for (const player of memberPlayers) {
        const inventory = await tx.playerInventory.findUnique({
          where: {
            playerId_itemId: { playerId: player.id, itemId: TOWER_TICKET_ID },
          },
        });
        if (!inventory || inventory.quantity < 1)
          throw new Error("Ticket indisponível no momento do início.");
        if (inventory.quantity === 1)
          await tx.playerInventory.delete({ where: { id: inventory.id } });
        else
          await tx.playerInventory.update({
            where: { id: inventory.id },
            data: { quantity: { decrement: 1 } },
          });
      }
    await tx.towerRun.update({
      where: { id: runId },
      data: {
        status: "ACTIVE",
        ticketConsumed: config.requireTicket,
        startedAt: new Date(),
        globalTurn: 1,
        resolutionOrder: order,
        nextDeadline: new Date(Date.now() + windowMsFor(run.pace)),
        volatileState: {
          ...((run.volatileState as object) ?? {}),
          submissions: {},
          roomIndex: 1,
          log: ["A porta se fechou. O mapa da Torre começou a se desenhar."],
          exploration,
        } as unknown as Prisma.InputJsonValue,
      },
    });
  });
  revalidatePath(PATH);
  return { ok: true as const };
}

/** Avança para o Boss após vencer o encounter. Objetivos ignorados o reforçam. */
export async function advanceToBossAction(
  runId: string,
): Promise<{ error: string } | { ok: true }> {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito à equipe ADMIN." };
  const run = await prisma.towerRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      status: true,
      pace: true,
      seed: true,
      volatileState: true,
      members: {
        select: {
          userId: true,
          mascots: {
            select: {
              mascotId: true,
              currentHp: true,
              currentStance: true,
              state: true,
            },
          },
        },
      },
    },
  });
  if (!run) return { error: "Expedição não encontrada." };
  if (!run.members.some((m) => m.userId === user.id))
    return { error: "Você não participa desta expedição." };
  if (run.status !== "ACTIVE") return { error: "A expedição não está ativa." };
  const vol = (run.volatileState ?? {}) as TowerVolatile;
  const b = vol.battle;
  if (!b || !b.encounterOver || b.outcome !== "WIN")
    return { error: "Vença o encounter atual antes de enfrentar o boss." };
  if (b.isBoss) return { error: "Você já está enfrentando o boss." };

  const unresolved = b.objects.filter(
    (o) => o.suppression && !o.resolved,
  ).length;
  const nextRoom = (vol.roomIndex ?? 1) + 1;

  const mascotIds = run.members.flatMap((m) =>
    m.mascots.map((x) => x.mascotId),
  );
  const rows = await prisma.mascot.findMany({
    where: { id: { in: mascotIds } },
    select: {
      id: true,
      pokemonId: true,
      nickname: true,
      level: true,
      statForce: true,
      statAgility: true,
      statInstinct: true,
      statVitality: true,
      statCharisma: true,
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const members = run.members.map((m) => ({
    userId: m.userId,
    mascots: m.mascots.flatMap((mm): MemberMascotInput[] => {
      const r = byId.get(mm.mascotId);
      if (!r) return [];
      return [
        {
          id: r.id,
          pokemonId: r.pokemonId,
          name: r.nickname ?? getPokemonName(r.pokemonId),
          level: r.level,
          force: r.statForce,
          agility: r.statAgility,
          instinct: r.statInstinct,
          vitality: r.statVitality,
          charisma: r.statCharisma,
          stance: normalizeCombatRole(mm.currentStance),
          currentHp: mm.currentHp,
        },
      ];
    }),
  }));
  const survivors = members.reduce(
    (s, m) => s + m.mascots.filter((mm) => (mm.currentHp ?? 1) > 0).length,
    0,
  );
  if (survivors === 0)
    return { error: "Nenhum mascote sobreviveu para enfrentar o boss." };

  const isBossRoom = nextRoom > 3;
  const battle = isBossRoom
    ? generateBossEncounter(run.seed, members, unresolved)
    : generateEncounter(`${run.seed}:room:${nextRoom}`, members);
  const log = [
    ...(vol.log ?? []),
    isBossRoom
      ? `Câmara do boss! ${unresolved} mecanismo(s) ignorado(s) reforçam o líder.`
      : `Sala ${nextRoom} revelada. A arquitetura da Torre mudou.`,
  ].slice(-50);
  await prisma.towerRun.update({
    where: { id: runId },
    data: {
      globalTurn: run.status === "ACTIVE" ? { increment: 1 } : undefined,
      nextDeadline: new Date(Date.now() + windowMsFor(run.pace)),
      volatileState: {
        ...vol,
        submissions: {},
        roomIndex: nextRoom,
        log,
        battle,
      } as unknown as Prisma.InputJsonValue,
    },
  });
  revalidatePath(PATH);
  return { ok: true as const };
}

/** Estado atual da run (para polling). Resolve o turno se o deadline já passou. */
export async function getTowerRunStateAction(
  runId: string,
  knownRevision?: string,
) {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito à equipe ADMIN." };

  // O cliente consulta com frequência para manter a sala sincronizada. Antes de
  // montar o snapshot completo (mapa, replay, mascotes e narrativa), confira uma
  // revisão pequena. Quando nada mudou, a resposta tem apenas alguns bytes.
  let revisionProbe = await prisma.towerRun.findUnique({
    where: { id: runId },
    select: {
      status: true,
      nextDeadline: true,
      updatedAt: true,
      members: {
        select: {
          userId: true,
          expeditionRole: true,
          confirmed: true,
          consecutiveMisses: true,
          afkRemoved: true,
          mascots: {
            select: {
              mascotId: true,
              currentHp: true,
              currentStance: true,
              state: true,
            },
          },
        },
      },
    },
  });
  if (!revisionProbe) return { error: "Expedição não encontrada." };
  if (!revisionProbe.members.some((member) => member.userId === user.id))
    return { error: "Você não participa desta expedição." };

  if (
    revisionProbe.status === "ACTIVE" &&
    revisionProbe.nextDeadline &&
    revisionProbe.nextDeadline.getTime() <= Date.now()
  ) {
    await resolveTowerTurnLocked(runId).catch(() => null);
    revisionProbe = await prisma.towerRun.findUnique({
      where: { id: runId },
      select: {
        status: true,
        nextDeadline: true,
        updatedAt: true,
        members: {
          select: {
            userId: true,
            expeditionRole: true,
            confirmed: true,
            consecutiveMisses: true,
            afkRemoved: true,
            mascots: {
              select: {
                mascotId: true,
                currentHp: true,
                currentStance: true,
                state: true,
              },
            },
          },
        },
      },
    });
    if (!revisionProbe) return { error: "Expedição não encontrada." };
  }

  const revision = [
    revisionProbe.updatedAt.toISOString(),
    ...revisionProbe.members.flatMap((member) => [
      member.userId,
      member.expeditionRole,
      Number(member.confirmed),
      member.consecutiveMisses,
      Number(member.afkRemoved),
      ...member.mascots.flatMap((mascot) => [
        mascot.mascotId,
        mascot.currentHp,
        mascot.currentStance,
        mascot.state,
      ]),
    ]),
  ].join(":");
  if (knownRevision === revision)
    return { ok: true as const, unchanged: true as const, revision };

  let run = await prisma.towerRun.findUnique({
    where: { id: runId },
    include: { members: { include: { mascots: true } } },
  });
  if (!run) return { error: "Expedição não encontrada." };

  const vol = (run.volatileState ?? {}) as TowerVolatile;
  const lobby = (
    run.volatileState as {
      lobby?: {
        code?: string;
        hostId?: string;
        ready?: Record<string, boolean>;
      };
    } | null
  )?.lobby;
  const submissions = vol.submissions ?? {};
  const scenes = await getTowerNarrativeScenes();
  const priorFailures = await prisma.towerRunMember.count({
    where: {
      userId: user.id,
      run: { status: { in: ["FAILED", "ABANDONED"] }, id: { not: run.id } },
    },
  });
  const unlockedNarrative = new Set(
    (
      await prisma.towerCodexEntry.findMany({
        where: { userId: null, subjectType: "NARRATIVE_SCENE" },
        select: { subjectKey: true },
      })
    ).map((entry) => entry.subjectKey),
  );
  const sceneTriggers: TowerSceneTrigger[] =
    run.status === "FINISHED"
      ? ["FINAL_VICTORY", "VICTORY", "POSTGAME"]
      : vol.battle?.isBoss
        ? ["BOSS_INTRO", "BOSS"]
        : vol.battle
          ? ["ENCOUNTER_PREVIEW", "ENCOUNTER"]
          : run.globalTurn <= 1
            ? ["RUN_START", "FLOOR_ENTER"]
            : ["ROOM_ENTER", "ENCOUNTER"];
  const currentScene = nextTowerSceneFor(
    scenes,
    sceneTriggers,
    run.currentFloor,
    priorFailures,
    unlockedNarrative,
  );
  if (currentScene && !unlockedNarrative.has(currentScene.id))
    await recordTowerSceneUnlock(currentScene, user.id, run.id);
  const userNames = new Map(
    (
      await prisma.user.findMany({
        where: { id: { in: run.members.map((member) => member.userId) } },
        select: { id: true, name: true },
      })
    ).map((member) => [member.id, member.name ?? "Jogador"]),
  );
  const setupMascotIds = run.members.flatMap((member) =>
    member.mascots.map((mascot) => mascot.mascotId),
  );
  const setupMascots = new Map(
    (
      await prisma.mascot.findMany({
        where: { id: { in: setupMascotIds } },
        select: { id: true, pokemonId: true, nickname: true, level: true },
      })
    ).map((mascot) => [mascot.id, mascot]),
  );
  const sessionPlayer =
    run.status === "LOBBY" ? await getSessionPlayer(user.id) : null;
  const lobbyMascots = sessionPlayer
    ? await prisma.mascot.findMany({
        where: {
          playerId: sessionPlayer.id,
          arenaState: "FREE",
          bazarListed: false,
          expeditions: { none: { status: "ACTIVE" } },
        },
        orderBy: [{ level: "desc" }, { nickname: "asc" }],
        take: 300,
        select: { id: true, pokemonId: true, nickname: true, level: true },
      })
    : [];

  // View do combate com fog de time: aliados sempre; inimigos só se visíveis.
  type ObjView = {
    id: string;
    key: string;
    name: string;
    x: number;
    y: number;
    radius: number;
    progress: number;
    required: number;
    resolved: boolean;
    suppression: boolean;
    interactable: boolean;
    spriteUrl: string;
    effect: string;
  };
  let battle: null | {
    room: {
      width: number;
      height: number;
      blocked: string[];
      wallTiles?: string[];
      doorTiles?: string[];
      trapTiles?: string[];
    };
    discovered: string[];
    visible: string[];
    units: {
      id: string;
      team: string;
      ownerId: string | null;
      name: string;
      pokemonId: number;
      level: number;
      types: string[];
      x: number;
      y: number;
      hp: number;
      maxHp: number;
      role: string;
      shield: number;
      agility: number;
      effects: {
        id: string;
        label: string;
        kind: string;
        value: number;
        duration: number;
      }[];
    }[];
    objects: ObjView[];
    suppression: { resolved: number; total: number };
    isBoss: boolean;
    over: boolean;
    outcome: "WIN" | "LOSS" | null;
  } = null;
  let myMascots: {
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    role: string;
  }[] = [];
  if (vol.battle) {
    const b = vol.battle;
    const vis = visibleTiles(b);
    const myAllies = b.units.filter(
      (u) => u.team === "ALLY" && u.ownerId === user.id && u.hp > 0,
    );
    const objects: ObjView[] = objectsView(b, vis).map((o) => ({
      ...o,
      spriteUrl:
        TOWER_OBJECTS[o.key]?.spriteUrl ??
        "/events/torre-dos-rebeldes/objects/19_pedra_runica.png",
      effect: TOWER_OBJECTS[o.key]?.effect ?? "Mecanismo desconhecido.",
      interactable:
        !o.resolved && myAllies.some((u) => manhattan(u, o) <= o.radius),
    }));
    const suppTotal = b.objects.filter((o) => o.suppression).length;
    const suppResolved = b.objects.filter(
      (o) => o.suppression && o.resolved,
    ).length;
    battle = {
      room: b.room,
      discovered: b.discovered,
      visible: [...vis],
      units: b.units
        .filter((u) => u.team === "ALLY" || vis.has(tileKey(u.x, u.y)))
        .map((u) => ({
          id: u.id,
          team: u.team,
          ownerId: u.ownerId,
          name: u.name,
          pokemonId: u.pokemonId,
          level: u.level,
          types: u.types,
          x: u.x,
          y: u.y,
          hp: u.hp,
          maxHp: u.maxHp,
          role: u.role,
          shield: u.shield,
          agility: u.agility,
          effects: u.effects,
        })),
      objects,
      suppression: { resolved: suppResolved, total: suppTotal },
      isBoss: b.isBoss ?? false,
      over: b.encounterOver,
      outcome: b.outcome ?? null,
    };
    myMascots = b.units
      .filter((u) => u.team === "ALLY" && u.ownerId === user.id)
      .map((u) => ({
        id: u.id,
        name: u.name,
        hp: u.hp,
        maxHp: u.maxHp,
        role: u.role,
      }));
  }

  const exploration = vol.exploration;
  const room = exploration ? currentTowerRoom(exploration) : null;
  const communityDiscoveries = exploration
    ? await prisma.towerCodexEntry.findMany({
        where: { userId: null, subjectType: "PUZZLE" },
        select: { subjectKey: true, discoveryLevel: true, data: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      })
    : [];
  if (exploration) {
    const snapshots = await prisma.towerRunMascot.findMany({
      where: { member: { runId, userId: user.id } },
    });
    const names = new Map(
      (
        await prisma.mascot.findMany({
          where: { id: { in: snapshots.map((m) => m.mascotId) } },
          select: { id: true, nickname: true, pokemonId: true },
        })
      ).map((m) => [m.id, m.nickname ?? getPokemonName(m.pokemonId)]),
    );
    myMascots = snapshots.map((m) => ({
      id: m.mascotId,
      name: names.get(m.mascotId) ?? "Mascote",
      hp: m.currentHp,
      maxHp: m.maxHp,
      role: m.currentStance,
    }));
  }

  return {
    ok: true as const,
    unchanged: false as const,
    revision,
    run: {
      id: run.id,
      status: run.status,
      pace: run.pace,
      currentFloor: run.currentFloor,
      globalTurn: run.globalTurn,
      nextDeadline: run.nextDeadline?.toISOString() ?? null,
      roomIndex: vol.roomIndex ?? 1,
    },
    order: Array.isArray(run.resolutionOrder)
      ? (run.resolutionOrder as string[])
      : [],
    members: run.members.map((m) => ({
      userId: m.userId,
      name: userNames.get(m.userId) ?? "Jogador",
      expeditionRole: m.expeditionRole,
      afkRemoved: m.afkRemoved,
      consecutiveMisses: m.consecutiveMisses,
      confirmed: Boolean(submissions[m.userId]),
      spectator: !m.mascots.some(
        (mascot) => mascot.currentHp > 0 && mascot.state === "IN_TOWER",
      ),
      mascots: m.mascots.map((snapshot) => {
        const mascot = setupMascots.get(snapshot.mascotId);
        return {
          id: snapshot.mascotId,
          pokemonId: mascot?.pokemonId ?? 0,
          name:
            mascot?.nickname ??
            (mascot ? getPokemonName(mascot.pokemonId) : "Mascote"),
          level: mascot?.level ?? 1,
          stance: snapshot.currentStance,
          allowedStances: Array.isArray(snapshot.allowedStances)
            ? snapshot.allowedStances.map(String)
            : [],
        };
      }),
    })),
    mine: {
      userId: user.id,
      confirmed: Boolean(submissions[user.id]),
      spectator: !(
        run.members
          .find((member) => member.userId === user.id)
          ?.mascots.some(
            (mascot) => mascot.currentHp > 0 && mascot.state === "IN_TOWER",
          ) ?? false
      ),
    },
    lobby: {
      code: lobby?.code ?? run.id.slice(-6).toUpperCase(),
      hostId: lobby?.hostId ?? run.members[0]?.userId ?? "",
      ready: lobby?.ready ?? {},
    },
    roles: TOWER_EXPEDITION_ROLES.map((role) => ({
      key: role.key,
      label: role.label,
    })),
    lobbyMascots: lobbyMascots.map((mascot) => ({
      id: mascot.id,
      pokemonId: mascot.pokemonId,
      name: mascot.nickname ?? getPokemonName(mascot.pokemonId),
      level: mascot.level,
    })),
    battle,
    exploration:
      exploration && room
        ? {
            currentRoom: {
              ...room,
              puzzle: room.puzzle
                ? {
                    id: room.puzzle.id,
                    prompt: room.puzzle.prompt,
                    options: room.puzzle.options,
                    hint:
                      exploration.countermeasures?.includes("INSIGHT") ||
                      exploration.countermeasures?.includes("ROLE:INVESTIGADOR")
                        ? "O Investigador e o Arquivo recomendam observar a sequência, não a intensidade."
                        : null,
                  }
                : undefined,
            },
            rooms: exploration.graph.map((node) => {
              const known =
                exploration.visited.includes(node.id) ||
                exploration.countermeasures?.includes("MAP");
              return {
                id: node.id,
                title: known ? node.title : "Sala desconhecida",
                kind: known ? node.kind : "UNKNOWN",
                visited: exploration.visited.includes(node.id),
                current: node.id === room.id,
                cleared: node.cleared,
                x: node.x,
                y: node.y,
                connections: node.connections,
                roomHint: known
                  ? node.kind === "COMBAT" || node.kind === "BOSS"
                    ? "Pode haver uma patrulha ou confronto."
                    : node.kind === "PUZZLE"
                      ? "Um mecanismo pode controlar passagens."
                      : node.kind === "REST"
                        ? "Pode oferecer recuperação, com algum custo."
                        : node.kind === "RESCUE"
                          ? "Há sinais de contenção e possíveis resgates."
                          : node.kind === "EVENT" || node.kind === "LUCK"
                            ? "Uma descoberta instável pode exigir uma escolha."
                            : "A função desta sala será revelada ao entrar."
                  : "Pode esconder um encontro, mecanismo, descanso, resgate ou descoberta.",
              };
            }),
            routes: room.connections
              .map((id) => {
                const node = exploration.graph.find(
                  (candidate) => candidate.id === id,
                );
                const blockedReason = exploration.encounter
                  ? "Inimigos bloqueiam a passagem. Lute ou espere reforços."
                  : !room.cleared && room.kind === "PUZZLE"
                    ? "Uma porta trancada depende do enigma desta sala."
                    : !room.cleared
                      ? "Resolva ou ignore o acontecimento desta sala antes de avançar."
                      : null;
                return node
                  ? {
                      id: node.id,
                      title: exploration.countermeasures?.includes("MAP")
                        ? node.title
                        : "Rota desconhecida",
                      kind: exploration.countermeasures?.includes("MAP") ||
                        exploration.countermeasures?.includes("SCOUT")
                        ? node.kind
                        : "UNKNOWN",
                      visited: exploration.visited.includes(node.id),
                      cleared: node.cleared,
                      available: !blockedReason,
                      blockedReason,
                    }
                  : null;
              })
              .filter(Boolean),
            pressure: exploration.pressure,
            modifiers: exploration.activeModifiers,
            countermeasures: exploration.countermeasures ?? [],
            pressureShield: exploration.pressureShield ?? 0,
            encounter: exploration.encounter ?? null,
            relics: exploration.relics ?? [],
            lastOutcome: exploration.lastOutcome ?? null,
            replay: exploration.pendingReplay ?? null,
            runReport: exploration.runReport ?? null,
            communityDiscoveries,
            votes: run.members.map((member) => {
              const choice = (submissions[member.userId]?.actions ?? {}) as {
                routeId?: string;
                puzzleChoice?: string;
                action?: string;
              };
              return {
                userId: member.userId,
                name: userNames.get(member.userId) ?? "Jogador",
                confirmed: Boolean(submissions[member.userId]),
                routeId: choice.routeId ?? null,
                puzzleChoice: choice.puzzleChoice ?? null,
                action: choice.action ?? null,
              };
            }),
          }
        : null,
    myMascots,
    log: (vol.log ?? []).slice(-12),
    lastEvents: vol.lastEvents ?? [],
    lastResolvedTurn: vol.lastResolvedTurn ?? null,
    scene: currentScene,
  };
}

/** Submete/confirma a ação do turno. Resolve na hora se todos os ativos confirmarem. */
export async function submitTowerActionAction(
  runId: string,
  actions: unknown,
): Promise<{ error: string } | { ok: true; resolved: boolean }> {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito à equipe ADMIN." };

  const resolvedNow = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${runLockKey(runId)})`;
      const run = await tx.towerRun.findUnique({
        where: { id: runId },
        include: { members: { include: { mascots: true } } },
      });
      if (!run) throw new Error("Expedição não encontrada.");
      if (run.status !== "ACTIVE")
        throw new Error("A expedição não está aceitando ações.");
      const me = run.members.find((m) => m.userId === user.id);
      if (!me || me.afkRemoved)
        throw new Error("Você não está ativo nesta expedição.");
      if (
        !me.mascots.some(
          (mascot) => mascot.currentHp > 0 && mascot.state === "IN_TOWER",
        )
      )
        throw new Error(
          "Seus mascotes estão nocauteados. Você continua acompanhando como espectador até ser revivido.",
        );

      const vol = (run.volatileState ?? {}) as TowerVolatile;
      const submissions = { ...(vol.submissions ?? {}) };
      if (submissions[user.id])
        throw new Error(
          "Sua ação nesta sala já foi confirmada e não pode ser substituída.",
        );
      const scopedActions =
        actions && typeof actions === "object"
          ? {
              ...(actions as Record<string, unknown>),
              _roomId: vol.exploration?.currentRoomId ?? null,
            }
          : actions;
      submissions[user.id] = {
        confirmedAt: new Date().toISOString(),
        actions: scopedActions ?? null,
      };
      await tx.towerRun.update({
        where: { id: runId },
        data: {
          volatileState: {
            ...vol,
            submissions,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      const active = run.members.filter(
        (m) =>
          !m.afkRemoved &&
          m.mascots.some(
            (mascot) => mascot.currentHp > 0 && mascot.state === "IN_TOWER",
          ),
      );
      return active.every((m) => Boolean(submissions[m.userId]));
    },
    { timeout: 15000 },
  );

  if (resolvedNow) await resolveTowerTurnLocked(runId).catch(() => null);
  revalidatePath(PATH);
  return { ok: true as const, resolved: resolvedNow };
}
