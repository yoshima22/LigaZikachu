"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAdmin } from "@/lib/auth/permissions";
import { getSessionPlayer } from "@/lib/session";
import { creditCoins } from "@/lib/zikacoins";
import { ZikaCoinTxType } from "@prisma/client";
import type { DayReward } from "./schedule";
export type { DayReward } from "./schedule";
import { PASS_SCHEDULE } from "./schedule";

// ── Calendário: leitura com fallback para o hardcoded ─────────────────────────

export async function getActiveSchedule(): Promise<DayReward[]> {
  try {
    const cfg = await prisma.passScheduleConfig.findUnique({ where: { id: "singleton" } });
    if (cfg && Array.isArray(cfg.schedule) && (cfg.schedule as DayReward[]).length === 30) {
      return cfg.schedule as DayReward[];
    }
  } catch { /* tabela ainda não existe — usa fallback */ }
  return PASS_SCHEDULE;
}

export async function adminGetSchedule(): Promise<{ schedule: DayReward[]; isCustom: boolean }> {
  await requireAdmin();
  try {
    const cfg = await prisma.passScheduleConfig.findUnique({ where: { id: "singleton" } });
    if (cfg && Array.isArray(cfg.schedule) && (cfg.schedule as DayReward[]).length === 30) {
      return { schedule: cfg.schedule as DayReward[], isCustom: true };
    }
  } catch { /* fallback */ }
  return { schedule: PASS_SCHEDULE, isCustom: false };
}

export async function adminSaveSchedule(
  schedule: DayReward[]
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const user = await getSessionUser();
    if (schedule.length !== 30) return { ok: false, error: "O calendário precisa ter exatamente 30 dias." };

    await prisma.passScheduleConfig.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", schedule: schedule as object[], updatedBy: user?.id },
      update: { schedule: schedule as object[], updatedBy: user?.id },
    });

    revalidatePath("/admin");
    revalidatePath("/passe-apoiador");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao salvar." };
  }
}

export async function adminResetSchedule(): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    await prisma.passScheduleConfig.deleteMany({ where: { id: "singleton" } });
    revalidatePath("/admin");
    revalidatePath("/passe-apoiador");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao resetar." };
  }
}

// ── Status do passe do jogador logado ─────────────────────────────────────────

export type ActivePassSummary = {
  id: string;
  startsAt: Date;
  expiresAt: Date;
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
    isExpired: boolean;
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

    // Lista de todos os passes ativos para o seletor
    const allActiveRaw = await prisma.supporterPass.findMany({
      where: { playerId: player.id, active: true },
      select: { id: true, startsAt: true, expiresAt: true, _count: { select: { claims: true } } },
      orderBy: { createdAt: "desc" },
    });
    const now = new Date();
    const allActivePasses: ActivePassSummary[] = allActiveRaw.map(p => ({
      id: p.id,
      startsAt: p.startsAt,
      expiresAt: p.expiresAt,
      daysRemaining: Math.max(0, Math.ceil((p.expiresAt.getTime() - now.getTime()) / 86400000)),
      claimsCount: p._count.claims,
    }));

    // Seleciona o passe: pelo ID se fornecido, senão o mais recente ativo
    const pass = passId
      ? await prisma.supporterPass.findFirst({
          where: { id: passId, playerId: player.id, active: true },
          include: { claims: { select: { dayNumber: true, claimedAt: true }, orderBy: { dayNumber: "asc" } } },
        })
      : await prisma.supporterPass.findFirst({
          where: { playerId: player.id, active: true },
          include: { claims: { select: { dayNumber: true, claimedAt: true }, orderBy: { dayNumber: "asc" } } },
          orderBy: { createdAt: "desc" },
        });

    if (!pass) {
      const hadPass = await prisma.supporterPass.count({ where: { playerId: player.id } });
      return { ...empty, allActivePasses, isNewVip: hadPass === 0 };
    }

    const isExpired = now > pass.expiresAt || !pass.active;
    const msElapsed = Math.max(0, now.getTime() - pass.startsAt.getTime());
    const daysElapsed = Math.floor(msElapsed / 86400000);
    const daysRemaining = Math.max(0, Math.ceil((pass.expiresAt.getTime() - now.getTime()) / 86400000));
    const todayDay = Math.min(30, daysElapsed + 1);
    const alreadyClaimed = pass.claims.some(c => c.dayNumber === todayDay);
    const canClaimToday = !isExpired && !alreadyClaimed && todayDay >= 1 && todayDay <= 30;

    return {
      pass: { id: pass.id, active: pass.active, startsAt: pass.startsAt, expiresAt: pass.expiresAt, daysElapsed, daysRemaining, isExpired },
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

    // Verificar que o dia já chegou
    const msElapsed = Math.max(0, Date.now() - pass.startsAt.getTime());
    const currentDay = Math.min(30, Math.floor(msElapsed / 86400000) + 1);
    if (dayNumber > currentDay) return { ok: false, error: "Esse dia ainda não chegou." };
    if (dayNumber < 1 || dayNumber > 30) return { ok: false, error: "Dia inválido." };

    const activeSchedule = await getActiveSchedule();
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
        const shopItem = await tx.shopItem.findFirst({ where: { name: { contains: reward.shopItemName }, active: true } });
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
}): Promise<{ ok: boolean; passId?: string; error?: string }> {
  try {
    const admin = await getSessionUser();
    await requireAdmin();

    const player = await prisma.player.findUnique({ where: { id: opts.playerId }, select: { id: true, displayName: true } });
    if (!player) return { ok: false, error: "Jogador não encontrado." };

    const startDay = Math.max(1, Math.min(30, opts.startDay ?? 1));

    // Se startDay > 1, rewind startsAt para que "hoje" seja o dia startDay
    const now = new Date();
    const startsAt = startDay > 1
      ? new Date(now.getTime() - (startDay - 1) * 86400000)
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

    const pass = await prisma.supporterPass.create({
      data: {
        playerId: opts.playerId,
        startsAt,
        expiresAt,
        titleItemId: titleItem.id,
        createdByAdminId: admin?.id,
      },
    });

    // Pré-criar claims para dias anteriores ao startDay (sem entregar recompensas)
    if (startDay > 1) {
      const activeSchedule = await getActiveSchedule();
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

export async function adminRevokeVip(passId: string, reason?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = await getSessionUser();
    await requireAdmin();

    const pass = await prisma.supporterPass.findUnique({
      where: { id: passId },
      include: { player: { select: { id: true, displayName: true, inventory: { where: { source: "VIP_PASS" }, select: { id: true, itemId: true, equipped: true } } } } },
    });
    if (!pass) return { ok: false, error: "Passe não encontrado." };

    await prisma.$transaction(async (tx) => {
      // Desativa passe
      await tx.supporterPass.update({
        where: { id: passId },
        data: { active: false, revokedAt: new Date(), revokedByAdminId: admin?.id, revokeReason: reason ?? null },
      });

      // Remove título VIP do inventário (e desequipa se equipado)
      for (const inv of pass.player.inventory) {
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
  passes: { id: string; player: { id: string; displayName: string }; startsAt: Date; expiresAt: Date; claimsCount: number }[];
  error?: string;
}> {
  try {
    await requireAdmin();
    const passes = await prisma.supporterPass.findMany({
      where: { active: true },
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
        startsAt: p.startsAt,
        expiresAt: p.expiresAt,
        claimsCount: p._count.claims,
      })),
    };
  } catch (err) {
    return { passes: [], error: err instanceof Error ? err.message : "Erro" };
  }
}
