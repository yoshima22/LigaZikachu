import { prisma } from "@/lib/prisma";

// O Escudo Diário deixou de criar buff permanente (agora tem o mesmo efeito do
// item Política de Fraqueza: apenas revive). Limpa os buffs legados de escudo.
async function main() {
  const res = await prisma.mascotBuff.deleteMany({ where: { type: "WEAKNESS_POLICY" } });
  console.log(`[ok] ${res.count} buff(s) de escudo (WEAKNESS_POLICY) removidos.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
