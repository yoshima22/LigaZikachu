// Amigo Oculto — camada de banco. Admin-only nesta etapa (getSsAdmin).
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { getSessionPlayer } from "@/lib/session";
import { DEFAULT_SS_CONFIG, brtDay, countCheckins, daysBetween, draw, earnedMimo, goalFor, hashSeed, levelFor, readConfig } from "./core";
import { MIMO_PAYLOAD, defaultGift, giftByKey } from "./catalog";
import { validateCard, type CardData } from "./cards";

export async function getSsAdmin() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) return null;
  const player = await getSessionPlayer(user.id);
  return player ? { userId: user.id, playerId: player.id, displayName: player.displayName } : null;
}

type Fail = { error: string };
const fail = (error: string): Fail => ({ error });

export async function createEdition(input: { name: string; startsOn: string; deliverAt: string }) {
  const deliverAt = new Date(input.deliverAt);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startsOn) || Number.isNaN(deliverAt.getTime())) return fail("Datas inválidas.");
  if (brtDay(deliverAt) < input.startsOn) return fail("A entrega precisa ser depois do início dos laços.");
  const e = await prisma.secretSantaEdition.create({ data: { name: input.name.trim().slice(0, 60) || "Amigo Oculto", startsOn: input.startsOn, deliverAt, configJson: DEFAULT_SS_CONFIG } });
  return { id: e.id };
}

export async function register(editionId: string, playerId: string, displayName: string) {
  const e = await prisma.secretSantaEdition.findUnique({ where: { id: editionId }, select: { phase: true } });
  if (!e || e.phase !== "REGISTRATION") return fail("As inscrições estão fechadas.");
  await prisma.secretSantaParticipant.upsert({ where: { editionId_playerId: { editionId, playerId } }, update: {}, create: { editionId, playerId, displayName } });
  return { ok: true };
}

export async function addBots(editionId: string, n: number) {
  const e = await prisma.secretSantaEdition.findUnique({ where: { id: editionId }, select: { phase: true } });
  if (!e || e.phase !== "REGISTRATION") return fail("Só dá para adicionar testadores antes do sorteio.");
  const have = await prisma.secretSantaParticipant.count({ where: { editionId } });
  await prisma.secretSantaParticipant.createMany({ data: Array.from({ length: Math.min(20, n) }, (_, i) => ({ editionId, displayName: `Testador ${have + i + 1}` })) });
  return { ok: true };
}

// Check-in diário (dia BRT). A condição `NOT ? dia` no UPDATE torna o duplo clique idempotente.
export async function checkin(participantId: string, dayOverride?: string) {
  const p = await prisma.secretSantaParticipant.findUnique({ where: { id: participantId }, include: { edition: true } });
  if (!p) return fail("Participante não encontrado.");
  // Dia livre só para depurar edições de teste.
  if (dayOverride && !p.edition.isTest) return fail("Dia livre só vale em edições de teste.");
  const day = dayOverride ?? brtDay(new Date());
  if (dayOverride && (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > brtDay(p.edition.deliverAt))) return fail("Dia fora da janela.");
  if (p.edition.phase !== "COLLECTING") return fail("Os laços só contam depois do sorteio e antes da entrega.");
  if (day < p.edition.startsOn) return fail("Os laços ainda não começaram.");
  const rows = await prisma.$executeRaw`UPDATE ss_participants SET "checkinsJson" = "checkinsJson" || to_jsonb(${day}::text) WHERE id = ${participantId} AND NOT ("checkinsJson" ? ${day})`;
  return { ok: true, counted: rows === 1 };
}

export async function runDraw(editionId: string) {
  const e = await prisma.secretSantaEdition.findUnique({ where: { id: editionId }, include: { participants: { select: { id: true } } } });
  if (!e || e.phase !== "REGISTRATION") return fail("O sorteio já foi feito ou a edição não existe.");
  const cfg = readConfig(e.configJson);
  if (e.participants.length < cfg.minParticipants) return fail(`Mínimo de ${cfg.minParticipants} inscritos (há ${e.participants.length}).`);
  const seed = randomBytes(16).toString("hex");
  const pairs = draw(e.participants.map((p) => p.id), seed);
  await prisma.$transaction([
    ...[...pairs].map(([id, recipientId]) => prisma.secretSantaParticipant.update({ where: { id }, data: { recipientId } })),
    prisma.secretSantaEdition.update({ where: { id: editionId }, data: { phase: "COLLECTING", drawnAt: new Date(), seed, seedHash: hashSeed(seed) } }),
  ]);
  return { ok: true };
}

