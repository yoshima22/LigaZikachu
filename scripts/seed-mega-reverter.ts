// Cria (ou atualiza) o item "Reversor De Mega" no Zikashop. Idempotente.
// Execute: npx tsx scripts/seed-mega-reverter.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DATA = {
  name: "Reversor De Mega",
  description: "Desfaz a Mega Evolução de um mascote: a pedra usada é destruída, ele volta à forma anterior e perde o bônus de atributos da Mega. Ideal para quem quer usar o mascote na Máquina de DNA, que exige o mesmo Pokémon.",
  imageUrl: "https://fwxqywivezsixamietps.supabase.co/storage/v1/object/public/assets/items/Reversor%20de%20Mega.webp",
  price: 1000,
  rarity: "RARE" as const,
  active: true,
  inventoryEnabled: true,
};

async function main() {
  const existing = await prisma.shopItem.findFirst({ where: { type: "MEGA_REVERTER" }, select: { id: true } });
  const item = existing
    ? await prisma.shopItem.update({ where: { id: existing.id }, data: DATA })
    : await prisma.shopItem.create({ data: { type: "MEGA_REVERTER", ...DATA } });
  console.log(existing ? "atualizado" : "criado", item.id, item.name, item.price);
}

main().finally(() => prisma.$disconnect());
