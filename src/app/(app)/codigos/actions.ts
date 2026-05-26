"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  BoosterCodeStatus,
  DistributionReason,
  DistributionStatus
} from "@prisma/client";
import { getSessionUser, isAdmin, requireAdmin } from "@/lib/auth/permissions";
import {
  assertNoDuplicateCodes,
  findDuplicateCodesInDatabase,
  normalizeBoosterCode,
  reserveBoosterCodes
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

  const where: Record<string, unknown> = {};

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
): Promise<{ error?: string; imported?: number }> {
  try {
    console.log("[SERVER DEBUG] importBoosterCodesAction chamado");
    const actor = await requireAdmin();
    console.log("[SERVER DEBUG] Admin:", actor.id);
    const data = importCodesSchema.parse(input);
    console.log("[SERVER DEBUG] Dados validados, rawCodes length:", data.rawCodes.length);
    const parsedCodes = parseRawCodes(data.rawCodes);
    console.log("[SERVER DEBUG] Codigos parseados:", parsedCodes.length, parsedCodes.slice(0, 3));
    const normalizedCodes = assertNoDuplicateCodes(parsedCodes);
    console.log("[SERVER DEBUG] Codigos normalizados:", normalizedCodes.length);

    if (normalizedCodes.length === 0) {
      return { error: "Nenhum codigo valido foi encontrado." };
    }

    const duplicates = await findDuplicateCodesInDatabase(normalizedCodes);
    console.log("[SERVER DEBUG] Duplicados:", duplicates.length);
    if (duplicates.length > 0) {
      return {
        error: `Codigos ja cadastrados: ${duplicates.map((code) => code.code).join(", ")}`
      };
    }

    const seasonId = normalizeOptionalId(data.seasonId);
    const expiresAt = parseOptionalDate(data.expiresAt);
    const sourceBatch = normalizeOptionalString(data.sourceBatch);
    const rewardLabel = normalizeOptionalString(data.rewardLabel);
    const notes = normalizeOptionalString(data.notes);

    console.log("[SERVER DEBUG] Criando", normalizedCodes.length, "codigos...");
    await prisma.$transaction(async (tx) => {
      await tx.boosterCode.createMany({
        data: normalizedCodes.map((code) => ({
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
            count: normalizedCodes.length,
            seasonId,
            sourceBatch,
            rewardLabel,
            expiresAt: expiresAt?.toISOString() ?? null
          }
        }
      });
    });

    revalidatePath("/codigos");
    console.log("[SERVER DEBUG] Sucesso!");
    return { imported: normalizedCodes.length };
  } catch (err) {
    console.error("[SERVER DEBUG] Erro:", err);
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
      reasonDetail: normalizeOptionalString(data.reasonDetail) ?? undefined
    });

    await prisma.auditLog.createMany({
      data: distributedCodes.map((code) => ({
        actorUserId: actor.id,
        entityType: "codeDistribution",
        entityId: code.distributions[0]?.id ?? code.id,
        action: "booster_code.distributed",
        after: {
          boosterCodeId: code.id,
          code: code.code,
          playerId: data.playerId,
          playerName: player.displayName,
          seasonId,
          reason: data.reason
        }
      }))
    });

    revalidatePath("/codigos");
    revalidatePath(`/jogadores/${data.playerId}`);
    return { distributed: distributedCodes.length };
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
        boosterCode: { select: { id: true, status: true } }
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

    await prisma.$transaction([
      prisma.codeDistribution.update({
        where: { id },
        data: {
          status: DistributionStatus.REVOKED,
          revokedAt: new Date(),
          revokedById: actor.id
        }
      }),
      prisma.boosterCode.update({
        where: { id: distribution.boosterCodeId },
        data: { status: BoosterCodeStatus.AVAILABLE }
      }),
      prisma.auditLog.create({
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
