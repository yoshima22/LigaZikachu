"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  BoosterCodeStatus,
  DistributionReason,
  DistributionStatus,
  GiftType,
  type Prisma
} from "@prisma/client";
import { getSessionUser, isAdmin, requireAdmin } from "@/lib/auth/permissions";
import {
  assertNoDuplicateCodes,
  findDuplicateCodesInDatabase,
  normalizeBoosterCode,
  reserveBoosterCodes,
  distributeBoosterCodesToPlayer
} from "@/lib/codes";
import { prisma } from "@/lib/prisma";

const importCodesSchema = z.object({
  rawCodes: z.string().min(1, "Informe ao menos um codigo."),
  seasonId: z.string().nullish(),
  sourceBatch: z.string().max(120).nullish(),
  rewardLabel: z.string().max(120).nullish(),
  expiresAt: z.string().nullish(),
  notes: z.string().max(1000).nullish()
});

const reserveCodesSchema = z.object({
  playerId: z.string().min(1, "Selecione um jogador."),
  seasonId: z.string().nullish(),
  quantity: z.number().int().min(1).max(500),
  reason: z.nativeEnum(DistributionReason),
  reasonDetail: z.string().max(240).nullish()
});

const assignSpecificCodesSchema = z.object({
  playerId: z.string().min(1, "Selecione um jogador."),
  boosterCodeIds: z.array(z.string().min(1)).min(1, "Selecione ao menos um codigo."),
  reason: z.nativeEnum(DistributionReason).default(DistributionReason.MANUAL_ADJUSTMENT),
  reasonDetail: z.string().max(240).nullish()
});

const idSchema = z.object({
  id: z.string().min(1)
});

const listCodesSchema = z.object({
  search: z.string().max(100).optional(),
  status: z.nativeEnum(BoosterCodeStatus).optional(),
  playerId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
});

export async function listBoosterCodesAction(
  input: z.infer<typeof listCodesSchema>
) {
  const admin = await requireAdmin();
  const data = listCodesSchema.parse(input);

  const where: Prisma.BoosterCodeWhereInput = {};

  if (data.search) {
    where.code = { contains: data.search, mode: "insensitive" };
  }
  if (data.status) {
    where.status = data.status;
  }
  if (data.playerId) {
    where.distributions = {
      some: {
        playerId: data.playerId,
        status: { not: DistributionStatus.REVOKED }
      }
    };
  }

  const skip = (data.page - 1) * data.pageSize;

  const [codes, total] = await Promise.all([
    prisma.boosterCode.findMany({
      where,
      include: {
        season: { select: { name: true } },
        distributions: {
          include: {
            player: { select: { displayName: true } },
            assignedBy: { select: { name: true, email: true } }
          },
          orderBy: { assignedAt: "desc" },
          take: 1
        }
      },
      orderBy: [{ status: "asc" }, { importedAt: "desc" }],
      skip,
      take: data.pageSize,
    }),
    prisma.boosterCode.count({ where }),
  ]);

  return {
    codes,
    total,
    page: data.page,
    pageSize: data.pageSize,
    totalPages: Math.ceil(total / data.pageSize),
  };
}

