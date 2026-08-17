"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/session";
import { isStaff } from "@/lib/auth/permissions";
import { SPEC_SETTINGS_KEY } from "@/lib/spec/constants";
import { getSpecConfig } from "@/lib/spec/config";
import { endSpecStreamAction } from "./actions";

// Liga/desliga o Modo SPEC (admin). Quando desligado, ninguém abre nova live e a
// página mostra indisponível; admins ainda podem encerrar lives antigas.
export async function setSpecEnabledAction(enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  const session = await getAppSession();
  if (!session?.user || !isStaff(session.user.role)) return { ok: false, error: "Acesso restrito." };
  const current = await getSpecConfig();
  await prisma.appSetting.upsert({
    where: { key: SPEC_SETTINGS_KEY },
    create: { key: SPEC_SETTINGS_KEY, value: { enabled, broadcasterPolicy: current.broadcasterPolicy } },
    update: { value: { enabled, broadcasterPolicy: current.broadcasterPolicy } },
  });
  revalidatePath("/spec");
  return { ok: true };
}

// Admin encerra uma transmissão à força (reusa a regra de encerramento).
export async function adminForceEndSpecStreamAction(streamId: string) {
  return endSpecStreamAction(streamId);
}
