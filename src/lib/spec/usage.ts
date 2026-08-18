import { prisma } from "@/lib/prisma";
import {
  SPEC_SETTINGS_KEY,
  SPEC_MONTHLY_GB_LIMIT,
  SPEC_AUDIO_TARGET_BITRATE,
  SPEC_RESOLUTION_PROFILES,
  SPEC_BITRATE_UTILIZATION,
} from "./constants";
import { getSpecConfig } from "./config";

// Corte de segurança por estimativa de egress. Em vez de "chutar" minutos por
// entrada (que superestimava muito), acumulamos o TEMPO REAL de audiência a
// partir dos heartbeats de presença dos espectadores e estimamos o consumo:
//   GB ≈ segundos_assistidos × bitrate_real / 8 / 1e9
// onde bitrate_real = (teto de vídeo da resolução + áudio) × utilização.
// Ao ultrapassar o teto mensal, o Modo SPEC se auto-desliga (kill-switch).

function usageKey(date = new Date()) {
  const ym = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(date);
  return `spec_usage_${ym}`;
}

async function currentBitrateBps() {
  const config = await getSpecConfig();
  const profile = SPEC_RESOLUTION_PROFILES[config.resolution] ?? SPEC_RESOLUTION_PROFILES["1080"];
  return (profile.maxVideoBitrate + SPEC_AUDIO_TARGET_BITRATE) * SPEC_BITRATE_UTILIZATION;
}

function estimateGb(watchSeconds: number, bitrateBps: number) {
  return (watchSeconds * bitrateBps) / 8 / 1_000_000_000;
}

function readWatchSeconds(value: unknown): number {
  const v = value as { watchSeconds?: number } | undefined;
  return Number(v?.watchSeconds ?? 0);
}

export async function getSpecMonthlyUsage(): Promise<{ watchSeconds: number; watchHours: number; estimatedGb: number; overLimit: boolean }> {
  const row = await prisma.appSetting.findUnique({ where: { key: usageKey() }, select: { value: true } }).catch(() => null);
  const watchSeconds = readWatchSeconds(row?.value);
  const estimatedGb = estimateGb(watchSeconds, await currentBitrateBps());
  return { watchSeconds, watchHours: watchSeconds / 3600, estimatedGb, overLimit: estimatedGb >= SPEC_MONTHLY_GB_LIMIT };
}

/** Só leitura: usado para recusar novas conexões quando já estourou o teto. */
export async function isSpecOverMonthlyLimit(): Promise<boolean> {
  return (await getSpecMonthlyUsage()).overLimit;
}

/**
 * Acumula `seconds` de audiência (um heartbeat de espectador) e, se a estimativa
 * passar do teto, desliga o Modo SPEC. Retorna se está acima do limite.
 */
export async function recordSpectatorWatchAndCheck(seconds: number): Promise<{ overLimit: boolean }> {
  const key = usageKey();
  const row = await prisma.appSetting.findUnique({ where: { key }, select: { value: true } }).catch(() => null);
  const watchSeconds = readWatchSeconds(row?.value) + Math.max(0, seconds);
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: { watchSeconds } },
    update: { value: { watchSeconds } },
  }).catch(() => null);

  if (estimateGb(watchSeconds, await currentBitrateBps()) >= SPEC_MONTHLY_GB_LIMIT) {
    const config = await getSpecConfig();
    const disabled = { enabled: false, broadcasterPolicy: config.broadcasterPolicy, resolution: config.resolution };
    await prisma.appSetting.upsert({
      where: { key: SPEC_SETTINGS_KEY },
      create: { key: SPEC_SETTINGS_KEY, value: disabled },
      update: { value: disabled },
    }).catch(() => null);
    return { overLimit: true };
  }
  return { overLimit: false };
}
