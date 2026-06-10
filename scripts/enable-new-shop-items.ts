/**
 * enable-new-shop-items.ts
 *
 * 1. Habilita os 6 novos itens da loja (LUCKY_EGG, WEAKNESS_POLICY, PICNIC_BASKET,
 *    VACATION_TICKET, XP_SHARE, RAINBOW_FEATHER) caso ainda estejam com active = false.
 * 2. Remove todos esses itens do inventário de todos os jogadores (incluindo equipados).
 * 3. Remove todos os MascotBuff criados por esses itens de todos os mascotes.
 * 4. Atualiza a descrição dos itens no banco para refletir o funcionamento real.
 *
 * Modo dry-run (padrão): mostra o que seria feito.
 * Com --apply: executa as alterações.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

const TARGET_TYPES = [
  "LUCKY_EGG",
  "WEAKNESS_POLICY",
  "PICNIC_BASKET",
  "VACATION_TICKET",
  "XP_SHARE",
  "RAINBOW_FEATHER",
] as const;

const BUFF_TYPES_TO_CLEAR = [
  "LUCKY_EGG",
  "WEAKNESS_POLICY",
  "PICNIC_BASKET",
  "XP_SHARE",
  // VACATION_TICKET cria MascotExpedition, não MascotBuff — não precisa limpar aqui
  // RAINBOW_FEATHER reseta mascote mas não cria buff
] as const;

/** Descrições corretas conforme implementação real */
const CORRECT_DESCRIPTIONS: Record<string, string> = {
  LUCKY_EGG:       "+20% EXP na próxima expedição de treinamento. Recarrega em 24h por mascote.",
  WEAKNESS_POLICY: "Protege o Pokémon de ataques oportunistas enquanto ferido. Consumido ao bloquear um ataque.",
  PICNIC_BASKET:   "Toda a equipe equipada recebe +50% EXP e +5 felicidade por interação durante 2 horas.",
  VACATION_TICKET: "Envia o Pokémon de férias por 7 dias. Volta revigorado com +30 felicidade e +500 EXP.",
  XP_SHARE:        "Equipe em um Pokémon. Quando outra expedição de treinamento terminar, ele recebe metade do EXP. Permanente até remover. Limite: 1 por jogador.",
  RAINBOW_FEATHER: "Reseta todos os atributos do Pokémon e o coloca de volta no nível 1. Irreversível.",
};

async function main() {
  console.log(`\n🛍  enable-new-shop-items — modo: ${apply ? "APPLY" : "DRY-RUN"}\n`);

  // ── 1. Listar itens alvo ──────────────────────────────────────────────────
  const items = await prisma.shopItem.findMany({
    where: { type: { in: TARGET_TYPES as unknown as import("@prisma/client").ShopItemType[] } },
    select: { id: true, type: true, name: true, active: true, description: true },
  });

  if (items.length === 0) {
    console.log("⚠️  Nenhum item encontrado no banco para os tipos alvo. Crie-os primeiro via /shop/admin.");
    return;
  }

  console.log(`📋 Itens encontrados (${items.length}):`);
  for (const item of items) {
    const descOk = item.description === CORRECT_DESCRIPTIONS[item.type];
    console.log(
      `  [${item.active ? "✅ ATIVO" : "🔴 INATIVO"}] ${item.name} (${item.type})` +
      `${descOk ? "" : " ← descrição diferente"}`
    );
  }

  // ── 2. Inventários a remover ──────────────────────────────────────────────
  const itemIds = items.map(i => i.id);
  const inventoryEntries = await prisma.playerInventory.findMany({
    where: { itemId: { in: itemIds } },
    select: {
      id: true, playerId: true, itemId: true, quantity: true, equipped: true,
      player: { select: { displayName: true } },
      item: { select: { name: true, type: true } },
    },
  });

  console.log(`\n🎒 Entradas de inventário a remover (${inventoryEntries.length}):`);
  for (const e of inventoryEntries) {
    console.log(`  ${e.player.displayName} — ${e.item.name} x${e.quantity}${e.equipped ? " [EQUIPADO]" : ""}`);
  }

  // ── 3. MascotBuffs a remover ──────────────────────────────────────────────
  const buffEntries = await prisma.mascotBuff.findMany({
    where: { type: { in: BUFF_TYPES_TO_CLEAR as unknown as import("@prisma/client").MascotBuffType[] } },
    select: {
      id: true, type: true, expiresAt: true,
      mascot: { select: { id: true, nickname: true, pokemonId: true, player: { select: { displayName: true } } } },
    },
  });

  console.log(`\n✨ MascotBuffs a remover (${buffEntries.length}):`);
  for (const b of buffEntries) {
    const name = b.mascot.nickname ?? `#${b.mascot.pokemonId}`;
    console.log(`  ${b.mascot.player.displayName} / ${name} — ${b.type} (expira ${b.expiresAt.toISOString().slice(0, 10)})`);
  }

  if (!apply) {
    console.log("\n⚡ Modo dry-run. Use --apply para executar.\n");
    return;
  }

  // ── APPLY ─────────────────────────────────────────────────────────────────

  // Habilita itens + corrige descrições
  let enabledCount = 0;
  let descUpdated = 0;
  for (const item of items) {
    const needsEnable = !item.active;
    const newDesc = CORRECT_DESCRIPTIONS[item.type];
    const needsDesc = newDesc && item.description !== newDesc;

    if (needsEnable || needsDesc) {
      await prisma.shopItem.update({
        where: { id: item.id },
        data: {
          ...(needsEnable ? { active: true } : {}),
          ...(needsDesc ? { description: newDesc } : {}),
        },
      });
      if (needsEnable) enabledCount++;
      if (needsDesc) descUpdated++;
    }
  }
  console.log(`\n✅ ${enabledCount} item(s) habilitado(s), ${descUpdated} descrição(ões) atualizada(s).`);

  // Remove inventário
  if (itemIds.length > 0) {
    const { count: invDeleted } = await prisma.playerInventory.deleteMany({
      where: { itemId: { in: itemIds } },
    });
    console.log(`✅ ${invDeleted} entrada(s) de inventário removida(s).`);
  }

  // Remove buffs
  if (BUFF_TYPES_TO_CLEAR.length > 0) {
    const { count: buffDeleted } = await prisma.mascotBuff.deleteMany({
      where: { type: { in: BUFF_TYPES_TO_CLEAR as unknown as import("@prisma/client").MascotBuffType[] } },
    });
    console.log(`✅ ${buffDeleted} MascotBuff(s) removido(s).`);
  }

  console.log("\n🎉 Concluído.\n");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
