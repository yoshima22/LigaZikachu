// Avisos do Rei do Rio (push + notificação no jogo). Cada evento é enviado UMA vez por edição (marker) e só para quem
// está inscrito — por isso, enquanto o modo for fechado a admins, só admins inscritos recebem. O convite geral
// de inscrição é manual (botão no painel admin) para nunca sair sem querer.
import { prisma } from "@/lib/prisma";
import { sendNotificationToPlayers, sendNotificationToUsers } from "@/lib/notifications";

const URL = "/combates/rei-do-rio";

async function once(eventKey: string) {
  const { count } = await prisma.pushNotificationMarker.createMany({ data: [{ eventKey }], skipDuplicates: true });
  return count === 1;
}

/** Avisa os inscritos (jogadores reais) de uma edição — 1 vez por (edição, evento). Nunca lança. */
export async function notifyParticipants(editionId: string, event: string, msg: { title: string; body: string }) {
  try {
    const ed = await prisma.reiRioEdition.findUnique({ where: { id: editionId }, select: { isTest: true } });
    if (!ed || ed.isTest) return;
    if (!(await once(`rdr:${editionId}:${event}`))) return;
    const parts = await prisma.reiRioParticipant.findMany({ where: { editionId, isBot: false }, select: { playerKey: true } });
    if (!parts.length) return;
    await sendNotificationToPlayers(parts.map((p) => p.playerKey), { ...msg, url: URL, category: "LIGA_SEMANAL", data: { eventKey: `rdr:${editionId}:${event}` } });
  } catch (e) {
    console.error("[ReiDoRio] notificação falhou", event, e);
  }
}

/** Convite de inscrição para TODOS os jogadores (disparo manual do admin; 1 vez por edição). */
export async function sendRegistrationInvite(editionId: string): Promise<{ ok: boolean; message: string }> {
  const ed = await prisma.reiRioEdition.findUnique({ where: { id: editionId }, select: { isTest: true, phase: true, name: true, mondayDate: true } });
  if (!ed || ed.isTest || ed.phase !== "PREPARATION") return { ok: false, message: "O convite só vale para uma edição real em fase de inscrição." };
  if (!(await once(`rdr:${editionId}:invite`))) return { ok: false, message: "O convite desta edição já foi enviado." };
  const r = await sendNotificationToUsers(null, {
    title: "👑 Rei do Rio — Trono de Natal",
    body: "Inscrições abertas! Entre agora; na segunda você monta seus 18 mascotes (até 21h) e disputa o Trono para trocar pontos por caixas de prêmios.",
    url: URL, category: "ANUNCIOS", data: { eventKey: `rdr:${editionId}:invite` },
  });
  if (!r.configured) {
    await prisma.pushNotificationMarker.deleteMany({ where: { eventKey: `rdr:${editionId}:invite` } });
    return { ok: false, message: "Push não configurado neste ambiente (credencial do Firebase ausente)." };
  }
  return { ok: true, message: `Convite enviado a ${r.users} jogadores (${r.sent} dispositivos).` };
}
