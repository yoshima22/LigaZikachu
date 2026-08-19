import { prisma } from "@/lib/prisma";

const NEW_DESCRIPTION =
  "Envia o mascote de férias por 5 dias. Ao voltar, recebe 4.500 EXP + 100 por nível do mascote, felicidade máxima, volta empanturrado e ainda pode trazer um ovo: 10% de chance de Ovo Raro ou 50% de Ovo Comum.";

async function main() {
  const item = await prisma.shopItem.findFirst({ where: { type: "VACATION_TICKET" } });
  if (!item) { console.log("[aviso] VACATION_TICKET não encontrado."); return; }
  const meta = { ...((item.metadata ?? {}) as Record<string, number>) };
  delete meta.eggChancePct; // substituído pelas duas chances abaixo
  meta.vacationDays = 5;
  meta.expBonus = 4500;
  meta.rareEggChancePct = 10;
  meta.commonEggChancePct = 50;
  await prisma.shopItem.update({
    where: { id: item.id },
    data: { description: NEW_DESCRIPTION, metadata: meta },
  });
  console.log("[ok] Item de Férias atualizado: 5d, 4500+100/nível, ovo 10% raro / 50% comum.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
