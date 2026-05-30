"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getSessionUser } from "@/lib/auth/permissions";
import { DeckSubmissionStatus, MatchStatus, ResultSource, Role, SeasonStatus, TournamentFormat, TournamentStatus, RegistrationStatus, WeekMode, WeekStatus, type Prisma } from "@prisma/client";
import {
  canSubmitTournamentWeekDeck,
  getDeckSubmissionDeadline,
  isDeckRegistrationLocked
} from "@/lib/decks";

// ─── Schemas de validação ────────────────────────────────────────────────────

const createTournamentSchema = z.object({
  name: z.string().min(3, "Nome deve ter ao menos 3 caracteres").max(100),
  slug: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Slug só pode conter letras minúsculas, números e hífens"),
  edition: z.string().max(50).nullish(),
  description: z.string().max(1000).nullish(),
  format: z.nativeEnum(TournamentFormat).default(TournamentFormat.ONLINE),
  startDate: z.string().datetime({ message: "Data inválida" }),
  endDate: z.string().datetime().nullish(),
  maxPlayers: z.number().int().min(2).max(256).nullish(),
  matchesPerPlayer: z.number().int().min(1).max(12).nullish(),
  requiresDeckSubmission: z.boolean().default(true),
  registrationOpensAt: z.string().datetime().nullish(),
  registrationClosesAt: z.string().datetime().nullish(),
  bannerImageUrl: z.string().url().nullish(),
  themeMetadata: z.record(z.string()).nullish()
});

const updateTournamentSchema = createTournamentSchema.partial().extend({
  id: z.string().min(1)
});

const updateTournamentSeasonSchema = z.object({
  tournamentId: z.string().min(1),
  seasonId: z.string().nullish()
});

const deleteTournamentSchema = z.object({
  tournamentId: z.string().min(1)
});

const updateWeekDeckLockSchema = z.object({
  weekId: z.string().min(1),
  deckLockAt: z.string().nullish()
});

const updateTournamentWeekSettingsSchema = z.object({
  weekId: z.string().min(1),
  label: z.string().trim().max(120).nullish(),
  mode: z.nativeEnum(WeekMode),
  status: z.nativeEnum(WeekStatus),
  deckLockAt: z.string().nullish(),
  notes: z.string().trim().max(2000).nullish()
});

const addTournamentWeekSchema = z.object({
  tournamentId: z.string().min(1)
});

const removeTournamentWeekSchema = z.object({
  weekId: z.string().min(1)
});

const addTournamentPlayerSchema = z.object({
  tournamentId: z.string().min(1),
  playerId: z.string().min(1)
});

const applyWeekBonusSchema = z.object({
  weekId: z.string().min(1),
  playerId: z.string().min(1),
  points: z.coerce.number().int().min(-50).max(50),
  reason: z.string().trim().max(240).nullish()
});

const setWeekTeamSchema = z.object({
  weekId: z.string().min(1),
  playerId: z.string().min(1),
  teamName: z.string().trim().max(80).nullish()
});

const submitTournamentWeekDeckSchema = z.object({
  tournamentWeekId: z.string().min(1),
  deckNumber: z.coerce.number().int().min(1).max(3).default(1),
  deckName: z.string().trim().min(2, "Informe o nome do deck.").max(120),
  archetype: z.string().trim().max(120).nullish(),
  deckList: z.string().trim().min(10, "Cole a lista completa do deck.").max(12000)
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildRoundRobinRounds(playerIds: string[]) {
  const players: Array<string | null> = [...playerIds];
  if (players.length % 2 === 1) players.push(null);

  const rounds: Array<Array<{ playerAId: string; playerBId: string }>> = [];
  const size = players.length;
  const rotating = [...players];

  for (let round = 0; round < size - 1; round++) {
    const pairings: Array<{ playerAId: string; playerBId: string }> = [];

    for (let index = 0; index < size / 2; index++) {
      const left = rotating[index];
      const right = rotating[size - 1 - index];
      if (left && right) {
        pairings.push(
          round % 2 === 0
            ? { playerAId: left, playerBId: right }
            : { playerAId: right, playerBId: left }
        );
      }
    }

    rounds.push(pairings);
    rotating.splice(1, 0, rotating.pop() ?? null);
  }

  return rounds;
}

function buildBalancedInPersonMatches(playerIds: string[], matchesPerPlayer: number) {
  if (playerIds.length < 2) return [];
  if ((playerIds.length * matchesPerPlayer) % 2 !== 0) {
    throw new Error("Com numero impar de jogadores, use uma quantidade par de partidas por jogador para evitar BYE.");
  }

  const pairs = buildRoundRobinRounds(playerIds).flat();
  const counts = new Map(playerIds.map((playerId) => [playerId, 0]));
  const matches: Array<{ playerAId: string; playerBId: string; roundLabel: string; tableLabel: string }> = [];
  let pass = 0;

  while (playerIds.some((playerId) => (counts.get(playerId) ?? 0) < matchesPerPlayer)) {
    let addedThisPass = 0;

    for (const pair of pairs) {
      const countA = counts.get(pair.playerAId) ?? 0;
      const countB = counts.get(pair.playerBId) ?? 0;
      if (countA >= matchesPerPlayer || countB >= matchesPerPlayer) continue;

      matches.push({
        playerAId: pass % 2 === 0 ? pair.playerAId : pair.playerBId,
        playerBId: pass % 2 === 0 ? pair.playerBId : pair.playerAId,
        roundLabel: "Rodada " + (matches.length + 1),
        tableLabel: "Mesa " + ((matches.length % Math.max(1, Math.floor(playerIds.length / 2))) + 1)
      });
      counts.set(pair.playerAId, countA + 1);
      counts.set(pair.playerBId, countB + 1);
      addedThisPass++;

      if (playerIds.every((playerId) => (counts.get(playerId) ?? 0) >= matchesPerPlayer)) break;
    }

    if (addedThisPass === 0) {
      throw new Error("Nao foi possivel montar partidas equilibradas sem BYE com esses parametros.");
    }
    pass++;
  }

  return matches;
}

function canManageTournament(user: { id: string; role: Role }, tournament: { createdById: string; format: TournamentFormat }) {
  return user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN || tournament.createdById === user.id;
}

async function logAudit(
  actorId: string,
  entityType: string,
  entityId: string,
  action: string,
  before?: Record<string, string | number | boolean | null>,
  after?: Record<string, string | number | boolean | null>
) {
  await prisma.auditLog.create({
    data: { actorUserId: actorId, entityType, entityId, action, before, after }
  });
}

const TOURNAMENT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateTournamentCode() {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += TOURNAMENT_CODE_ALPHABET[Math.floor(Math.random() * TOURNAMENT_CODE_ALPHABET.length)];
  }
  return code;
}

async function generateUniqueTournamentCode() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateTournamentCode();
    const existing = await prisma.tournament.findFirst({ where: { code }, select: { id: true } });
    if (!existing) return code;
  }
  throw new Error("Nao foi possivel gerar um codigo unico para o torneio.");
}

