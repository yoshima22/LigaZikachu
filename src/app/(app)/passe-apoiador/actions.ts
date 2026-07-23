"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAdmin } from "@/lib/auth/permissions";
import { getSessionPlayer } from "@/lib/session";
import { creditCoins } from "@/lib/zikacoins";
import { ZikaCoinTxType } from "@prisma/client";
import { deactivateExpiredSupporterPasses } from "@/lib/supporter-pass";
import type { DayReward } from "./schedule";
export type { DayReward } from "./schedule";
import { PASS_SCHEDULE, PASS_SCHEDULE_DEFAULTS } from "./schedule";

const DEFAULT_PASS_DISPLAY = {
  title: "Pilar da Comunidade",
  description: "Passe Apoiador da Liga",
  flavorText: "Sem você, as luzes se apagariam.",
};

async function getPassDisplayConfig(passLabel?: string) {
  const label = passLabel?.trim() || "Passe Apoiador";
  try {
    const cfg = await prisma.passScheduleConfig.findUnique({
      where: { id: label === "Passe Apoiador" ? "singleton" : label },
      select: { displayTitle: true, description: true, flavorText: true },
    });
    return {
      title: cfg?.displayTitle?.trim() || (label === "Passe Apoiador" ? DEFAULT_PASS_DISPLAY.title : label),
      description: cfg?.description?.trim() || (label === "Passe Apoiador" ? DEFAULT_PASS_DISPLAY.description : label),
      flavorText: cfg?.flavorText?.trim() || (label === "Passe Apoiador" ? DEFAULT_PASS_DISPLAY.flavorText : "Uma recompensa especial da Liga Zikachu."),
    };
  } catch {
    return {
      title: label === "Passe Apoiador" ? DEFAULT_PASS_DISPLAY.title : label,
      description: label === "Passe Apoiador" ? DEFAULT_PASS_DISPLAY.description : label,
      flavorText: label === "Passe Apoiador" ? DEFAULT_PASS_DISPLAY.flavorText : "Uma recompensa especial da Liga Zikachu.",
    };
  }
}

// ── Calendário: leitura com fallback para o hardcoded ─────────────────────────
// scheduleKey = passLabel do passe (ex: "Passe Apoiador", "Passe Gold").
// Fallback chain: DB[key] → DB["singleton"] → hardcoded default → PASS_SCHEDULE

export async function getActiveSchedule(scheduleKey?: string): Promise<DayReward[]> {
  try {
    // Tenta buscar pelo key específico primeiro
    const ids = scheduleKey && scheduleKey !== "Passe Apoiador"
      ? [scheduleKey, "singleton"]
      : ["singleton"];
    for (const id of ids) {
      const cfg = await prisma.passScheduleConfig.findUnique({ where: { id } });
      if (cfg && Array.isArray(cfg.schedule) && (cfg.schedule as DayReward[]).length === 30)
        return cfg.schedule as DayReward[];
    }
  } catch { /* tabela ainda não existe — usa fallback */ }
  // Fallback para hardcoded por label, depois PASS_SCHEDULE
  if (scheduleKey && PASS_SCHEDULE_DEFAULTS[scheduleKey])
    return PASS_SCHEDULE_DEFAULTS[scheduleKey];
  return PASS_SCHEDULE;
}

export async function adminGetSchedule(
  scheduleKey?: string
): Promise<{ schedule: DayReward[]; isCustom: boolean; label: string; allowRetroactiveClaims: boolean; displayTitle: string; description: string; flavorText: string }> {
  await requireAdmin();
  const label = scheduleKey ?? "Passe Apoiador";
  const display = await getPassDisplayConfig(label);
  try {
    const cfg = await prisma.passScheduleConfig.findUnique({ where: { id: label === "Passe Apoiador" ? "singleton" : label } });
    if (cfg && Array.isArray(cfg.schedule) && (cfg.schedule as DayReward[]).length === 30)
      return {
        schedule: cfg.schedule as DayReward[],
        isCustom: true,
        label,
        allowRetroactiveClaims: cfg.allowRetroactiveClaims,
        displayTitle: cfg.displayTitle?.trim() || display.title,
        description: cfg.description?.trim() || display.description,
        flavorText: cfg.flavorText?.trim() || display.flavorText,
      };
  } catch { /* fallback */ }
  const fallback = PASS_SCHEDULE_DEFAULTS[label] ?? PASS_SCHEDULE;
  return { schedule: fallback, isCustom: false, label, allowRetroactiveClaims: false, displayTitle: display.title, description: display.description, flavorText: display.flavorText };
}

