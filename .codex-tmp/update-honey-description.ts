import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const description = "Leva a felicidade do mascote para 100 e tem 40% de chance de criar uma nova amizade (se houver espaço entre os 10 amigos) ou gerar um evento social bônus com um amigo atual.";
  const apply = process.argv.includes("--apply");

  const before = await prisma.shopItem.findMany({
    where: { type: "MASCOT_BUFF_HAPPY" },
    select: { id: true, name: true, description: true, active: true },
  });
  console.log(JSON.stringify({ apply, before, nextDescription: description }, null, 2));

  if (apply) {
    const result = await prisma.shopItem.updateMany({
      where: { type: "MASCOT_BUFF_HAPPY" },
      data: { description },
    });
    console.log(`Atualizados: ${result.count}`);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
