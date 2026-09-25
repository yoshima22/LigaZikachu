"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/permissions";
import { getSessionPlayer } from "@/lib/session";

// Modo Construtor (Semana 6): cada jogador registra 3 decks; o adversário de
// cada partida escolhe qual deck o jogador usará. O deck usado no Jogo 1 sai da
// escolha do Jogo 2, e o adversário do Jogo 2 só escolhe depois que o deck do
// Jogo 1 daquele jogador for definido (regra "mútua" e "ordenada").

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
    select: { id: true, mode: true, tournamentId: true, tournament: { select: { slug: true } } },
  });
  if (!week) throw new Error("Semana não encontrada.");
  if (week.mode !== "CONSTRUTOR_MISTERIOSO") throw new Error("Esta semana não é do modo Construtor.");
  return week;
}

/** Partidas (não-BYE) de um jogador na semana, na ordem dos jogos (Jogo 1, 2…). */
async function orderedMatchesForPlayer(tournamentWeekId: string, playerId: string) {
  const matches = await prisma.match.findMany({
    where: { tournamentWeekId, isBye: false, OR: [{ playerAId: playerId }, { playerBId: playerId }] },
    orderBy: [{ scheduledAt: "asc" }, { roundLabel: "asc" }, { id: "asc" }],
    select: { id: true, playerAId: true, playerBId: true, roundLabel: true, scheduledAt: true },
  });
  return matches;
}

/**
 * Núcleo da regra (puro/testável): dada a ordem das partidas do alvo, os decks
 * já escolhidos por partida e o deck atual, resolve espera/uso/disponibilidade.
 */
export function computePickAvailability(
  orderedMatchIds: string[],
  currentMatchId: string,
  pickByMatch: Map<string, string>,
  deckIds: string[],
): { gameIndex: number; waiting: boolean; usedDeckIds: string[]; availableDeckIds: string[]; currentPick: string | null } {
  const gameIndex = orderedMatchIds.indexOf(currentMatchId);
  const previous = gameIndex > 0 ? orderedMatchIds.slice(0, gameIndex) : [];
  // Espera: todo jogo anterior do alvo precisa já ter deck escolhido.
  const waiting = previous.some((id) => !pickByMatch.has(id));
  const usedDeckIds = previous.map((id) => pickByMatch.get(id)).filter((id): id is string => Boolean(id));
  const availableDeckIds = deckIds.filter((id) => !usedDeckIds.includes(id));
  return { gameIndex, waiting, usedDeckIds, availableDeckIds, currentPick: pickByMatch.get(currentMatchId) ?? null };
}

/** Estado de escolha do deck do `targetId` para a partida `matchId`. */
async function pickContext(tournamentWeekId: string, matchId: string, targetId: string) {
  const ordered = await orderedMatchesForPlayer(tournamentWeekId, targetId);
  const picks = await prisma.construtorPick.findMany({
    where: { targetPlayerId: targetId, matchId: { in: ordered.map((m) => m.id) } },
    select: { matchId: true, deckId: true },
  });
  const pickByMatch = new Map(picks.map((p) => [p.matchId, p.deckId]));
  const decks = await prisma.construtorDeck.findMany({
    where: { tournamentWeekId, playerId: targetId },
    orderBy: { slot: "asc" },
    select: { id: true, slot: true, name: true, archetype: true },
  });
  const avail = computePickAvailability(ordered.map((m) => m.id), matchId, pickByMatch, decks.map((d) => d.id));
  const availableDecks = decks.filter((d) => avail.availableDeckIds.includes(d.id));
  return { gameIndex: avail.gameIndex, ordered, decks, availableDecks, usedDeckIds: avail.usedDeckIds, waiting: avail.waiting, currentPick: avail.currentPick };
}

