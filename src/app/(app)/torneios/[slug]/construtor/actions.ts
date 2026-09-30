"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAdmin } from "@/lib/auth/permissions";
import { getSessionPlayer } from "@/lib/session";
import { Prisma } from "@prisma/client";
import { buildMascotMissionOption, validateMascotMissionSubmission } from "@/lib/tcg-mascot-mission";
import { computePickAvailability } from "./rules";

// Modo Construtor (Semana 6): cada jogador registra 3 decks (nesta página).
// O adversário de cada partida escolhe qual dos 3 decks o jogador usará. O deck
// usado no Jogo 1 sai da escolha do Jogo 2; o adversário do Jogo 2 só escolhe
// depois que o Jogo 1 daquele jogador estiver totalmente revelado (ambos votaram).
// As escolhas de uma partida só são reveladas quando OS DOIS jogadores votaram.

async function viewer() {
  const user = await getSessionUser();
  if (!user) throw new Error("Não autenticado.");
  const player = await getSessionPlayer(user.id);
  if (!player) throw new Error("Perfil não encontrado.");
  return player;
}

async function requireConstrutorWeek(tournamentWeekId: string) {
  const week = await prisma.tournamentWeek.findUnique({
    where: { id: tournamentWeekId },
    select: {
      id: true, mode: true, weekNumber: true, deckLockAt: true, lockAt: true, endDate: true,
      tournament: { select: { id: true, slug: true, seasonId: true, mascotMissionEnabled: true, badges: { select: { id: true, name: true } } } },
    },
  });
  if (!week) throw new Error("Semana não encontrada.");
  if (week.mode !== "CONSTRUTOR_MISTERIOSO") throw new Error("Esta semana não é do modo Construtor.");
  return week;
}

type LiteMatch = { id: string; playerAId: string; playerBId: string | null; roundLabel: string | null; scheduledAt: Date | null };

async function orderedMatchesForPlayer(tournamentWeekId: string, playerId: string): Promise<LiteMatch[]> {
  const matches = await prisma.match.findMany({
    where: { tournamentWeekId, isBye: false, OR: [{ playerAId: playerId }, { playerBId: playerId }] },
    select: { id: true, playerAId: true, playerBId: true, roundLabel: true, scheduledAt: true },
  });
  // Ordena em JS: rótulos como "Jogo 10" vs "Jogo 2" precisam de ordem NUMÉRICA
  // (no banco viraria texto e o "Jogo 10" viria antes do "Jogo 2"). Como todos os
  // jogos do dia costumam ter o mesmo horário, o rótulo é o critério que decide.
  return matches.sort((a, b) => {
    const ta = a.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const tb = b.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (ta !== tb) return ta - tb;
    return (a.roundLabel ?? "").localeCompare(b.roundLabel ?? "", "pt-BR", { numeric: true }) || a.id.localeCompare(b.id);
  });
}

async function decksOf(tournamentWeekId: string, playerId: string) {
  return prisma.construtorDeck.findMany({
    where: { tournamentWeekId, playerId },
    orderBy: { slot: "asc" },
    select: { id: true, slot: true, name: true, archetype: true },
  });
}

/** picks[matchId] = Map(targetPlayerId → deckId) — escolhas já feitas nas partidas. */
async function picksByMatch(matchIds: string[]) {
  const rows = await prisma.construtorPick.findMany({ where: { matchId: { in: matchIds } }, select: { matchId: true, targetPlayerId: true, deckId: true } });
  const map = new Map<string, Map<string, string>>();
  for (const r of rows) {
    const m = map.get(r.matchId) ?? new Map<string, string>();
    m.set(r.targetPlayerId, r.deckId);
    map.set(r.matchId, m);
  }
  return map;
}

function matchBothVoted(m: LiteMatch, picks: Map<string, Map<string, string>>): boolean {
  const p = picks.get(m.id);
  return Boolean(p && m.playerBId && p.has(m.playerAId) && p.has(m.playerBId));
}

