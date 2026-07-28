import { prisma } from "@/lib/prisma";
import type { TacticalBiomeId } from "@/lib/tactical-arena";

export const LIVE_PVP_ACCESS_KEY = "live_pvp_access";

export type LivePvpAccessConfig = {
  enabledGlobally: boolean;
  allowedPlayerIds: string[];
  biomeImages: Partial<Record<TacticalBiomeId, string>>;
};

export const DEFAULT_LIVE_PVP_ACCESS: LivePvpAccessConfig = {
  enabledGlobally: false,
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

export function canAccessLivePvp(
  config: LivePvpAccessConfig,
  playerId: string | null | undefined,
  admin: boolean,
) {
  return (
    admin ||
    config.enabledGlobally ||
    (!!playerId && config.allowedPlayerIds.includes(playerId))
  );
}