// ── Registro dos 3 decks ──────────────────────────────────────────────────────
export async function saveConstrutorDecksAction(input: {
  tournamentWeekId: string;
  decks: { slot: number; name: string; deckList: string; archetype?: string | null }[];
}): Promise<{ ok?: boolean; error?: string }> {
  try {
    const me = await viewer();
    const week = await requireConstrutorWeek(input.tournamentWeekId);

    // Não deixa mexer num deck que um adversário já escolheu para você.
    const alreadyPicked = await prisma.construtorPick.count({ where: { targetPlayerId: me.id, matchId: { in: (await orderedMatchesForPlayer(week.id, me.id)).map((m) => m.id) } } });
    if (alreadyPicked > 0) return { error: "Seus decks já entraram em jogo (um adversário já escolheu). Não é possível alterá-los agora." };

    const slots = input.decks.filter((d) => [1, 2, 3].includes(d.slot));
    if (slots.length !== 3) return { error: "Registre exatamente 3 decks." };
    for (const d of slots) {
      if (!d.name?.trim() || d.name.trim().length < 2) return { error: `Dê um nome ao deck ${d.slot}.` };
      if (!d.deckList?.trim() || d.deckList.trim().length < 5) return { error: `A lista do deck ${d.slot} está muito curta.` };
    }

    await prisma.$transaction(slots.map((d) => prisma.construtorDeck.upsert({
      where: { tournamentWeekId_playerId_slot: { tournamentWeekId: week.id, playerId: me.id, slot: d.slot } },
      create: { tournamentWeekId: week.id, playerId: me.id, slot: d.slot, name: d.name.trim().slice(0, 80), deckList: d.deckList.trim().slice(0, 5000), archetype: d.archetype?.trim()?.slice(0, 60) || null },
      update: { name: d.name.trim().slice(0, 80), deckList: d.deckList.trim().slice(0, 5000), archetype: d.archetype?.trim()?.slice(0, 60) || null },
    })));
    revalidatePath(`/torneios/${week.tournament.slug}`);
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao salvar decks." };
  }
}

