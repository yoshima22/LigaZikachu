// Publica a edição do Amigo Oculto para os jogadores e envia UMA notificação push de convite (marker evita reenvio).
// Uso: NODE_PATH=<stub de server-only> npx tsx scripts/amigo-oculto-publish.ts [--no-push]
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { readConfig } from "../src/lib/amigo-oculto/core";
import { sendNotificationToUsers } from "../src/lib/notifications";

const EVENT_KEY = "amigo-oculto-convite-2026";
(async () => {
  const e = await prisma.secretSantaEdition.findFirst({ where: { isTest: false, phase: "REGISTRATION" }, orderBy: { createdAt: "desc" } });
  if (!e) throw new Error("Nenhuma edição real em inscrição.");
  await prisma.secretSantaEdition.update({ where: { id: e.id }, data: { configJson: { ...readConfig(e.configJson), published: true } } });
  console.log("publicada:", e.id, e.name);
  if (process.argv.includes("--no-push")) return;
  const { count } = await prisma.pushNotificationMarker.createMany({ data: [{ eventKey: EVENT_KEY }], skipDuplicates: true });
  if (count === 0) return console.log("push já enviado antes (marker existe) — nada a fazer");
  const r = await sendNotificationToUsers(null, {
    title: "🎁 Amigo Oculto da Liga",
    body: "Jotapê passou aqui para te convidar! Inscreva-se até 01/12 e participe da troca de presentes de Natal.",
    url: "/amigo-oculto",
    data: { eventKey: EVENT_KEY },
    category: "ANUNCIOS",
  });
  console.log("push:", JSON.stringify(r));
})().catch((err) => { console.error(err); process.exit(1); }).finally(() => prisma.$disconnect());
