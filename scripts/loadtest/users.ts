// Cria/remove usuários de teste de carga (loadtest-NNN@loadtest.invalid).
// Uso: node scripts/run-with-env-local.mjs tsx scripts/loadtest/users.ts seed 200 | clean
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();
const PASSWORD = "LoadTest#2026";
const LIKE = "loadtest-%@loadtest.invalid";

async function seed(n: number) {
  const passwordHash = await hash(PASSWORD, 10);
  for (let i = 1; i <= n; i++) {
    const id = String(i).padStart(3, "0");
    const email = `loadtest-${id}@loadtest.invalid`;
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) continue;
    await prisma.user.create({
      data: {
        email,
        name: `LoadTest ${id}`,
        passwordHash,
        status: "ACTIVE",
        player: {
          create: {
            displayName: `LoadTest ${id}`,
            wallet: { create: { balance: 500, totalEarned: 500 } },
          },
        },
      },
    });
  }
  console.log(`ok: ${n} usuários (senha ${PASSWORD})`);
}

async function clean() {
  // um por vez: o cascade de 200 usuários de uma vez estoura o statement_timeout do Supabase
  const users = await prisma.user.findMany({ where: { email: { endsWith: "@loadtest.invalid", startsWith: "loadtest-" } }, select: { id: true } });
  for (const { id } of users) await prisma.user.delete({ where: { id } });
  console.log(`removidos: ${users.length}`);
}

const [cmd, arg] = process.argv.slice(2);
(cmd === "seed" ? seed(Number(arg ?? 200)) : cmd === "clean" ? clean() : Promise.reject(new Error("seed N | clean")))
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
