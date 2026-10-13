/** Ajusta o evento de Johto já criado (sem progresso) para os novos padrões: 5 mi por líder e espera de 20 min e dano ×1. npx tsx scripts/rescale-johto-event.ts */
import { config } from "dotenv"; config({ path: ".env.local" }); config();
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
(async () => {
  const event = await prisma.johtoRaidEvent.findFirst({ include: { _count: { select: { attempts: true } } } });
  if (!event) return console.log("sem evento");
  if (event._count.attempts > 0) return console.log("há ataques registrados: não alterado (use 'Recriar do zero' no painel)");
  const mascotHp = Math.floor(5_000_000 / 6);
  await prisma.$executeRaw`UPDATE johto_raid_leader_mascots SET "hpMax" = ${mascotHp}, "hpCurrent" = ${mascotHp} WHERE "leaderId" IN (SELECT id FROM johto_raid_leaders WHERE "eventId" = ${event.id})`;
  await prisma.$executeRaw`UPDATE johto_raid_leaders SET "hpMax" = ${mascotHp * 6}, "hpCurrent" = ${mascotHp * 6} WHERE "eventId" = ${event.id}`;
  await prisma.johtoRaidEvent.update({ where: { id: event.id }, data: { cooldownMinutes: 20, damageScale: 1 } });
  console.log(`ok: líderes com ${(mascotHp * 6).toLocaleString("pt-BR")} HP (${mascotHp.toLocaleString("pt-BR")} por mascote), espera de 20 min`);
})().finally(() => prisma.$disconnect());
