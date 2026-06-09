/**
 * Migração de imagens base64 → Supabase Storage
 * ─────────────────────────────────────────────
 * Lê todos os registros com imageUrl = "data:..." em shop_items e sticker_packs,
 * faz upload para o bucket público "assets" no Supabase Storage
 * e atualiza o campo imageUrl com a URL pública estável.
 *
 * Rodar UMA vez. É idempotente: pula registros que já têm URL (não base64).
 *
 * Pré-requisitos:
 *   1. Criar o bucket "assets" no Supabase Storage como PÚBLICO
 *      (Storage → New bucket → name: assets → Public: ON)
 *   2. Adicionar SUPABASE_SERVICE_ROLE_KEY no .env.local
 *      (Settings → API → service_role secret)
 *
 * Como rodar:
 *   npx tsx scripts/migrate-images-to-storage.ts
 *
 * Ou dry-run (só mostra o que faria, sem alterar nada):
 *   DRY_RUN=1 npx tsx scripts/migrate-images-to-storage.ts
 */

import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";

// Carrega .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const DRY_RUN = process.env.DRY_RUN === "1";
const BUCKET = "assets";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Variáveis ausentes no .env.local:");
  if (!supabaseUrl) console.error("   NEXT_PUBLIC_SUPABASE_URL não definida");
  if (!serviceRoleKey) console.error("   SUPABASE_SERVICE_ROLE_KEY não definida");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const prisma = new PrismaClient();

// ─── helpers ──────────────────────────────────────────────────────────────────

function base64ToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string; ext: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) throw new Error("Formato data URL inválido");
  const mimeType = match[1];
  const ext = mimeType.split("/")[1].replace("jpeg", "jpg").replace("svg+xml", "svg");
  const buffer = Buffer.from(match[2], "base64");
  return { buffer, mimeType, ext };
}

async function uploadToStorage(
  storagePath: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  if (DRY_RUN) return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: true,
      // Cache de 1 ano — assets estáticos não mudam
      cacheControl: "31536000",
    });

  if (error) throw new Error(`Upload falhou (${storagePath}): ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── migração shop_items ──────────────────────────────────────────────────────

async function migrateShopItems() {
  const items = await prisma.shopItem.findMany({
    where: { imageUrl: { startsWith: "data:" } },
    select: { id: true, name: true, type: true, imageUrl: true },
  });

  console.log(`\n📦 shop_items com base64: ${items.length}`);
  if (items.length === 0) { console.log("   Nada a migrar."); return; }

  let ok = 0, fail = 0;

  for (const item of items) {
    try {
      const { buffer, mimeType, ext } = base64ToBuffer(item.imageUrl!);
      const slug = slugify(item.name);
      const storagePath = `shop/${item.type.toLowerCase()}/${slug}-${item.id.slice(-6)}.${ext}`;

      console.log(`  ⬆ ${item.name} (${(buffer.length / 1024).toFixed(0)} kB) → ${storagePath}`);

      const publicUrl = await uploadToStorage(storagePath, buffer, mimeType);

      if (!DRY_RUN) {
        await prisma.shopItem.update({
          where: { id: item.id },
          data: { imageUrl: publicUrl },
        });
      }

      console.log(`  ✅ ${item.name} → ${publicUrl}`);
      ok++;
    } catch (err) {
      console.error(`  ❌ ${item.name}: ${err instanceof Error ? err.message : err}`);
      fail++;
    }
  }

  console.log(`\n  shop_items: ${ok} migrados, ${fail} erros`);
}

// ─── migração sticker_packs ───────────────────────────────────────────────────

async function migrateStickerPacks() {
  const packs = await prisma.stickerPack.findMany({
    where: { imageUrl: { startsWith: "data:" } },
    select: { id: true, name: true, imageUrl: true },
  });

  console.log(`\n🃏 sticker_packs com base64: ${packs.length}`);
  if (packs.length === 0) { console.log("   Nada a migrar."); return; }

  let ok = 0, fail = 0;

  for (const pack of packs) {
    try {
      const { buffer, mimeType, ext } = base64ToBuffer(pack.imageUrl!);
      const slug = slugify(pack.name);
      const storagePath = `stickers/packs/${slug}-${pack.id.slice(-6)}.${ext}`;

      console.log(`  ⬆ ${pack.name} (${(buffer.length / 1024).toFixed(0)} kB) → ${storagePath}`);

      const publicUrl = await uploadToStorage(storagePath, buffer, mimeType);

      if (!DRY_RUN) {
        await prisma.stickerPack.update({
          where: { id: pack.id },
          data: { imageUrl: publicUrl },
        });
      }

      console.log(`  ✅ ${pack.name} → ${publicUrl}`);
      ok++;
    } catch (err) {
      console.error(`  ❌ ${pack.name}: ${err instanceof Error ? err.message : err}`);
      fail++;
    }
  }

  console.log(`\n  sticker_packs: ${ok} migrados, ${fail} erros`);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("  Migração de base64 → Supabase Storage");
  console.log(`  Bucket: ${BUCKET} | Supabase: ${supabaseUrl}`);
  if (DRY_RUN) console.log("  ⚠️  DRY RUN — nenhuma alteração será feita");
  console.log("=".repeat(60));

  await migrateShopItems();
  await migrateStickerPacks();

  console.log("\n" + "=".repeat(60));
  console.log(DRY_RUN
    ? "  Dry run concluído. Rode sem DRY_RUN=1 para aplicar."
    : "  ✅ Migração concluída! Verifique o Supabase Storage.");
  console.log("=".repeat(60));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
