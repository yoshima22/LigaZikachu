"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import {
  getLivePvpAccessConfig,
  LIVE_PVP_ACCESS_KEY,
} from "@/lib/live-pvp-access";

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
