import {
  BoosterCodeStatus,
  DistributionReason,
  DistributionStatus,
  type BoosterCode,
  type Prisma,
  type PrismaClient
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

export interface ListAvailableCodesInput {
  seasonId?: string;
  take?: number;
  includeGlobalCodes?: boolean;
}

export interface ReserveCodesInput {
  playerId: string;
  assignedById: string;
  quantity: number;
  seasonId?: string;
  reason?: DistributionReason;
  reasonDetail?: string;
}

export interface DistributeCodesInput {
  playerId: string;
  assignedById: string;
  boosterCodeIds: string[];
  seasonId?: string;
  reason?: DistributionReason;
  reasonDetail?: string;
}

export function normalizeBoosterCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function assertNoDuplicateCodes(codes: string[]) {
  const normalizedCodes = codes.map(normalizeBoosterCode);
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const code of normalizedCodes) {
    if (seen.has(code)) duplicates.add(code);
    seen.add(code);
  }

  if (duplicates.size > 0) {
    throw new Error(`Codigos duplicados: ${[...duplicates].join(", ")}`);
  }

  return normalizedCodes;
}

export async function findDuplicateCodesInDatabase(codes: string[], db: DbClient = prisma) {
  const normalizedCodes = assertNoDuplicateCodes(codes);

  if (normalizedCodes.length === 0) {
    return [];
  }

  return db.boosterCode.findMany({
    where: {
      code: { in: normalizedCodes }
    },
    select: {
      id: true,
      code: true,
      status: true
    }
  });
}

export async function listAvailableBoosterCodes(
  input: ListAvailableCodesInput = {},
  db: DbClient = prisma
) {
  return db.boosterCode.findMany({
    where: {
      status: BoosterCodeStatus.AVAILABLE,
      AND: [
        seasonCodeWhere(input.seasonId, input.includeGlobalCodes ?? true),
        { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }
      ]
    },
    orderBy: {
      importedAt: "asc"
    },
    take: input.take
  });
}

export async function reserveBoosterCodes(input: ReserveCodesInput, db: PrismaClient = prisma) {
  if (input.quantity <= 0) {
    throw new Error("A quantidade precisa ser maior que zero.");
  }

  return db.$transaction(async (tx) => {
    const availableCodes = await tx.boosterCode.findMany({
      where: {
        status: BoosterCodeStatus.AVAILABLE,
        AND: [
          seasonCodeWhere(input.seasonId, true),
          { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }
        ]
      },
      orderBy: { importedAt: "asc" },
      take: input.quantity
    });

    if (availableCodes.length < input.quantity) {
      throw new Error("Nao ha codigos disponiveis suficientes.");
    }

    return distributeCodesInsideTransaction(
      tx,
      availableCodes,
      {
        playerId: input.playerId,
        assignedById: input.assignedById,
        seasonId: input.seasonId,
        reason: input.reason,
        reasonDetail: input.reasonDetail
      }
    );
  });
}

export async function distributeBoosterCodesToPlayer(
  input: DistributeCodesInput,
  db: PrismaClient = prisma
) {
  const uniqueIds = [...new Set(input.boosterCodeIds)];

  if (uniqueIds.length !== input.boosterCodeIds.length) {
    throw new Error("A lista de distribuicao contem codigos repetidos.");
  }

  if (uniqueIds.length === 0) {
    throw new Error("Informe pelo menos um codigo para distribuir.");
  }

  return db.$transaction(async (tx) => {
    const codes = await tx.boosterCode.findMany({
      where: {
        id: { in: uniqueIds }
      },
      orderBy: {
        importedAt: "asc"
      }
    });

    if (codes.length !== uniqueIds.length) {
      throw new Error("Um ou mais codigos informados nao foram encontrados.");
    }

    return distributeCodesInsideTransaction(tx, codes, input);
  });
}

async function distributeCodesInsideTransaction(
  tx: Prisma.TransactionClient,
  codes: BoosterCode[],
  input: Omit<DistributeCodesInput, "boosterCodeIds">
) {
  assertCodesCanBeDistributed(codes);

  const codeIds = codes.map((code) => code.id);

  const updateResult = await tx.boosterCode.updateMany({
    where: {
      id: { in: codeIds },
      status: BoosterCodeStatus.AVAILABLE
    },
    data: {
      status: BoosterCodeStatus.ASSIGNED
    }
  });

  if (updateResult.count !== codeIds.length) {
    throw new Error("Algum codigo deixou de estar disponivel durante a distribuicao.");
  }

  await tx.codeDistribution.createMany({
    data: codes.map((code) => ({
      boosterCodeId: code.id,
      seasonId: input.seasonId ?? code.seasonId,
      playerId: input.playerId,
      assignedById: input.assignedById,
      reason: input.reason ?? DistributionReason.MANUAL_ADJUSTMENT,
      reasonDetail: input.reasonDetail,
      status: DistributionStatus.ASSIGNED
    }))
  });

  return tx.boosterCode.findMany({
    where: {
      id: { in: codeIds }
    },
    include: {
      distributions: true
    },
    orderBy: {
      importedAt: "asc"
    }
  });
}

function assertCodesCanBeDistributed(codes: BoosterCode[]) {
  for (const code of codes) {
    if (code.status !== BoosterCodeStatus.AVAILABLE) {
      throw new Error(`O codigo ${code.code} nao esta disponivel.`);
    }

    if (code.expiresAt && code.expiresAt <= new Date()) {
      throw new Error(`O codigo ${code.code} esta expirado.`);
    }
  }
}

function seasonCodeWhere(seasonId?: string, includeGlobalCodes = true): Prisma.BoosterCodeWhereInput {
  if (!seasonId) {
    return {};
  }

  if (!includeGlobalCodes) {
    return { seasonId };
  }

  return {
    OR: [{ seasonId }, { seasonId: null }]
  };
}
