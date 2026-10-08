import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

async function loadEnvFile(file) {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), file), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator <= 0) continue;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Arquivo opcional.
  }
}

async function main() {
  await loadEnvFile(".env.local");
  await loadEnvFile(".env");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error("Storage do Supabase não configurado.");

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const assets = [
    {
      source: "C:/Users/LuizAguiar/Pictures/ImagensZikachu/Icones/Itens/TMdeHabilidade.png",
      storagePath: "items/ability-tm-v1.webp",
    },
    {
      source: "C:/Users/LUIZAG~1/AppData/Local/Temp/codex-clipboard-90a0b91e-5f53-4cd9-976c-2f5686c8b693.png",
      storagePath: "items/lab-egg-v1.webp",
    },
  ];

  for (const asset of assets) {
    const input = await fs.readFile(asset.source);
    const output = await sharp(input)
      .resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 86, alphaQuality: 100, effort: 6 })
      .toBuffer();
    const { error } = await supabase.storage.from("assets").upload(asset.storagePath, output, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: true,
    });
    if (error) throw new Error(`${asset.storagePath}: ${error.message}`);
    const { error: metadataError } = await supabase.storage.from("assets").update(asset.storagePath, output, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: true,
    });
    if (metadataError) throw new Error(`${asset.storagePath} (cache): ${metadataError.message}`);
    console.log(`${asset.storagePath}: ${input.length} -> ${output.length} bytes`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
