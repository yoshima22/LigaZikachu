"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import { getJohtoInvitationAdminSummary, JOHTO_INVITATION_PUSH, prepareJohtoInvitationCampaign } from "@/lib/johto-invitation";
import { sendNotificationToUsers } from "@/lib/notifications";
import {
  claimJohtoMascotReward, createJohtoEvent, getJohtoEvent, getJohtoReplay, grantLeaderRewards, isJohtoRaidVisibleToPlayers, openNextLeaderWindow,
  previewLeaderRewards, runJohtoRaidAttack, setJohtoRaidVisible, simulateJohtoTest, useJohtoRaidShield,
} from "@/lib/johto-raid";

const PATH = "/combates/raid-johto";
const refresh = () => { revalidatePath(PATH); revalidatePath("/admin"); revalidatePath("/mascotes"); };

async function requireAdminUser() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) return null;
  return user;
}

function readTeam(formData: FormData) {
  const mascotIds = formData.getAll("mascotId").map((id) => String(id)).filter(Boolean);
  const roles = Object.fromEntries(mascotIds.map((id) => [id, String(formData.get(`role:${id}`) ?? "ATTACKER")]));
  return { mascotIds, roles };
}

/** Ataque de jogador: só vale com a página liberada (ou conta de admin). */
export async function attackJohtoRaidAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, message: "Faça login novamente." };
  if (!isAdmin(user.role) && !(await isJohtoRaidVisibleToPlayers())) return { ok: false as const, message: "Esta raid ainda não foi liberada." };
  const { mascotIds, roles } = readTeam(formData);
  const result = await runJohtoRaidAttack(user.id, mascotIds, roles);
  refresh();
  return result;
}

/** Replay de um dos últimos combates (qualquer jogador com acesso à página). */
export async function getJohtoReplayAction(attemptId: string) {
  const user = await getSessionUser();
  if (!user) return null;
  if (!isAdmin(user.role) && !(await isJohtoRaidVisibleToPlayers())) return null;
  return getJohtoReplay(String(attemptId).slice(0, 60));
}

/** Escolha do mascote de recompensa entre os seis do líder. */
export async function claimJohtoMascotAction(rewardId: string, pokemonId: number) {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Faça login novamente." };
  const result = await claimJohtoMascotReward(user.id, String(rewardId).slice(0, 60), Math.floor(Number(pokemonId)));
  refresh();
  return result;
}

/** Teste do admin: N simulações sem gravar nada, com estatísticas de combate e uma luta para assistir. */
export async function johtoTestBattleAction(formData: FormData) {
  const user = await requireAdminUser();
  if (!user) return { ok: false as const, message: "Apenas administradores." };
  const { mascotIds, roles } = readTeam(formData);
  const result = await simulateJohtoTest(user.id, mascotIds, roles, String(formData.get("leaderKey") ?? ""), Number(formData.get("runs") ?? 20), Math.max(0, Math.min(4, Math.floor(Number(formData.get("combo") ?? 0)))));
  if (!result.ok) return result;
  return { ok: true as const, message: `Simulação concluída (${result.summary.runs} lutas).`, test: result.summary };
}

type AdminResult = { ok: boolean; message: string };
const fail = (message: string): AdminResult => ({ ok: false, message });
const done = (message: string): AdminResult => { refresh(); return { ok: true, message }; };