/** Contexto para o adversário escolher o deck do `targetId` na partida `matchId`. */
async function pickContext(tournamentWeekId: string, matchId: string, targetId: string, picks: Map<string, Map<string, string>>) {
  const ordered = await orderedMatchesForPlayer(tournamentWeekId, targetId);
  // Só partidas ANTERIORES totalmente reveladas (ambos votaram) contam para
  // espera e exclusão — a escolha do jogo anterior não vaza cedo demais.
  const resolvedDeckByMatch = new Map<string, string>();
  for (const m of ordered) {
    if (m.id === matchId) continue;
    const used = picks.get(m.id)?.get(targetId);
    if (used && matchBothVoted(m, picks)) resolvedDeckByMatch.set(m.id, used);
  }
  const decks = await decksOf(tournamentWeekId, targetId);
  const avail = computePickAvailability(ordered.map((m) => m.id), matchId, resolvedDeckByMatch, decks.map((d) => d.id));
  return { decks, availableDecks: decks.filter((d) => avail.availableDeckIds.includes(d.id)), waiting: avail.waiting, currentPick: picks.get(matchId)?.get(targetId) ?? null };
}

// ── Registro dos 3 decks ──────────────────────────────────────────────────────
type DeckExtras = {
  gymBadgeId: string | null; mascotMissionMascotId: string | null; mascotMissionPokemonId: number | null;
  mascotMissionMascotName: string | null; mascotMissionValid: boolean | null;
  mascotMissionValidation: Prisma.InputJsonValue | typeof Prisma.JsonNull;
};
export type SaveConstrutorDecksResult = {
  ok?: boolean;
  error?: string;
  savedAt?: string;
  /** Resultado da validação da Missão de Mascote, por deck (quando declarada). */
  missions?: { slot: number; mascotName: string; valid: boolean }[];
};

export async function saveConstrutorDecksAction(input: {
  tournamentWeekId: string;
  decks: { slot: number; name: string; deckList: string; archetype?: string | null; gymBadgeId?: string | null; mascotMissionMascotId?: string | null }[];
}): Promise<SaveConstrutorDecksResult> {
  try {
    const me = await viewer();
    const week = await requireConstrutorWeek(input.tournamentWeekId);
    const myMatches = await orderedMatchesForPlayer(week.id, me.id);
    const picked = await prisma.construtorPick.count({ where: { targetPlayerId: me.id, matchId: { in: myMatches.map((m) => m.id) } } });
    if (picked > 0) return { error: "Seus decks já entraram em jogo (um adversário já escolheu). Não é possível alterá-los agora." };

    const slots = input.decks.filter((d) => [1, 2, 3].includes(d.slot));
    if (slots.length !== 3) return { error: "Registre exatamente 3 decks." };
    for (const d of slots) {
      if (!d.name?.trim() || d.name.trim().length < 2) return { error: `Dê um nome ao deck ${d.slot}.` };
      if (!d.deckList?.trim() || d.deckList.trim().length < 5) return { error: `A lista do deck ${d.slot} está muito curta.` };
    }

    // Jornada de Ginásio + Missão de Mascote (opcionais, validadas como no envio normal).
    const missions: NonNullable<SaveConstrutorDecksResult["missions"]> = [];
    const extras = new Map<number, DeckExtras>();
    for (const d of slots) {
      const badge = d.gymBadgeId ? week.tournament.badges.find((b) => b.id === d.gymBadgeId) ?? null : null;
      if (d.gymBadgeId && !badge) return { error: `A insígnia do deck ${d.slot} não pertence a este campeonato.` };
      let mission: { id: string; pokemonId: number; name: string; valid: boolean; validation: Prisma.InputJsonValue } | null = null;
      if (week.tournament.mascotMissionEnabled && d.mascotMissionMascotId) {
        const mascot = await prisma.mascot.findFirst({
          where: { id: d.mascotMissionMascotId, playerId: me.id },
          select: { id: true, pokemonId: true, nickname: true, level: true },
        });
        if (!mascot) return { error: `Mascote da missão do deck ${d.slot} não encontrado na sua conta.` };
        const option = buildMascotMissionOption(mascot);
        const validation = validateMascotMissionSubmission(d.deckList, option);
        mission = { id: mascot.id, pokemonId: mascot.pokemonId, name: option.displayName, valid: validation.valid, validation: { speciesName: option.speciesName, ...validation } as Prisma.InputJsonValue };
        missions.push({ slot: d.slot, mascotName: option.displayName, valid: validation.valid });
      }
      extras.set(d.slot, {
        gymBadgeId: badge?.id ?? null,
        mascotMissionMascotId: mission?.id ?? null,
        mascotMissionPokemonId: mission?.pokemonId ?? null,
        mascotMissionMascotName: mission?.name ?? null,
        mascotMissionValid: mission?.valid ?? null,
        mascotMissionValidation: mission?.validation ?? Prisma.JsonNull,
      });
    }

    // Se a lista ou a insígnia mudou, a validação da organização deixa de valer.
    const previous = await prisma.construtorDeck.findMany({ where: { tournamentWeekId: week.id, playerId: me.id }, select: { slot: true, deckList: true, gymBadgeId: true } });
    await prisma.$transaction(slots.map((d) => {
      const before = previous.find((x) => x.slot === d.slot);
      const extra = extras.get(d.slot)!;
      const changed = !before || before.deckList !== d.deckList.trim().slice(0, 5000) || before.gymBadgeId !== extra.gymBadgeId;
      const data = {
        name: d.name.trim().slice(0, 80),
        deckList: d.deckList.trim().slice(0, 5000),
        archetype: d.archetype?.trim()?.slice(0, 60) || null,
        ...extra,
        ...(changed ? { gymBadgeValid: null, gymBadgeValidation: Prisma.JsonNull } : {}),
      };
      return prisma.construtorDeck.upsert({
        where: { tournamentWeekId_playerId_slot: { tournamentWeekId: week.id, playerId: me.id, slot: d.slot } },
        create: { tournamentWeekId: week.id, playerId: me.id, slot: d.slot, ...data },
        update: data,
      });
    }));
    revalidatePath(`/torneios/${week.tournament.slug}/construtor`);
    // Atualiza a lista pública "Envio de decks" da página do dia.
    revalidatePath(`/torneios/${week.tournament.slug}/semanas/${week.weekNumber}`);
    return { ok: true, savedAt: new Date().toISOString(), missions };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao salvar decks." };
  }
}

