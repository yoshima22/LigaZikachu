"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/session";
import { isStaff } from "@/lib/auth/permissions";
import { SPEC_SETTINGS_KEY, type SpecResolution, type SpecMode, type SpecFps, type SpecQualityPriority } from "@/lib/spec/constants";
import { getSpecConfig } from "@/lib/spec/config";
import { endSpecStreamAction } from "./actions";

// Persiste o objeto de config completo (preservando os campos não alterados).
async function saveSpecConfig(patch: { enabled?: boolean; resolution?: SpecResolution; mode?: SpecMode; fps?: SpecFps; qualityPriority?: SpecQualityPriority }) {
  const current = await getSpecConfig();
  const value = {
    enabled: patch.enabled ?? current.enabled,
    broadcasterPolicy: current.broadcasterPolicy,
    resolution: patch.resolution ?? current.resolution,
    mode: patch.mode ?? current.mode,
    fps: patch.fps ?? current.fps,
    qualityPriority: patch.qualityPriority ?? current.qualityPriority,
  };
  await prisma.appSetting.upsert({
    where: { key: SPEC_SETTINGS_KEY },
    create: { key: SPEC_SETTINGS_KEY, value },
    update: { value },
  });
  revalidatePath("/spec");
}

// Liga/desliga o Modo SPEC (admin). Quando desligado, ninguém abre nova live e a
// página mostra indisponível; admins ainda podem encerrar lives antigas.
export async function setSpecEnabledAction(enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  const session = await getAppSession();
  if (!session?.user || !isStaff(session.user.role)) return { ok: false, error: "Acesso restrito." };
  await saveSpecConfig({ enabled });
  return { ok: true };
}

// Define a resolução das transmissões (720p ou 1080p).
export async function setSpecResolutionAction(resolution: SpecResolution): Promise<{ ok: boolean; error?: string }> {
  const session = await getAppSession();
  if (!session?.user || !isStaff(session.user.role)) return { ok: false, error: "Acesso restrito." };
  if (resolution !== "720" && resolution !== "1080") return { ok: false, error: "Resolução inválida." };
  await saveSpecConfig({ resolution });
  return { ok: true };
}

// Define o modo de transmissão ativo (Cloudflare SFU ou P2P mesh econômico).
export async function setSpecModeAction(mode: SpecMode): Promise<{ ok: boolean; error?: string }> {
  const session = await getAppSession();
  if (!session?.user || !isStaff(session.user.role)) return { ok: false, error: "Acesso restrito." };
  if (mode !== "cloudflare-realtime" && mode !== "p2p-mesh" && mode !== "youtube") return { ok: false, error: "Modo inválido." };
  await saveSpecConfig({ mode });
  return { ok: true };
}

// Define o frame rate das transmissões (12/24/30 fps).
export async function setSpecFpsAction(fps: SpecFps): Promise<{ ok: boolean; error?: string }> {
  const session = await getAppSession();
  if (!session?.user || !isStaff(session.user.role)) return { ok: false, error: "Acesso restrito." };
  if (fps !== 12 && fps !== 24 && fps !== 30) return { ok: false, error: "FPS inválido." };
  await saveSpecConfig({ fps });
  return { ok: true };
}

// Define a prioridade de qualidade (nitidez x fluidez) sob banda/CPU limitada.
export async function setSpecQualityPriorityAction(qualityPriority: SpecQualityPriority): Promise<{ ok: boolean; error?: string }> {
  const session = await getAppSession();
  if (!session?.user || !isStaff(session.user.role)) return { ok: false, error: "Acesso restrito." };
  if (qualityPriority !== "sharpness" && qualityPriority !== "fluidity") return { ok: false, error: "Prioridade inválida." };
  await saveSpecConfig({ qualityPriority });
  return { ok: true };
}

// Admin encerra uma transmissão à força (reusa a regra de encerramento).
export async function adminForceEndSpecStreamAction(streamId: string) {
  return endSpecStreamAction(streamId);
}