export async function adminListScheduleLabels(): Promise<string[]> {
  await requireAdmin();
  try {
    const configs = await prisma.passScheduleConfig.findMany({ select: { id: true } });
    const dbLabels = configs.map(c => c.id === "singleton" ? "Passe Apoiador" : c.id);
    const allLabels = new Set([...Object.keys(PASS_SCHEDULE_DEFAULTS), ...dbLabels]);
    return [...allLabels];
  } catch { return Object.keys(PASS_SCHEDULE_DEFAULTS); }
}

export async function adminSaveSchedule(
  schedule: DayReward[],
  scheduleKey?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const user = await getSessionUser();
    if (schedule.length !== 30) return { ok: false, error: "O calendário precisa ter exatamente 30 dias." };
    // "Passe Apoiador" usa id="singleton" para compatibilidade com passes antigos
    const id = (!scheduleKey || scheduleKey === "Passe Apoiador") ? "singleton" : scheduleKey;
    const current = await prisma.passScheduleConfig.findUnique({
      where: { id },
      select: { allowRetroactiveClaims: true },
    });
    await prisma.passScheduleConfig.upsert({
      where: { id },
      create: { id, schedule: schedule as object[], allowRetroactiveClaims: current?.allowRetroactiveClaims ?? false, updatedBy: user?.id },
      update: { schedule: schedule as object[], updatedBy: user?.id },
    });
    revalidatePath("/passe-apoiador");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao salvar." };
  }
}

export async function adminCreatePassSchedule(
  label: string,
  baseLabel = "Passe Apoiador"
): Promise<{ ok: boolean; label?: string; schedule?: DayReward[]; allowRetroactiveClaims?: boolean; error?: string }> {
  try {
    await requireAdmin();
    const user = await getSessionUser();
    const cleanLabel = label.trim().replace(/\s+/g, " ");
    if (cleanLabel.length < 3) return { ok: false, error: "Nome do passe muito curto." };
    if (cleanLabel.length > 40) return { ok: false, error: "Nome do passe muito longo." };
    if (cleanLabel.toLowerCase() === "custom") return { ok: false, error: "Escolha outro nome para o passe." };

    const id = cleanLabel === "Passe Apoiador" ? "singleton" : cleanLabel;
    const existing = await prisma.passScheduleConfig.findUnique({ where: { id }, select: { id: true } });
    if (existing || PASS_SCHEDULE_DEFAULTS[cleanLabel]) {
      return { ok: false, error: "Esse tipo de passe ja existe." };
    }

    const base = await adminGetSchedule(baseLabel);
    await prisma.passScheduleConfig.create({
      data: {
        id,
        schedule: base.schedule as object[],
        allowRetroactiveClaims: base.allowRetroactiveClaims,
        updatedBy: user?.id,
      },
    });

    revalidatePath("/admin");
    return {
      ok: true,
      label: cleanLabel,
      schedule: base.schedule,
      allowRetroactiveClaims: base.allowRetroactiveClaims,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao criar passe." };
  }
}

export async function adminResetSchedule(scheduleKey?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const id = (!scheduleKey || scheduleKey === "Passe Apoiador") ? "singleton" : scheduleKey;
    await prisma.passScheduleConfig.deleteMany({ where: { id } });
    revalidatePath("/admin");
    revalidatePath("/passe-apoiador");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao resetar." };
  }
}