export async function importBoosterCodesAction(
  input: z.infer<typeof importCodesSchema>
): Promise<{ error?: string; imported?: number; skipped?: string[] }> {
  try {
    const actor = await requireAdmin();
    const data = importCodesSchema.parse(input);
    const parsedCodes = parseRawCodes(data.rawCodes);
    const normalizedCodes = assertNoDuplicateCodes(parsedCodes);

    if (normalizedCodes.length === 0) {
      return { error: "Nenhum codigo valido foi encontrado." };
    }

    const duplicates = await findDuplicateCodesInDatabase(normalizedCodes);
    const duplicateCodes = duplicates.map((d) => d.code);
    const codesToImport = normalizedCodes.filter((code) => !duplicateCodes.includes(code));

    if (codesToImport.length === 0) {
      return {
        error: "Todos os codigos ja estao cadastrados.",
        skipped: duplicateCodes
      };
    }

    const seasonId = normalizeOptionalId(data.seasonId);
    const expiresAt = parseOptionalDate(data.expiresAt);
    const sourceBatch = normalizeOptionalString(data.sourceBatch);
    const rewardLabel = normalizeOptionalString(data.rewardLabel);
    const notes = normalizeOptionalString(data.notes);

    await prisma.$transaction(async (tx) => {
      await tx.boosterCode.createMany({
        data: codesToImport.map((code) => ({
          code,
          seasonId,
          sourceBatch,
          rewardLabel,
          expiresAt,
          notes,
          createdById: actor.id
        }))
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          entityType: "boosterCode",
          entityId: sourceBatch ?? "manual-import",
          action: "booster_codes.imported",
          after: {
            count: codesToImport.length,
            skipped: duplicateCodes.length,
            seasonId,
            sourceBatch,
            rewardLabel,
            expiresAt: expiresAt?.toISOString() ?? null
          }
        }
      });
    });

    revalidatePath("/codigos");
    return {
      imported: codesToImport.length,
      skipped: duplicateCodes.length > 0 ? duplicateCodes : undefined
    };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues.map((issue) => issue.message).join(", ") };
    }

    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function reserveCodesForPlayerAction(
  input: z.infer<typeof reserveCodesSchema>
): Promise<{ error?: string; distributed?: number }> {
  try {
    const actor = await requireAdmin();
    const data = reserveCodesSchema.parse(input);
    const seasonId = normalizeOptionalId(data.seasonId);
    const reasonDetail = normalizeOptionalString(data.reasonDetail);

    const player = await prisma.player.findUnique({
      where: { id: data.playerId },
      select: { id: true, displayName: true }
    });

    if (!player) {
      return { error: "Jogador nao encontrado." };
    }

    const distributedCodes = await reserveBoosterCodes({
      playerId: data.playerId,
      assignedById: actor.id,
      quantity: data.quantity,
      seasonId: seasonId ?? undefined,
      reason: data.reason,
      reasonDetail: reasonDetail ?? undefined
    });

    await createGiftsForDistributedCodes({
      actorId: actor.id,
      playerId: data.playerId,
      playerName: player.displayName,
      codes: distributedCodes,
      reason: data.reason,
      reasonDetail
    });

    revalidatePath("/codigos");
    revalidatePath("/caixa-de-presentes");
    revalidatePath(`/jogadores/${data.playerId}`);
    return { distributed: distributedCodes.length };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues.map((issue) => issue.message).join(", ") };
    }

    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function assignSpecificCodesToPlayerAction(
  input: z.infer<typeof assignSpecificCodesSchema>
): Promise<{ error?: string; distributed?: number }> {
  try {
    const actor = await requireAdmin();
    const data = assignSpecificCodesSchema.parse(input);
    const reasonDetail = normalizeOptionalString(data.reasonDetail);

    const player = await prisma.player.findUnique({
      where: { id: data.playerId },
      select: { id: true, displayName: true }
    });

    if (!player) return { error: "Jogador nao encontrado." };

    const distributedCodes = await distributeBoosterCodesToPlayer({
      playerId: data.playerId,
      assignedById: actor.id,
      boosterCodeIds: data.boosterCodeIds,
      reason: data.reason,
      reasonDetail: reasonDetail ?? undefined
    });

    await createGiftsForDistributedCodes({
      actorId: actor.id,
      playerId: data.playerId,
      playerName: player.displayName,
      codes: distributedCodes,
      reason: data.reason,
      reasonDetail
    });

    revalidatePath("/codigos");
    revalidatePath("/caixa-de-presentes");
    revalidatePath(`/jogadores/${data.playerId}`);
    return { distributed: distributedCodes.length };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues.map((issue) => issue.message).join(", ") };
    }

    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function deleteBoosterCodeAction(
  input: z.infer<typeof idSchema>
): Promise<{ error?: string }> {
  try {
    const actor = await requireAdmin();
    const { id } = idSchema.parse(input);

    const code = await prisma.boosterCode.findUnique({
      where: { id },
      include: { distributions: { select: { id: true, status: true, playerId: true } } }
    });

    if (!code) return { error: "Codigo nao encontrado." };

    await prisma.$transaction(async (tx) => {
      await deleteGiftsForCode(
        tx,
        code.id,
        code.distributions.map((distribution) => distribution.id),
        code.code
      );

      await tx.boosterCode.delete({ where: { id: code.id } });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          entityType: "boosterCode",
          entityId: code.id,
          action: "booster_code.deleted",
          before: {
            code: code.code,
            status: code.status,
            distributions: code.distributions.length
          }
        }
      });
    });

    revalidatePath("/codigos");
    revalidatePath("/caixa-de-presentes");
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues.map((issue) => issue.message).join(", ") };
    }

    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function markCodeRedeemedAction(
  input: z.infer<typeof idSchema>
): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Nao autenticado." };

    const { id } = idSchema.parse(input);
    const distribution = await prisma.codeDistribution.findUnique({
      where: { id },
      include: {
        boosterCode: { select: { id: true, code: true, status: true } },
        player: { select: { id: true, userId: true } }
      }
    });

    if (!distribution) {
      return { error: "Distribuicao nao encontrada." };
    }

    const admin = isAdmin(user.role);
    if (!admin && distribution.player?.userId !== user.id) {
      return { error: "Sem permissao para alterar este codigo." };
    }

    if (distribution.status !== DistributionStatus.ASSIGNED) {
      return { error: "Apenas codigos atribuidos podem ser marcados como resgatados." };
    }

    await prisma.$transaction([
      prisma.codeDistribution.update({
        where: { id },
        data: {
          status: DistributionStatus.REDEEMED,
          redeemedAt: new Date()
        }
      }),
      prisma.boosterCode.update({
        where: { id: distribution.boosterCodeId },
        data: { status: BoosterCodeStatus.REDEEMED }
      }),
      prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          entityType: "codeDistribution",
          entityId: distribution.id,
          action: "booster_code.redeemed",
          before: {
            distributionStatus: distribution.status,
            codeStatus: distribution.boosterCode.status
          },
          after: {
            distributionStatus: DistributionStatus.REDEEMED,
            codeStatus: BoosterCodeStatus.REDEEMED
          }
        }
      })
    ]);

    revalidatePath("/codigos");
    if (distribution.playerId) revalidatePath(`/jogadores/${distribution.playerId}`);
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues.map((issue) => issue.message).join(", ") };
    }

    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function revokeCodeDistributionAction(
  input: z.infer<typeof idSchema>
): Promise<{ error?: string }> {
  try {
    const actor = await requireAdmin();
    const { id } = idSchema.parse(input);
    const distribution = await prisma.codeDistribution.findUnique({
      where: { id },
      include: {
        boosterCode: { select: { id: true, code: true, status: true } }
      }
    });

    if (!distribution) {
      return { error: "Distribuicao nao encontrada." };
    }

    if (distribution.status === DistributionStatus.REVOKED) {
      return {};
    }

    if (distribution.status === DistributionStatus.REDEEMED) {
      return { error: "Codigo ja resgatado nao pode ser revogado." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.codeDistribution.update({
        where: { id },
        data: {
          playerId: null,
          status: DistributionStatus.REVOKED,
          revokedAt: new Date(),
          revokedById: actor.id
        }
      });

      await tx.boosterCode.update({
        where: { id: distribution.boosterCodeId },
        data: { status: BoosterCodeStatus.AVAILABLE }
      });

      await deleteGiftsForCode(
        tx,
        distribution.boosterCodeId,
        [distribution.id],
        distribution.boosterCode.code,
        distribution.playerId
      );

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          entityType: "codeDistribution",
          entityId: distribution.id,
          action: "booster_code.revoked",
          before: {
            distributionStatus: distribution.status,
            codeStatus: distribution.boosterCode.status
          },
          after: {
            distributionStatus: DistributionStatus.REVOKED,
            codeStatus: BoosterCodeStatus.AVAILABLE
          }
        }
      });
    });

    revalidatePath("/codigos");
    revalidatePath("/caixa-de-presentes");
    if (distribution.playerId) revalidatePath(`/jogadores/${distribution.playerId}`);
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues.map((issue) => issue.message).join(", ") };
    }

    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function invalidateBoosterCodeAction(
  input: z.infer<typeof idSchema>
): Promise<{ error?: string }> {
  try {
    const actor = await requireAdmin();
    const { id } = idSchema.parse(input);
    const code = await prisma.boosterCode.findUnique({
      where: { id },
      select: { id: true, code: true, status: true }
    });

    if (!code) {
      return { error: "Codigo nao encontrado." };
    }

    if (code.status !== BoosterCodeStatus.AVAILABLE) {
      return { error: "Apenas codigos disponiveis podem ser invalidados." };
    }

    await prisma.$transaction([
      prisma.boosterCode.update({
        where: { id },
        data: {
          status: BoosterCodeStatus.INVALIDATED,
          invalidatedAt: new Date(),
          invalidatedById: actor.id
        }
      }),
      prisma.auditLog.create({
        data: {
          actorUserId: actor.id,
          entityType: "boosterCode",
          entityId: code.id,
          action: "booster_code.invalidated",
          before: { status: code.status },
          after: { status: BoosterCodeStatus.INVALIDATED }
        }
      })
    ]);

    revalidatePath("/codigos");
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues.map((issue) => issue.message).join(", ") };
    }

    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

