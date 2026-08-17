import { prisma } from "../src/lib/prisma";

async function main() {
  const updates = [
    {
      key: "CONCURSO_DE_CARISMA",
      description: "A dupla com maior soma de Carisma recebe +8% em todos os atributos; o combate completo ainda decide o vencedor.",
      effectJson: { type: "TEAM_STAT_ADVANTAGE", stat: "statCharisma", value: 0.08 },
    },
    {
      key: "QUEDA_DE_BRACO",
      description: "A dupla com maior soma de Força recebe +8% em todos os atributos; o combate completo ainda decide o vencedor.",
      effectJson: { type: "TEAM_STAT_ADVANTAGE", stat: "statForce", value: 0.08 },
    },
  ];
  for (const update of updates) {
    await prisma.syncEventModifier.updateMany({
      where: { key: update.key },
      data: { description: update.description, effectJson: update.effectJson },
    });
  }
  const result = await prisma.syncEventModifier.findMany({
    where: { key: { in: updates.map((entry) => entry.key) } },
    select: { key: true, description: true, effectJson: true },
    orderBy: { key: "asc" },
  });
  console.log(JSON.stringify(result));
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
