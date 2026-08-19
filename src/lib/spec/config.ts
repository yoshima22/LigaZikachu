import { prisma } from "@/lib/prisma";
import {
  SPEC_SETTINGS_KEY,
  SPEC_DEFAULT_BROADCASTER_POLICY,
  SPEC_DEFAULT_RESOLUTION,
  SPEC_DEFAULT_MODE,
  SPEC_DEFAULT_FPS,
  SPEC_DEFAULT_QUALITY_PRIORITY,
  SPEC_PROVIDER,
  type SpecBroadcasterPolicy,
  type SpecResolution,
  type SpecMode,
  type SpecFps,
  type SpecQualityPriority,
} from "./constants";

// Feature flag + política do Modo SPEC, guardada em AppSetting (mesmo padrão do
// live-pvp-access). Desligado por padrão: nada consulta a tabela nem abre live
// até um admin ativar. `providerConfigured` indica se há credenciais reais.
export type SpecConfig = {
  enabled: boolean;
  broadcasterPolicy: SpecBroadcasterPolicy;
  resolution: SpecResolution;
  mode: SpecMode;
  fps: SpecFps;
  qualityPriority: SpecQualityPriority;
  providerConfigured: boolean;
};

function isPolicy(value: unknown): value is SpecBroadcasterPolicy {
  return value === "ANY_TOURNAMENT_PARTICIPANT" || value === "MATCH_PLAYERS_ONLY" || value === "ADMIN_ONLY";
}

function isResolution(value: unknown): value is SpecResolution {
  return value === "720" || value === "1080";
}

function isMode(value: unknown): value is SpecMode {
  return value === "cloudflare-realtime" || value === "p2p-mesh" || value === "youtube";
}

function isFps(value: unknown): value is SpecFps {
  return value === 12 || value === 24 || value === 30;
}

function isQualityPriority(value: unknown): value is SpecQualityPriority {
  return value === "sharpness" || value === "fluidity";
}

/** Verdadeiro somente quando a Cloudflare Realtime estiver realmente configurada. */
export function isSpecProviderConfigured(): boolean {
  return SPEC_PROVIDER === "cloudflare-realtime"
    && Boolean(process.env.CLOUDFLARE_REALTIME_APP_ID)
    && Boolean(process.env.CLOUDFLARE_REALTIME_APP_TOKEN);
}

export async function getSpecConfig(): Promise<SpecConfig> {
  const setting = await prisma.appSetting
    .findUnique({ where: { key: SPEC_SETTINGS_KEY }, select: { value: true } })
    .catch(() => null);
  const value = setting?.value as Partial<SpecConfig> | undefined;
  return {
    enabled: value?.enabled === true,
    broadcasterPolicy: isPolicy(value?.broadcasterPolicy) ? value.broadcasterPolicy : SPEC_DEFAULT_BROADCASTER_POLICY,
    resolution: isResolution(value?.resolution) ? value.resolution : SPEC_DEFAULT_RESOLUTION,
    mode: isMode(value?.mode) ? value.mode : SPEC_DEFAULT_MODE,
    fps: isFps(value?.fps) ? value.fps : SPEC_DEFAULT_FPS,
    qualityPriority: isQualityPriority(value?.qualityPriority) ? value.qualityPriority : SPEC_DEFAULT_QUALITY_PRIORITY,
    providerConfigured: isSpecProviderConfigured(),
  };
}
