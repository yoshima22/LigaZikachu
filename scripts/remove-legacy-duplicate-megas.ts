/**
 * Remove as duas Megas que o painel recriou depois das versões legadas.
 * Uso: npx tsx scripts/remove-legacy-duplicate-megas.ts [--apply]
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

for (const file of [".env", ".env.local"]) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] ??= value;
  }
}

const duplicatePokemonIds = [10283, 10300] as const;
const duplicateStoneTypes = ["MEGA_STONE_CUSTOM_10283", "MEGA_STONE_CUSTOM_10300"] as const;
const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  const [mascots, inventory, items, toggles] = await Promise.all([
    prisma.mascot.count({ where: { pokemonId: { in: [...duplicatePokemonIds] } } }),
    prisma.playerInventory.count({ where: { item: { type: { in: [...duplicateStoneTypes] } } } }),
    prisma.shopItem.findMany({ where: { type: { in: [...duplicateStoneTypes] } }, select: { id: true, type: true } }),
    prisma.eggPokemonToggle.findMany({ where: { pokemonId: { in: [...duplicatePokemonIds] } }, select: { pokemonId: true } }),
  ]);

  console.log(JSON.stringify({ mascots, inventory, items: items.map((item) => item.type), toggles: toggles.map((toggle) => toggle.pokemonId), apply }));
  if (mascots !== 0 || inventory !== 0) throw new Error("Há jogadores usando uma Mega duplicada; migre os dados antes de removê-la.");
  if (!apply) return;

  const result = await prisma.$transaction(async (tx) => ({
    toggles: (await tx.eggPokemonToggle.deleteMany({ where: { pokemonId: { in: [...duplicatePokemonIds] } } })).count,
    shopItems: (await tx.shopItem.deleteMany({ where: { type: { in: [...duplicateStoneTypes] } } })).count,
  }));
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