export async function johtoAdminAction(
  command:
    | { type: "create"; reset?: boolean; hpPerLeader?: number }
    | { type: "visible"; value: boolean }
    | { type: "active"; value: boolean }
    | { type: "settings"; cooldownMinutes: number; damageScale: number; leaderDays: number }
    | { type: "extend"; hours: number }
    | { type: "testReward"; leaderKey: string; level: number }
    | { type: "resetMyChoice" }
    | { type: "unlockPlayer"; playerName: string }
    | { type: "leaderHp"; leaderKey: string; hp: number }
    | { type: "damage"; amount: number }
    | { type: "healCurrent" }
    | { type: "skipCurrent" }
    | { type: "resetProgress" }
    | { type: "resetMyCooldown" }
    | { type: "rewards"; leaderKey: string; deliver: boolean }
    | { type: "prepareInvitation" }
    | { type: "publishInvitation" }
    | { type: "sendInvitationTestPush" }
    | { type: "getInvitationAdminSummary" },
): Promise<AdminResult & { preview?: Awaited<ReturnType<typeof previewLeaderRewards>>; invitationSummary?: Awaited<ReturnType<typeof getJohtoInvitationAdminSummary>> }> {
  const user = await requireAdminUser();
  if (!user) return fail("Apenas administradores.");
  try {
    if (command.type === "getInvitationAdminSummary") {
      const invitationSummary = await getJohtoInvitationAdminSummary();
      return { ok: true, message: "Resumo do convite carregado.", invitationSummary };
    }
    if (command.type === "prepareInvitation" || command.type === "publishInvitation") {
      const publish = command.type === "publishInvitation";
      await prepareJohtoInvitationCampaign({ publish });
      return done(publish ? "Convite de Johto publicado." : "Convite de Johto preparado.");
    }
    if (command.type === "sendInvitationTestPush") {
      const result = await sendNotificationToUsers([user.id], {
        ...JOHTO_INVITATION_PUSH,
        data: { source: "johto-invitation-test" },
        category: "ANUNCIOS",
      });
      return result.sent > 0
        ? { ok: true, message: "Push de teste do convite enviado." }
        : fail("Nenhum push de teste foi entregue. Verifique o token e as preferências de anúncios.");
    }
    if (command.type === "create") {
      const event = await getJohtoEvent();
      if (event && !command.reset) return fail("O evento já existe. Use 'Recriar do zero' para apagá-lo.");
      await createJohtoEvent({ reset: Boolean(command.reset), hpPerLeader: command.hpPerLeader });
      return done(command.reset ? "Evento recriado do zero (8 líderes com 6 mascotes, HP cheio). Continua inativo." : "Evento criado. Continua inativo e oculto.");
    }
    if (command.type === "visible") {
      await setJohtoRaidVisible(Boolean(command.value));
      return done(command.value ? "Página LIBERADA para todos os jogadores." : "Página oculta: só administradores veem.");
    }
    const event = await getJohtoEvent();
    if (!event) return fail("Crie o evento primeiro.");
    const leaders = await prisma.johtoRaidLeader.findMany({ where: { eventId: event.id }, orderBy: { position: "asc" }, include: { mascots: { orderBy: { slot: "asc" } } } });
    const current = leaders.find((l) => l.startedAt && !l.defeatedAt && !l.escapedAt) ?? null;
    switch (command.type) {
      case "active": {
        if (command.value) {
          await prisma.johtoRaidEvent.update({ where: { id: event.id }, data: { active: true } });
          await openNextLeaderWindow(event.id);
          return done("Ataques ABERTOS. O prazo do líder atual começou a contar.");
        }
        await prisma.johtoRaidEvent.update({ where: { id: event.id }, data: { active: false } });
        return done("Ataques pausados (o prazo do líder continua correndo).");
      }
      case "settings": {
        const cooldownMinutes = Math.max(0, Math.min(1440, Math.floor(command.cooldownMinutes)));
        const damageScale = Math.max(0.1, Math.min(10000, Number(command.damageScale) || 10));
        const leaderDays = Math.max(1, Math.min(30, Math.floor(command.leaderDays) || 5));
        await prisma.johtoRaidEvent.update({ where: { id: event.id }, data: { cooldownMinutes, damageScale, leaderDays } });
        return done(`Salvo: espera ${cooldownMinutes} min · escala de dano ×${damageScale} · ${leaderDays} dia(s) por líder (vale para os próximos líderes).`);
      }
      case "leaderHp": {
        // Ajusta a vida total de um líder (ex.: os próximos da sequência). Mantém a proporção de vida que cada mascote já tem.
        const leader = leaders.find((l) => l.key === command.leaderKey);
        if (!leader) return fail("Líder não encontrado.");
        if (leader.defeatedAt || leader.escapedAt) return fail("Esse líder já foi resolvido.");
        const mascotHp = Math.max(60, Math.min(300_000_000, Math.floor(Number(command.hp) / 6)));
        for (const m of leader.mascots) {
          const fraction = m.hpMax > 0 ? m.hpCurrent / m.hpMax : 1;
          await prisma.johtoRaidLeaderMascot.update({ where: { id: m.id }, data: { hpMax: mascotHp, hpCurrent: m.hpCurrent <= 0 ? 0 : Math.max(1, Math.round(mascotHp * fraction)) } });
        }
        const rows = await prisma.johtoRaidLeaderMascot.findMany({ where: { leaderId: leader.id } });
        await prisma.johtoRaidLeader.update({ where: { id: leader.id }, data: { hpMax: mascotHp * 6, hpCurrent: rows.reduce((sum, m) => sum + m.hpCurrent, 0) } });
        return done(`${leader.key}: vida total ajustada para ${(mascotHp * 6).toLocaleString("pt-BR")} (${mascotHp.toLocaleString("pt-BR")} por mascote).`);
      }
      case "testReward": {
        // Debug: cria uma recompensa de teste (sem ZC/ovo) para a conta do admin poder testar o seletor.
        const me = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
        if (!me) return fail("Perfil não encontrado.");
        const level = Math.max(1, Math.min(100, Math.floor(command.level) || 55));
        await prisma.johtoRaidReward.create({ data: { eventId: event.id, leaderKey: command.leaderKey, playerId: me.id, tier: "TEST" + Date.now().toString(36).slice(-4).toUpperCase(), zc: 0, mascotLevel: level, egg: false } });
        return done(`Recompensa de teste criada para você (${command.leaderKey}, Nv.${level}). Ela aparece em "Suas recompensas dos líderes".`);
      }
      case "resetMyChoice": {
        const me = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
        if (!me) return fail("Perfil não encontrado.");
        const removed = await prisma.johtoRaidReward.deleteMany({ where: { eventId: event.id, playerId: me.id, tier: { startsWith: "TEST" } } });
        const reopened = await prisma.johtoRaidReward.updateMany({ where: { eventId: event.id, playerId: me.id, claimedAt: { not: null } }, data: { claimedAt: null, chosenPokemonId: null } });
        return done(`Sua escolha foi liberada: ${removed.count} recompensa(s) de teste apagada(s), ${reopened.count} reaberta(s). Mascotes já criados não são removidos.`);
      }
      case "unlockPlayer": {
        const name = String(command.playerName ?? "").trim();
        if (name.length < 2) return fail("Digite o nome do jogador.");
        const matches = await prisma.player.findMany({ where: { displayName: { equals: name, mode: "insensitive" } }, select: { id: true, displayName: true }, take: 2 });
        if (matches.length !== 1) return fail(matches.length === 0 ? "Jogador não encontrado (use o nome exato)." : "Mais de um jogador com esse nome.");
        const reopened = await prisma.johtoRaidReward.updateMany({ where: { eventId: event.id, playerId: matches[0].id, claimedAt: { not: null } }, data: { claimedAt: null, chosenPokemonId: null } });
        return done(`${matches[0].displayName}: ${reopened.count} escolha(s) liberada(s). O mascote já criado continua na conta dele (remova pelo painel de mascotes se necessário).`);
      }
      case "extend": {
        if (!current?.expiresAt) return fail("Nenhum líder com prazo aberto.");
        const hours = Math.max(-72, Math.min(240, Math.floor(command.hours)));
        await prisma.johtoRaidLeader.update({ where: { id: current.id }, data: { expiresAt: new Date(current.expiresAt.getTime() + hours * 3600_000) } });
        return done(`Prazo do líder atual ${hours >= 0 ? "estendido" : "reduzido"} em ${Math.abs(hours)}h.`);
      }
      case "damage": {
        if (!current) return fail("Nenhum líder em andamento.");
        let left = Math.max(1, Math.floor(command.amount));
        for (const m of current.mascots) {
          if (left <= 0) break;
          if (m.hpCurrent <= 0) continue;
          const dealt = Math.min(left, m.hpCurrent);
          left -= dealt;
          await prisma.johtoRaidLeaderMascot.update({ where: { id: m.id }, data: { hpCurrent: m.hpCurrent - dealt, ...(m.hpCurrent - dealt === 0 ? { defeatedAt: new Date() } : {}) } });
        }
        const rows = await prisma.johtoRaidLeaderMascot.findMany({ where: { leaderId: current.id } });
        const remaining = rows.reduce((sum, m) => sum + m.hpCurrent, 0);
        await prisma.johtoRaidLeader.update({ where: { id: current.id }, data: { hpCurrent: remaining, ...(remaining === 0 ? { defeatedAt: new Date() } : {}) } });
        if (remaining === 0) await openNextLeaderWindow(event.id);
        return done(`Debug: −${Math.floor(command.amount).toLocaleString("pt-BR")} HP no líder atual (sem ranking${remaining === 0 ? "; ele caiu, use 'Entregar prêmios' se quiser testar" : ""}).`);
      }
      case "healCurrent": {
        const target = current ?? [...leaders].reverse().find((l) => l.defeatedAt || l.escapedAt);
        if (!target) return fail("Sem líderes.");
        await prisma.$executeRaw`UPDATE johto_raid_leader_mascots SET "hpCurrent" = "hpMax", "defeatedAt" = NULL, "defeatedByPlayerId" = NULL WHERE "leaderId" = ${target.id}`;
        await prisma.johtoRaidLeader.update({
          where: { id: target.id },
          data: { hpCurrent: target.hpMax, defeatedAt: null, escapedAt: null, finalBlowPlayerId: null, startedAt: target.startedAt ?? new Date(), expiresAt: new Date(Date.now() + event.leaderDays * 86_400_000) },
        });
        await prisma.johtoRaidEvent.update({ where: { id: event.id }, data: { defeatedAt: null } });
        return done(`Debug: ${target.key} restaurado com os 6 mascotes e HP cheio (prazo reiniciado).`);
      }
      case "skipCurrent": {
        if (!current) return fail("Nenhum líder em andamento.");
        await prisma.$executeRaw`UPDATE johto_raid_leader_mascots SET "hpCurrent" = 0, "defeatedAt" = NOW() WHERE "leaderId" = ${current.id} AND "hpCurrent" > 0`;
        await prisma.johtoRaidLeader.update({ where: { id: current.id }, data: { hpCurrent: 0, defeatedAt: new Date(), finalBlowPlayerId: null } });
        const open = await prisma.johtoRaidLeader.count({ where: { eventId: event.id, defeatedAt: null, escapedAt: null } });
        if (open === 0) await prisma.johtoRaidEvent.update({ where: { id: event.id }, data: { defeatedAt: new Date(), active: false } });
        else await openNextLeaderWindow(event.id);
        return done("Debug: líder atual derrubado (sem golpe final atribuído). Prêmios não foram entregues automaticamente.");
      }
      case "resetProgress": {
        await prisma.$transaction([
          prisma.johtoRaidAttempt.deleteMany({ where: { eventId: event.id } }),
          prisma.johtoRaidReward.deleteMany({ where: { eventId: event.id } }),
          prisma.$executeRaw`DELETE FROM johto_raid_leader_stats WHERE "leaderId" IN (SELECT id FROM johto_raid_leaders WHERE "eventId" = ${event.id})`,
          prisma.$executeRaw`UPDATE johto_raid_leader_mascots SET "hpCurrent" = "hpMax", "defeatedAt" = NULL, "defeatedByPlayerId" = NULL WHERE "leaderId" IN (SELECT id FROM johto_raid_leaders WHERE "eventId" = ${event.id})`,
          prisma.$executeRaw`UPDATE johto_raid_leaders SET "hpCurrent" = "hpMax", "defeatedAt" = NULL, "escapedAt" = NULL, "finalBlowPlayerId" = NULL, "startedAt" = NULL, "expiresAt" = NULL, "rewardsGrantedAt" = NULL WHERE "eventId" = ${event.id}`,
          prisma.johtoRaidEvent.update({ where: { id: event.id }, data: { defeatedAt: null, active: false } }),
        ]);
        return done("Progresso zerado: 8 líderes com HP cheio, sem prazo, ranking/ataques/recompensas apagados. ZC e mascotes já entregues não são desfeitos.");
      }
      case "resetMyCooldown": {
        await prisma.johtoRaidAttempt.deleteMany({ where: { eventId: event.id, player: { userId: user.id } } });
        return done("Seu cooldown e seus ataques de teste foram limpos.");
      }
      case "rewards": {
        const leader = leaders.find((l) => l.key === command.leaderKey);
        if (!leader) return fail("Líder não encontrado.");
        const preview = await previewLeaderRewards(leader.id);
        if (!command.deliver) return { ok: true, message: `Prévia dos prêmios de ${leader.key} (${preview.length} recompensas).`, preview };
        if (!leader.defeatedAt) return { ok: false, message: "Esse líder ainda não foi derrotado: nada foi entregue.", preview };
        const result = await grantLeaderRewards(leader.id);
        refresh();
        return { ok: true, message: `Prêmios entregues: ${result.granted} novos (${result.total - result.granted} já tinham sido entregues).`, preview };
      }
    }
  } catch (error) {
    console.error("[JohtoRaid] admin", error);
    return fail(error instanceof Error ? error.message : "Erro inesperado.");
  }
}

/** Atendimento SUS dos mascotes derrotados na raid (mesmo da Arena Z). */
export async function healJohtoMascotSusAction(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  const mascotId = String(formData.get("mascotId") ?? "");
  const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!player || !mascotId) return;
  const { healMascotSus } = await import("@/lib/arena-z");
  await healMascotSus(player.id, mascotId);
  refresh();
}

/** Atendimento único para todos os mascotes que caíram na investida da Raid. */
export async function healAllJohtoMascotsSusAction(formData: FormData): Promise<{ ok: boolean; message?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Faça login novamente." };
  const mascotIds = formData.getAll("mascotId").map(String).filter(Boolean);
  const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!player || mascotIds.length === 0) return { ok: false, message: "Nenhum mascote ferido foi selecionado." };
  const { healMascotsSus } = await import("@/lib/arena-z");
  try {
    await healMascotsSus(player.id, mascotIds);
    refresh();
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Não foi possível recuperar os mascotes." };
  }
}

export async function useJohtoRaidShieldAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Faça login novamente." };
  const result = await useJohtoRaidShield(user.id, String(formData.get("mascotId") ?? ""));
  if (result.ok) refresh();
  return result;
}
