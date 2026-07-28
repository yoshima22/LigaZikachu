"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import {
  getLivePvpAccessConfig,
  LIVE_PVP_ACCESS_KEY,
} from "@/lib/live-pvp-access";
import { uploadDataUrlAsset } from "@/lib/asset-storage";
import { TACTICAL_BIOMES, type TacticalBiomeId } from "@/lib/tactical-arena";

const TERRAIN_RANKING_PREFIX = "terrain_battle_ranking:";

export async function updateLivePvpAccessAction(input: {
  enabledGlobally?: boolean;
  playerId?: string;
  allowed?: boolean;
}) {
  const admin = await requireAdmin();
  const current = await getLivePvpAccessConfig();
  const allowed = new Set(current.allowedPlayerIds);
  if (input.playerId) {
    if (input.allowed) allowed.add(input.playerId);
    else allowed.delete(input.playerId);
  }
  const value = {
    enabledGlobally: input.enabledGlobally ?? current.enabledGlobally,
    allowedPlayerIds: [...allowed],
    biomeImages: current.biomeImages,
  };
  await prisma.$transaction([
    prisma.appSetting.upsert({
      where: { key: LIVE_PVP_ACCESS_KEY },
      create: { key: LIVE_PVP_ACCESS_KEY, value },
      update: { value },
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: admin.id,
        entityType: "LIVE_PVP_ACCESS",
        entityId: LIVE_PVP_ACCESS_KEY,
        action: "UPDATE",
        before: current as unknown as Prisma.InputJsonValue,
        after: value as unknown as Prisma.InputJsonValue,
      },
    }),
  ]);
  revalidatePath("/combates/arena-online");
  revalidatePath("/admin/arena-online");
  return { ok: true, config: value };
}

export async function updateLivePvpBiomeImageAction(input: {
  biomeId: TacticalBiomeId;
  image: string;
}) {
  const admin = await requireAdmin();
  if (!TACTICAL_BIOMES.some((biome) => biome.id === input.biomeId))
    throw new Error("Bioma inválido.");
  const current = await getLivePvpAccessConfig();
  const image = input.image.trim()
    ? await uploadDataUrlAsset(
        input.image.trim(),
        "arena-online/biomas",
        input.biomeId,
      )
    : "";
  const value = {
    ...current,
    biomeImages: { ...current.biomeImages, [input.biomeId]: image },
  };
  await prisma.$transaction([
    prisma.appSetting.upsert({
      where: { key: LIVE_PVP_ACCESS_KEY },
      create: { key: LIVE_PVP_ACCESS_KEY, value },
      update: { value },
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: admin.id,
        entityType: "LIVE_PVP_BIOME",
        entityId: input.biomeId,
        action: "UPDATE_IMAGE",
        before: current as unknown as Prisma.InputJsonValue,
        after: value as unknown as Prisma.InputJsonValue,
      },
    }),
  ]);
  revalidatePath("/admin/arena-online");
  return { ok: true, config: value };
}

export async function resetTerrainBattleRankingAction() {
  const admin = await requireAdmin();
  const result = await prisma.$transaction(async (tx) => {
    const deleted = await tx.appSetting.deleteMany({
      where: { key: { startsWith: TERRAIN_RANKING_PREFIX } },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: admin.id,
        entityType: "TERRAIN_BATTLE_RANKING",
        entityId: "beta",
        action: "RESET",
        after: { deletedEntries: deleted.count },
      },
    });
    return deleted.count;
  });
  revalidatePath("/combates/arena-online");
  revalidatePath("/admin/arena-online");
  return { ok: true, deletedEntries: result };
}