// ── Utilitário: dias de calendário decorridos em BRT ─────────────────────────
// Conta quantos dias do calendário (meia-noite BRT) separaram duas datas.
// Assim, "dia 2" libera na meia-noite seguinte à criação — não após 24h corridas.
function calendarDaysBRT(from: Date, to: Date): number {
  const TZ = "America/Sao_Paulo";
  // Formata como "YYYY-MM-DD" no fuso BRT e compara datas, sem depender de hora
  const toYMD = (d: Date) =>
    d.toLocaleDateString("sv-SE", { timeZone: TZ }); // sv-SE dá "YYYY-MM-DD"
  const fromStr = toYMD(from);
  const toStr   = toYMD(to);
  const msFrom  = new Date(fromStr).getTime();
  const msTo    = new Date(toStr).getTime();
  return Math.floor((msTo - msFrom) / 86400000);
}

// ── Status do passe do jogador logado ─────────────────────────────────────────

export type ActivePassSummary = {
  id: string;
  startsAt: Date;
  expiresAt: Date;
  passLabel: string;
  totalDays: number;
  daysRemaining: number;
  claimsCount: number;
};

export type PassStatus = {
  pass: {
    id: string;
    active: boolean;
    startsAt: Date;
    expiresAt: Date;
    daysElapsed: number;
    daysRemaining: number;
    totalDays: number;
    isExpired: boolean;
    allowRetroactiveClaims: boolean;
    passLabel: string;
    displayTitle: string;
    description: string;
    flavorText: string;
  } | null;
  claims: { dayNumber: number; claimedAt: Date }[];
  todayDay: number | null; // null = não tem passe ativo
  canClaimToday: boolean;
  isNewVip: boolean; // nunca teve passe antes (para celebração)
  /** Todos os passes ativos — para o seletor quando houver mais de um */
  allActivePasses: ActivePassSummary[];
  error?: string;
};

