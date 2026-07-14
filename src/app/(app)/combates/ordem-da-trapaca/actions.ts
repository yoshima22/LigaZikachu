"use server";

import { revalidatePath } from "next/cache";
import { getAppSession } from "@/lib/session";
import { isAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { applyRandomMascotInjurySabotage, deactivateOrderSabotagesForStep, ensureOrderPasswordStamps, estimateOrderRaidBossHp, grantOrderStepRewardToAll, ORDER_EVENT_SLUG, ORDER_MYSTERY_STEP_KEYS, ORDER_MYSTERY_STEPS, ORDER_STARTER_CLUES, ORDER_STEP_CONFIG, ORDER_STEP_REWARD_NOTIFICATION, runOrderRaidBattle, submitOrderRaidPassword, type OrderMysteryStepKey } from "@/lib/raid-event";
import { healMascotSus } from "@/lib/arena-z";
import { activateMegaStoneShopItems, ensureMegaStoneShopItems } from "@/lib/mega-shop";
import { getMegaStoneByType } from "@/lib/mega-evolution";

const PATH = "/combates/ordem-da-trapaca";
const DAILY_CLUE_LIMIT = 10;

async function requireAdmin() {
  const session = await getAppSession();
  if (!session?.user || !isAdmin(session.user.role)) {
    throw new Error("Apenas admins podem alterar o evento.");
  }
  return session.user;
}

function getBrtDayRange(date = new Date()) {
  const day = date.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const start = new Date(`${day}T00:00:00-03:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

async function selectNextUsefulClueIds(eventId: string, limit: number) {
  const selected: string[] = [];
  let selectedGeneral = 0;
  const selectedSpecific = new Map<string, number>();
  const steps = await prisma.raidMysteryStep.findMany({
    where: { raidEventId: eventId, active: true, stepKey: { in: [...ORDER_MYSTERY_STEP_KEYS] } },
    select: { stepKey: true, resolvedAt: true },
    orderBy: { requiredVisibleClues: "asc" },
  });

  async function pickOne(where: { relatedStepKey?: string | null }) {
    const clue = await prisma.raidClue.findFirst({
      where: { raidEventId: eventId, visible: false, id: { notIn: selected }, ...where },
      select: { id: true, relatedStepKey: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    if (clue) {
      selected.push(clue.id);
      if (clue.relatedStepKey) selectedSpecific.set(clue.relatedStepKey, (selectedSpecific.get(clue.relatedStepKey) ?? 0) + 1);
      else selectedGeneral++;
    }
    return !!clue;
  }

  while (selected.length < limit) {
    const generalVisible = await prisma.raidClue.count({ where: { raidEventId: eventId, visible: true, relatedStepKey: null } });
    const virtualGeneral = generalVisible + selectedGeneral;
    let picked = false;

    for (const step of steps) {
      if (step.resolvedAt) continue;
      const config = ORDER_STEP_CONFIG[step.stepKey as OrderMysteryStepKey];
      if (!config) continue;

      const specificVisible = await prisma.raidClue.count({ where: { raidEventId: eventId, visible: true, relatedStepKey: step.stepKey } });
      const virtualSpecific = specificVisible + (selectedSpecific.get(step.stepKey) ?? 0);

      if (virtualGeneral < config.requiredGeneralClues) {
        picked = await pickOne({ relatedStepKey: null });
        break;
      }
      if (virtualSpecific < config.requiredSpecificClues) {
        picked = await pickOne({ relatedStepKey: step.stepKey });
        break;
      }
    }

    if (!picked) picked = await pickOne({});
    if (!picked) break;
  }

  return selected;
}

export async function prepareOrderEventAction() {
  await requireAdmin();
  const bossHp = await estimateOrderRaidBossHp();
  const now = new Date();

  const event = await prisma.raidEvent.upsert({
    where: { slug: ORDER_EVENT_SLUG },
    create: {
      name: "Ordem da Trapaca",
      slug: ORDER_EVENT_SLUG,
      villainGroupName: "Ordem da Trapaca",
      phase: "ANNOUNCED",
      active: true,
      localOnly: true,
      startsAt: now,
      investigationStartsAt: null,
      bossName: "Capitao Trambique",
      bossMascotName: "Mega Sableye Trapaceiro",
      bossPokemonId: 302,
      bossMegaPokemonId: 10066,
      bossHpMax: bossHp,
      bossHpCurrent: bossHp,
      megaThresholdPercent: 30,
      bossConfigJson: {
        recommendation: "Sableye foi escolhido como placeholder real por combinar com roubo/trapaca e possuir Mega oficial.",
        baseSpritePokemonId: 302,
        megaSpritePokemonId: 10066,
        cooldownHours: 6,
      },
    },
    update: {
      phase: "ANNOUNCED",
      active: true,
      startsAt: now,
      investigationStartsAt: null,
      hideoutFoundAt: null,
      hideoutFoundByUserId: null,
      raidStartsAt: null,
      raidEndsAt: null,
      megaActivatedAt: null,
      bossHpMax: bossHp,
      bossHpCurrent: bossHp,
    },
  });

  for (const [index, step] of ORDER_MYSTERY_STEPS.entries()) {
      const existingStep = await prisma.raidMysteryStep.findFirst({
        where: { raidEventId: event.id, stepKey: step.stepKey },
        select: { id: true },
      });
      const stepData = {
        pageKey: step.pageKey,
        requiredVisibleClues: step.requiredVisibleClues,
        requiredPreviousStepKey: step.requiredPreviousStepKey,
        interactionType: step.interactionType,
        targetKey: step.targetKey,
        successFeedback: step.successFeedback,
        earlyFeedback: step.earlyFeedback,
        active: true,
        resolvedAt: null,
        resolvedByUserId: null,
      };
      if (existingStep) {
        await prisma.raidMysteryStep.update({
          where: { id: existingStep.id },
          data: stepData,
        });
      } else {
        await prisma.raidMysteryStep.create({
          data: {
            ...stepData,
            raidEventId: event.id,
            stepKey: step.stepKey,
          },
        });
      }

      const existingInteraction = await prisma.raidHiddenInteraction.findFirst({
        where: { raidEventId: event.id, stepKey: step.stepKey, targetSelectorOrKey: step.targetKey },
        select: { id: true },
      });
      const interactionData = {
        pageKey: step.pageKey,
        interactionType: step.interactionType,
        requiredVisibleClues: step.requiredVisibleClues,
        solutionJson: { order: index + 1, previous: step.requiredPreviousStepKey },
        active: true,
      };
      if (existingInteraction) {
        await prisma.raidHiddenInteraction.update({
          where: { id: existingInteraction.id },
          data: interactionData,
        });
      } else {
        await prisma.raidHiddenInteraction.create({
          data: {
            ...interactionData,
            raidEventId: event.id,
            stepKey: step.stepKey,
            targetSelectorOrKey: step.targetKey,
          },
        });
      }
    }

    await prisma.raidMysteryStep.updateMany({
      where: { raidEventId: event.id, stepKey: { notIn: [...ORDER_MYSTERY_STEP_KEYS] } },
      data: { active: false },
    });
    await prisma.raidHiddenInteraction.updateMany({
      where: { raidEventId: event.id, stepKey: { notIn: [...ORDER_MYSTERY_STEP_KEYS] } },
      data: { active: false },
    });
    await prisma.raidClue.updateMany({
      where: { raidEventId: event.id },
      data: {
        visible: false,
        releasedAt: null,
        discoveredAt: null,
        discoveredByPlayerId: null,
      },
    });

    for (const [index, clue] of ORDER_STARTER_CLUES.entries()) {
      const existingClue = await prisma.raidClue.findFirst({
        where: { raidEventId: event.id, sortOrder: index + 1 },
        select: { id: true },
      });
      const clueData = {
        clueText: clue.clueText,
        rarity: clue.rarity,
        quality: clue.quality,
        relatedStepKey: clue.relatedStepKey,
        visible: false,
        releasedAt: null,
        discoveredAt: null,
        discoveredByPlayerId: null,
      };
      if (existingClue) {
        await prisma.raidClue.update({
          where: { id: existingClue.id },
          data: clueData,
        });
      } else {
        await prisma.raidClue.create({
          data: {
            ...clueData,
            raidEventId: event.id,
            visible: false,
            sortOrder: index + 1,
          },
        });
      }
    }

  await prisma.userRaidNotification.deleteMany({
    where: { raidEventId: event.id, notificationType: "ORDER_INTRO" },
  });
  await prisma.userRaidNotification.deleteMany({
    where: {
      raidEventId: event.id,
      notificationType: { in: Object.values(ORDER_STEP_REWARD_NOTIFICATION) as never },
    },
  });
  await prisma.raidBattleAttempt.deleteMany({ where: { raidEventId: event.id } });
  await prisma.raidDamageRanking.deleteMany({ where: { raidEventId: event.id } });
  await prisma.raidSabotage.updateMany({ where: { raidEventId: event.id }, data: { active: false, endsAt: null } });

  revalidatePath("/", "layout");
  revalidatePath(PATH);
}

export async function setOrderEventPhaseAction(formData: FormData) {
  await requireAdmin();
  const requestedPhase = String(formData.get("phase") ?? "ANNOUNCED");
  const phase = requestedPhase === "HIDEOUT_UNLOCKING" ? "HIDEOUT_FOUND" : requestedPhase;
  const now = new Date();
  const isRaidActive = phase === "RAID_ACTIVE";
  const isClosed = phase === "ENDED";
  const event = await prisma.raidEvent.update({
    where: { slug: ORDER_EVENT_SLUG },
    data: {
      phase: phase as never,
      active: !isClosed,
      investigationStartsAt: phase === "INVESTIGATION" ? now : undefined,
      hideoutFoundAt: phase === "HIDEOUT_FOUND" || isRaidActive ? now : undefined,
      raidStartsAt: isRaidActive ? now : undefined,
      raidEndsAt: isRaidActive ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) : undefined,
    },
    select: { id: true },
  });
  if (isClosed) {
    await prisma.raidSabotage.updateMany({
      where: { raidEventId: event.id, active: true },
      data: { active: false, endsAt: now },
    });
  }
  if (phase === "HIDEOUT_FOUND" || phase === "RAID_ACTIVE") {
    await ensureOrderPasswordStamps(event.id);
  }
  if (phase === "RAID_DEFEATED" || phase === "ENDED") {
    await activateMegaStoneShopItems();
  }
  revalidatePath(PATH);
  revalidatePath("/perfil");
  revalidatePath("/jogadores");
}

export async function submitOrderRaidPasswordAction(formData: FormData) {
  const session = await getAppSession();
  if (!session?.user) return;
  const password = String(formData.get("password") ?? "");
  await submitOrderRaidPassword(session.user.id, password);
  revalidatePath(PATH);
  revalidatePath("/jogadores");
  revalidatePath("/perfil");
}

export async function attackOrderRaidBossAction(formData: FormData) {
  const session = await getAppSession();
  if (!session?.user) return { ok: false as const, message: "Faça login novamente." };
  const mascotIds = formData.getAll("mascotId").map((id) => String(id)).filter(Boolean);
  const roles = Object.fromEntries(mascotIds.map((id) => [id, String(formData.get(`role:${id}`) ?? "ATTACKER")]));
  const result = await runOrderRaidBattle(session.user.id, mascotIds, roles);
  if (result.ok && result.result === "WIN") {
    await activateMegaStoneShopItems();
  }
  revalidatePath(PATH);
  revalidatePath("/mascotes");
  return result;
}

export async function healOrderRaidMascotSusAction(formData: FormData) {
  const session = await getAppSession();
  if (!session?.user) return;
  const mascotId = String(formData.get("mascotId") ?? "");
  if (!mascotId) return;
  const player = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!player) return;
  await healMascotSus(player.id, mascotId);
  revalidatePath(PATH);
  revalidatePath("/mascotes");
}

export async function claimOrderFreeMegaStoneAction(formData: FormData): Promise<void> {
  const session = await getAppSession();
  if (!session?.user) return;

  const stoneType = String(formData.get("stoneType") ?? "");
  const stone = getMegaStoneByType(stoneType);
  if (!stone) return;

  const [event, player] = await Promise.all([
    prisma.raidEvent.findUnique({
      where: { slug: ORDER_EVENT_SLUG },
      select: { id: true, phase: true },
    }),
    prisma.player.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    }),
  ]);
  if (!event || !["RAID_DEFEATED", "ENDED"].includes(event.phase)) {
    return;
  }
  if (!player) return;

  await ensureMegaStoneShopItems(event.phase === "RAID_DEFEATED" || event.phase === "ENDED");
  const item = await prisma.shopItem.findFirst({
    where: { type: stone.type },
    select: { id: true, name: true },
  });
  if (!item) return;

  const notificationType = "ORDER_FREE_MEGA_STONE";
  const existing = await prisma.userRaidNotification.findUnique({
    where: {
      raidEventId_userId_notificationType: {
        raidEventId: event.id,
        userId: session.user.id,
        notificationType,
      },
    },
    select: { id: true },
  });
  if (existing) return;

  await prisma.$transaction(async (tx) => {
    await tx.playerInventory.upsert({
      where: { playerId_itemId: { playerId: player.id, itemId: item.id } },
      update: { quantity: { increment: 1 } },
      create: { playerId: player.id, itemId: item.id, quantity: 1, equipped: false, source: "ORDER_RAID_REWARD" },
    });
    await tx.userRaidNotification.create({
      data: {
        raidEventId: event.id,
        userId: session.user.id,
        notificationType,
        seenAt: null,
      },
    });
  });

  revalidatePath("/combates/ordem-da-trapaca");
  revalidatePath("/inventario");
  revalidatePath("/mascotes");
}

export async function debugSetOrderBossHpPercentAction(formData: FormData) {
  await requireAdmin();
  const percent = Math.max(1, Math.min(100, Number(formData.get("percent") ?? 29) || 29));
  const event = await prisma.raidEvent.findUnique({
    where: { slug: ORDER_EVENT_SLUG },
    select: { id: true, bossHpMax: true },
  });
  if (!event) return;
  await prisma.raidEvent.update({
    where: { id: event.id },
    data: { bossHpCurrent: Math.max(1, Math.round(event.bossHpMax * (percent / 100))) },
  });
  revalidatePath(PATH);
}

export async function debugRecalculateOrderBossHpAction() {
  await requireAdmin();
  const bossHp = await estimateOrderRaidBossHp();
  await prisma.raidEvent.update({
    where: { slug: ORDER_EVENT_SLUG },
    data: { bossHpMax: bossHp, bossHpCurrent: bossHp },
  });
  revalidatePath(PATH);
}

export async function revealNextOrderClueAction() {
  await requireAdmin();
  const event = await prisma.raidEvent.findUnique({ where: { slug: ORDER_EVENT_SLUG }, select: { id: true } });
  if (!event) return;

  const [nextId] = await selectNextUsefulClueIds(event.id, 1);
  if (nextId) {
    await prisma.raidClue.update({
      where: { id: nextId },
      data: { visible: true, releasedAt: new Date() },
    });
  }
  revalidatePath(PATH);
}

export async function releaseDailyOrderCluesAction() {
  await requireAdmin();
  const event = await prisma.raidEvent.findUnique({ where: { slug: ORDER_EVENT_SLUG }, select: { id: true } });
  if (!event) return;

  const { start, end } = getBrtDayRange();
  const releasedToday = await prisma.raidClue.count({
    where: { raidEventId: event.id, visible: true, releasedAt: { gte: start, lt: end } },
  });
  const remaining = Math.max(0, DAILY_CLUE_LIMIT - releasedToday);
  if (remaining === 0) return;

  const nextClueIds = await selectNextUsefulClueIds(event.id, remaining);
  if (nextClueIds.length === 0) return;

  await prisma.raidClue.updateMany({
    where: { id: { in: nextClueIds } },
    data: { visible: true, releasedAt: new Date() },
  });
  revalidatePath(PATH);
}

export async function releaseAllOrderCluesAction() {
  await requireAdmin();
  const event = await prisma.raidEvent.findUnique({ where: { slug: ORDER_EVENT_SLUG }, select: { id: true } });
  if (!event) return;

  await prisma.raidClue.updateMany({
    where: { raidEventId: event.id, visible: false },
    data: { visible: true, releasedAt: new Date() },
  });
  revalidatePath(PATH);
}

export async function resolveOrderStepForTestAction(formData: FormData) {
  const admin = await requireAdmin();
  const stepKey = String(formData.get("stepKey") ?? "");
  if (!stepKey) return;

  const event = await prisma.raidEvent.findUnique({ where: { slug: ORDER_EVENT_SLUG }, select: { id: true, phase: true } });
  if (!event) return;

  await prisma.raidMysteryStep.updateMany({
    where: { raidEventId: event.id, stepKey },
    data: { resolvedAt: new Date(), resolvedByUserId: admin.id },
  });
  if (ORDER_MYSTERY_STEP_KEYS.includes(stepKey as OrderMysteryStepKey)) {
    await deactivateOrderSabotagesForStep(event.id, stepKey as OrderMysteryStepKey);
    await grantOrderStepRewardToAll(event.id, stepKey as OrderMysteryStepKey, admin.id);
  }

  const unresolvedCount = await prisma.raidMysteryStep.count({
    where: { raidEventId: event.id, active: true, stepKey: { in: [...ORDER_MYSTERY_STEP_KEYS] }, resolvedAt: null },
  });
  if (unresolvedCount === 0 && event.phase !== "HIDEOUT_FOUND" && event.phase !== "RAID_ACTIVE") {
    await prisma.raidEvent.update({
      where: { id: event.id },
      data: { phase: "HIDEOUT_FOUND", hideoutFoundAt: new Date(), hideoutFoundByUserId: admin.id },
    });
    await ensureOrderPasswordStamps(event.id);
  }

  revalidatePath(PATH);
}

export async function resetOrderStepsForTestAction() {
  await requireAdmin();
  const event = await prisma.raidEvent.findUnique({ where: { slug: ORDER_EVENT_SLUG }, select: { id: true } });
  if (!event) return;

  await prisma.raidMysteryStep.updateMany({
    where: { raidEventId: event.id, stepKey: { in: [...ORDER_MYSTERY_STEP_KEYS] } },
    data: { resolvedAt: null, resolvedByUserId: null },
  });
  await prisma.raidPasswordStamp.deleteMany({ where: { raidEventId: event.id } });
  await prisma.raidPassword.deleteMany({ where: { raidEventId: event.id } });
  await prisma.raidEvent.update({
    where: { id: event.id },
    data: { phase: "INVESTIGATION", active: true, hideoutFoundAt: null, hideoutFoundByUserId: null },
  });
  revalidatePath(PATH);
}

export async function createOrderClueAction(formData: FormData) {
  await requireAdmin();
  const event = await prisma.raidEvent.findUnique({ where: { slug: ORDER_EVENT_SLUG }, select: { id: true } });
  if (!event) return;

  const clueText = String(formData.get("clueText") ?? "").trim();
  if (!clueText) {
    revalidatePath(PATH);
    return;
  }
  const rarity = String(formData.get("rarity") ?? "COMMON");
  const quality = String(formData.get("quality") ?? "OK");
  const relatedStepKey = String(formData.get("relatedStepKey") ?? "").trim() || null;
  const visible = String(formData.get("visible") ?? "false") === "true";
  const nextSort = await prisma.raidClue.aggregate({
    where: { raidEventId: event.id },
    _max: { sortOrder: true },
  });

  await prisma.raidClue.create({
    data: {
      raidEventId: event.id,
      clueText,
      rarity: rarity as never,
      quality: quality as never,
      relatedStepKey,
      visible,
      releasedAt: visible ? new Date() : null,
      sortOrder: (nextSort._max.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath(PATH);
}

export async function toggleOrderClueVisibilityAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const visible = String(formData.get("visible") ?? "false") === "true";
  if (!id) return;

  await prisma.raidClue.update({
    where: { id },
    data: { visible, releasedAt: visible ? new Date() : null },
  });
  revalidatePath(PATH);
}

export async function resetOrderEventLocalAction() {
  await requireAdmin();
  const event = await prisma.raidEvent.findUnique({ where: { slug: ORDER_EVENT_SLUG }, select: { id: true } });
  if (!event) return;

  await prisma.$transaction([
    prisma.userRaidNotification.deleteMany({ where: { raidEventId: event.id } }),
    prisma.raidBattleAttempt.deleteMany({ where: { raidEventId: event.id } }),
    prisma.raidDamageRanking.deleteMany({ where: { raidEventId: event.id } }),
    prisma.raidSabotage.deleteMany({ where: { raidEventId: event.id } }),
    prisma.raidHiddenInteraction.deleteMany({ where: { raidEventId: event.id } }),
    prisma.raidMysteryStep.deleteMany({ where: { raidEventId: event.id } }),
    prisma.raidClue.deleteMany({ where: { raidEventId: event.id } }),
    prisma.raidEvent.delete({ where: { id: event.id } }),
  ]);
  revalidatePath(PATH);
}

export async function seedOrderSabotagesAction() {
  await requireAdmin();
  const event = await prisma.raidEvent.findUnique({ where: { slug: ORDER_EVENT_SLUG }, select: { id: true } });
  if (!event) return;

  const presets = [
    {
      systemKey: "ZIKALOOT",
      sabotageType: "ZIKALOOT_FAKE_NUMBER",
      title: "ZikaLoot roubada",
      description: "A Ordem lacrou a ZikaLoot e segurou as recompensas até que a pista certa seja descoberta.",
      effectJson: { locked: true, message: "As recompensas da ZikaLoot foram roubadas pela Ordem." },
      severity: 2,
    },
    {
      systemKey: "BAZAR",
      sabotageType: "BLOCK_BAZAR_SLOT",
      title: "Slot sabotado no Bazar",
      description: "A Ordem plantou uma oferta corrompida no meio do Bazar. Enquanto a travessura estiver ativa, esse espaço não pode ser comprado.",
      effectJson: { slotLabel: "Oferta corrompida", blockedIndex: 1 },
      severity: 2,
    },
    {
      systemKey: "LABORATORY",
      sabotageType: "DISABLE_LAB_ANALYSIS",
      title: "Máquina de análise engasgada",
      description: "A fumaça roxa da Ordem travou a análise de mascotes no Laboratório até que a origem da sabotagem seja descoberta.",
      effectJson: { disableAnalysis: true },
      severity: 3,
    },
    {
      systemKey: "ZIKASHOP",
      sabotageType: "INCREASE_PRICE",
      title: "Preços adulterados",
      description: "Etiquetas falsas da Ordem tentam confundir a loja com valores suspeitos durante a investigação.",
      effectJson: { priceIncreasePct: 10 },
      severity: 2,
    },
    {
      systemKey: "PROFILE",
      sabotageType: "PROFILE_GRAFFITI",
      title: "Carimbo da Ordem",
      description: "A Ordem deixou marcas nos perfis dos jogadores. Algumas delas escondem parte do caminho até o esconderijo.",
      effectJson: { stampText: "TRAPACEADO", intensity: "LOW" },
      severity: 1,
    },
    {
      systemKey: "MASCOT_LEAGUE",
      sabotageType: "HIDDEN_INTERACTION",
      title: "Liga Semanal adulterada",
      description: "A Ordem mexeu nos três primeiros slots das equipes da Liga Semanal e reduziu seus atributos pela metade.",
      effectJson: {
        kind: "WEEKLY_LEAGUE_SLOT_DEBUFF",
        affectedSlots: [1, 2, 3],
        statMultiplier: 0.5,
        affectedStats: ["force", "agility", "instinct", "vitality", "charisma"],
        publicWarning: true,
      },
      severity: 4,
    },
    {
      systemKey: "MASCOTS",
      sabotageType: "HIDDEN_INTERACTION",
      title: "Sussurros perigosos da Ordem",
      description: "A Ordem espalhou armadilhas e rumores que deixam companheiros em destaque mais expostos a ataques surpresa durante a investigação.",
      effectJson: {
        kind: "RANDOM_MASCOT_INJURY",
        dailyLimit: 2,
        emergencyDisabled: true,
        avoidFavorites: false,
        preferFavorites: true,
        preferStrongMascots: true,
        maxPerPlayerPerDay: 1,
      },
      severity: 5,
    },
  ] as const;

  for (const preset of presets) {
    const existing = await prisma.raidSabotage.findFirst({
      where: { raidEventId: event.id, systemKey: preset.systemKey as never, sabotageType: preset.sabotageType as never },
      select: { id: true },
    });
    if (existing) {
      await prisma.raidSabotage.update({
        where: { id: existing.id },
        data: {
          title: preset.title,
          description: preset.description,
          effectJson: preset.effectJson,
          severity: preset.severity,
          visibleToPlayers: true,
        },
      });
    } else {
      await prisma.raidSabotage.create({
        data: {
          raidEventId: event.id,
          systemKey: preset.systemKey as never,
          sabotageType: preset.sabotageType as never,
          title: preset.title,
          description: preset.description,
          effectJson: preset.effectJson,
          severity: preset.severity,
          visibleToPlayers: true,
          active: false,
        },
      });
    }
  }

  revalidatePath(PATH);
}

export async function toggleOrderSabotageAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "false") === "true";
  if (!id) return;
  await prisma.raidSabotage.update({ where: { id }, data: { active } });
  revalidatePath(PATH);
  revalidatePath("/bazar");
  revalidatePath("/zikaloot");
  revalidatePath("/laboratorio");
  revalidatePath("/shop");
}

export async function setOrderInjuryEmergencyAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const emergencyDisabled = String(formData.get("emergencyDisabled") ?? "true") === "true";
  if (!id) return;

  const sabotage = await prisma.raidSabotage.findUnique({ where: { id }, select: { effectJson: true } });
  const current = sabotage?.effectJson && typeof sabotage.effectJson === "object" && !Array.isArray(sabotage.effectJson)
    ? sabotage.effectJson as Record<string, unknown>
    : {};

  await prisma.raidSabotage.update({
    where: { id },
    data: {
      effectJson: {
        ...current,
        kind: "RANDOM_MASCOT_INJURY",
        emergencyDisabled,
      },
    },
  });

  revalidatePath(PATH);
  revalidatePath("/mascotes");
}

export async function testOrderMascotInjuryAction() {
  await requireAdmin();
  await applyRandomMascotInjurySabotage({ force: true });
  revalidatePath(PATH);
  revalidatePath("/mascotes");
}

export async function clearOrderSabotagesAction() {
  await requireAdmin();
  const event = await prisma.raidEvent.findUnique({ where: { slug: ORDER_EVENT_SLUG }, select: { id: true } });
  if (!event) return;
  await prisma.raidSabotage.updateMany({ where: { raidEventId: event.id }, data: { active: false } });
  revalidatePath(PATH);
  revalidatePath("/bazar");
  revalidatePath("/zikaloot");
  revalidatePath("/laboratorio");
  revalidatePath("/shop");
}
