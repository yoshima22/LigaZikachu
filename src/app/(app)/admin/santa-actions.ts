"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/auth/permissions";
import { SANTA_SETTING_KEY, type SantaSetting } from "@/lib/papai-noel";

/** Liga/desliga o Papai Noel. O jogador vê a mudança em até ~30 s (cache em memória do layout). */
export async function saveSantaSettingAction(input: SantaSetting): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = await requirePlatformAdmin();
    const value = { enabled: input.enabled === true, ignoreWindow: input.ignoreWindow === true };
    await prisma.appSetting.upsert({ where: { key: SANTA_SETTING_KEY }, create: { key: SANTA_SETTING_KEY, value }, update: { value } });
    await prisma.auditLog.create({
      data: { actorUserId: admin.id, action: "SANTA_EVENT_SETTING", entityType: "AppSetting", entityId: SANTA_SETTING_KEY, metadata: value },
    });
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}
