"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import {
  createJohtoEvent, getJohtoEvent, grantJohtoRaidRewards, isJohtoRaidVisibleToPlayers, previewJohtoRewards, runJohtoRaidAttack, setJohtoRaidVisible,
} from "@/lib/johto-raid";

const PATH = "/combates/raid-johto";
const refresh = () => { revalidatePath(PATH); revalidatePath("/admin"); revalidatePath("/mascotes"); };

async function requireAdminUser() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) return null;
  return user;
}

/** Ataque de jogador: só vale com a página liberada (ou conta de admin). */
export async function attackJohtoRaidAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, message: "Faça login novamente." };
  if (!isAdmin(user.role) && !(await isJohtoRaidVisibleToPlayers())) return { ok: false as const, message: "Esta raid ainda não foi liberada." };
  const mascotIds = formData.getAll("mascotId").map((id) => String(id)).filter(Boolean);
  const roles = Object.fromEntries(mascotIds.map((id) => [id, String(formData.get(`role:${id}`) ?? "ATTACKER")]));
  const result = await runJohtoRaidAttack(user.id, mascotIds, roles);
  refresh();
  return result;
}

type AdminResult = { ok: boolean; message: string };
const fail = (message: string): AdminResult => ({ ok: false, message });
const done = (message: string): AdminResult => { refresh(); return { ok: true, message }; };