// Estado coletivo: laços, meta e nível. `now` limita a janela de contagem ao dia atual/entrega.
export function collective(e: { startsOn: string; deliverAt: Date; configJson: unknown }, rows: { checkinsJson: unknown }[], now = new Date()) {
  const cfg = readConfig(e.configJson);
  const last = brtDay(e.deliverAt);
  const totalDays = daysBetween(e.startsOn, last);
  const goal = goalFor(rows.length, totalDays, cfg);
  const bonds = rows.reduce((s, r) => s + countCheckins(r.checkinsJson as string[], e.startsOn, last), 0);
  return { cfg, totalDays, elapsedDays: Math.min(totalDays, daysBetween(e.startsOn, brtDay(now))), goal, bonds, level: levelFor(bonds, goal, cfg) };
}

export async function saveBuild(participantId: string, giftKey: string, rawCard: unknown) {
  const p = await prisma.secretSantaParticipant.findUnique({ where: { id: participantId }, include: { edition: { include: { participants: { select: { checkinsJson: true } } } } } });
  if (!p) return fail("Participante não encontrado.");
  if (p.edition.phase !== "COLLECTING") return fail("A montagem abre após o sorteio e fecha na entrega.");
  // giftKey vazio = só o cartão (o presente fica para quando os laços liberarem algum nível).
  const gift = giftKey ? giftByKey(giftKey) : null;
  if (giftKey && !gift) return fail("Presente inválido.");
  if (gift && gift.tier > collective(p.edition, p.edition.participants).level) return fail("Esse presente ainda não foi liberado pelos laços da comunidade.");
  const v = validateCard(rawCard);
  if (!v.ok) return fail(v.error);
  await prisma.secretSantaParticipant.update({ where: { id: participantId }, data: { ...(gift ? { giftKey } : {}), cardJson: v.card, builtAt: new Date() } });
  return { ok: true };
}

// Entrega: fecha a edição, completa presentes que ficaram sem escolha e revela a seed. Os presentes
// só viram PlayerGift quando o recebedor abre o cartão (openCard).
export async function deliver(editionId: string) {
  const e = await prisma.secretSantaEdition.findUnique({ where: { id: editionId }, include: { participants: true } });
  if (!e || e.phase !== "COLLECTING") return fail("A edição precisa estar em contagem de laços.");
  const level = collective(e, e.participants).level;
  const fallbackCard: CardData = { greeting: "g1", lines: ["l2"], closing: "c2", background: "noite", sticker: "🎄" };
  await prisma.$transaction([
    ...e.participants.filter((p) => !p.giftKey || !p.cardJson).map((p) =>
      prisma.secretSantaParticipant.update({ where: { id: p.id }, data: { giftKey: p.giftKey ?? defaultGift(level).key, cardJson: (p.cardJson ?? fallbackCard) as Prisma.InputJsonValue } })),
    prisma.secretSantaEdition.update({ where: { id: editionId }, data: { phase: "DELIVERED", deliveredAt: new Date() } }),
  ]);
  return { ok: true };
}

export async function resetEdition(editionId: string) {
  const e = await prisma.secretSantaEdition.findUnique({ where: { id: editionId }, select: { isTest: true } });
  if (!e?.isTest) return fail("Só edições de teste podem ser apagadas.");
  await prisma.secretSantaEdition.delete({ where: { id: editionId } });
  return { ok: true };
}

// Recebedor abre o cartão que recebeu: cria o presente na Caixa (idempotente) e devolve cartão + presente.
export async function openCard(viewerParticipantId: string) {
  const me = await prisma.secretSantaParticipant.findUnique({ where: { id: viewerParticipantId }, include: { edition: true } });
  if (!me || me.edition.phase !== "DELIVERED") return fail("O cartão ainda não foi entregue.");
  const giver = await prisma.secretSantaParticipant.findFirst({ where: { editionId: me.editionId, recipientId: me.id } });
  if (!giver?.cardJson || !giver.giftKey) return fail("Nenhum cartão para você.");
  const gift = giftByKey(giver.giftKey);
  if (!gift) return fail("Presente inválido.");
  const rows = await prisma.secretSantaParticipant.findMany({ where: { editionId: me.editionId }, select: { checkinsJson: true } });
  const { cfg, totalDays } = collective(me.edition, rows);
  const mimo = earnedMimo(countCheckins(giver.checkinsJson as string[], me.edition.startsOn, brtDay(me.edition.deliverAt)), totalDays, cfg);
  let giftId = giver.deliveredGiftId;
  if (me.playerId && !giver.openedAt) {
    const p = gift.payload;
    const payload = { rewardKind: "TOURNAMENT_BOX", origin: "Amigo Oculto", ...p, food: (p.food ?? 0) + (mimo ? MIMO_PAYLOAD.food : 0), sweet: (p.sweet ?? 0) + (mimo ? MIMO_PAYLOAD.sweet : 0) };
    giftId = await prisma.$transaction(async (tx) => {
      const claimed = await tx.secretSantaParticipant.updateMany({ where: { id: giver.id, openedAt: null }, data: { openedAt: new Date() } });
      if (claimed.count !== 1) return giver.deliveredGiftId;
      const g = await tx.playerGift.create({ data: { playerId: me.playerId!, type: "CUSTOM", title: `🎁 Amigo oculto: ${gift.name}`, description: "Presente do seu amigo oculto. Abra o cartão para ver a mensagem!", payload: payload as Prisma.InputJsonValue } });
      await tx.secretSantaParticipant.update({ where: { id: giver.id }, data: { deliveredGiftId: g.id } });
      return g.id;
    });
  }
  return { card: giver.cardJson as CardData, gift: { name: gift.name, emoji: gift.emoji, tier: gift.tier }, mimo, giftId, delivered: Boolean(me.playerId) };
}

