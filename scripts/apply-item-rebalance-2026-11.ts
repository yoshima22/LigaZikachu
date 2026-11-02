/**
 * apply-item-rebalance-2026-11.ts (idempotente)
 *
 * Rebalanceamento de itens de mascote de novembro/2026:
 *  - preços/descrições/imagens de Amuleto, Água Fresca, Ovo da Sorte, Cesta, Política e Ovos Raro/Especial;
 *  - penas atuais viram "… Potente" (servem para qualquer mascote) e nascem 5 penas novas, 25% mais
 *    baratas, que só funcionam em espécies de crescimento x1.0 (metadata.commonSpeciesOnly);
 *  - presentes ainda não coletados que citam a pena pelo nome antigo passam a citar a Potente;
 *  - sorteio retroativo do bônus de Ovo de Evento (+3 a +6 em um atributo) para quem ainda não rolou.
 *
 * Uso: npx tsx scripts/apply-item-rebalance-2026-11.ts           (simulação)
 *      npx tsx scripts/apply-item-rebalance-2026-11.ts --apply   (grava)
 */
import { PrismaClient, ShopItemRarity, ShopItemType } from "@prisma/client";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { eventBonusLabel, rollEventBonus } from "../src/lib/mascot-data";
import {
  FRESH_WATER_IMAGE, LUCK_CHARM_IMAGE, RAINBOW_FEATHER_IMAGE, RAINBOW_FEATHER_POTENT_IMAGE,
} from "../src/lib/item-image-assets";

for (const f of [".env", ".env.local"]) {
  const p = resolve(process.cwd(), f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] ??= v;
  }
}

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();
const log = (...a: unknown[]) => console.log(APPLY ? "[APPLY]" : "[DRY]", ...a);

const TIERS = [
  { tier: "COMMON", name: "Pena Arco-Íris Comum", sortOrder: 71 },
  { tier: "RARE", name: "Pena Arco-Íris Rara", sortOrder: 72 },
  { tier: "EVENT", name: "Pena Arco-Íris de Evento", sortOrder: 73 },
  { tier: "SPECIAL", name: "Pena Arco-Íris Especial", sortOrder: 74 },
  { tier: "LAB", name: "Pena Arco-Íris de Laboratório", sortOrder: 75 },
] as const;

const COMMON_ONLY_NOTE = "Só funciona em mascotes de raridade comum (crescimento x1.0). Lendários, pseudo-lendários e paradoxos exigem a versão Potente.";
const POTENT_NOTE = "Versão Potente: funciona em qualquer mascote, inclusive lendários, pseudo-lendários e paradoxos.";
const EVENT_BONUS_NOTE = "Mascotes nascidos de Ovo de Evento têm 35% de chance de vir com +3 a +6 em um atributo aleatório. O bônus não é garantido e fica fixo mesmo após usar a Pena Arco-Íris.";

async function update(type: ShopItemType, data: { price?: number; ligaCashPrice?: number; description?: string; imageUrl?: string }) {
  const items = await prisma.shopItem.findMany({ where: { type, active: true }, select: { id: true, name: true, price: true } });
  for (const item of items) {
    log(`${item.name} (${type})`, JSON.stringify(data));
    if (APPLY) await prisma.shopItem.update({ where: { id: item.id }, data });
  }
}

