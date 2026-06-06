/**
 * Script para criar os 6 novos itens especiais no shop.
 * Execute: npx ts-node scripts/seed-special-items.ts
 * Ou rode via prisma studio para inserção manual.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ITEMS = [
  {
    name: "Ovo da Sorte",
    type: "LUCKY_EGG" as const,
    description: "+20% EXP na próxima expedição de treinamento. Recarrega em 24h.",
    price: 400,
    active: true,
    imageUrl: null as string | null,
  },
  {
    name: "Política de Fraqueza",
    type: "WEAKNESS_POLICY" as const,
    description: "Protege o Pokémon de ataques oportunistas enquanto ferido. Bloqueio único — o item é consumido ao ativar.",
    price: 300,
    active: true,
    imageUrl: null as string | null,
  },
  {
    name: "Cesta de Piquenique Chocante",
    type: "PICNIC_BASKET" as const,
    description: "A equipe equipada recebe +50% EXP e +5 felicidade em cada interação durante 2 horas. Pokémon ficam presos durante o efeito.",
    price: 500,
    active: true,
    imageUrl: null as string | null,
  },
  {
    name: "Ticket de Férias do Prof. Carvalho",
    type: "VACATION_TICKET" as const,
    description: "Envia o Pokémon de férias com o Professor Carvalho por 7 dias. Volta revigorado com +30 felicidade e +500 EXP.",
    price: 800,
    active: true,
    imageUrl: null as string | null,
  },
  {
    name: "Compartilhador de XP",
    type: "XP_SHARE" as const,
    description: "Equipe em um Pokémon fora de expedição. Quando outra expedição de treinamento terminar, esse Pokémon recebe metade do EXP. Permanente até remover. Limite: 1 ativo por jogador.",
    price: 500,
    active: true,
    imageUrl: null as string | null,
  },
  {
    name: "Pena Arco-Íris",
    type: "RAINBOW_FEATHER" as const,
    description: "Reseta todos os atributos do Pokémon e o coloca de volta no nível 1. Use para rebalancear um Pokémon do zero. Ação irreversível.",
    price: 3000,
    active: true,
    imageUrl: null as string | null,
  },
];

async function main() {
  console.log("Criando itens especiais na loja...");

  for (const item of ITEMS) {
    const existing = await prisma.shopItem.findFirst({ where: { type: item.type } });
    if (existing) {
      console.log(`  ⏭  ${item.name} já existe (id: ${existing.id})`);
      continue;
    }
    const created = await prisma.shopItem.create({
      data: {
        name: item.name,
        type: item.type,
        description: item.description,
        price: item.price,
        active: item.active,
        imageUrl: item.imageUrl,
      },
    });
    console.log(`  ✅ ${item.name} criado (id: ${created.id}, preço: ${item.price} ZC)`);
  }

  console.log("Concluído!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
