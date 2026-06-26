import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const before = await prisma.mascot.count({ where: { pokemonId: 809 } });

  if (before === 0) {
    console.log("Nenhum Melmetal encontrado. Nada para corrigir.");
    return;
  }

  const result = await prisma.mascot.updateMany({
    where: { pokemonId: 809 },
    data: { pokemonId: 808 },
  });

  console.log(
    `Corrigidos ${result.count} mascotes: pokemonId 809 (Melmetal) -> 808 (Meltan). Stats, EXP, level, dono e historico foram preservados.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
