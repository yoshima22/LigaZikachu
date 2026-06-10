"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin, requireAdmin } from "@/lib/auth/permissions";
import { getSessionPlayer } from "@/lib/session";
import {
  addMascotToArenaTeam,
  adminSetMascotArenaState,
  adminRepairArenaStates,
  applyPassiveIncomeForPlayer,
  claimArenaTutorialBonus,
  createArenaTeam,
  deleteArenaTeam,
  getTeamTimeMultiplier,
  applyMultiplierToVault,
  healMascotSus,
  lockBotForTeam,
  purgeAdminArenaData,
  retireArenaTeam,
  runBotBattle,
  runOpportunisticAttack,
  runPvpBattle,
  markPvpDefenseSeenForTeam,
} from "@/lib/arena-z";
import type { ArenaDifficulty } from "@/lib/arena-z";

type ArenaStaleNotice = {
  attackerName?: string | null;
  happenedAt?: string | null;
  battleId?: string | null;
  message: string;
};

async function getCurrentPlayerId() {
  const user = await getSessionUser();
  if (!user) throw new Error("Nao autenticado.");
  const player = await getSessionPlayer(user.id);
  if (!player) throw new Error("Perfil de jogador nao encontrado.");
  return player.id;
}

async function checkTeamStaleFromIncomingAttack(
  playerId: string,
  teamId: string,
  knownUpdatedAt?: string | null,
): Promise<ArenaStaleNotice | null> {
  if (!knownUpdatedAt) return null;
  const knownDate = new Date(knownUpdatedAt);
  if (Number.isNaN(knownDate.getTime())) return null;

  const team = await prisma.arenaTeam.findUnique({
    where: { id: teamId },
    select: { playerId: true, updatedAt: true, status: true },
  });
  if (!team || team.playerId !== playerId) return null;
  if (team.updatedAt <= knownDate) return null;

  const battle = await prisma.arenaBattle.findFirst({
    where: {
      type: "PVP",
      defenseTeamId: teamId,
      defenderPlayerId: playerId,
      createdAt: { gt: knownDate },
    },
    include: { attackerPlayer: { select: { displayName: true, ptcglNick: true } } },
    orderBy: { createdAt: "desc" },
  });

  if (!battle) {
    return {
      message: "Sua equipe mudou depois que esta tela foi carregada. Atualize a Arena antes de iniciar outro combate.",
    };
  }

  const attackerName = battle.attackerPlayer?.displayName ?? battle.attackerPlayer?.ptcglNick ?? "outro jogador";
  return {
    attackerName,
    happenedAt: battle.createdAt.toISOString(),
    battleId: battle.id,
    message: `${attackerName} atacou sua equipe antes desta acao. Atualize para ver o combate resolvido e o estado atual do cofre/mascotes.`,
  };
}

export async function createArenaTeamAction(mascotIds: string[], name: string, roomLevel: number): Promise<{ error?: string }> {
  try {
    const playerId = await getCurrentPlayerId();
    const { ARENA_ROOMS } = await import("@/lib/arena-z");
    if (!ARENA_ROOMS.includes(roomLevel as typeof ARENA_ROOMS[number])) return { error: "Sala inválida." };
    await createArenaTeam(playerId, name, mascotIds, roomLevel as typeof ARENA_ROOMS[number]);
    revalidatePath("/arena-z");
    revalidatePath("/mascotes");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao criar equipe." };
  }
}

export async function addMascotToArenaTeamAction(teamId: string, mascotId: string): Promise<{ error?: string }> {
  try {
    const playerId = await getCurrentPlayerId();
    await addMascotToArenaTeam(playerId, teamId, mascotId);
    revalidatePath("/arena-z");
    revalidatePath("/mascotes");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao adicionar mascote." };
  }
}

