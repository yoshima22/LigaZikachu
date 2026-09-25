"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/permissions";
import { getSessionPlayer } from "@/lib/session";
import { computePickAvailability } from "./rules";

// Modo Construtor (Semana 6): cada jogador registra 3 decks pela janela padrão da
// semana (DeckSubmission, decksToSubmit=3). O adversário de cada partida escolhe
// qual desses 3 decks o jogador usará. O deck usado no Jogo 1 sai da escolha do
// Jogo 2, e o adversário do Jogo 2 só escolhe depois que o deck do Jogo 1 daquele
// jogador for definido (regra "mútua" e "ordenada"). A escolha é gravada em
// Match.player{A,B}DeckSubmissionId (o deck que aquele jogador vai usar).

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

type LiteMatch = { id: string; playerAId: string; playerBId: string | null; roundLabel: string | null; scheduledAt: Date | null; playerADeckSubmissionId: string | null; playerBDeckSubmissionId: string | null };

/** Partidas (não-BYE) de um jogador na semana, na ordem dos jogos (Jogo 1, 2…). */
async function orderedMatchesForPlayer(tournamentWeekId: string, playerId: string): Promise<LiteMatch[]> {
  return prisma.match.findMany({
    where: { tournamentWeekId, isBye: false, OR: [{ playerAId: playerId }, { playerBId: playerId }] },
    orderBy: [{ scheduledAt: "asc" }, { roundLabel: "asc" }, { id: "asc" }],
    select: { id: true, playerAId: true, playerBId: true, roundLabel: true, scheduledAt: true, playerADeckSubmissionId: true, playerBDeckSubmissionId: true },
  });
}

/** Deck escolhido para `playerId` naquela partida (o que ele vai jogar). */
function chosenDeckFor(match: LiteMatch, playerId: string): string | null {
  return match.playerAId === playerId ? match.playerADeckSubmissionId : match.playerBId === playerId ? match.playerBDeckSubmissionId : null;
}

async function decksOf(tournamentWeekId: string, playerId: string) {
  return prisma.deckSubmission.findMany({
    where: { tournamentWeekId, playerId },
    orderBy: { deckNumber: "asc" },
    select: { id: true, deckNumber: true, deckName: true, archetype: true },
  });
}

function bothVoted(m: LiteMatch): boolean {
  return Boolean(m.playerADeckSubmissionId && m.playerBDeckSubmissionId);
}

/** Contexto de escolha do deck do `targetId` para a partida `matchId`. */
async function pickContext(tournamentWeekId: string, matchId: string, targetId: string) {
  const ordered = await orderedMatchesForPlayer(tournamentWeekId, targetId);
  // Só partidas ANTERIORES já totalmente reveladas (ambos votaram) contam para a
  // espera e a exclusão — assim a escolha do jogo anterior não vaza cedo demais.
  const resolvedDeckByMatch = new Map<string, string>();
  for (const m of ordered) { const d = chosenDeckFor(m, targetId); if (d && bothVoted(m)) resolvedDeckByMatch.set(m.id, d); }
  const decks = await decksOf(tournamentWeekId, targetId);
  const avail = computePickAvailability(ordered.map((m) => m.id), matchId, resolvedDeckByMatch, decks.map((d) => d.id));
  const current = ordered.find((m) => m.id === matchId) ?? null;
  return { ordered, decks, availableDecks: decks.filter((d) => avail.availableDeckIds.includes(d.id)), waiting: avail.waiting, currentPick: current ? chosenDeckFor(current, targetId) : null };
}

