/**
 * Otimiza as imagens do bucket "assets" sem mudar nenhuma URL.
 *
 * - PNG/JPEG grandes viram WebP (qualidade 86, alfa preservado, largura máx.
 *   1920px) gravados NO MESMO CAMINHO, com content-type image/webp. O navegador
 *   usa o content-type, não a extensão, então os links salvos no banco seguem
 *   valendo. Só troca se o novo arquivo ficar < 70% do original.
 * - Tudo passa a ter Cache-Control de 1 ano (os uploads novos já usam isso;
 *   68 arquivos antigos estavam com 1 hora).
 * - Antes de sobrescrever, o original é copiado para `_originals/<caminho>` no
 *   mesmo bucket (e numa pasta local, se BACKUP_DIR for informado).
 *
 *   npx tsx --env-file=.env.local scripts/optimize-storage-assets.ts           # ensaio
 *   npx tsx --env-file=.env.local scripts/optimize-storage-assets.ts --apply   # grava
 *
 * Idempotente: arquivos já em WebP/1 ano são pulados; o backup não é sobrescrito.
 */
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

const BUCKET = "assets";
const YEAR = "31536000";
const APPLY = process.argv.includes("--apply");
const BACKUP_DIR = process.env.BACKUP_DIR;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Obj = { name: string; size: number; mime: string; cc: string | null };

async function main() {
  const objects = await prisma.$queryRaw<Obj[]>`
    SELECT name, COALESCE((metadata->>'size')::bigint, 0)::int AS size,
           metadata->>'mimetype' AS mime, metadata->>'cacheControl' AS cc
    FROM storage.objects
    WHERE bucket_id = ${BUCKET} AND name NOT LIKE '\_originals/%'
    ORDER BY name`;

  let before = 0, after = 0, converted = 0, cacheOnly = 0;
  for (const o of objects) {
    const convertible = (o.mime === "image/png" || o.mime === "image/jpeg") && o.size > 150_000;
    const needsCache = o.cc !== `max-age=${YEAR}`;
    if (!o.size || (!convertible && !needsCache)) continue;

    const { data, error } = await supabase.storage.from(BUCKET).download(o.name);
    if (error || !data) { console.log("ERRO download", o.name, error?.message); continue; }
    const original = Buffer.from(await data.arrayBuffer());

    let body: Buffer = original, mime = o.mime;
    if (convertible) {
      const webp = await sharp(original)
        .rotate()
        .resize({ width: 1920, withoutEnlargement: true })
        .webp({ quality: 86, alphaQuality: 100, effort: 6 })
        .toBuffer();
      if (webp.length < original.length * 0.7) { body = webp; mime = "image/webp"; }
    }
    const changed = body !== original;
    before += original.length; after += body.length;
    if (changed) converted++; else cacheOnly++;
    console.log(`${changed ? "webp " : "cache"} ${String(Math.round(original.length / 1024)).padStart(6)} KB -> ${String(Math.round(body.length / 1024)).padStart(6)} KB  ${o.name}`);
    if (!APPLY) continue;

    if (changed) {
      if (BACKUP_DIR) {
        const file = path.join(BACKUP_DIR, o.name);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, original);
      }
      const backup = await supabase.storage.from(BUCKET).upload(`_originals/${o.name}`, original, { contentType: o.mime, cacheControl: YEAR, upsert: false });
      if (backup.error && !/exists|duplicate/i.test(backup.error.message)) {
        console.log("  ABORTADO (backup falhou)", o.name, backup.error.message);
        continue;
      }
    }
    const { error: upErr } = await supabase.storage.from(BUCKET).update(o.name, body, { contentType: mime, cacheControl: YEAR, upsert: true });
    if (upErr) console.log("  ERRO update", o.name, upErr.message);
  }
  console.log(`\n${APPLY ? "APLICADO" : "ENSAIO"}: ${converted} convertidos, ${cacheOnly} só cache; ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(1)} MB`);
}

main().finally(() => prisma.$disconnect());