// ── Escolha do deck do adversário ─────────────────────────────────────────────
export async function pickOpponentDeckAction(input: { matchId: string; deckId: string }): Promise<{ ok?: boolean; error?: string }> {
  try {
    const me = await viewer();
    const match = await prisma.match.findUnique({
      where: { id: input.matchId },
      select: { id: true, tournamentWeekId: true, playerAId: true, playerBId: true, isBye: true },
    });
    if (!match || !match.tournamentWeekId) return { error: "Partida não encontrada." };
    if (match.isBye || !match.playerBId) return { error: "Partida sem adversário (BYE)." };
    const week = await requireConstrutorWeek(match.tournamentWeekId);

    // O picker (viewer) precisa ser um dos jogadores; o alvo é o adversário dele.
    if (me.id !== match.playerAId && me.id !== match.playerBId) return { error: "Você não participa desta partida." };
    const targetId = me.id === match.playerAId ? match.playerBId : match.playerAId;

    const ctx = await pickContext(week.id, match.id, targetId);
    if (ctx.decks.length !== 3) return { error: "O adversário ainda não registrou os 3 decks." };
    if (ctx.waiting) return { error: "Aguarde: o deck do jogo anterior deste jogador ainda não foi escolhido." };
    const chosen = ctx.availableDecks.find((d) => d.id === input.deckId);
    if (!chosen) return { error: "Deck indisponível (já foi usado em outro jogo ou não existe)." };

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${match.id + ":" + targetId}))`;
      await tx.construtorPick.upsert({
        where: { matchId_targetPlayerId: { matchId: match.id, targetPlayerId: targetId } },
        create: { matchId: match.id, targetPlayerId: targetId, pickerPlayerId: me.id, deckId: chosen.id },
        update: { pickerPlayerId: me.id, deckId: chosen.id },
      });
      // Espelha no Match para exibições existentes lerem o deck do alvo.
      await tx.match.update({
        where: { id: match.id },
        data: targetId === match.playerAId ? { playerADeckSubmissionId: chosen.id } : { playerBDeckSubmissionId: chosen.id },
      });
    });
    revalidatePath(`/torneios/${week.tournament.slug}`);
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao escolher o deck." };
  }
}

// ── Estado para a UI ──────────────────────────────────────────────────────────
export type ConstrutorMatchView = {
  matchId: string;
  roundLabel: string | null;
  scheduledAt: string | null;
  opponentId: string;
  opponentName: string;
  // O deck que EU vou usar (escolhido pelo adversário):
  myDeckChosen: { id: string; name: string } | null;
  // Minha vez de escolher o deck do adversário:
  opponentDeckOptions: { id: string; slot: number; name: string; archetype: string | null }[];
  opponentHasRegistered: boolean;
  iCanPick: boolean;          // false quando preciso esperar o jogo anterior do adversário
  opponentChosenByMe: string | null; // deckId que eu já escolhi para o adversário
  waitReason: string | null;
};

export async function getConstrutorStateAction(tournamentWeekId: string): Promise<{
  error?: string;
  myDecks?: { slot: number; name: string; deckList: string; archetype: string | null }[];
  decksLocked?: boolean;
  matches?: ConstrutorMatchView[];
}> {
  try {
    const me = await viewer();
    const week = await requireConstrutorWeek(tournamentWeekId);

    const myDecksRows = await prisma.construtorDeck.findMany({ where: { tournamentWeekId: week.id, playerId: me.id }, orderBy: { slot: "asc" }, select: { slot: true, name: true, deckList: true, archetype: true } });
    const myMatches = await orderedMatchesForPlayer(week.id, me.id);
    const decksLocked = (await prisma.construtorPick.count({ where: { targetPlayerId: me.id, matchId: { in: myMatches.map((m) => m.id) } } })) > 0;

    const opponentIds = [...new Set(myMatches.map((m) => (m.playerAId === me.id ? m.playerBId : m.playerAId)).filter((id): id is string => Boolean(id)))];
    const players = await prisma.player.findMany({ where: { id: { in: [me.id, ...opponentIds] } }, select: { id: true, displayName: true } });
    const nameOf = (id: string) => players.find((p) => p.id === id)?.displayName ?? "Adversário";

    // Decks que os adversários escolheram PARA MIM.
    const picksForMe = await prisma.construtorPick.findMany({ where: { targetPlayerId: me.id, matchId: { in: myMatches.map((m) => m.id) } }, select: { matchId: true, deckId: true } });
    const myDeckByMatch = new Map(picksForMe.map((p) => [p.matchId, p.deckId]));
    const myDeckById = new Map((await prisma.construtorDeck.findMany({ where: { tournamentWeekId: week.id, playerId: me.id }, select: { id: true, name: true } })).map((d) => [d.id, d.name]));

    const matches: ConstrutorMatchView[] = [];
    for (const m of myMatches) {
      const opponentId = m.playerAId === me.id ? m.playerBId! : m.playerAId;
      const ctx = await pickContext(week.id, m.id, opponentId); // contexto para EU escolher o deck do adversário
      const myChosenDeckId = myDeckByMatch.get(m.id) ?? null;
      matches.push({
        matchId: m.id,
        roundLabel: m.roundLabel,
        scheduledAt: m.scheduledAt ? m.scheduledAt.toISOString() : null,
        opponentId,
        opponentName: nameOf(opponentId),
        myDeckChosen: myChosenDeckId ? { id: myChosenDeckId, name: myDeckById.get(myChosenDeckId) ?? "Deck" } : null,
        opponentHasRegistered: ctx.decks.length === 3,
        opponentDeckOptions: ctx.availableDecks.map((d) => ({ id: d.id, slot: d.slot, name: d.name, archetype: d.archetype })),
        iCanPick: ctx.decks.length === 3 && !ctx.waiting && !ctx.currentPick,
        opponentChosenByMe: ctx.currentPick,
        waitReason: ctx.waiting ? "Aguardando o deck do jogo anterior do adversário ser escolhido." : null,
      });
    }

    return {
      myDecks: myDecksRows.map((d) => ({ slot: d.slot, name: d.name, deckList: d.deckList, archetype: d.archetype })),
      decksLocked,
      matches,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao carregar." };
  }
}