function parseRawCodes(rawCodes: string) {
  const trimmed = rawCodes.trim();
  if (!trimmed) return [];

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const firstLineCells = splitCsvLine(lines[0]).map((cell) => cell.trim().toLowerCase());
  const codeColumnIndex = firstLineCells.indexOf("code");

  if (codeColumnIndex >= 0) {
    return lines
      .slice(1)
      .map((line) => splitCsvLine(line)[codeColumnIndex] ?? "")
      .map(normalizeBoosterCode)
      .filter(Boolean);
  }

  // Suporta separadores: nova linha, vírgula, ponto-e-vírgula, espaço, tab
  // Remove ; no final de cada linha antes de processar
  const cleaned = trimmed
    .split(/\r?\n/)
    .map((line) => line.replace(/;+\s*$/, "").trim())
    .filter(Boolean)
    .join("\n");

  return cleaned
    .split(/[\r?\n,;\s]+/)
    .map((code) => code.trim())
    .filter((code) => code.length > 0)
    .map(normalizeBoosterCode)
    .filter(Boolean);
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function normalizeOptionalId(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

type DistributedCodeWithRelations = Awaited<ReturnType<typeof reserveBoosterCodes>>[number];

async function createGiftsForDistributedCodes({
  actorId,
  playerId,
  playerName,
  codes,
  reason,
  reasonDetail
}: {
  actorId: string;
  playerId: string;
  playerName: string;
  codes: DistributedCodeWithRelations[];
  reason: DistributionReason;
  reasonDetail?: string | null;
}) {
  const giftPayloads = codes.map((code) => {
    const distribution = code.distributions.find((item) => item.playerId === playerId) ?? code.distributions[0];
    return { code, distribution };
  });

  await prisma.$transaction([
    prisma.playerGift.createMany({
      data: giftPayloads.map(({ code, distribution }) => ({
        playerId,
        type: GiftType.BOOSTER_CODE,
        title: "Codigo de booster",
        description: code.rewardLabel ?? code.sourceBatch ?? reasonDetail ?? reasonLabel(reason),
        payload: {
          code: code.code,
          boosterCodeId: code.id,
          distributionId: distribution?.id ?? null,
          seasonId: distribution?.seasonId ?? code.seasonId ?? null,
          rewardLabel: code.rewardLabel ?? null,
          sourceBatch: code.sourceBatch ?? null,
          reason,
          reasonDetail: reasonDetail ?? null
        }
      }))
    }),
    prisma.auditLog.createMany({
      data: giftPayloads.map(({ code, distribution }) => ({
        actorUserId: actorId,
        entityType: "codeDistribution",
        entityId: distribution?.id ?? code.id,
        action: "booster_code.distributed",
        after: {
          boosterCodeId: code.id,
          code: code.code,
          playerId,
          playerName,
          seasonId: distribution?.seasonId ?? code.seasonId ?? null,
          reason,
          giftCreated: true
        }
      }))
    })
  ]);
}

async function deleteGiftsForCode(
  tx: Prisma.TransactionClient,
  boosterCodeId: string,
  distributionIds: string[],
  code?: string,
  playerId?: string | null
) {
  const filters: Prisma.PlayerGiftWhereInput[] = [
    { payload: { path: ["boosterCodeId"], equals: boosterCodeId } },
    ...distributionIds.map((distributionId) => ({
      payload: { path: ["distributionId"], equals: distributionId }
    }))
  ];

  if (code) {
    filters.push({ payload: { path: ["code"], equals: code } });
  }

  await tx.playerGift.deleteMany({
    where: {
      ...(playerId ? { playerId } : {}),
      type: GiftType.BOOSTER_CODE,
      OR: filters
    }
  });
}

function reasonLabel(reason: DistributionReason) {
  const labels: Record<DistributionReason, string> = {
    TOP_OF_DAY: "Premio de Top do Dia",
    PARTICIPATION: "Premio de participacao",
    WEEKLY_WINNER: "Premio semanal",
    SEASON_REWARD: "Premio da temporada",
    MANUAL_ADJUSTMENT: "Presente enviado pela administracao"
  };

  return labels[reason];
}

function normalizeOptionalString(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function parseOptionalDate(value?: string | null) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Data de expiracao invalida.");
  }

  return date;
}