export async function getMyPassStatus(passId?: string): Promise<PassStatus> {
  const empty: PassStatus = { pass: null, claims: [], todayDay: null, canClaimToday: false, isNewVip: false, allActivePasses: [] };
  try {
    const user = await getSessionUser();
    if (!user) return empty;
    const player = await getSessionPlayer(user.id);
    if (!player) return empty;

    const now = new Date();
    await deactivateExpiredSupporterPasses(now);

    // Lista de todos os passes ativos para o seletor
    const allActiveRaw = await prisma.supporterPass.findMany({
      where: { playerId: player.id, active: true, expiresAt: { gt: now } },
      select: {
        id: true,
        startsAt: true,
        expiresAt: true,
        passLabel: true,
        claims: { select: { rewardType: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const allActivePasses: ActivePassSummary[] = allActiveRaw.map(p => ({
      id: p.id,
      startsAt: p.startsAt,
      expiresAt: p.expiresAt,
      passLabel: p.passLabel ?? "Passe Apoiador",
      totalDays: Math.max(1, Math.min(30, Math.ceil((p.expiresAt.getTime() - p.startsAt.getTime()) / 86400000))),
      daysRemaining: Math.max(0, Math.ceil((p.expiresAt.getTime() - now.getTime()) / 86400000)),
      claimsCount: p.claims.filter((claim) => claim.rewardType !== "DEBUG_SKIP").length,
    }));

    // Seleciona o passe: pelo ID se fornecido, senão o mais recente ativo
    const pass = passId
      ? await prisma.supporterPass.findFirst({
          where: { id: passId, playerId: player.id, active: true, expiresAt: { gt: now } },
          include: { claims: { select: { dayNumber: true, claimedAt: true }, orderBy: { dayNumber: "asc" } } },
        })
      : await prisma.supporterPass.findFirst({
          where: { playerId: player.id, active: true, expiresAt: { gt: now } },
          include: { claims: { select: { dayNumber: true, claimedAt: true }, orderBy: { dayNumber: "asc" } } },
          orderBy: { createdAt: "desc" },
        });

    if (!pass) {
      const hadPass = await prisma.supporterPass.count({ where: { playerId: player.id } });
      return { ...empty, allActivePasses, isNewVip: hadPass === 0 };
    }

    const isExpired = now > pass.expiresAt || !pass.active;
    // Usa dias de calendário em BRT para que o dia 2 libere na meia-noite seguinte,
    // independente do horário em que o passe foi criado.
    const daysElapsed = calendarDaysBRT(pass.startsAt, now);
    const daysRemaining = Math.max(0, Math.ceil((pass.expiresAt.getTime() - now.getTime()) / 86400000));
    const totalDays = Math.max(1, Math.min(30, Math.ceil((pass.expiresAt.getTime() - pass.startsAt.getTime()) / 86400000)));
    const todayDay = Math.min(totalDays, daysElapsed + 1);
    const alreadyClaimed = pass.claims.some(c => c.dayNumber === todayDay);
    const canClaimToday = !isExpired && !alreadyClaimed && todayDay >= 1 && todayDay <= totalDays;
    const display = await getPassDisplayConfig(pass.passLabel);

    return {
      pass: {
        id: pass.id,
        active: pass.active,
        startsAt: pass.startsAt,
        expiresAt: pass.expiresAt,
        daysElapsed,
        daysRemaining,
        totalDays,
        isExpired,
        allowRetroactiveClaims: pass.allowRetroactiveClaims,
        passLabel: pass.passLabel,
        displayTitle: display.title,
        description: display.description,
        flavorText: display.flavorText,
      },
      claims: pass.claims,
      todayDay: isExpired ? null : todayDay,
      canClaimToday,
      isNewVip: false,
      allActivePasses,
    };
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ── Resgatar recompensa do dia ────────────────────────────────────────────────

export type ClaimResult = {
  ok: boolean;
  reward?: DayReward;
  stickerResult?: {
    cards: { nationalId: number; displayName: string; imageUrl: string | null; rarity: string; isDuplicate: boolean; coinsEarned: number }[];
    totalCoinsEarned: number;
  };
  error?: string;
};

export async function claimPassDay(passId: string, dayNumber: number): Promise<ClaimResult> {
  try {
    const user = await getSessionUser();
    if (!user) return { ok: false, error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { ok: false, error: "Jogador não encontrado." };

    // Validações de segurança
    const pass = await prisma.supporterPass.findUnique({
      where: { id: passId },
      include: { claims: { where: { dayNumber }, select: { id: true } } },
    });
    if (!pass || pass.playerId !== player.id) return { ok: false, error: "Passe não encontrado." };
    if (!pass.active || new Date() > pass.expiresAt) return { ok: false, error: "Passe expirado." };
    if (pass.claims.length > 0) return { ok: false, error: "Dia já resgatado." };

    // Verificar que o dia já chegou (calendário BRT, não 24h corridas)
    const passTotalDays = Math.max(1, Math.min(30, Math.ceil((pass.expiresAt.getTime() - pass.startsAt.getTime()) / 86400000)));
    const currentDay = Math.min(passTotalDays, calendarDaysBRT(pass.startsAt, new Date()) + 1);
    if (!pass.allowRetroactiveClaims && dayNumber > currentDay) return { ok: false, error: "Esse dia ainda não chegou." };
    if (dayNumber < 1 || dayNumber > passTotalDays) return { ok: false, error: "Dia inválido para este passe." };

    const activeSchedule = await getActiveSchedule(pass.passLabel ?? undefined);
    const reward = activeSchedule.find(r => r.day === dayNumber);
    if (!reward) return { ok: false, error: "Recompensa não configurada." };

    let stickerResult: ClaimResult["stickerResult"] | undefined;

    await prisma.$transaction(async (tx) => {
      // 1. Registrar claim
      await tx.supporterPassClaim.create({
        data: { passId, playerId: player.id, dayNumber, rewardType: reward.type, rewardPayload: reward as object },
      });

      // 2. ZikaCoins
      if (reward.coins && reward.coins > 0) {
        await creditCoins(tx, {
          playerId: player.id,
          type: ZikaCoinTxType.VIP_PASS_REWARD,
          amount: reward.coins,
          description: `Passe Apoiador — Dia ${dayNumber}`,
        });
      }

      // 3. Ovo
      if (reward.type === "EGG" || (reward.eggType)) {
        const qty = reward.foodQty ?? 1;
        for (let i = 0; i < qty; i++) {
          await tx.mascotEgg.create({
            data: { playerId: player.id, type: (reward.eggType ?? "COMMON") as import("@prisma/client").EggType, origin: "VIP_PASS" },
          });
        }
      }

      // 4. Comida
      if (reward.foodType === "FOOD" && reward.type !== "SWEET") {
        const qty = reward.foodQty ?? 1;
        const food = await tx.mascotFoodItem.findFirst({ where: { playerId: player.id, type: "FOOD" } });
        if (food) {
          await tx.mascotFoodItem.update({ where: { id: food.id }, data: { quantity: { increment: qty } } });
        } else {
          await tx.mascotFoodItem.create({ data: { playerId: player.id, type: "FOOD", quantity: qty } });
        }
      }

      // 5. Doce
      if (reward.foodType === "SWEET" || reward.type === "SWEET") {
        const qty = reward.foodQty ?? 1;
        const sweet = await tx.mascotFoodItem.findFirst({ where: { playerId: player.id, type: "SWEET" } });
        if (sweet) {
          await tx.mascotFoodItem.update({ where: { id: sweet.id }, data: { quantity: { increment: qty } } });
        } else {
          await tx.mascotFoodItem.create({ data: { playerId: player.id, type: "SWEET", quantity: qty } });
        }
      }

      // 6. Shop item (por nome — lookup)
      if (reward.shopItemName) {
        const shopItem = await tx.shopItem.findFirst({
          where: {
            name: { contains: reward.shopItemName, mode: "insensitive" },
            inventoryEnabled: true,
          },
          orderBy: [
            { active: "desc" },
            { updatedAt: "desc" },
          ],
        });
        if (shopItem) {
          const existing = await tx.playerInventory.findUnique({
            where: { playerId_itemId: { playerId: player.id, itemId: shopItem.id } },
          });
          if (existing) {
            await tx.playerInventory.update({
              where: { playerId_itemId: { playerId: player.id, itemId: shopItem.id } },
              data: { quantity: { increment: 1 } },
            });
          } else {
            await tx.playerInventory.create({
              data: { playerId: player.id, itemId: shopItem.id, quantity: 1, source: "VIP_PASS" },
            });
          }
        }
      }

      // 7. ZikaLoot — via PlayerGift
      if (reward.type === "ZIKALOOT") {
        await tx.playerGift.create({
          data: {
            playerId: player.id,
            type: "CUSTOM",
            title: reward.zikalootSpecial ? "🎟️ Ticket ZikaLoot Especial" : "🎟️ Ticket ZikaLoot",
            description: `Recompensa do Passe Apoiador — Dia ${dayNumber}`,
            payload: {
              rewardKind: "ZIKALOOT_TICKET",
              special: reward.zikalootSpecial ?? false,
              origin: "VIP_PASS",
            },
          },
        });
      }
    });

    // 8. Sticker pack — abre fora da transação (usa lógica existente)
    if (reward.type === "STICKER_PACK" && reward.packName) {
      const { openStickerPackByName } = await import("./pack-opener");
      stickerResult = await openStickerPackByName(player.id, reward.packName);
    }

    revalidatePath("/passe-apoiador");
    return { ok: true, reward, stickerResult };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao resgatar." };
  }
}

// ── Admin: conceder VIP ───────────────────────────────────────────────────────

export async function adminGrantVip(opts: {
  playerId: string;
  days: number;
  /** Iniciar o passe a partir deste dia (1–30). Dias anteriores serão marcados como resgatados sem entregar recompensas. */
  startDay?: number;
  /** Rótulo/tier do passe (ex: "Passe Gold"). Default: "Passe Apoiador". */
  passLabel?: string;
}): Promise<{ ok: boolean; passId?: string; error?: string }> {
  try {
    const admin = await getSessionUser();
    await requireAdmin();

    const player = await prisma.player.findUnique({ where: { id: opts.playerId }, select: { id: true, displayName: true } });
    if (!player) return { ok: false, error: "Jogador não encontrado." };

    const startDay = Math.max(1, Math.min(30, opts.startDay ?? 1));

    // Se startDay > 1, rewind startsAt para que "hoje" seja o dia startDay.
    // Usamos meia-noite BRT do dia de criação menos (startDay-1) dias, para que
    // o cálculo de calendário BRT dê o dia correto.
    const now = new Date();
    const TZ = "America/Sao_Paulo";
    // Meia-noite BRT de hoje
    const todayBRTStr = now.toLocaleDateString("sv-SE", { timeZone: TZ }); // "YYYY-MM-DD"
    const todayBRTMidnight = new Date(`${todayBRTStr}T00:00:00-03:00`);
    const startsAt = startDay > 1
      ? new Date(todayBRTMidnight.getTime() - (startDay - 1) * 86400000)
      : now;
    const expiresAt = new Date(startsAt.getTime() + opts.days * 86400000);

    // Encontrar ou criar o título "Pilar da Comunidade"
    let titleItem = await prisma.shopItem.findFirst({
      where: { name: "Pilar da Comunidade", type: "TITLE" },
    });

    if (!titleItem) {
      titleItem = await prisma.shopItem.create({
        data: {
          type: "TITLE",
          name: "Pilar da Comunidade",
          description: "Concedido a quem ajuda a manter a Liga Zikachu online.",
          rarity: "MYTHIC",
          price: 0,
          active: false, // não aparece na loja — só via VIP
          theme: "ELECTRIC",
          flavorText: "Sem você, as luzes se apagariam.",
          entranceEffect: "PILAR_DA_COMUNIDADE",
          sortOrder: 999,
          createdById: admin!.id,
        },
      });
    }

    // Conceder título ao jogador
    const existingTitle = await prisma.playerInventory.findUnique({
      where: { playerId_itemId: { playerId: opts.playerId, itemId: titleItem.id } },
    });
    if (!existingTitle) {
      await prisma.playerInventory.create({
        data: { playerId: opts.playerId, itemId: titleItem.id, quantity: 1, source: "VIP_PASS" },
      });
    }

    const passLabel = opts.passLabel?.trim() || "Passe Apoiador";
    const passSchedule = await prisma.passScheduleConfig.findUnique({
      where: { id: passLabel === "Passe Apoiador" ? "singleton" : passLabel },
      select: { allowRetroactiveClaims: true },
    }).catch(() => null);

    const pass = await prisma.supporterPass.create({
      data: {
        playerId: opts.playerId,
        passLabel,
        startsAt,
        expiresAt,
        allowRetroactiveClaims: passSchedule?.allowRetroactiveClaims ?? false,
        titleItemId: titleItem.id,
        createdByAdminId: admin?.id,
      },
    });

    // Pré-criar claims para dias anteriores ao startDay (sem entregar recompensas)
    if (startDay > 1) {
      const activeSchedule = await getActiveSchedule(passLabel);
      await prisma.supporterPassClaim.createMany({
        data: Array.from({ length: startDay - 1 }, (_, i) => {
          const day = i + 1;
          const reward = activeSchedule.find(r => r.day === day);
          return {
            passId: pass.id,
            playerId: opts.playerId,
            dayNumber: day,
            rewardType: "DEBUG_SKIP",
            rewardPayload: {
              skipped: true,
              originalReward: reward ?? null,
              reason: `Passe iniciado no dia ${startDay} pelo admin`,
            },
          };
        }),
      });
    }

    await prisma.auditLog.create({
      data: {
        actorUserId: admin!.id,
        action: "VIP_GRANTED",
        entityType: "SupporterPass",
        entityId: pass.id,
        metadata: { playerId: opts.playerId, playerName: player.displayName, days: opts.days, startDay, expiresAt },
      },
    });

    revalidatePath("/admin");
    revalidatePath("/passe-apoiador");
    return { ok: true, passId: pass.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ── Admin: revogar VIP ────────────────────────────────────────────────────────

export async function adminGrantVipToAll(opts: {
  days: number;
  startDay?: number;
  passLabel?: string;
  skipExisting?: boolean;
}): Promise<{ ok: boolean; granted: number; skipped: number; total: number; error?: string }> {
  try {
    await requireAdmin();
    const days = Math.max(1, Math.min(365, Math.floor(opts.days)));
    const passLabel = opts.passLabel?.trim() || "Passe Apoiador";
    const startDay = Math.max(1, Math.min(30, opts.startDay ?? 1));
    const skipExisting = opts.skipExisting ?? true;

    const players = await prisma.player.findMany({
      where: { user: { status: "ACTIVE" } },
      select: { id: true },
      orderBy: { displayName: "asc" },
    });

    const existingPlayerIds = skipExisting
      ? new Set((await prisma.supporterPass.findMany({
          where: {
            active: true,
            passLabel,
            expiresAt: { gt: new Date() },
            playerId: { in: players.map((p) => p.id) },
          },
          select: { playerId: true },
        })).map((pass) => pass.playerId))
      : new Set<string>();

    let granted = 0;
    let skipped = 0;
    for (const player of players) {
      if (existingPlayerIds.has(player.id)) {
        skipped++;
        continue;
      }
      const result = await adminGrantVip({ playerId: player.id, days, startDay, passLabel });
      if (result.ok) granted++;
      else skipped++;
    }

    revalidatePath("/admin");
    revalidatePath("/passe-apoiador");
    return { ok: true, granted, skipped, total: players.length };
  } catch (err) {
    return { ok: false, granted: 0, skipped: 0, total: 0, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function adminRevokeVip(passId: string, reason?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = await getSessionUser();
    await requireAdmin();

    const pass = await prisma.supporterPass.findUnique({
      where: { id: passId },
      include: { player: { select: { id: true, displayName: true, inventory: { where: { source: "VIP_PASS" }, select: { id: true, itemId: true, equipped: true } } } } },
    });
    if (!pass) return { ok: false, error: "Passe não encontrado." };

    // O jogador mantém o título (com intro no perfil) enquanto tiver QUALQUER
    // outro passe ativo e não expirado — o título é um brinde compartilhado
    // por todos os passes, não exclusivo deste.
    const otherActivePass = await prisma.supporterPass.findFirst({
      where: { playerId: pass.playerId, active: true, id: { not: passId }, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    const titleItemId = pass.titleItemId
      ?? (await prisma.shopItem.findFirst({ where: { name: "Pilar da Comunidade", type: "TITLE" }, select: { id: true } }))?.id
      ?? null;

    await prisma.$transaction(async (tx) => {
      // Desativa passe
      await tx.supporterPass.update({
        where: { id: passId },
        data: { active: false, revokedAt: new Date(), revokedByAdminId: admin?.id, revokeReason: reason ?? null },
      });

      // Remove itens VIP do inventário (e desequipa se equipado).
      // Preserva o título se houver outro passe ativo.
      for (const inv of pass.player.inventory) {
        if (inv.itemId === titleItemId && otherActivePass) continue; // mantém o título
        if (inv.equipped) {
          await tx.playerInventory.update({ where: { id: inv.id }, data: { equipped: false } });
        }
        await tx.playerInventory.delete({ where: { id: inv.id } });
      }
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: admin!.id,
        action: "VIP_REVOKED",
        entityType: "SupporterPass",
        entityId: passId,
        metadata: { playerId: pass.playerId, playerName: pass.player.displayName, reason },
      },
    });

    revalidatePath("/admin");
    revalidatePath("/passe-apoiador");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ── Admin: listar VIPs ativos ─────────────────────────────────────────────────

export async function adminListActiveVips(): Promise<{
  passes: { id: string; player: { id: string; displayName: string }; passLabel: string; startsAt: Date; expiresAt: Date; claimsCount: number; allowRetroactiveClaims: boolean }[];
  error?: string;
}> {
  try {
    await requireAdmin();
    const now = new Date();
    await deactivateExpiredSupporterPasses(now);
    const passes = await prisma.supporterPass.findMany({
      where: { active: true, expiresAt: { gt: now } },
      include: {
        player: { select: { id: true, displayName: true } },
        _count: { select: { claims: true } },
      },
      orderBy: { expiresAt: "asc" },
    });
    return {
      passes: passes.map(p => ({
        id: p.id,
        player: p.player,
        passLabel: p.passLabel ?? "Passe Apoiador",
        startsAt: p.startsAt,
        expiresAt: p.expiresAt,
        claimsCount: p._count.claims,
        allowRetroactiveClaims: p.allowRetroactiveClaims,
      })),
    };
  } catch (err) {
    return { passes: [], error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function adminSetRetroactiveClaims(passId: string, allow: boolean): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    await prisma.supporterPass.update({
      where: { id: passId },
      data: { allowRetroactiveClaims: allow },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function adminSetRetroactiveClaimsByLabel(label: string, allow: boolean): Promise<{ ok: boolean; updated: number; error?: string }> {
  try {
    const admin = await getSessionUser();
    await requireAdmin();
    const id = label === "Passe Apoiador" ? "singleton" : label;
    const fallback = PASS_SCHEDULE_DEFAULTS[label] ?? PASS_SCHEDULE;
    const [result] = await prisma.$transaction([
      prisma.supporterPass.updateMany({
        where: { active: true, expiresAt: { gt: new Date() }, passLabel: label },
        data: { allowRetroactiveClaims: allow },
      }),
      prisma.passScheduleConfig.upsert({
        where: { id },
        create: {
          id,
          schedule: fallback as object[],
          allowRetroactiveClaims: allow,
          updatedBy: admin?.id,
        },
        update: {
          allowRetroactiveClaims: allow,
          updatedBy: admin?.id,
        },
      }),
    ]);
    revalidatePath("/admin");
    revalidatePath("/passe-apoiador");
    return { ok: true, updated: result.count };
  } catch (err) {
    return { ok: false, updated: 0, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function adminSetPassScheduleRetroactive(label: string, allow: boolean): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = await getSessionUser();
    await requireAdmin();
    const id = label === "Passe Apoiador" ? "singleton" : label;
    const fallback = PASS_SCHEDULE_DEFAULTS[label] ?? PASS_SCHEDULE;
    await prisma.passScheduleConfig.upsert({
      where: { id },
      create: {
        id,
        schedule: fallback as object[],
        allowRetroactiveClaims: allow,
        updatedBy: admin?.id,
      },
      update: {
        allowRetroactiveClaims: allow,
        updatedBy: admin?.id,
      },
    });
    revalidatePath("/admin");
    revalidatePath("/passe-apoiador");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function adminSavePassDisplayConfig(
  label: string,
  data: { displayTitle: string; description: string; flavorText: string }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = await getSessionUser();
    await requireAdmin();
    const cleanLabel = label.trim() || "Passe Apoiador";
    const id = cleanLabel === "Passe Apoiador" ? "singleton" : cleanLabel;
    const fallback = PASS_SCHEDULE_DEFAULTS[cleanLabel] ?? PASS_SCHEDULE;
    await prisma.passScheduleConfig.upsert({
      where: { id },
      create: {
        id,
        schedule: fallback as object[],
        displayTitle: data.displayTitle.trim().slice(0, 80) || null,
        description: data.description.trim().slice(0, 160) || null,
        flavorText: data.flavorText.trim().slice(0, 220) || null,
        updatedBy: admin?.id,
      },
      update: {
        displayTitle: data.displayTitle.trim().slice(0, 80) || null,
        description: data.description.trim().slice(0, 160) || null,
        flavorText: data.flavorText.trim().slice(0, 220) || null,
        updatedBy: admin?.id,
      },
    });
    revalidatePath("/admin");
    revalidatePath("/passe-apoiador");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao salvar descrição." };
  }
}

export async function adminSetRetroactiveClaimsAll(allow: boolean): Promise<{ ok: boolean; updated: number; error?: string }> {
  try {
    await requireAdmin();
    const result = await prisma.supporterPass.updateMany({
      where: { active: true, expiresAt: { gt: new Date() } },
      data: { allowRetroactiveClaims: allow },
    });
    return { ok: true, updated: result.count };
  } catch (err) {
    return { ok: false, updated: 0, error: err instanceof Error ? err.message : "Erro" };
  }
}
