import { prisma } from "@/lib/prisma";
import {
  SPEC_SETTINGS_KEY,
  SPEC_DEFAULT_BROADCASTER_POLICY,
  SPEC_PROVIDER,
  type SpecBroadcasterPolicy,
} from "./constants";

// Feature flag + política do Modo SPEC, guardada em AppSetting (mesmo padrão do
// live-pvp-access). Desligado por padrão: nada consulta a tabela nem abre live
// até um admin ativar. `providerConfigured` indica se há credenciais reais.
export type SpecConfig = {
  enabled: boolean;
  broadcasterPolicy: SpecBroadcasterPolicy;
  providerConfigured: boolean;
};

function isPolicy(value: unknown): value is SpecBroadcasterPolicy {
  return value === "ANY_TOURNAMENT_PARTICIPANT" || value === "MATCH_PLAYERS_ONLY" || value === "ADMIN_ONLY";
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
    providerConfigured: isSpecProviderConfigured(),
  };
}
