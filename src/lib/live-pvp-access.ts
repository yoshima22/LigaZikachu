import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { TacticalBiomeId } from "@/lib/tactical-arena";

export const LIVE_PVP_ACCESS_KEY = "live_pvp_access";

export type LivePvpAccessConfig = {
  enabledGlobally: boolean;
  allowedPlayerIds: string[];
  biomeImages: Partial<Record<TacticalBiomeId, string>>;
};

export const DEFAULT_LIVE_PVP_ACCESS: LivePvpAccessConfig = {
  enabledGlobally: true,
  allowedPlayerIds: [],
  biomeImages: {},
};

export async function getLivePvpAccessConfig(): Promise<LivePvpAccessConfig> {
  const setting = await prisma.appSetting.findUnique({
    where: { key: LIVE_PVP_ACCESS_KEY },
    select: { value: true },
  });
  const value = setting?.value as Partial<LivePvpAccessConfig> | undefined;
  return {
    enabledGlobally: value?.enabledGlobally === true,
    allowedPlayerIds: Array.isArray(value?.allowedPlayerIds)
      ? value.allowedPlayerIds.filter(
          (id): id is string => typeof id === "string",
        )
      : [],
    biomeImages:
      value?.biomeImages && typeof value.biomeImages === "object"
        ? value.biomeImages
        : {},
  };
}

export const LIVE_PVP_ACCESS_TAG = "live-pvp-access";

/** Só para o menu do layout (lido em toda navegação). A escrita do admin invalida a tag na hora;
 * regras de acesso/partida seguem usando getLivePvpAccessConfig sem cache. */
export const getLivePvpAccessConfigForNav = unstable_cache(
  getLivePvpAccessConfig,
  ["live-pvp-access-nav-v1"],
  { revalidate: 60, tags: [LIVE_PVP_ACCESS_TAG] },
);

export function canAccessLivePvp(
  _config: LivePvpAccessConfig,
  _playerId: string | null | undefined,
  _admin: boolean,
) {
  // A Batalha de Terreno foi liberada como modo Casual para toda conta ativa.
  // A configuração histórica é mantida apenas para não perder imagens de bioma.
  return true;
}
