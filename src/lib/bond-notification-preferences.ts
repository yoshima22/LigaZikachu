import { prisma } from "@/lib/prisma";

export const bondNotificationPreferenceId = (playerId: string) => `bonds-notifications:${playerId}`;

export function preferenceEnabled(data: unknown): boolean {
  return !(data && typeof data === "object" && !Array.isArray(data) && (data as Record<string, unknown>).enabled === false);
}

export async function getBondNotificationsEnabled(playerId: string): Promise<boolean> {
  const setting = await prisma.siteContent.findUnique({
    where: { id: bondNotificationPreferenceId(playerId) },
    select: { data: true },
  });
  return preferenceEnabled(setting?.data);
}

export async function filterBondNotificationRecipients(playerIds: string[]): Promise<string[]> {
  const unique = [...new Set(playerIds)];
  if (!unique.length) return [];
  const disabled = await prisma.siteContent.findMany({
    where: { id: { in: unique.map(bondNotificationPreferenceId) } },
    select: { id: true, data: true },
  });
  const disabledIds = new Set(
    disabled.filter((setting) => !preferenceEnabled(setting.data)).map((setting) => setting.id.slice("bonds-notifications:".length)),
  );
  return unique.filter((playerId) => !disabledIds.has(playerId));
}