// Visão do painel admin: edição, coletivo e participantes (com quem tirou quem, só para admin).
export async function getView(editionId?: string) {
  const editions = await prisma.secretSantaEdition.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, phase: true } });
  const id = editionId ?? editions[0]?.id;
  if (!id) return { editions, edition: null };
  const e = await prisma.secretSantaEdition.findUnique({ where: { id }, include: { participants: { orderBy: { createdAt: "asc" } } } });
  if (!e) return { editions, edition: null };
  const col = collective(e, e.participants);
  const last = brtDay(e.deliverAt);
  const nameOf = new Map(e.participants.map((p) => [p.id, p.displayName]));
  return {
    editions,
    edition: {
      id: e.id, name: e.name, phase: e.phase, isTest: e.isTest, startsOn: e.startsOn, deliverAt: e.deliverAt.toISOString(), seedHash: e.seedHash, seed: e.phase === "DELIVERED" ? e.seed : null,
      ...col, today: brtDay(new Date()),
      participants: e.participants.map((p) => ({
        id: p.id, name: p.displayName, isBot: !p.playerId, recipient: p.recipientId ? nameOf.get(p.recipientId) ?? null : null,
        checkins: countCheckins(p.checkinsJson as string[], e.startsOn, last), days: p.checkinsJson as string[], checkedToday: (p.checkinsJson as string[]).includes(brtDay(new Date())),
        giftKey: p.giftKey, built: Boolean(p.builtAt), opened: Boolean(p.openedAt),
      })),
    },
  };
}

// Regras ajustáveis (antes da entrega): meta, faixas dos níveis e % de constância para o mimo.
export async function updateConfig(editionId: string, input: { goalPct: number; levels: number[]; mimoMinPct: number }) {
  const e = await prisma.secretSantaEdition.findUnique({ where: { id: editionId }, select: { phase: true, configJson: true } });
  if (!e || e.phase === "DELIVERED") return fail("Edição já entregue.");
  const l = input.levels;
  const sorted = l.length === 4 && l.every((x, i) => x > 0 && x <= 1.5 && (i === 0 || x > l[i - 1]));
  if (!(input.goalPct > 0 && input.goalPct <= 1) || !sorted || !(input.mimoMinPct >= 0 && input.mimoMinPct <= 1)) return fail("Valores inválidos (meta 1–100%, níveis crescentes, mimo 0–100%).");
  await prisma.secretSantaEdition.update({ where: { id: editionId }, data: { configJson: { ...readConfig(e.configJson), goalPct: input.goalPct, levels: l as [number, number, number, number], mimoMinPct: input.mimoMinPct } } });
  return { ok: true };
}

// Depuração (só edições de teste em contagem de laços): marca check-ins sem esperar os dias passarem.
export async function debugCheckins(editionId: string, mode: "random" | "clear" | "fill", pct = 0.7) {
  const e = await prisma.secretSantaEdition.findUnique({ where: { id: editionId }, include: { participants: { select: { id: true } } } });
  if (!e?.isTest) return fail("Só em edições de teste.");
  if (e.phase !== "COLLECTING") return fail("Disponível só durante a contagem de laços.");
  const last = brtDay(e.deliverAt);
  const days: string[] = [];
  for (let n = 0; n < daysBetween(e.startsOn, last) && n < 60; n++) days.push(new Date(Date.parse(`${e.startsOn}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10));
  await prisma.$transaction(e.participants.map((p) => prisma.secretSantaParticipant.update({
    where: { id: p.id },
    data: { checkinsJson: mode === "clear" ? [] : mode === "fill" ? days : days.filter(() => Math.random() < pct) },
  })));
  return { ok: true };
}