// ─── Create / Update ─────────────────────────────────────────────────────────

export async function createTournament(
  raw: z.infer<typeof createTournamentSchema>
): Promise<{ error?: string; slug?: string; id?: string }> {
  try {
    const actor = await getSessionUser();
    if (!actor) return { error: "Nao autenticado." };
    const data = createTournamentSchema.parse(raw);
    const isAdmin = actor.role === Role.ADMIN || actor.role === Role.SUPER_ADMIN;

    if (data.format === TournamentFormat.ONLINE && !isAdmin) {
      return { error: "Apenas admins podem criar campeonatos online." };
    }

    const existing = await prisma.tournament.findUnique({ where: { slug: data.slug } });
    if (existing) return { error: "Já existe um torneio com este slug." };

    const code = await generateUniqueTournamentCode();
    const activeSeason = data.format === TournamentFormat.IN_PERSON
      ? await prisma.season.findFirst({
          where: { status: SeasonStatus.ACTIVE },
          orderBy: { startDate: "desc" },
          select: { id: true }
        })
      : null;
    const requiresDeckSubmission =
      data.format === TournamentFormat.ONLINE ? data.requiresDeckSubmission : false;

    const tournament = await prisma.tournament.create({
      data: {
        code,
        name: data.name,
        slug: data.slug,
        edition: data.edition ?? null,
        description: data.description ?? null,
        format: data.format,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        maxPlayers: data.maxPlayers ?? null,
        matchesPerPlayer: data.format === TournamentFormat.IN_PERSON ? data.matchesPerPlayer ?? 4 : null,
        requiresDeckSubmission,
        registrationOpensAt: data.registrationOpensAt ? new Date(data.registrationOpensAt) : null,
        registrationClosesAt: data.registrationClosesAt
          ? new Date(data.registrationClosesAt)
          : null,
        bannerImageUrl: data.bannerImageUrl ?? null,
        themeMetadata: data.themeMetadata ?? undefined,
        rankingConfig: {
          version: "2.0.0",
          format: "MD1",
          winPoints: 3,
          lossPoints: 0,
          tiebreakers: ["wins", "wo_count_asc", "defended_badges", "opponent_win_rate"]
        },
        seasonId: activeSeason?.id ?? null,
        createdById: actor.id
      }
    });

    if (data.format === TournamentFormat.IN_PERSON) {
      const endDate = data.endDate ? new Date(data.endDate) : new Date(data.startDate);
      endDate.setHours(23, 59, 59, 999);
      await prisma.tournamentWeek.create({
        data: {
          tournamentId: tournament.id,
          weekNumber: 1,
          label: "Dia presencial",
          mode: WeekMode.PADRAO,
          multiplier: 1,
          startDate: new Date(data.startDate),
          endDate,
          lockAt: new Date(data.startDate),
          deckLockAt: new Date(data.startDate),
          status: WeekStatus.PLANNED
        }
      });

      const player = await prisma.player.findUnique({ where: { userId: actor.id }, select: { id: true } });
      if (player) {
        await prisma.tournamentRegistration.create({
          data: {
            tournamentId: tournament.id,
            playerId: player.id,
            status: RegistrationStatus.APPROVED,
            decidedAt: new Date(),
            decidedById: actor.id
          }
        });

        if (activeSeason) {
          await prisma.seasonPlayer.upsert({
            where: { seasonId_playerId: { seasonId: activeSeason.id, playerId: player.id } },
            update: { isActive: true, leftAt: null },
            create: { seasonId: activeSeason.id, playerId: player.id }
          });
        }
      }
    }

    await logAudit(actor.id, "tournament", tournament.id, "tournament.created", undefined, {
      name: tournament.name,
      slug: tournament.slug,
      code: tournament.code,
      format: tournament.format
    });

    revalidatePath("/torneios");
    return { slug: tournament.slug, id: tournament.id };
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues.map((i) => i.message).join(", ") };
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function updateTournament(
  raw: z.infer<typeof updateTournamentSchema>
): Promise<{ error?: string }> {
  try {
    const actor = await requireAdmin();
    const data = updateTournamentSchema.parse(raw);
    const { id, ...rest } = data;

    const before = await prisma.tournament.findUnique({ where: { id } });
    if (!before) return { error: "Torneio não encontrado." };

    await prisma.tournament.update({
      where: { id },
      data: {
        ...(rest.name ? { name: rest.name } : {}),
        ...(rest.slug ? { slug: rest.slug } : {}),
        ...(rest.edition !== undefined ? { edition: rest.edition ?? null } : {}),
        ...(rest.description !== undefined ? { description: rest.description ?? null } : {}),
        ...(rest.format !== undefined ? { format: rest.format } : {}),
        ...(rest.startDate ? { startDate: new Date(rest.startDate) } : {}),
        ...(rest.endDate !== undefined ? { endDate: rest.endDate ? new Date(rest.endDate) : null } : {}),
        ...(rest.maxPlayers !== undefined ? { maxPlayers: rest.maxPlayers ?? null } : {}),
        ...(rest.matchesPerPlayer !== undefined ? { matchesPerPlayer: rest.matchesPerPlayer ?? null } : {}),
        ...(rest.requiresDeckSubmission !== undefined ? { requiresDeckSubmission: rest.requiresDeckSubmission } : {}),
        ...(rest.bannerImageUrl !== undefined ? { bannerImageUrl: rest.bannerImageUrl ?? null } : {}),
        ...(rest.themeMetadata !== undefined
          ? { themeMetadata: rest.themeMetadata ?? undefined }
          : {})
      }
    });

    await logAudit(actor.id, "tournament", id, "tournament.updated", { name: before.name }, { name: rest.name ?? before.name });
    revalidatePath("/torneios");
    revalidatePath(`/torneios/${rest.slug ?? before.slug}`);
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues.map((i) => i.message).join(", ") };
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ─── Status transitions ──────────────────────────────────────────────────────

export async function deleteTournament(
  raw: z.infer<typeof deleteTournamentSchema>
): Promise<{ error?: string }> {
  try {
    const actor = await getSessionUser();
    if (!actor) return { error: "Nao autenticado." };
    const { tournamentId } = deleteTournamentSchema.parse(raw);

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        weeks: { select: { id: true } },
        _count: { select: { registrations: true } }
      }
    });

    if (!tournament) return { error: "Torneio nao encontrado." };
    if (!canManageTournament(actor, tournament)) return { error: "Voce nao pode deletar este torneio." };

    const weekIds = tournament.weeks.map((week) => week.id);

    await prisma.$transaction(async (tx) => {
      if (weekIds.length > 0) {
        const matches = await tx.match.findMany({
          where: { tournamentWeekId: { in: weekIds } },
          select: { id: true }
        });
        const matchIds = matches.map((match) => match.id);

        if (matchIds.length > 0) {
          await tx.challenge.deleteMany({
            where: { matchId: { in: matchIds } }
          });
        }

        await tx.matchConfirmation.deleteMany({
          where: { match: { tournamentWeekId: { in: weekIds } } }
        });
        await tx.match.deleteMany({ where: { tournamentWeekId: { in: weekIds } } });
      }

      await tx.playerBadge.deleteMany({ where: { badge: { tournamentId } } });
      await tx.leagueBadge.deleteMany({ where: { tournamentId } });
      await tx.deckSubmission.deleteMany({ where: { tournamentId } });
      await tx.tournamentRegistration.deleteMany({ where: { tournamentId } });
      await tx.tournamentWeek.deleteMany({ where: { tournamentId } });
      await tx.tournament.delete({ where: { id: tournamentId } });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          entityType: "tournament",
          entityId: tournamentId,
          action: "tournament.deleted",
          before: {
            name: tournament.name,
            slug: tournament.slug,
            code: tournament.code,
            registrations: tournament._count.registrations,
            weeks: tournament.weeks.length
          }
        }
      });
    });

    revalidatePath("/torneios");
    revalidatePath("/dashboard");
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues.map((i) => i.message).join(", ") };
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function updateTournamentSeason(
  raw: z.infer<typeof updateTournamentSeasonSchema>
): Promise<{ error?: string }> {
  try {
    const actor = await requireAdmin();
    const data = updateTournamentSeasonSchema.parse(raw);
    const seasonId = data.seasonId?.trim() || null;

    const tournament = await prisma.tournament.findUnique({
      where: { id: data.tournamentId },
      select: { id: true, slug: true, seasonId: true }
    });
    if (!tournament) return { error: "Torneio nao encontrado." };

    if (seasonId) {
      const season = await prisma.season.findUnique({ where: { id: seasonId }, select: { id: true } });
      if (!season) return { error: "Temporada nao encontrada." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.tournament.update({
        where: { id: data.tournamentId },
        data: { seasonId }
      });

      if (seasonId) {
        const weeks = await tx.tournamentWeek.findMany({
          where: { tournamentId: data.tournamentId },
          select: { id: true }
        });
        const weekIds = weeks.map((week) => week.id);

        if (weekIds.length > 0) {
          await tx.match.updateMany({
            where: { tournamentWeekId: { in: weekIds } },
            data: { seasonId }
          });
        }

        await tx.deckSubmission.updateMany({
          where: { tournamentId: data.tournamentId },
          data: { seasonId }
        });

        const registrations = await tx.tournamentRegistration.findMany({
          where: {
            tournamentId: data.tournamentId,
            status: { in: [RegistrationStatus.APPROVED, RegistrationStatus.PENDING] }
          },
          select: { playerId: true }
        });

        for (const registration of registrations) {
          await tx.seasonPlayer.upsert({
            where: {
              seasonId_playerId: {
                seasonId,
                playerId: registration.playerId
              }
            },
            update: { isActive: true, leftAt: null },
            create: { seasonId, playerId: registration.playerId }
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          entityType: "tournament",
          entityId: data.tournamentId,
          action: "tournament.season_updated",
          before: { seasonId: tournament.seasonId },
          after: { seasonId }
        }
      });
    });

    revalidatePath("/torneios");
    revalidatePath("/temporadas");
    revalidatePath("/torneios/" + tournament.slug);
    revalidatePath("/torneios/" + tournament.slug + "/admin");
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues.map((i) => i.message).join(", ") };
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function publishTournament(
  tournamentId: string
): Promise<{ error?: string }> {
  try {
    const actor = await getSessionUser();
    if (!actor) return { error: "Nao autenticado." };
    const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!t) return { error: "Torneio não encontrado." };
    if (!canManageTournament(actor, t)) return { error: "Voce nao pode publicar este torneio." };
    if (t.status !== TournamentStatus.DRAFT)
      return { error: "Apenas torneios em rascunho podem ser publicados." };

    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: TournamentStatus.REGISTRATION_OPEN }
    });

    await logAudit(actor.id, "tournament", tournamentId, "tournament.published", { status: "DRAFT" }, { status: "REGISTRATION_OPEN" });
    revalidatePath("/torneios");
    revalidatePath(`/torneios/${t.slug}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function startTournament(tournamentId: string): Promise<{ error?: string }> {
  try {
    const actor = await getSessionUser();
    if (!actor) return { error: "Nao autenticado." };
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        weeks: { orderBy: { weekNumber: "asc" } },
        registrations: {
          where: {
            status: { in: [RegistrationStatus.APPROVED, RegistrationStatus.PENDING] }
          },
          orderBy: { registeredAt: "asc" },
          include: { player: { select: { id: true } } }
        }
      }
    });

    if (!tournament) return { error: "Torneio nao encontrado." };
    if (!canManageTournament(actor, tournament)) return { error: "Voce nao pode gerenciar este torneio." };
    if (tournament.status !== TournamentStatus.REGISTRATION_OPEN) {
      return { error: "Apenas torneios com inscricoes abertas podem ser iniciados." };
    }
    if (tournament.weeks.length === 0) {
      return { error: "Configure ao menos um dia/semana antes de iniciar o torneio." };
    }
    if (tournament.registrations.length < 2) {
      return { error: "Precisa de pelo menos 2 jogadores inscritos para montar a chave." };
    }

    const existingMatches = await prisma.match.count({
      where: { tournamentWeekId: { in: tournament.weeks.map((week) => week.id) } }
    });
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const pendingPlayerIds = tournament.registrations
        .filter((registration) => registration.status === RegistrationStatus.PENDING)
        .map((registration) => registration.playerId);

      if (pendingPlayerIds.length > 0) {
        await tx.tournamentRegistration.updateMany({
          where: { tournamentId, playerId: { in: pendingPlayerIds } },
          data: {
            status: RegistrationStatus.APPROVED,
            decidedAt: now,
            decidedById: actor.id
          }
        });
      }

      if (tournament.seasonId) {
        for (const registration of tournament.registrations) {
          await tx.seasonPlayer.upsert({
            where: {
              seasonId_playerId: {
                seasonId: tournament.seasonId,
                playerId: registration.playerId
              }
            },
            update: { isActive: true, leftAt: null },
            create: { seasonId: tournament.seasonId, playerId: registration.playerId }
          });
        }
      }

      let createdMatches = 0;
      if (existingMatches === 0) {
        const playerIds = tournament.registrations.map((registration) => registration.player.id);
        const matches =
          tournament.format === TournamentFormat.IN_PERSON
            ? buildBalancedInPersonMatches(playerIds, tournament.matchesPerPlayer ?? 4).map((pairing) => ({
                seasonId: tournament.seasonId,
                tournamentWeekId: tournament.weeks[0].id,
                playerAId: pairing.playerAId,
                playerBId: pairing.playerBId,
                roundLabel: pairing.roundLabel,
                tableLabel: pairing.tableLabel,
                bestOf: 1,
                status: MatchStatus.PENDING_CONFIRMATION,
                resultSource: ResultSource.MANUAL,
                topOfDayEligible: true,
                createdById: actor.id
              }))
            : buildRoundRobinRounds(playerIds).flatMap((round, roundIndex) => {
                const week = tournament.weeks[roundIndex % tournament.weeks.length];

                return round.map((pairing, tableIndex) => ({
                  seasonId: tournament.seasonId,
                  tournamentWeekId: week.id,
                  playerAId: pairing.playerAId,
                  playerBId: pairing.playerBId,
                  roundLabel: "Rodada " + (roundIndex + 1),
                  tableLabel: "Mesa " + (tableIndex + 1),
                  bestOf: 1,
                  status: MatchStatus.PENDING_CONFIRMATION,
                  resultSource: ResultSource.MANUAL,
                  topOfDayEligible: true,
                  createdById: actor.id
                }));
              });

        if (matches.length > 0) {
          await tx.match.createMany({ data: matches });
          createdMatches = matches.length;
        }

        await Promise.all(
          tournament.weeks.map((week, index) =>
            tx.tournamentWeek.update({
              where: { id: week.id },
              data: { status: index === 0 ? WeekStatus.OPEN : WeekStatus.PLANNED }
            })
          )
        );
      }

      await tx.tournament.update({
        where: { id: tournamentId },
        data: { status: TournamentStatus.IN_PROGRESS }
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          entityType: "tournament",
          entityId: tournamentId,
          action: "tournament.started",
          before: { status: tournament.status },
          after: {
            status: TournamentStatus.IN_PROGRESS,
            generatedMatches: createdMatches,
            autoApprovedPlayers: pendingPlayerIds.length
          }
        }
      });

      return { createdMatches, autoApprovedPlayers: pendingPlayerIds.length };
    });

    revalidatePath("/torneios");
    revalidatePath("/torneios/" + tournament.slug);
    revalidatePath("/torneios/" + tournament.slug + "/admin");
    for (const week of tournament.weeks) {
      revalidatePath("/torneios/" + tournament.slug + "/semanas/" + week.weekNumber);
      revalidatePath("/torneios/" + tournament.slug + "/semanas/" + week.weekNumber + "/partidas");
    }

    if (existingMatches > 0) return {};
    if (result.createdMatches === 0) {
      return { error: "Torneio iniciado, mas nenhuma partida foi gerada." };
    }

    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function finishTournament(tournamentId: string): Promise<{ error?: string }> {
  try {
    const actor = await getSessionUser();
    if (!actor) return { error: "Nao autenticado." };
    const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!t) return { error: "Torneio não encontrado." };
    if (!canManageTournament(actor, t)) return { error: "Voce nao pode gerenciar este torneio." };
    if (t.status !== TournamentStatus.IN_PROGRESS)
      return { error: "Apenas torneios em andamento podem ser encerrados." };

    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: TournamentStatus.FINISHED }
    });

    await logAudit(actor.id, "tournament", tournamentId, "tournament.finished", { status: "IN_PROGRESS" }, { status: "FINISHED" });
    revalidatePath("/torneios");
    revalidatePath(`/torneios/${t.slug}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function updateTournamentWeekDeckLock(
  raw: z.infer<typeof updateWeekDeckLockSchema>
): Promise<{ error?: string }> {
  try {
    const actor = await requireAdmin();
    const data = updateWeekDeckLockSchema.parse(raw);
    const rawDate = data.deckLockAt?.trim();
    const deckLockAt = rawDate ? new Date(rawDate) : null;

    if (deckLockAt && Number.isNaN(deckLockAt.getTime())) {
      return { error: "Data de fechamento de decklist invalida." };
    }

    const before = await prisma.tournamentWeek.findUnique({
      where: { id: data.weekId },
      include: { tournament: { select: { slug: true } } }
    });
    if (!before) return { error: "Semana de torneio nao encontrada." };

    await prisma.tournamentWeek.update({
      where: { id: data.weekId },
      data: { deckLockAt }
    });

    await logAudit(
      actor.id,
      "tournamentWeek",
      data.weekId,
      "tournament_week.deck_lock_updated",
      { deckLockAt: before.deckLockAt?.toISOString() ?? null },
      { deckLockAt: deckLockAt?.toISOString() ?? null }
    );

    revalidatePath(`/torneios/${before.tournament.slug}/admin`);
    revalidatePath(`/torneios/${before.tournament.slug}/semanas/${before.weekNumber}`);
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues.map((i) => i.message).join(", ") };
    }

    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ─── Inscrições ──────────────────────────────────────────────────────────────

export async function updateTournamentWeekSettings(
  raw: z.infer<typeof updateTournamentWeekSettingsSchema>
): Promise<{ error?: string }> {
  try {
    const actor = await requireAdmin();
    const data = updateTournamentWeekSettingsSchema.parse(raw);
    const rawDate = data.deckLockAt?.trim();
    const deckLockAt = rawDate ? new Date(rawDate) : null;

    if (deckLockAt && Number.isNaN(deckLockAt.getTime())) {
      return { error: "Data de fechamento de decklist invalida." };
    }

    const before = await prisma.tournamentWeek.findUnique({
      where: { id: data.weekId },
      include: { tournament: { select: { slug: true } } }
    });
    if (!before) return { error: "Semana de torneio nao encontrada." };

    const label = data.label?.trim() || null;
    const notes = data.notes?.trim() || null;
    const updated = await prisma.tournamentWeek.update({
      where: { id: data.weekId },
      data: {
        label,
        mode: data.mode,
        status: data.status,
        deckLockAt,
        notes
      }
    });

    await logAudit(
      actor.id,
      "tournamentWeek",
      data.weekId,
      "tournament_week.settings_updated",
      {
        label: before.label,
        mode: before.mode,
        status: before.status,
        deckLockAt: before.deckLockAt?.toISOString() ?? null,
        notes: before.notes
      },
      {
        label: updated.label,
        mode: updated.mode,
        status: updated.status,
        deckLockAt: updated.deckLockAt?.toISOString() ?? null,
        notes: updated.notes
      }
    );

    revalidatePath("/torneios/" + before.tournament.slug);
    revalidatePath("/torneios/" + before.tournament.slug + "/admin");
    revalidatePath("/torneios/" + before.tournament.slug + "/semanas/" + before.weekNumber);
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues.map((i) => i.message).join(", ") };
    }

    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function addTournamentWeek(
  raw: z.infer<typeof addTournamentWeekSchema>
): Promise<{ error?: string }> {
  try {
    const actor = await requireAdmin();
    const { tournamentId } = addTournamentWeekSchema.parse(raw);

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { weeks: { orderBy: { weekNumber: "asc" } } }
    });

    if (!tournament) return { error: "Torneio nao encontrado." };

    const lastWeek = tournament.weeks.at(-1);
    const weekNumber = (lastWeek?.weekNumber ?? 0) + 1;
    const startDate = lastWeek ? new Date(lastWeek.endDate) : new Date(tournament.startDate);
    if (lastWeek) startDate.setUTCDate(startDate.getUTCDate() + 1);
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + 6);
    endDate.setUTCHours(23, 59, 59, 999);
    const deckLockAt = new Date(startDate);
    deckLockAt.setUTCHours(21, 0, 0, 0);

    const week = await prisma.tournamentWeek.create({
      data: {
        tournamentId,
        weekNumber,
        label: `Semana ${weekNumber}`,
        mode: WeekMode.PADRAO,
        multiplier: 1,
        startDate,
        endDate,
        lockAt: deckLockAt,
        deckLockAt,
        status: WeekStatus.PLANNED
      }
    });

    await logAudit(actor.id, "tournamentWeek", week.id, "tournament_week.created", undefined, {
      tournamentId,
      weekNumber
    });

    revalidatePath(`/torneios/${tournament.slug}`);
    revalidatePath(`/torneios/${tournament.slug}/admin`);
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues.map((i) => i.message).join(", ") };
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function removeTournamentWeek(
  raw: z.infer<typeof removeTournamentWeekSchema>
): Promise<{ error?: string }> {
  try {
    const actor = await requireAdmin();
    const { weekId } = removeTournamentWeekSchema.parse(raw);

    const week = await prisma.tournamentWeek.findUnique({
      where: { id: weekId },
      include: {
        tournament: { select: { slug: true } },
        matches: { select: { id: true } }
      }
    });

    if (!week) return { error: "Dia nao encontrado." };

    const matchIds = week.matches.map((match) => match.id);

    await prisma.$transaction(async (tx) => {
      if (matchIds.length > 0) {
        await tx.challenge.deleteMany({ where: { matchId: { in: matchIds } } });
        await tx.matchConfirmation.deleteMany({ where: { matchId: { in: matchIds } } });
        await tx.match.deleteMany({ where: { id: { in: matchIds } } });
      }

      await tx.deckSubmission.deleteMany({ where: { tournamentWeekId: week.id } });
      await tx.tournamentWeek.delete({ where: { id: week.id } });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          entityType: "tournamentWeek",
          entityId: week.id,
          action: "tournament_week.deleted",
          before: {
            tournamentId: week.tournamentId,
            weekNumber: week.weekNumber,
            matches: matchIds.length
          }
        }
      });
    });

    revalidatePath(`/torneios/${week.tournament.slug}`);
    revalidatePath(`/torneios/${week.tournament.slug}/admin`);
    revalidatePath("/ranking");
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues.map((i) => i.message).join(", ") };
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function addTournamentPlayer(
  raw: z.infer<typeof addTournamentPlayerSchema>
): Promise<{ error?: string }> {
  try {
    const actor = await getSessionUser();
    if (!actor) return { error: "Nao autenticado." };
    const data = addTournamentPlayerSchema.parse(raw);

    const [tournament, player] = await Promise.all([
      prisma.tournament.findUnique({ where: { id: data.tournamentId } }),
      prisma.player.findUnique({ where: { id: data.playerId }, select: { id: true, displayName: true } })
    ]);
    if (!tournament) return { error: "Torneio nao encontrado." };
    if (!player) return { error: "Jogador nao encontrado." };
    if (!canManageTournament(actor, tournament)) return { error: "Voce nao pode gerenciar este torneio." };
    if (tournament.status === TournamentStatus.FINISHED) return { error: "Torneio encerrado nao aceita novos jogadores." };

    if (tournament.maxPlayers) {
      const existing = await prisma.tournamentRegistration.findUnique({
        where: { tournamentId_playerId: { tournamentId: tournament.id, playerId: player.id } }
      });
      if (!existing) {
        const count = await prisma.tournamentRegistration.count({
          where: { tournamentId: tournament.id, status: { in: [RegistrationStatus.APPROVED, RegistrationStatus.PENDING] } }
        });
        if (count >= tournament.maxPlayers) return { error: `Limite de ${tournament.maxPlayers} jogadores atingido.` };
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.tournamentRegistration.upsert({
        where: {
          tournamentId_playerId: {
            tournamentId: tournament.id,
            playerId: player.id
          }
        },
        update: {
          status: RegistrationStatus.APPROVED,
          decidedAt: new Date(),
          decidedById: actor.id
        },
        create: {
          tournamentId: tournament.id,
          playerId: player.id,
          status: RegistrationStatus.APPROVED,
          decidedAt: new Date(),
          decidedById: actor.id
        }
      });

      if (tournament.seasonId) {
        await tx.seasonPlayer.upsert({
          where: { seasonId_playerId: { seasonId: tournament.seasonId, playerId: player.id } },
          update: { isActive: true, leftAt: null },
          create: { seasonId: tournament.seasonId, playerId: player.id }
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          entityType: "tournamentRegistration",
          entityId: tournament.id,
          action: "registration.added_by_manager",
          after: { playerId: player.id, playerName: player.displayName }
        }
      });
    });

    revalidatePath(`/torneios/${tournament.slug}`);
    revalidatePath(`/torneios/${tournament.slug}/inscricoes`);
    revalidatePath(`/torneios/${tournament.slug}/admin`);
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues.map((i) => i.message).join(", ") };
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function applyTournamentWeekBonus(
  raw: z.infer<typeof applyWeekBonusSchema>
): Promise<{ error?: string }> {
  try {
    const actor = await requireAdmin();
    const data = applyWeekBonusSchema.parse(raw);

    const [week, player] = await Promise.all([
      prisma.tournamentWeek.findUnique({
        where: { id: data.weekId },
        include: { tournament: { select: { slug: true, season: { select: { slug: true } } } } }
      }),
      prisma.player.findUnique({ where: { id: data.playerId }, select: { displayName: true } })
    ]);

    if (!week) return { error: "Dia nao encontrado." };
    if (!player) return { error: "Jogador nao encontrado." };

    const currentRule =
      week.bonusRule && typeof week.bonusRule === "object" && !Array.isArray(week.bonusRule)
        ? (week.bonusRule as Record<string, unknown>)
        : {};
    const currentBonuses = Array.isArray(currentRule.manualBonuses)
      ? (currentRule.manualBonuses as Array<Record<string, unknown>>)
      : [];

    const manualBonuses: Prisma.InputJsonArray = [
      ...currentBonuses
        .filter((bonus) => bonus.playerId !== data.playerId)
        .map((bonus) => bonus as Prisma.InputJsonObject),
      {
        playerId: data.playerId,
        playerName: player.displayName,
        points: data.points,
        reason: data.reason?.trim() || "Bonus manual do modo de jogo",
        awardedById: actor.id,
        awardedAt: new Date().toISOString()
      }
    ].filter((bonus) => Number(bonus.points) !== 0);

    const bonusRule: Prisma.InputJsonObject = { ...currentRule, manualBonuses };

    await prisma.$transaction([
      prisma.tournamentWeek.update({
        where: { id: week.id },
        data: { bonusRule }
      }),
      prisma.auditLog.create({
        data: {
          actorUserId: actor.id,
          entityType: "tournamentWeek",
          entityId: week.id,
          action: "tournament_week.manual_bonus_applied",
          after: {
            playerId: data.playerId,
            playerName: player.displayName,
            points: data.points,
            reason: data.reason ?? null
          }
        }
      })
    ]);

    revalidatePath(`/torneios/${week.tournament.slug}/admin`);
    revalidatePath(`/torneios/${week.tournament.slug}/semanas/${week.weekNumber}`);
    revalidatePath(`/torneios/${week.tournament.slug}/ranking`);
    if (week.tournament.season?.slug) revalidatePath(`/temporadas/${week.tournament.season.slug}/ranking`);
    revalidatePath("/ranking");
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues.map((i) => i.message).join(", ") };
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function setTournamentWeekTeam(
  raw: z.infer<typeof setWeekTeamSchema>
): Promise<{ error?: string }> {
  try {
    const actor = await requireAdmin();
    const data = setWeekTeamSchema.parse(raw);

    const [week, player] = await Promise.all([
      prisma.tournamentWeek.findUnique({
        where: { id: data.weekId },
        include: { tournament: { select: { slug: true } } }
      }),
      prisma.player.findUnique({ where: { id: data.playerId }, select: { displayName: true } })
    ]);

    if (!week) return { error: "Dia nao encontrado." };
    if (!player) return { error: "Jogador nao encontrado." };

    const currentRule =
      week.bonusRule && typeof week.bonusRule === "object" && !Array.isArray(week.bonusRule)
        ? (week.bonusRule as Record<string, unknown>)
        : {};
    const currentTeams = Array.isArray(currentRule.teamAssignments)
      ? (currentRule.teamAssignments as Array<Record<string, unknown>>)
      : [];
    const teamName = data.teamName?.trim();
    const teamAssignments = currentTeams
      .filter((assignment) => assignment.playerId !== data.playerId)
      .map((assignment) => assignment as Prisma.InputJsonObject);
    const nextTeamAssignments: Prisma.InputJsonArray = teamName
      ? [
          ...teamAssignments,
          {
            playerId: data.playerId,
            playerName: player.displayName,
            teamName,
            assignedById: actor.id,
            assignedAt: new Date().toISOString()
          }
        ]
      : teamAssignments;

    await prisma.$transaction([
      prisma.tournamentWeek.update({
        where: { id: week.id },
        data: { bonusRule: { ...currentRule, teamAssignments: nextTeamAssignments } }
      }),
      prisma.auditLog.create({
        data: {
          actorUserId: actor.id,
          entityType: "tournamentWeek",
          entityId: week.id,
          action: "tournament_week.team_assignment_updated",
          after: { playerId: data.playerId, playerName: player.displayName, teamName: teamName ?? null }
        }
      })
    ]);

    revalidatePath(`/torneios/${week.tournament.slug}/semanas/${week.weekNumber}`);
    revalidatePath(`/torneios/${week.tournament.slug}/semanas/${week.weekNumber}/partidas`);
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues.map((i) => i.message).join(", ") };
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function submitTournamentWeekDeck(
  raw: z.infer<typeof submitTournamentWeekDeckSchema>
): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Nao autenticado." };

    const player = await prisma.player.findUnique({ where: { userId: user.id } });
    if (!player) return { error: "Perfil de jogador nao encontrado." };

    const data = submitTournamentWeekDeckSchema.parse(raw);
    const week = await prisma.tournamentWeek.findUnique({
      where: { id: data.tournamentWeekId },
      include: {
        tournament: {
          select: {
            id: true,
            slug: true,
            seasonId: true
          }
        }
      }
    });
    if (!week) return { error: "Dia de campeonato nao encontrado." };

    const seasonId = week.tournament.seasonId;
    if (!seasonId) {
      return { error: "Este campeonato ainda nao esta vinculado a uma temporada." };
    }

    const registration = await prisma.tournamentRegistration.findUnique({
      where: {
        tournamentId_playerId: {
          tournamentId: week.tournamentId,
          playerId: player.id
        }
      },
      select: { status: true }
    });

    if (
      !canSubmitTournamentWeekDeck({
        viewerRole: user.role,
        registrationStatus: registration?.status ?? null,
        week
      })
    ) {
      return isDeckRegistrationLocked(week)
        ? { error: "O prazo de cadastro de decklist para este dia ja foi fechado." }
        : { error: "Apenas jogadores inscritos neste campeonato podem enviar decklist." };
    }

    const deadline = getDeckSubmissionDeadline(week) ?? week.endDate;
    const now = new Date();
    const existing = await prisma.deckSubmission.findFirst({
      where: {
        tournamentWeekId: week.id,
        playerId: player.id,
        deckNumber: data.deckNumber
      }
    });

    const payload = {
      seasonId,
      tournamentId: week.tournamentId,
      tournamentWeekId: week.id,
      playerId: player.id,
      deckNumber: data.deckNumber,
      deckName: data.deckName,
      archetype: data.archetype || null,
      deckList: data.deckList,
      deadlineAt: deadline,
      status: DeckSubmissionStatus.SUBMITTED,
      editedAt: existing ? now : null,
      isLate: now > deadline
    };

    const submission = existing
      ? await prisma.deckSubmission.update({
          where: { id: existing.id },
          data: payload
        })
      : await prisma.deckSubmission.create({
          data: payload
        });

    await logAudit(
      user.id,
      "deckSubmission",
      submission.id,
      existing ? "deck_submission.updated" : "deck_submission.created",
      existing
        ? {
            deckName: existing.deckName,
            deckNumber: existing.deckNumber,
            status: existing.status
          }
        : undefined,
      {
        deckName: submission.deckName,
        deckNumber: submission.deckNumber,
        tournamentWeekId: week.id
      }
    );

    revalidatePath("/torneios/" + week.tournament.slug);
    revalidatePath("/torneios/" + week.tournament.slug + "/semanas/" + week.weekNumber);
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues.map((i) => i.message).join(", ") };
    }

    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function selfRegister(
  tournamentId: string
): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };

    const player = await prisma.player.findUnique({ where: { userId: user.id } });
    if (!player) return { error: "Perfil de jogador não encontrado." };

    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) return { error: "Torneio não encontrado." };

    if (
      tournament.status !== TournamentStatus.REGISTRATION_OPEN &&
      tournament.status !== TournamentStatus.IN_PROGRESS
    ) {
      return { error: "Inscrições não estão abertas para este torneio." };
    }

    if (tournament.maxPlayers) {
      const count = await prisma.tournamentRegistration.count({
        where: {
          tournamentId,
          status: { in: [RegistrationStatus.APPROVED, RegistrationStatus.PENDING] }
        }
      });
      if (count >= tournament.maxPlayers)
        return { error: "Torneio com vagas esgotadas." };
    }

    const existing = await prisma.tournamentRegistration.findUnique({
      where: { tournamentId_playerId: { tournamentId, playerId: player.id } }
    });
    const registrationStatus =
      tournament.format === TournamentFormat.IN_PERSON ? RegistrationStatus.APPROVED : RegistrationStatus.PENDING;
    const decidedAt = tournament.format === TournamentFormat.IN_PERSON ? new Date() : null;
    const decidedById = tournament.format === TournamentFormat.IN_PERSON ? user.id : null;

    if (existing) {
      if (existing.status === RegistrationStatus.WITHDRAWN) {
        // Reinscrição após saída
        await prisma.tournamentRegistration.update({
          where: { tournamentId_playerId: { tournamentId, playerId: player.id } },
          data: { status: registrationStatus, decidedAt, decidedById }
        });
      } else {
        return { error: "Você já está inscrito neste torneio." };
      }
    } else {
      await prisma.tournamentRegistration.create({
        data: {
          tournamentId,
          playerId: player.id,
          status: registrationStatus,
          decidedAt,
          decidedById
        }
      });
    }

    if (tournament.format === TournamentFormat.IN_PERSON && tournament.seasonId) {
      await prisma.seasonPlayer.upsert({
        where: { seasonId_playerId: { seasonId: tournament.seasonId, playerId: player.id } },
        update: { isActive: true, leftAt: null },
        create: { seasonId: tournament.seasonId, playerId: player.id }
      });
    }

    await logAudit(user.id, "tournamentRegistration", tournamentId, "registration.self_registered", undefined, { playerId: player.id });
    revalidatePath(`/torneios/${tournament.slug}`);
    revalidatePath(`/torneios/${tournament.slug}/inscricoes`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function approveRegistration(
  tournamentId: string,
  playerId: string
): Promise<{ error?: string }> {
  try {
    const actor = await requireAdmin();

    const reg = await prisma.tournamentRegistration.findUnique({
      where: { tournamentId_playerId: { tournamentId, playerId } }
    });
    if (!reg) return { error: "Inscrição não encontrada." };
    if (reg.status !== RegistrationStatus.PENDING)
      return { error: "Inscrição não está pendente." };

    const t = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { slug: true, seasonId: true, maxPlayers: true }
    });

    if (t?.maxPlayers) {
      const count = await prisma.tournamentRegistration.count({
        where: { tournamentId, status: RegistrationStatus.APPROVED }
      });
      if (count >= t.maxPlayers) return { error: `Limite de ${t.maxPlayers} jogadores aprovados atingido.` };
    }

    await prisma.tournamentRegistration.update({
      where: { tournamentId_playerId: { tournamentId, playerId } },
      data: {
        status: RegistrationStatus.APPROVED,
        decidedAt: new Date(),
        decidedById: actor.id
      }
    });

    if (t?.seasonId) {
      await prisma.seasonPlayer.upsert({
        where: {
          seasonId_playerId: {
            seasonId: t.seasonId,
            playerId
          }
        },
        update: { isActive: true, leftAt: null },
        create: { seasonId: t.seasonId, playerId }
      });
    }

    await logAudit(actor.id, "tournamentRegistration", reg.id, "registration.approved", { status: "PENDING" }, { status: "APPROVED" });
    revalidatePath(`/torneios/${t?.slug ?? tournamentId}/inscricoes`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function rejectRegistration(
  tournamentId: string,
  playerId: string
): Promise<{ error?: string }> {
  try {
    const actor = await requireAdmin();

    const reg = await prisma.tournamentRegistration.findUnique({
      where: { tournamentId_playerId: { tournamentId, playerId } }
    });
    if (!reg) return { error: "Inscrição não encontrada." };

    await prisma.tournamentRegistration.update({
      where: { tournamentId_playerId: { tournamentId, playerId } },
      data: {
        status: RegistrationStatus.REJECTED,
        decidedAt: new Date(),
        decidedById: actor.id
      }
    });

    const t = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { slug: true } });
    await logAudit(actor.id, "tournamentRegistration", reg.id, "registration.rejected", { status: reg.status }, { status: "REJECTED" });
    revalidatePath(`/torneios/${t?.slug ?? tournamentId}/inscricoes`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function withdrawRegistration(
  tournamentId: string
): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await prisma.player.findUnique({ where: { userId: user.id } });
    if (!player) return { error: "Jogador não encontrado." };

    const reg = await prisma.tournamentRegistration.findUnique({
      where: { tournamentId_playerId: { tournamentId, playerId: player.id } }
    });
    if (!reg) return { error: "Inscrição não encontrada." };
    if (reg.status === RegistrationStatus.WITHDRAWN) return {};

    await prisma.tournamentRegistration.update({
      where: { tournamentId_playerId: { tournamentId, playerId: player.id } },
      data: { status: RegistrationStatus.WITHDRAWN }
    });

    const t = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { slug: true } });
    await logAudit(user.id, "tournamentRegistration", reg.id, "registration.withdrawn", { status: reg.status }, { status: "WITHDRAWN" });
    revalidatePath(`/torneios/${t?.slug ?? tournamentId}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ─── Reabrir inscrições ───────────────────────────────────────────────────────

export async function reopenRegistrations(tournamentId: string): Promise<{ error?: string }> {
  try {
    const actor = await requireAdmin();
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, status: true, slug: true }
    });
    if (!tournament) return { error: "Torneio não encontrado." };
    if (tournament.status === TournamentStatus.FINISHED)
      return { error: "Não é possível reabrir inscrições de um torneio encerrado." };

    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: TournamentStatus.REGISTRATION_OPEN }
    });
    await logAudit(actor.id, "tournament", tournamentId, "tournament.registrations_reopened",
      { status: tournament.status }, { status: TournamentStatus.REGISTRATION_OPEN });
    revalidatePath(`/torneios/${tournament.slug}`);
    revalidatePath(`/torneios/${tournament.slug}/admin`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function removePlayerRegistration(
  tournamentId: string,
  playerId: string
): Promise<{ error?: string }> {
  try {
    const actor = await requireAdmin();
    const reg = await prisma.tournamentRegistration.findUnique({
      where: { tournamentId_playerId: { tournamentId, playerId } }
    });
    if (!reg) return { error: "Inscrição não encontrada." };

    await prisma.tournamentRegistration.update({
      where: { tournamentId_playerId: { tournamentId, playerId } },
      data: { status: RegistrationStatus.REJECTED, decidedAt: new Date(), decidedById: actor.id }
    });
    const t = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { slug: true } });
    await logAudit(actor.id, "tournamentRegistration", reg.id, "registration.removed_by_admin",
      { status: reg.status }, { status: "REJECTED" });
    revalidatePath(`/torneios/${t?.slug}/inscricoes`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ─── Seed default weeks ──────────────────────────────────────────────────────

const defaultWeekDefs = [
  { weekNumber: 1, label: "Semana 1 — Padrão",           mode: WeekMode.PADRAO,                 multiplier: 1, daysOffset: 0  },
  { weekNumber: 2, label: "Semana 2 — GLC",              mode: WeekMode.GLC,                    multiplier: 1, daysOffset: 7  },
  { weekNumber: 3, label: "Semana 3 — Padrão",           mode: WeekMode.PADRAO,                 multiplier: 1, daysOffset: 14 },
  { weekNumber: 4, label: "Semana 4 — Duplas Sincronizadas", mode: WeekMode.DUPLAS_SINCRONIZADAS, multiplier: 1, daysOffset: 21 },
  { weekNumber: 5, label: "Semana 5 — Pontuação Dobrada", mode: WeekMode.PONTUACAO_DOBRADA,     multiplier: 2, daysOffset: 28 },
  { weekNumber: 6, label: "Semana 6 — Construtor Misterioso", mode: WeekMode.CONSTRUTOR_MISTERIOSO, multiplier: 1, daysOffset: 35 },
  { weekNumber: 7, label: "Semana 7 — Guerra de Times",  mode: WeekMode.GUERRA_DE_TIMES,        multiplier: 1, daysOffset: 42 },
  { weekNumber: 8, label: "Semana 8 — Batalha Final",    mode: WeekMode.BATALHA_FINAL,          multiplier: 1, daysOffset: 49 }
];

export async function seedDefaultWeeks(tournamentId: string): Promise<{ error?: string }> {
  try {
    const actor = await requireAdmin();

    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) return { error: "Torneio não encontrado." };

    const base = new Date(tournament.startDate);

    for (const wk of defaultWeekDefs) {
      const startDate = new Date(base);
      startDate.setUTCDate(startDate.getUTCDate() + wk.daysOffset);

      const endDate = new Date(startDate);
      endDate.setUTCDate(endDate.getUTCDate() + 6);
      endDate.setUTCHours(23, 59, 59, 999);

      const lockAt = new Date(endDate);
      lockAt.setUTCDate(lockAt.getUTCDate() - 2);
      lockAt.setUTCHours(21, 0, 0, 0);

      await prisma.tournamentWeek.upsert({
        where: { tournamentId_weekNumber: { tournamentId, weekNumber: wk.weekNumber } },
        update: {
          mode: wk.mode,
          multiplier: wk.multiplier,
          lockAt,
          deckLockAt: lockAt,
          status: WeekStatus.PLANNED
        },
        create: {
          tournamentId,
          weekNumber: wk.weekNumber,
          label: wk.label,
          mode: wk.mode,
          multiplier: wk.multiplier,
          startDate,
          endDate,
          lockAt,
          deckLockAt: lockAt,
          status: WeekStatus.PLANNED
        }
      });
    }

    await logAudit(actor.id, "tournament", tournamentId, "tournament.weeks_seeded", undefined, { weeks: 8 });
    revalidatePath(`/torneios/${tournament.slug}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
