"use server";

import { requireAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { sendDeckReminderEmail } from "@/lib/email";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://liga-zikachu.vercel.app";

export async function triggerDeckReminder(dryRun = false): Promise<
  | { weeksChecked: number; emailsSent: number; simulated: number; errors: number; details: Array<{ email: string; week: string; status: string }>; dryRun: boolean }
  | { error: string }
> {
  try {
    await requireAdmin();

    const now   = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const weeks = await prisma.tournamentWeek.findMany({
      where: {
        deckLockAt: { gt: now, lte: in24h },
        tournament: { status: "IN_PROGRESS", requiresDeckSubmission: true },
      },
      select: {
        id: true,
        weekNumber: true,
        label: true,
        deckLockAt: true,
        tournament: { select: { name: true, slug: true } },
        matches: {
          where: {
            status: { notIn: ["CONFIRMED", "CANCELED"] },
            isBye: false,
            playerBId: { not: null },
          },
          select: {
            id: true,
            scheduledAt: true,
            playerA: { select: { id: true, displayName: true, user: { select: { email: true } } } },
            playerB: { select: { id: true, displayName: true, user: { select: { email: true } } } },
          },
        },
        deckSubmissions: { select: { playerId: true } },
      },
    });

    const details: Array<{ email: string; week: string; status: string }> = [];

    for (const week of weeks) {
      const submittedIds = new Set(week.deckSubmissions.map((d) => d.playerId));
      const weekLabel    = week.label ?? `Semana ${week.weekNumber}`;
      const deckLink     = `${APP_URL}/torneios/${week.tournament.slug}/semanas/${week.weekNumber}`;
      const matchDate    = week.deckLockAt!;

      for (const match of week.matches) {
        const pairs = [
          { player: match.playerA, opponent: match.playerB },
          { player: match.playerB, opponent: match.playerA },
        ] as const;

        for (const { player, opponent } of pairs) {
          if (!player || !opponent) continue;
          if (submittedIds.has(player.id)) continue;
          if (!player.user.email) continue;

          if (dryRun) {
            details.push({ email: player.user.email, week: weekLabel, status: "simulado" });
            continue;
          }

          const { error } = await sendDeckReminderEmail({
            to:             player.user.email,
            playerName:     player.displayName,
            opponentName:   opponent.displayName,
            matchDate:      match.scheduledAt ?? matchDate,
            tournamentName: week.tournament.name,
            weekLabel,
            deckLink,
          });

          details.push({
            email:  player.user.email,
            week:   weekLabel,
            status: error ? `erro: ${error}` : "enviado",
          });
        }
      }
    }

    return {
      weeksChecked: weeks.length,
      emailsSent:   dryRun ? 0 : details.filter((d) => d.status === "enviado").length,
      simulated:    dryRun ? details.length : 0,
      errors:       details.filter((d) => d.status.startsWith("erro")).length,
      details,
      dryRun,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ── Envio de teste para um jogador específico ─────────────────────────────────

export async function sendTestDeckReminder(
  playerId: string
): Promise<{ ok: boolean; to: string; usedRealMatch: boolean; error?: string }> {
  try {
    await requireAdmin();

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        displayName: true,
        user: { select: { email: true } },
      },
    });
    if (!player)            return { ok: false, to: "", usedRealMatch: false, error: "Jogador não encontrado." };
    if (!player.user.email) return { ok: false, to: "", usedRealMatch: false, error: "Este jogador não tem e-mail cadastrado." };

    const now   = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // Tenta encontrar uma partida real pendente do jogador nas próximas 48h
    const realMatch = await prisma.match.findFirst({
      where: {
        OR: [{ playerAId: playerId }, { playerBId: playerId }],
        status: { notIn: ["CONFIRMED", "CANCELED"] },
        isBye: false,
        playerBId: { not: null },
        tournamentWeekId: { not: null },
      },
      include: {
        playerA:        { select: { id: true, displayName: true } },
        playerB:        { select: { id: true, displayName: true } },
        tournamentWeek: {
          select: {
            weekNumber: true, label: true, deckLockAt: true,
            tournament: { select: { name: true, slug: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    let emailParams: Parameters<typeof sendDeckReminderEmail>[0];
    let usedRealMatch = false;

    if (realMatch?.tournamentWeek) {
      const week     = realMatch.tournamentWeek;
      const opponent = realMatch.playerAId === playerId ? realMatch.playerB : realMatch.playerA;
      usedRealMatch  = true;
      emailParams    = {
        to:             player.user.email,
        playerName:     player.displayName,
        opponentName:   opponent?.displayName ?? "Adversário",
        matchDate:      realMatch.scheduledAt ?? week.deckLockAt ?? in48h,
        tournamentName: week.tournament.name,
        weekLabel:      week.label ?? `Semana ${week.weekNumber}`,
        deckLink:       `${APP_URL}/torneios/${week.tournament.slug}/semanas/${week.weekNumber}`,
      };
    } else {
      // Sem partida real — usa dados de exemplo para testar o template
      const anyTournament = await prisma.tournament.findFirst({
        where: { status: "IN_PROGRESS" },
        select: { name: true, slug: true },
      });
      emailParams = {
        to:             player.user.email,
        playerName:     player.displayName,
        opponentName:   "Adversário de Teste",
        matchDate:      new Date(now.getTime() + 6 * 60 * 60 * 1000),
        tournamentName: anyTournament?.name ?? "Liga Zikachu",
        weekLabel:      "Semana de Teste",
        deckLink:       anyTournament
          ? `${APP_URL}/torneios/${anyTournament.slug}`
          : `${APP_URL}/torneios`,
      };
    }

    const { error } = await sendDeckReminderEmail(emailParams);
    if (error) return { ok: false, to: player.user.email, usedRealMatch, error };

    return { ok: true, to: player.user.email, usedRealMatch };
  } catch (err) {
    return { ok: false, to: "", usedRealMatch: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ── Envio de item para TODOS os jogadores ─────────────────────────────────────
export async function sendItemToAllPlayers(
  itemId: string
): Promise<{ sent: number; skipped: number; error?: string }> {
  try {
    await requireAdmin();

    const item = await prisma.shopItem.findUnique({ where: { id: itemId } });
    if (!item) return { sent: 0, skipped: 0, error: "Item não encontrado." };

    const players = await prisma.player.findMany({
      where: { user: { status: "ACTIVE" } },
      select: { id: true }
    });

    const EGG_MAP: Record<string, string> = {
      EGG_COMMON: "COMMON", EGG_RARE: "RARE", EGG_SPECIAL: "SPECIAL",
      EGG_GEN1: "EGG_GEN1", EGG_GEN2: "EGG_GEN2"
    };
    const BUFF_TYPES = ["MASCOT_BUFF_EXP","MASCOT_BUFF_STAT","MASCOT_BUFF_HAPPY","MASCOT_BUFF_LUCK","MASCOT_BUFF_MOOD"];

    const itemName = item.name;
    // Monta o payload do gift baseado no tipo do item
    function buildGiftPayload(type: string): Record<string, unknown> | null {
      if (EGG_MAP[type]) return { rewardKind: "MASCOT_EGG", eggType: EGG_MAP[type], origin: "Enviado pelo Admin", rewardLabel: itemName };
      if (type === "MASCOT_FOOD")  return { rewardKind: "MASCOT_FOOD", foodType: "FOOD",  quantity: 1, rewardLabel: itemName };
      if (type === "MASCOT_SWEET") return { rewardKind: "MASCOT_FOOD", foodType: "SWEET", quantity: 1, rewardLabel: itemName };
      if (BUFF_TYPES.includes(type)) return { rewardKind: "MASCOT_BUFF", buffType: type, rewardLabel: itemName };
      return null;
    }

    const giftPayload = buildGiftPayload(item.type);
    const isConsumable = !!giftPayload;

    let sent = 0, skipped = 0;

    for (const player of players) {
      try {
        if (isConsumable) {
          // Consumíveis → Caixa de Presentes
          await prisma.playerGift.create({
            data: {
              playerId: player.id,
              type: "CUSTOM",
              title: item.name,
              description: `${item.name} enviado pelo admin para todos os jogadores.`,
              payload: giftPayload as import("@prisma/client").Prisma.InputJsonValue
            }
          });
          sent++;
        } else {
          // Cosméticos → PlayerInventory (pula se já possui)
          const existing = await prisma.playerInventory.findUnique({
            where: { playerId_itemId: { playerId: player.id, itemId } }
          });
          if (existing) { skipped++; continue; }
          await prisma.playerInventory.create({ data: { playerId: player.id, itemId } });
          sent++;
        }
      } catch { skipped++; }
    }

    return { sent, skipped };
  } catch (err) {
    return { sent: 0, skipped: 0, error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ── Trigger manual: eventos sociais de mascotes ───────────────────────────────
export async function triggerMascotSocialEvents(): Promise<{ battles: number; friendships: number; pairs: number; error?: string }> {
  try {
    await requireAdmin();
    const secret = process.env.CRON_SECRET ?? "";
    const baseUrl = process.env.NEXTAUTH_URL ?? "https://liga-zikachu.vercel.app";
    const res = await fetch(`${baseUrl}/api/cron/mascot-social`, {
      headers: { Authorization: `Bearer ${secret}` }
    });
    const data = await res.json() as { battles?: number; friendships?: number; pairs?: number; error?: string };
    if (!res.ok) return { battles: 0, friendships: 0, pairs: 0, error: data.error ?? "Erro" };
    return { battles: data.battles ?? 0, friendships: data.friendships ?? 0, pairs: data.pairs ?? 0 };
  } catch (err) {
    return { battles: 0, friendships: 0, pairs: 0, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ── Limpar expedições bugadas de um jogador ────────────────────────────────────
export async function clearPlayerExpeditions(playerId: string): Promise<{ cleared: number; error?: string }> {
  try {
    await requireAdmin();
    const result = await prisma.mascotExpedition.updateMany({
      where: { mascot: { playerId }, status: "ACTIVE" },
      data: { status: "CLAIMED", rewardJson: { type: "NOTHING" } }
    });
    return { cleared: result.count };
  } catch (err) {
    return { cleared: 0, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ── Reset de senha de usuário (admin) ─────────────────────────────────────────
export async function adminResetUserPassword(
  userId: string,
  newPassword: string
): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    if (newPassword.length < 8) return { error: "Senha deve ter ao menos 8 caracteres." };

    const { hashPassword } = await import("@/lib/auth/password");
    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, status: "ACTIVE" } // reativa conta junto se necessário
    });

    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ── Reativar conta de usuário bloqueado (admin) ───────────────────────────────
export async function adminReactivateUser(userId: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await prisma.user.update({ where: { id: userId }, data: { status: "ACTIVE" } });
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ── Listar mascotes de um jogador (admin) ─────────────────────────────────────
export async function getPlayerMascotsAdmin(playerId: string): Promise<{
  mascots: { id: string; pokemonId: number; nickname: string | null; level: number; isFavorite: boolean; isEquipped: boolean; arenaState: string; bazarListed: boolean; activeExpedition: boolean }[];
  error?: string;
}> {
  try {
    await requireAdmin();
    const mascots = await prisma.mascot.findMany({
      where: { playerId },
      select: {
        id: true, pokemonId: true, nickname: true, level: true,
        isFavorite: true, isEquipped: true, arenaState: true, bazarListed: true,
        expeditions: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 },
      },
      orderBy: [{ isFavorite: "desc" }, { isEquipped: "desc" }, { level: "desc" }],
    });
    return {
      mascots: mascots.map(m => ({
        id: m.id, pokemonId: m.pokemonId, nickname: m.nickname, level: m.level,
        isFavorite: m.isFavorite, isEquipped: m.isEquipped,
        arenaState: m.arenaState, bazarListed: m.bazarListed,
        activeExpedition: m.expeditions.length > 0,
      })),
    };
  } catch (err) {
    return { mascots: [], error: err instanceof Error ? err.message : "Erro" };
  }
}

// ── Completar expedição de um mascote (admin) — skip + claim com recompensa ───
export async function completeAdminExpeditionAction(
  playerId: string,
  mascotId: string,
): Promise<{ ok: boolean; reward?: unknown; error?: string }> {
  try {
    await requireAdmin();
    const { skipExpedition, claimExpedition } = await import("@/lib/mascot");

    const expedition = await prisma.mascotExpedition.findFirst({
      where: { mascotId, status: "ACTIVE" },
      select: { id: true, finishAt: true },
    });
    if (!expedition) return { ok: false, error: "Nenhuma expedição ativa encontrada para este mascote." };

    if (expedition.finishAt > new Date()) {
      await skipExpedition(expedition.id);
    }
    const { reward } = await claimExpedition(playerId, expedition.id);
    return { ok: true, reward };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ── Iniciar expedição em nome de um jogador (admin) ───────────────────────────
export async function startAdminExpeditionAction(
  playerId: string,
  mascotId: string,
  duration: import("@/lib/mascot-data").ExpeditionDuration,
  mode: import("@/lib/mascot-data").ExpeditionMode,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const { startExpedition } = await import("@/lib/mascot");
    await startExpedition(playerId, mascotId, duration, mode);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ── Diagnóstico + reset completo de um mascote travado ────────────────────────
export async function resetStuckMascotAction(mascotId: string): Promise<{
  ok: boolean;
  before?: Record<string, unknown>;
  fixed?: string[];
  error?: string;
}> {
  try {
    await requireAdmin();

    const mascot = await prisma.mascot.findUnique({
      where: { id: mascotId },
      select: {
        id: true, pokemonId: true, nickname: true, playerId: true,
        arenaState: true, injuredAt: true, restingUntil: true,
        bazarListed: true, isEquipped: true,
        expeditions: { select: { id: true, finishAt: true, status: true } },
      },
    });
    if (!mascot) return { ok: false, error: "Mascote não encontrado." };

    const activeExps = mascot.expeditions.filter(e => e.status === "ACTIVE");

    const before = {
      arenaState:        mascot.arenaState,
      isEquipped:        mascot.isEquipped,
      injuredAt:         mascot.injuredAt,
      restingUntil:      mascot.restingUntil,
      bazarListed:       mascot.bazarListed,
      activeExpeditions: activeExps.length,
      totalExpeditions:  mascot.expeditions.length,
    };

    const fixed: string[] = [];

    // 1. Encerra TODAS as expedições ACTIVE — direto no DB, sem validações
    if (activeExps.length > 0) {
      await prisma.mascotExpedition.updateMany({
        where: { id: { in: activeExps.map(e => e.id) } },
        data: { status: "CLAIMED", rewardJson: { type: "NOTHING", adminReset: true } },
      });
      fixed.push(`${activeExps.length} expedição(ões) ACTIVE encerrada(s) à força`);
    }

    // 2. Reset completo do mascote — um único update com tudo
    await prisma.mascot.update({
      where: { id: mascotId },
      data: {
        arenaState:   "FREE",
        isEquipped:   false,   // remove do slot de companheiro
        injuredAt:    null,
        restingUntil: null,
        bazarListed:  false,   // limpa flag (o anúncio em si continua no Bazar se existir)
      },
    });

    if (mascot.arenaState !== "FREE") fixed.push(`arenaState: ${mascot.arenaState} → FREE`);
    if (mascot.isEquipped)            fixed.push("isEquipped: true → false (removido do slot de companheiro)");
    if (mascot.injuredAt)             fixed.push("injuredAt limpo");
    if (mascot.restingUntil)          fixed.push("restingUntil limpo");
    if (mascot.bazarListed)           fixed.push("bazarListed: true → false");

    if (fixed.length === 0) fixed.push("Nenhum campo problemático encontrado — mas reset foi aplicado mesmo assim.");

    return { ok: true, before, fixed };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ── Limpeza de eventos de mascotes de admins ──────────────────────────────────

export async function cleanAdminMascotEvents(): Promise<{ deleted: number; error?: string }> {
  try {
    await requireAdmin();

    const adminRoles = ["ADMIN", "SUPER_ADMIN"] as import("@prisma/client").Role[];

    // Find all mascot IDs belonging to admin users
    const adminMascots = await prisma.mascot.findMany({
      where: {
        player: {
          user: { role: { in: adminRoles } }
        }
      },
      select: { id: true }
    });

    const adminMascotIds = adminMascots.map(m => m.id);
    if (adminMascotIds.length === 0) return { deleted: 0 };

    // Delete MascotEvent records for admin mascots
    const deletedEvents = await prisma.mascotEvent.deleteMany({
      where: { mascotId: { in: adminMascotIds } }
    });

    // Delete MascotRelation records where either mascot belongs to an admin
    const deletedRelations = await prisma.mascotRelation.deleteMany({
      where: {
        OR: [
          { mascotAId: { in: adminMascotIds } },
          { mascotBId: { in: adminMascotIds } },
        ]
      }
    });

    return { deleted: deletedEvents.count + deletedRelations.count };
  } catch (err) {
    return { deleted: 0, error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