export async function johtoAdminAction(
  command:
    | { type: "create"; reset?: boolean; hpPerLeader?: number }
    | { type: "visible"; value: boolean }
    | { type: "active"; value: boolean; durationHours?: number }
    | { type: "cooldown"; minutes: number }
    | { type: "damage"; amount: number }
    | { type: "healCurrent" }
    | { type: "skipCurrent" }
    | { type: "resetProgress" }
    | { type: "resetMyCooldown" }
    | { type: "grantRewards" },
): Promise<AdminResult & { preview?: Awaited<ReturnType<typeof previewJohtoRewards>> }> {
  const user = await requireAdminUser();
  if (!user) return fail("Apenas administradores.");
  try {
    if (command.type === "create") {
      const event = await getJohtoEvent();
      if (event && !command.reset) return fail("O evento já existe. Use 'Recriar do zero' para apagá-lo.");
      await createJohtoEvent({ reset: Boolean(command.reset), hpPerLeader: command.hpPerLeader });
      return done(command.reset ? "Evento recriado do zero (8 líderes, HP cheio). Continua inativo." : "Evento criado. Continua inativo e oculto.");
    }
    if (command.type === "visible") {
      await setJohtoRaidVisible(Boolean(command.value));
      return done(command.value ? "Página LIBERADA para todos os jogadores." : "Página oculta: só administradores veem.");
    }
    const event = await getJohtoEvent();
    if (!event) return fail("Crie o evento primeiro.");
    switch (command.type) {
      case "active": {
        const hours = Math.max(0, Math.min(24 * 14, Math.floor(command.durationHours ?? 0)));
        await prisma.johtoRaidEvent.update({
          where: { id: event.id },
          data: command.value
            ? { active: true, startsAt: event.startsAt ?? new Date(), endsAt: hours > 0 ? new Date(Date.now() + hours * 3600_000) : null }
            : { active: false },
        });
        return done(command.value ? `Ataques ABERTOS${hours ? ` por ${hours}h` : " (sem prazo)"}.` : "Ataques pausados.");
      }
      case "cooldown": {
        const minutes = Math.max(0, Math.min(1440, Math.floor(command.minutes)));
        await prisma.johtoRaidEvent.update({ where: { id: event.id }, data: { cooldownMinutes: minutes } });
        return done(`Espera entre ataques: ${minutes} min.`);
      }
      case "damage": {
        const amount = Math.max(1, Math.floor(command.amount));
        const row = await prisma.johtoRaidLeader.findFirst({ where: { eventId: event.id, hpCurrent: { gt: 0 } }, orderBy: { position: "asc" } });
        if (!row) return fail("Todos os líderes já caíram.");
        const hpCurrent = Math.max(0, row.hpCurrent - amount);
        await prisma.johtoRaidLeader.update({ where: { id: row.id }, data: { hpCurrent, defeatedAt: hpCurrent === 0 ? new Date() : null } });
        return done(`Debug: −${amount.toLocaleString("pt-BR")} HP no líder atual (sem ranking).`);
      }
      case "healCurrent": {
        const rows = await prisma.johtoRaidLeader.findMany({ where: { eventId: event.id }, orderBy: { position: "asc" } });
        const row = rows.find((r) => r.hpCurrent > 0) ?? [...rows].reverse().find((r) => r.hpCurrent <= 0);
        if (!row) return fail("Sem líderes.");
        await prisma.johtoRaidLeader.update({ where: { id: row.id }, data: { hpCurrent: row.hpMax, defeatedAt: null, finalBlowPlayerId: null } });
        await prisma.johtoRaidEvent.update({ where: { id: event.id }, data: { defeatedAt: null } });
        return done("Debug: líder restaurado com HP cheio.");
      }
      case "skipCurrent": {
        const row = await prisma.johtoRaidLeader.findFirst({ where: { eventId: event.id, hpCurrent: { gt: 0 } }, orderBy: { position: "asc" } });
        if (!row) return fail("Todos os líderes já caíram.");
        await prisma.johtoRaidLeader.update({ where: { id: row.id }, data: { hpCurrent: 0, defeatedAt: new Date(), finalBlowPlayerId: null } });
        const open = await prisma.johtoRaidLeader.count({ where: { eventId: event.id, hpCurrent: { gt: 0 } } });
        if (open === 0) await prisma.johtoRaidEvent.update({ where: { id: event.id }, data: { defeatedAt: new Date(), active: false } });
        return done("Debug: líder atual derrubado (sem golpe final atribuído).");
      }
      case "resetProgress": {
        await prisma.$transaction([
          prisma.johtoRaidAttempt.deleteMany({ where: { eventId: event.id } }),
          prisma.johtoRaidRanking.deleteMany({ where: { eventId: event.id } }),
          prisma.$executeRaw`UPDATE johto_raid_leaders SET "hpCurrent" = "hpMax", "defeatedAt" = NULL, "finalBlowPlayerId" = NULL WHERE "eventId" = ${event.id}`,
          prisma.johtoRaidEvent.update({ where: { id: event.id }, data: { defeatedAt: null, rewardsGrantedAt: null, active: false } }),
        ]);
        return done("Progresso zerado: líderes com HP cheio, ranking e ataques apagados. Prêmios já entregues não são desfeitos.");
      }
      case "resetMyCooldown": {
        await prisma.johtoRaidAttempt.deleteMany({ where: { eventId: event.id, player: { userId: user.id } } });
        return done("Seu cooldown e seus ataques de teste foram limpos.");
      }
      case "grantRewards": {
        const preview = await previewJohtoRewards(event.id);
        if (!event.defeatedAt) return { ok: false, message: "Prévia: os líderes ainda não caíram, nada foi entregue.", preview };
        const result = await grantJohtoRaidRewards(event.id);
        refresh();
        return { ok: true, message: `Prêmios entregues a ${result.granted} jogador(es) (${result.total - result.granted} já tinham recebido).`, preview };
      }
    }
  } catch (error) {
    console.error("[JohtoRaid] admin", error);
    return fail(error instanceof Error ? error.message : "Erro inesperado.");
  }
}

/** Só a prévia dos prêmios, com o ranking atual — não entrega nada. */
export async function previewJohtoRewardsAction() {
  if (!(await requireAdminUser())) return { ok: false as const, message: "Apenas administradores." };
  const event = await getJohtoEvent();
  if (!event) return { ok: false as const, message: "Crie o evento primeiro." };
  return { ok: true as const, preview: await previewJohtoRewards(event.id) };
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