// ── Escolha do deck do adversário ─────────────────────────────────────────────
export async function pickOpponentDeckAction(input: { matchId: string; deckId: string }): Promise<{ ok?: boolean; error?: string }> {
  try {
    const me = await viewer();
    const match = await prisma.match.findUnique({ where: { id: input.matchId }, select: { id: true, tournamentWeekId: true, playerAId: true, playerBId: true, isBye: true } });
    if (!match || !match.tournamentWeekId) return { error: "Partida não encontrada." };
    if (match.isBye || !match.playerBId) return { error: "Partida sem adversário (BYE)." };
    const week = await requireConstrutorWeek(match.tournamentWeekId);
    if (me.id !== match.playerAId && me.id !== match.playerBId) return { error: "Você não participa desta partida." };
    const targetId = me.id === match.playerAId ? match.playerBId : match.playerAId;

    const targetMatches = await orderedMatchesForPlayer(week.id, targetId);
    const picks = await picksByMatch(targetMatches.map((m) => m.id));
    const ctx = await pickContext(week.id, match.id, targetId, picks);
    if (ctx.decks.length < 3) return { error: "O adversário ainda não registrou os 3 decks." };
    if (ctx.waiting) return { error: "Aguarde: o jogo anterior deste jogador ainda não foi totalmente revelado." };
    if (ctx.currentPick) return { error: "Você já escolheu o deck do adversário neste jogo. A escolha não pode ser alterada." };
    const chosen = ctx.availableDecks.find((d) => d.id === input.deckId);
    if (!chosen) return { error: "Deck indisponível (já foi usado em outro jogo ou não existe)." };

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${match.id + ":" + targetId}))`;
      await tx.construtorPick.upsert({
        where: { matchId_targetPlayerId: { matchId: match.id, targetPlayerId: targetId } },
        create: { matchId: match.id, targetPlayerId: targetId, pickerPlayerId: me.id, deckId: chosen.id },
        update: { pickerPlayerId: me.id, deckId: chosen.id },
      });
    });
    // Se os dois já votaram, os decks jogados viram DeckSubmission da partida:
    // é assim que revisão de insígnia e EXP da missão funcionam como no envio normal.
    try { await linkRevealedMatchDecks(match.id, week); } catch (e) { console.error("[construtor] falha ao vincular decks revelados", e); }
    revalidatePath(`/torneios/${week.tournament.slug}/construtor`);
    revalidatePath(`/torneios/${week.tournament.slug}/semanas/${week.weekNumber}/partidas`);
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao escolher o deck." };
  }
}

type ConstrutorWeek = Awaited<ReturnType<typeof requireConstrutorWeek>>;

/** Quando ambos votaram na partida, vincula o deck jogado de cada lado a uma DeckSubmission (idempotente). */
async function linkRevealedMatchDecks(matchId: string, week: ConstrutorWeek) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, playerAId: true, playerBId: true, playerADeckSubmissionId: true, playerBDeckSubmissionId: true },
  });
  if (!match?.playerBId) return;
  const picks = await prisma.construtorPick.findMany({ where: { matchId }, select: { targetPlayerId: true, deckId: true } });
  const deckIdOf = (playerId: string) => picks.find((p) => p.targetPlayerId === playerId)?.deckId;
  if (!deckIdOf(match.playerAId) || !deckIdOf(match.playerBId)) return;

  let seasonId = week.tournament.seasonId;
  if (!seasonId) {
    const fallback = await prisma.season.findFirst({ orderBy: [{ status: "asc" }, { startDate: "desc" }], select: { id: true } });
    seasonId = fallback?.id ?? null;
  }
  if (!seasonId) return;
  const deadline = week.deckLockAt ?? week.lockAt ?? week.endDate;

  for (const side of [
    { playerId: match.playerAId, existing: match.playerADeckSubmissionId, field: "playerADeckSubmissionId" as const },
    { playerId: match.playerBId, existing: match.playerBDeckSubmissionId, field: "playerBDeckSubmissionId" as const },
  ]) {
    if (side.existing) continue;
    const deck = await prisma.construtorDeck.findUnique({ where: { id: deckIdOf(side.playerId)! } });
    if (!deck) continue;
    const reusable = await prisma.deckSubmission.findFirst({
      where: { tournamentWeekId: week.id, playerId: side.playerId, deckName: deck.name, deckList: deck.deckList },
      select: { id: true },
    });
    let submissionId = reusable?.id;
    if (!submissionId) {
      const count = await prisma.deckSubmission.count({ where: { tournamentWeekId: week.id, playerId: side.playerId } });
      const created = await prisma.deckSubmission.create({
        data: {
          seasonId, tournamentId: week.tournament.id, tournamentWeekId: week.id, playerId: side.playerId,
          deckNumber: count + 1, deckName: deck.name, archetype: deck.archetype, deckList: deck.deckList,
          deadlineAt: deadline, status: "SUBMITTED", isLate: false,
          mascotMissionMascotId: deck.mascotMissionMascotId,
          mascotMissionPokemonId: deck.mascotMissionPokemonId,
          mascotMissionMascotName: deck.mascotMissionMascotName,
          mascotMissionValid: deck.mascotMissionValid,
          mascotMissionValidation: deck.mascotMissionValidation ?? Prisma.JsonNull,
          gymBadgeId: deck.gymBadgeId,
          gymBadgeValid: deck.gymBadgeId ? deck.gymBadgeValid : null,
          gymBadgeValidation: !deck.gymBadgeId
            ? Prisma.JsonNull
            : deck.gymBadgeValidation ?? { status: "PENDING_ADMIN_REVIEW", message: "Jornada declarada. A organizacao ainda precisa validar o deck monotipo." },
        },
        select: { id: true },
      });
      submissionId = created.id;
    }
    await prisma.match.update({ where: { id: matchId }, data: { [side.field]: submissionId } });
  }
}

// ── Estado para a UI ──────────────────────────────────────────────────────────
export type ConstrutorMatchView = {
  matchId: string;
  roundLabel: string | null;
  scheduledAt: string | null;
  opponentName: string;
  myDeckChosen: { name: string } | null; // só revelado após ambos votarem
  bothVoted: boolean;
  iVoted: boolean;
  opponentHasRegistered: boolean;
  opponentDeckOptions: { id: string; slot: number; name: string; archetype: string | null }[];
  iCanPick: boolean;
  opponentChosenByMe: string | null;
  waitReason: string | null;
};

export async function getConstrutorStateAction(tournamentWeekId: string): Promise<{
  error?: string;
  myDecks?: {
    slot: number; name: string; deckList: string; archetype: string | null;
    gymBadgeId: string | null; mascotMissionMascotId: string | null; mascotMissionMascotName: string | null; mascotMissionValid: boolean | null; gymBadgeValid: boolean | null;
  }[];
  gymBadges?: { id: string; name: string }[];
  missionEnabled?: boolean;
  mascotOptions?: { id: string; pokemonId: number; nickname: string | null; level: number }[];
  decksLocked?: boolean;
  matches?: ConstrutorMatchView[];
}> {
  try {
    const me = await viewer();
    const week = await requireConstrutorWeek(tournamentWeekId);

    const [myDecksFull, myMatches] = await Promise.all([
      prisma.construtorDeck.findMany({ where: { tournamentWeekId: week.id, playerId: me.id }, orderBy: { slot: "asc" }, select: { id: true, slot: true, name: true, deckList: true, archetype: true, gymBadgeId: true, mascotMissionMascotId: true, mascotMissionMascotName: true, mascotMissionValid: true, gymBadgeValid: true } }),
      orderedMatchesForPlayer(week.id, me.id),
    ]);
    const missionEnabled = week.tournament.mascotMissionEnabled;
    const mascotOptions = missionEnabled
      ? (await prisma.mascot.findMany({
          where: { playerId: me.id },
          select: { id: true, pokemonId: true, nickname: true, level: true },
          orderBy: [{ isFavorite: "desc" }, { level: "desc" }, { hatchedAt: "desc" }],
          take: 500,
        }))
      : [];
    const myPicksAsTarget = await prisma.construtorPick.count({ where: { targetPlayerId: me.id, matchId: { in: myMatches.map((m) => m.id) } } });
    const decksLocked = myPicksAsTarget > 0;

    const opponentIds = [...new Set(myMatches.map((m) => (m.playerAId === me.id ? m.playerBId : m.playerAId)).filter((id): id is string => Boolean(id)))];
    const players = await prisma.player.findMany({ where: { id: { in: [me.id, ...opponentIds] } }, select: { id: true, displayName: true } });
    const nameOf = (id: string) => players.find((p) => p.id === id)?.displayName ?? "Adversário";
    const myDeckNameById = new Map(myDecksFull.map((d) => [d.id, d.name]));
    const myMatchPicks = await picksByMatch(myMatches.map((m) => m.id));

    const matches: ConstrutorMatchView[] = [];
    for (const m of myMatches) {
      const opponentId = m.playerAId === me.id ? m.playerBId! : m.playerAId;
      const revealed = matchBothVoted(m, myMatchPicks);
      const myChosenDeckId = myMatchPicks.get(m.id)?.get(me.id) ?? null;      // deck escolhido PARA mim
      const iChoseForOpp = myMatchPicks.get(m.id)?.get(opponentId) ?? null;   // deck que eu escolhi pro adversário
      const oppMatches = await orderedMatchesForPlayer(week.id, opponentId);
      const oppPicks = await picksByMatch(oppMatches.map((x) => x.id));
      const ctx = await pickContext(week.id, m.id, opponentId, oppPicks);
      // Partidas reveladas antes do vínculo existir (ou que falharam) são reparadas aqui (idempotente).
      if (revealed) await linkRevealedMatchDecks(m.id, week).catch(() => undefined);
      matches.push({
        matchId: m.id,
        roundLabel: m.roundLabel,
        scheduledAt: m.scheduledAt ? m.scheduledAt.toISOString() : null,
        opponentName: nameOf(opponentId),
        myDeckChosen: revealed && myChosenDeckId ? { name: myDeckNameById.get(myChosenDeckId) ?? "Deck" } : null,
        bothVoted: revealed,
        iVoted: Boolean(iChoseForOpp),
        opponentHasRegistered: ctx.decks.length >= 3,
        opponentDeckOptions: ctx.availableDecks.map((d) => ({ id: d.id, slot: d.slot, name: d.name, archetype: d.archetype })),
        iCanPick: ctx.decks.length >= 3 && !ctx.waiting && !ctx.currentPick,
        opponentChosenByMe: ctx.currentPick,
        waitReason: ctx.waiting ? "Aguardando o jogo anterior do adversário ser revelado." : null,
      });
    }

    return {
      myDecks: myDecksFull.map((d) => ({ slot: d.slot, name: d.name, deckList: d.deckList, archetype: d.archetype, gymBadgeId: d.gymBadgeId, mascotMissionMascotId: d.mascotMissionMascotId, mascotMissionMascotName: d.mascotMissionMascotName, mascotMissionValid: d.mascotMissionValid, gymBadgeValid: d.gymBadgeValid })),
      gymBadges: week.tournament.badges, missionEnabled, mascotOptions, decksLocked, matches,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao carregar." };
  }
}

// ── Admin: validar decks de Jornada de Ginásio ────────────────────────────────
export type AdminConstrutorGymDeck = {
  deckId: string; playerName: string; slot: number; deckName: string; deckList: string;
  badgeName: string; valid: boolean | null; notes: string | null;
};

export async function adminListConstrutorGymDecksAction(tournamentWeekId: string): Promise<{ error?: string; decks?: AdminConstrutorGymDeck[] }> {
  try {
    await requireAdmin();
    const week = await requireConstrutorWeek(tournamentWeekId);
    const decks = await prisma.construtorDeck.findMany({
      where: { tournamentWeekId: week.id, gymBadgeId: { not: null } },
      orderBy: [{ playerId: "asc" }, { slot: "asc" }],
      select: { id: true, playerId: true, slot: true, name: true, deckList: true, gymBadgeId: true, gymBadgeValid: true, gymBadgeValidation: true },
    });
    const players = await prisma.player.findMany({ where: { id: { in: [...new Set(decks.map((d) => d.playerId))] } }, select: { id: true, displayName: true } });
    const badgeName = new Map(week.tournament.badges.map((b) => [b.id, b.name]));
    return {
      decks: decks
        .map((d) => ({
          deckId: d.id,
          playerName: players.find((p) => p.id === d.playerId)?.displayName ?? "Jogador",
          slot: d.slot, deckName: d.name, deckList: d.deckList,
          badgeName: badgeName.get(d.gymBadgeId!) ?? "Insígnia",
          valid: d.gymBadgeValid,
          notes: d.gymBadgeValidation && typeof d.gymBadgeValidation === "object" && !Array.isArray(d.gymBadgeValidation)
            ? ((d.gymBadgeValidation as Record<string, unknown>).notes as string | null | undefined) ?? null : null,
        }))
        .sort((a, b) => a.playerName.localeCompare(b.playerName, "pt-BR") || a.slot - b.slot),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao listar decks." };
  }
}

export async function adminValidateConstrutorGymDeckAction(input: { deckId: string; valid: boolean; notes?: string }): Promise<{ ok?: boolean; error?: string }> {
  try {
    const admin = await requireAdmin();
    const deck = await prisma.construtorDeck.findUnique({ where: { id: input.deckId } });
    if (!deck?.gymBadgeId) return { error: "Este deck não declarou uma Jornada de Ginásio." };
    const week = await requireConstrutorWeek(deck.tournamentWeekId);
    const badge = week.tournament.badges.find((b) => b.id === deck.gymBadgeId);
    const validation = {
      status: input.valid ? "VALID" : "INVALID",
      badgeName: badge?.name ?? null,
      reviewedById: admin.id,
      reviewedAt: new Date().toISOString(),
      notes: input.notes?.trim() || null,
    };
    await prisma.$transaction([
      prisma.construtorDeck.update({ where: { id: deck.id }, data: { gymBadgeValid: input.valid, gymBadgeValidation: validation } }),
      // Envios já gerados a partir deste deck (partidas reveladas) recebem a mesma revisão.
      prisma.deckSubmission.updateMany({
        where: { tournamentWeekId: deck.tournamentWeekId, playerId: deck.playerId, deckName: deck.name, deckList: deck.deckList, gymBadgeId: deck.gymBadgeId },
        data: { gymBadgeValid: input.valid, gymBadgeValidation: validation },
      }),
      prisma.auditLog.create({
        data: { actorUserId: admin.id, entityType: "construtorDeck", entityId: deck.id, action: "gym_deck.validated", after: { gymBadgeId: deck.gymBadgeId, valid: input.valid, notes: input.notes?.trim() || null } },
      }),
    ]);
    revalidatePath(`/torneios/${week.tournament.slug}/semanas/${week.weekNumber}`);
    revalidatePath(`/torneios/${week.tournament.slug}/semanas/${week.weekNumber}/partidas`);
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao validar deck." };
  }
}
