// Popup de convite do Rei do Rio no layout: só quando o modo estiver aberto aos jogadores (REI_DO_RIO_PUBLIC),
// há edição real em inscrição e a pessoa ainda não se inscreveu.
import { memoTtl } from "@/lib/memo-ttl";
import { prisma } from "@/lib/prisma";
import { REI_DO_RIO_PUBLIC } from "./config";
import { lockAt } from "./schedule";

const openEdition = memoTtl(async () => {
  const e = await prisma.reiRioEdition.findFirst({ where: { isTest: false, phase: "PREPARATION", registrationOpen: true }, orderBy: { mondayDate: "asc" }, select: { id: true, name: true, mondayDate: true } });
  return e && new Date() < lockAt(e.mondayDate) ? e : null;
}, 30000);

export async function getReiInviteState(playerId: string): Promise<{ editionId: string; name: string; closesAt: string } | null> {
  if (!REI_DO_RIO_PUBLIC) return null;
  const e = await openEdition();
  if (!e) return null;
  const mine = await prisma.reiRioParticipant.findUnique({ where: { editionId_playerKey: { editionId: e.id, playerKey: playerId } }, select: { id: true } });
  return mine ? null : { editionId: e.id, name: e.name, closesAt: lockAt(e.mondayDate).toISOString() };
}