export async function claimArenaTutorialBonusAction(): Promise<{ error?: string; claimed?: boolean }> {
  try {
    const playerId = await getCurrentPlayerId();
    return await claimArenaTutorialBonus(playerId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro." };
  }
}

export async function runBotBattleAction(teamId: string, difficulty: ArenaDifficulty = "normal"): Promise<{ error?: string; stale?: ArenaStaleNotice; result?: Awaited<ReturnType<typeof runBotBattle>> }> {
  try {
    const playerId = await getCurrentPlayerId();
    // Nota: NÃO fazemos checkTeamStaleFromIncomingAttack aqui porque lockBotAction
    // já o fez E porque o próprio lockBot muda updatedAt, causando falso positivo.
    // O bloqueio por PvP não-visto é tratado dentro de runBotBattle via getUnseenPvpAttack.
    const result = await runBotBattle(playerId, teamId, difficulty);
    // Não revalidamos aqui para que o modal de resultado/animação permaneça aberto.
    // O router.refresh() é chamado pelo cliente ao fechar o modal.
    return { result };
  } catch (err) {
    // blockedByUnseenPvp: converte em stale notice para mostrar modal de PvP não visto
    if (err instanceof Error && (err as Error & { blockedByUnseenPvp?: boolean; unseenPvp?: { attackerName: string; happenedAt: Date; battleId: string } }).blockedByUnseenPvp) {
      const pvp = (err as Error & { unseenPvp: { attackerName: string; happenedAt: Date; battleId: string } }).unseenPvp;
      return { stale: { attackerName: pvp.attackerName, happenedAt: pvp.happenedAt.toISOString(), battleId: pvp.battleId, message: err.message } };
    }
    return { error: err instanceof Error ? err.message : "Erro ao combater bot." };
  }
}

export async function runPvpBattleAction(attackTeamId: string, defenseTeamId: string, attackTeamKnownUpdatedAt?: string): Promise<{ error?: string; stale?: ArenaStaleNotice; result?: Awaited<ReturnType<typeof runPvpBattle>> }> {
  try {
    const playerId = await getCurrentPlayerId();
    const stale = await checkTeamStaleFromIncomingAttack(playerId, attackTeamId, attackTeamKnownUpdatedAt);
    if (stale) return { stale };
    const result = await runPvpBattle(playerId, attackTeamId, defenseTeamId);
    // Revalidação feita pelo cliente ao fechar o modal
    return { result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao resolver PvP." };
  }
}

export async function retireArenaTeamAction(teamId: string): Promise<{ error?: string; stale?: ArenaStaleNotice }> {
  try {
    const playerId = await getCurrentPlayerId();
    // Nota: NÃO fazemos checkTeamStaleFromIncomingAttack aqui — qualquer PvE anterior
    // muda updatedAt e causaria falso positivo. O bloqueio por PvP não-visto é tratado
    // dentro de retireArenaTeam via getUnseenPvpAttack (throw com unseenPvp).
    await retireArenaTeam(playerId, teamId);
    revalidatePath("/arena-z");
    revalidatePath("/mascotes");
    return {};
  } catch (err) {
    // Se a função lançou com unseenPvp, converte em stale notice
    if (err instanceof Error && (err as Error & { unseenPvp?: unknown }).unseenPvp) {
      const pvp = (err as Error & { unseenPvp: { attackerName: string; happenedAt: Date; battleId: string } }).unseenPvp;
      return { stale: { attackerName: pvp.attackerName, happenedAt: pvp.happenedAt.toISOString(), battleId: pvp.battleId, message: err.message } };
    }
    return { error: err instanceof Error ? err.message : "Erro ao retirar equipe." };
  }
}

/** Retorna detalhes de um combate PvP para exibição no modal "foi atacado" */
export async function getArenaBattleDetailsAction(battleId: string): Promise<{
  error?: string;
  battle?: {
    result: string;
    attackerName: string;
    defenderName: string;
    defenderWon: boolean;
    attackerWon: boolean;
    rounds: number;
    happenedAt: string;
    isCurrentUserDefender: boolean;
    // Loot do DEFENSOR: positivo = ganhou (vitória), negativo = perdeu (derrota)
    defenderLoot: { coins: number; exp: number; food: number; sweet: number } | null;
    // Recompensas extras de defesa
    defenseRewardCoins: number;
    defenderEgg: string | null;
    attackerEgg: string | null;
    // Resumo do turno em texto
    turnLines: string[];
    injuredCount: number;
  };
}> {
  try {
    const playerId = await getCurrentPlayerId();
    const battle = await prisma.arenaBattle.findUnique({
      where: { id: battleId },
      include: {
        attackerPlayer: { select: { displayName: true, ptcglNick: true } },
        defenderPlayer: { select: { displayName: true, ptcglNick: true } },
      },
    });
    if (!battle) return { error: "Batalha não encontrada." };
    // Garante que o jogador participou desta batalha
    if (battle.attackerPlayerId !== playerId && battle.defenderPlayerId !== playerId) {
      return { error: "Sem permissão." };
    }

    const attackerName = battle.attackerPlayer?.displayName ?? battle.attackerPlayer?.ptcglNick ?? "Atacante";
    const defenderName = battle.defenderPlayer?.displayName ?? battle.defenderPlayer?.ptcglNick ?? "Defensor";
    const defenderWon = battle.result === "DEFENDER_WIN";
    const attackerWon = battle.result === "ATTACKER_WIN";

    // Loot: stolen = o que o vencedor tirou do perdedor
    const loot = battle.lootResult as Record<string, unknown> | null;
    const stolen = loot?.stolen as { coins: number; exp: number; food: number; sweet: number } | undefined;
    // Do ponto de vista do defensor:
    //   Se defensor venceu → ganhou o "stolen" (tirou do atacante e adicionou ao cofre)
    //   Se atacante venceu → perdeu o "stolen" (foi tirado do seu cofre)
    const defenderLoot = stolen
      ? defenderWon
        ? stolen              // ganhou
        : { coins: -(stolen.coins), exp: -(stolen.exp), food: -(stolen.food), sweet: -(stolen.sweet) }  // perdeu
      : null;
    // Recompensas adicionais da defesa (armazenadas no lootResult pelo runPvpBattle)
    const defenseRewardCoins = (loot?.defenseRewardCoins as number | undefined) ?? 0;
    const defenderEgg = (loot?.defenderEgg as string | undefined) ?? null;
    const attackerEgg = (loot?.attackerEgg as string | undefined) ?? null;
    const isCurrentUserDefender = battle.defenderPlayerId === playerId;

    const log = Array.isArray(battle.turnLog)
      ? (battle.turnLog as Array<{ turn: number; actorName: string; targetName: string; damage: number; advantageApplied?: boolean }>)
      : [];
    const turnLines = log.slice(0, 15).map(t =>
      `T${t.turn}: ${t.actorName} → ${t.targetName} (${t.damage} dano${t.advantageApplied ? " ⚡" : ""})`
    );
    const injuredCount = Array.isArray(battle.injuredMascotIds) ? battle.injuredMascotIds.length : 0;

    return {
      battle: {
        result: battle.result,
        attackerName,
        defenderName,
        defenderWon,
        attackerWon,
        rounds: battle.rounds,
        happenedAt: battle.createdAt.toISOString(),
        isCurrentUserDefender,
        defenderLoot,
        defenseRewardCoins,
        defenderEgg,
        attackerEgg,
        turnLines,
        injuredCount,
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao buscar batalha." };
  }
}

/** Marca todos os ataques PvP desta equipe como vistos (chamado após o jogador visualizar o modal stale) */
export async function markPvpDefenseSeenAction(teamId: string): Promise<void> {
  try {
    await markPvpDefenseSeenForTeam(teamId);
    revalidatePath("/arena-z");
  } catch { /* silencioso */ }
}

export async function healMascotSusAction(mascotId: string): Promise<{ error?: string }> {
  try {
    const playerId = await getCurrentPlayerId();
    await healMascotSus(playerId, mascotId);
    revalidatePath("/arena-z");
    revalidatePath("/mascotes");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro no Atendimento SUS." };
  }
}

export async function applyPassiveIncomeAction(): Promise<void> {
  try {
    const user = await getSessionUser();
    if (!user) return;
    const player = await getSessionPlayer(user.id);
    if (!player) return;
    await applyPassiveIncomeForPlayer(player.id);
    revalidatePath("/arena-z");
  } catch { /* silencioso */ }
}

export async function deleteArenaTeamAction(teamId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Nao autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil nao encontrado." };
    const isAdminUser = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    await deleteArenaTeam(player.id, teamId, isAdminUser);
    revalidatePath("/arena-z");
    revalidatePath("/mascotes");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao remover equipe." };
  }
}

export async function purgeAdminArenaDataAction(): Promise<{ error?: string; teams?: number; battles?: number }> {
  try {
    await requireAdmin();
    const result = await purgeAdminArenaData();
    revalidatePath("/arena-z");
    return result;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro na limpeza." };
  }
}

export async function lockBotAction(teamId: string, difficulty: ArenaDifficulty = "normal"): Promise<{ error?: string; stale?: ArenaStaleNotice; result?: Awaited<ReturnType<typeof lockBotForTeam>> }> {
  try {
    const playerId = await getCurrentPlayerId();
    // Não fazemos checkTeamStaleFromIncomingAttack aqui — qualquer PvE anterior
    // muda updatedAt causando falso positivo. Bloqueio real por PvP não-visto é
    // tratado dentro de runBotBattle via getUnseenPvpAttack (throw blockedByUnseenPvp).
    const result = await lockBotForTeam(playerId, teamId, difficulty);
    revalidatePath("/arena-z");
    return { result };
  } catch (err) {
    // blockedByUnseenPvp: retorna como stale notice com battleId para abrir modal correto
    if (err instanceof Error && (err as Error & { blockedByUnseenPvp?: boolean; unseenPvp?: { attackerName: string; happenedAt: Date; battleId: string } }).blockedByUnseenPvp) {
      const pvp = (err as Error & { unseenPvp: { attackerName: string; happenedAt: Date; battleId: string } }).unseenPvp;
      return { stale: { attackerName: pvp.attackerName, happenedAt: pvp.happenedAt.toISOString(), battleId: pvp.battleId, message: err.message } };
    }
    return { error: err instanceof Error ? err.message : "Erro ao gerar adversario." };
  }
}

export async function runOpportunisticAttackAction(targetMascotId: string): Promise<{ error?: string; result?: Awaited<ReturnType<typeof runOpportunisticAttack>> }> {
  try {
    const playerId = await getCurrentPlayerId();
    const result = await runOpportunisticAttack(playerId, targetMascotId);
    revalidatePath("/arena-z");
    revalidatePath("/mascotes");
    return { result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao atacar." };
  }
}

export async function adminSetMascotStateAction(mascotId: string, state: "FREE" | "INJURED" | "RESTING"): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await adminSetMascotArenaState(mascotId, state);
    revalidatePath("/arena-z");
    revalidatePath("/mascotes");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao alterar estado." };
  }
}

export async function adminRepairArenaAction(targetPlayerId?: string): Promise<{
  error?: string;
  fixedOrphanArena?: number;
  fixedExpiredResting?: number;
  deletedEmptyTeams?: number;
  fixedMismatchedTeamMembers?: number;
  details?: string[];
}> {
  try {
    await requireAdmin();
    const result = await adminRepairArenaStates(targetPlayerId);
    revalidatePath("/arena-z");
    revalidatePath("/mascotes");
    return result;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao reparar arena." };
  }
}