async function main() {
  // Backup read-only dos itens que serão alterados.
  const targets = await prisma.shopItem.findMany({
    where: { type: { in: ["MASCOT_BUFF_LUCK", "MASCOT_BUFF_MOOD", "LUCKY_EGG", "WEAKNESS_POLICY", "PICNIC_BASKET", "EGG_RARE", "EGG_SPECIAL", "EGG_EVENT", "RAINBOW_FEATHER"] } },
  });
  const dir = process.env.BACKUP_DIR ?? resolve(process.cwd(), "outputs");
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `shop-items-backup-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(targets, null, 2));
  log(`backup: ${file} (${targets.length} itens)`);

  await update("MASCOT_BUFF_LUCK", {
    imageUrl: LUCK_CHARM_IMAGE,
    description: "Por 6 horas melhora as expedições do mascote: ovos podem subir de raridade, comida, doces e itens podem vir em dobro e as moedas rendem mais. Itens ganha mais chance de Pedra de Mega e, com sorte muito alta, expedições de 6h podem trazer um Ovo de Laboratório. Os bônus não são garantidos; o resultado avisa quando acontecem.",
  });
  await update("MASCOT_BUFF_MOOD", {
    imageUrl: FRESH_WATER_IMAGE,
    description: "Remove humores negativos (Bravo, Cansado, Carente), devolve +20 de felicidade e deixa o mascote refrescado por 24h: enquanto durar, ele não adoece nem pega doenças de outros mascotes.",
  });
  await update("LUCKY_EGG", {
    price: 1300, ligaCashPrice: 120,
    description: "Sorteia um bônus de EXP na próxima expedição de Treinamento do mascote: +20% (55%), +40% (30%), +80% (12%) ou +150% (3%). O bônus escala com a duração. Recarrega em 24h por mascote.",
  });
  await update("WEAKNESS_POLICY", { price: 510, ligaCashPrice: 47 });
  await update("PICNIC_BASKET", { price: 2125, ligaCashPrice: 195 });
  await update("EGG_RARE", { price: 2380, ligaCashPrice: 217 });
  await update("EGG_SPECIAL", { price: 4725, ligaCashPrice: 434 });

  const eventEggs = await prisma.shopItem.findMany({ where: { type: "EGG_EVENT" }, select: { id: true, name: true, description: true } });
  for (const egg of eventEggs) {
    if (egg.description?.includes("+3 a +6")) continue;
    const description = [egg.description, EVENT_BONUS_NOTE].filter(Boolean).join(" ");
    log(`${egg.name} (EGG_EVENT) descrição += bônus`);
    if (APPLY) await prisma.shopItem.update({ where: { id: egg.id }, data: { description } });
  }

  // ── Penas ────────────────────────────────────────────────────────────────
  const feathers = await prisma.shopItem.findMany({ where: { type: "RAINBOW_FEATHER" }, orderBy: { createdAt: "asc" } });
  for (const t of TIERS) {
    const potentName = `${t.name} Potente`;
    const meta = (item: { metadata: unknown }) => (item.metadata ?? {}) as { eggTier?: string; commonSpeciesOnly?: boolean; adminLabOriginOverride?: boolean };
    const legacy = feathers.find((f) => !meta(f).adminLabOriginOverride && !meta(f).commonSpeciesOnly && meta(f).eggTier === t.tier && (f.name === t.name || f.name === potentName));
    if (!legacy) throw new Error(`Pena original ${t.tier} não encontrada.`);
    const baseDescription = (legacy.description ?? "").replace(POTENT_NOTE, "").trim();
    if (legacy.name !== potentName || legacy.imageUrl !== RAINBOW_FEATHER_POTENT_IMAGE || !legacy.description?.includes(POTENT_NOTE)) {
      log(`renomear ${legacy.name} -> ${potentName}`);
      if (APPLY) await prisma.shopItem.update({ where: { id: legacy.id }, data: { name: potentName, imageUrl: RAINBOW_FEATHER_POTENT_IMAGE, description: `${baseDescription} ${POTENT_NOTE}` } });
    }
    const newPrice = Math.round(legacy.price * 0.75);
    const newLc = legacy.ligaCashPrice ? Math.round(legacy.ligaCashPrice * 0.75) : null;
    const existing = feathers.find((f) => f.name === t.name && meta(f).commonSpeciesOnly);
    const data = {
      type: ShopItemType.RAINBOW_FEATHER,
      name: t.name,
      description: `${baseDescription} ${COMMON_ONLY_NOTE}`,
      imageUrl: RAINBOW_FEATHER_IMAGE,
      rarity: legacy.rarity as ShopItemRarity,
      price: newPrice,
      ligaCashPrice: newLc,
      active: true,
      inventoryEnabled: true,
      sortOrder: t.sortOrder,
      metadata: { eggTier: t.tier, commonSpeciesOnly: true },
    };
    if (existing) { log(`pena nova já existe: ${t.name}`); continue; }
    log(`criar ${t.name} ${newPrice} ZC / ${newLc} LC`);
    if (APPLY) await prisma.shopItem.create({ data });
  }

  // ── Presentes pendentes que citam a pena pelo nome antigo ──────────────────
  const gifts = await prisma.playerGift.findMany({ where: { status: "UNCLAIMED" }, select: { id: true, payload: true } });
  let giftFixes = 0;
  for (const gift of gifts) {
    if (!gift.payload) continue;
    let text = JSON.stringify(gift.payload);
    const before = text;
    for (const t of TIERS) text = text.split(`"${t.name}"`).join(`"${t.name} Potente"`);
    if (text === before) continue;
    giftFixes++;
    if (APPLY) await prisma.playerGift.update({ where: { id: gift.id }, data: { payload: JSON.parse(text) } });
  }
  log(`presentes pendentes ajustados: ${giftFixes}`);

  // ── Bônus retroativo de Ovo de Evento ───────────────────────────────────────
  const mascots = await prisma.mascot.findMany({
    where: { hatchedFromEggType: "EVENT", eventBonusRolledAt: null },
    select: { id: true, hatchedFromEggOrigin: true },
  });
  let rolled = 0, withBonus = 0;
  for (const mascot of mascots) {
    const bonus = rollEventBonus();
    rolled++;
    if (bonus) withBonus++;
    if (!APPLY) continue;
    const claimed = await prisma.mascot.updateMany({
      where: { id: mascot.id, eventBonusRolledAt: null },
      data: {
        eventBonusRolledAt: new Date(),
        eventBonusStat: bonus?.stat ?? null,
        eventBonusValue: bonus?.value ?? null,
        ...(bonus ? { [bonus.stat]: { increment: bonus.value } } : {}),
      },
    });
    if (claimed.count === 1 && bonus) {
      await prisma.mascotEvent.create({ data: { mascotId: mascot.id, emoji: "🎉", description: `Bônus de Ovo de Evento sorteado: +${bonus.value} em ${eventBonusLabel(bonus.stat)}!` } });
    }
  }
  log(`mascotes de Ovo de Evento: ${rolled} sorteados, ${withBonus} com bônus`);
}

main().finally(() => prisma.$disconnect());
