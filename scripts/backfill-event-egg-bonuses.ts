import { prisma } from "../src/lib/prisma";
import { eventBonusLabel, rollEventBonus } from "../src/lib/mascot-data";

async function main() {
  const candidates = await prisma.mascot.findMany({
    where: { hatchedFromEggType: "EVENT", eventBonusRolledAt: null },
    select: { id: true },
  });
  let awarded = 0;
  for (const mascot of candidates) {
    const bonus = rollEventBonus();
    await prisma.$transaction(async (tx) => {
      await tx.mascot.update({
        where: { id: mascot.id },
        data: {
          eventBonusRolledAt: new Date(),
          eventBonusStat: bonus?.stat ?? null,
          eventBonusValue: bonus?.value ?? null,
          ...(bonus ? { [bonus.stat]: { increment: bonus.value } } : {}),
        },
      });
      if (bonus) {
        await tx.mascotEvent.create({
          data: { mascotId: mascot.id, emoji: "🎉", description: `Bônus retroativo de Ovo de Evento: +${bonus.value} em ${eventBonusLabel(bonus.stat)}. Já incluído no atributo final.` },
        });
        awarded++;
      }
    });
  }
  console.log(`Ovos de Evento processados: ${candidates.length}; bônus concedidos: ${awarded}.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