// ── Escolha do deck do adversário ─────────────────────────────────────────────
export async function pickOpponentDeckAction(input: { matchId: string; deckSubmissionId: string }): Promise<{ ok?: boolean; error?: string }> {
  try {
    const me = await viewer();
    const match = await prisma.match.findUnique({
      where: { id: input.matchId },
      select: { id: true, tournamentWeekId: true, playerAId: true, playerBId: true, isBye: true },
    });
    if (!match || !match.tournamentWeekId) return { error: "Partida não encontrada." };
    if (match.isBye || !match.playerBId) return { error: "Partida sem adversário (BYE)." };
    const week = await requireConstrutorWeek(match.tournamentWeekId);
    if (me.id !== match.playerAId && me.id !== match.playerBId) return { error: "Você não participa desta partida." };
    const targetId = me.id === match.playerAId ? match.playerBId : match.playerAId;

    const ctx = await pickContext(week.id, match.id, targetId);
    if (ctx.decks.length < 3) return { error: "O adversário ainda não registrou os 3 decks." };
    if (ctx.waiting) return { error: "Aguarde: o deck do jogo anterior deste jogador ainda não foi escolhido." };
    const chosen = ctx.availableDecks.find((d) => d.id === input.deckSubmissionId);
    if (!chosen) return { error: "Deck indisponível (já foi usado em outro jogo ou não existe)." };

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${match.id + ":" + targetId}))`;
      await tx.match.update({
        where: { id: match.id },
        data: targetId === match.playerAId ? { playerADeckSubmissionId: chosen.id } : { playerBDeckSubmissionId: chosen.id },
      });
    });
    revalidatePath(`/torneios/${week.tournament.slug}/construtor`);
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
  opponentName: string;
  myDeckChosen: { id: string; name: string } | null; // deck que EU vou jogar — só revelado após ambos votarem
  bothVoted: boolean; // ambos os jogadores já escolheram o deck do outro nesta partida
  iVoted: boolean;    // eu já escolhi o deck do adversário
  opponentHasRegistered: boolean;
  opponentDeckOptions: { id: string; deckNumber: number; name: string; archetype: string | null }[];
  iCanPick: boolean;
  opponentChosenByMe: string | null;
  waitReason: string | null;
};

export async function getConstrutorStateAction(tournamentWeekId: string): Promise<{
  error?: string;
  myDecks?: { deckNumber: number; name: string; archetype: string | null }[];
  matches?: ConstrutorMatchView[];
}> {
  try {
    const me = await viewer();
    const week = await requireConstrutorWeek(tournamentWeekId);

    const [myDecks, myMatches] = await Promise.all([decksOf(week.id, me.id), orderedMatchesForPlayer(week.id, me.id)]);
    const opponentIds = [...new Set(myMatches.map((m) => (m.playerAId === me.id ? m.playerBId : m.playerAId)).filter((id): id is string => Boolean(id)))];
    const players = await prisma.player.findMany({ where: { id: { in: [me.id, ...opponentIds] } }, select: { id: true, displayName: true } });
    const nameOf = (id: string) => players.find((p) => p.id === id)?.displayName ?? "Adversário";
    const myDeckById = new Map(myDecks.map((d) => [d.id, d.deckName]));

    const matches: ConstrutorMatchView[] = [];
    for (const m of myMatches) {
      const opponentId = m.playerAId === me.id ? m.playerBId! : m.playerAId;
      const myChosen = chosenDeckFor(m, me.id);            // deck que o adversário escolheu pra mim
      const iChose = chosenDeckFor(m, opponentId);         // deck que eu escolhi pro adversário
      const revealed = bothVoted(m);
      const ctx = await pickContext(week.id, m.id, opponentId); // contexto para EU escolher o deck do adversário
      matches.push({
        matchId: m.id,
        roundLabel: m.roundLabel,
        scheduledAt: m.scheduledAt ? m.scheduledAt.toISOString() : null,
        opponentName: nameOf(opponentId),
        // Só revela o deck que vou usar depois que AMBOS votaram.
        myDeckChosen: revealed && myChosen ? { id: myChosen, name: myDeckById.get(myChosen) ?? "Deck" } : null,
        bothVoted: revealed,
        iVoted: Boolean(iChose),
        opponentHasRegistered: ctx.decks.length >= 3,
        opponentDeckOptions: ctx.availableDecks.map((d) => ({ id: d.id, deckNumber: d.deckNumber, name: d.deckName, archetype: d.archetype })),
        iCanPick: ctx.decks.length >= 3 && !ctx.waiting && !ctx.currentPick,
        opponentChosenByMe: ctx.currentPick,
        waitReason: ctx.waiting ? "Aguardando o deck do jogo anterior do adversário ser escolhido." : null,
      });
    }

    return { myDecks: myDecks.map((d) => ({ deckNumber: d.deckNumber, name: d.deckName, archetype: d.archetype })), matches };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao carregar." };
  }
}
