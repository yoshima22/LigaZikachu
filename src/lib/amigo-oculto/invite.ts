// Estado do popup de convite do Amigo Oculto para o layout: só aparece para quem ainda não se inscreveu,
// enquanto a edição publicada está em período de inscrição.
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { brtDay, readConfig } from "./core";

export const AMIGO_OCULTO_TAG = "amigo-oculto-published";

// Edição publicada e aberta (cache curto; revalidado ao publicar/ocultar).
const publishedOpenEdition = unstable_cache(
  async () => {
    const all = await prisma.secretSantaEdition.findMany({ where: { phase: "REGISTRATION" }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, startsOn: true, isTest: true, configJson: true } });
    const e = all.find((x) => readConfig(x.configJson).published);
    return e ? { id: e.id, startsOn: e.startsOn, isTest: e.isTest } : null;
  },
  ["amigo-oculto-invite-edition"],
  { revalidate: 120, tags: [AMIGO_OCULTO_TAG] },
);

export async function getAmigoInviteState(playerId: string): Promise<{ editionId: string } | null> {
  const e = await publishedOpenEdition();
  if (!e || (!e.isTest && brtDay(new Date()) >= e.startsOn)) return null;
  const mine = await prisma.secretSantaParticipant.findUnique({ where: { editionId_playerId: { editionId: e.id, playerId } }, select: { id: true } });
  return mine ? null : { editionId: e.id };
}
