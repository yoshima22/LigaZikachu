import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

async function loadEnvFile(file: string) {
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

  const sources = [
    { directory: path.join(process.cwd(), "public", "world-mode", "kanto", "generated"), prefix: "" },
    { directory: path.join(process.cwd(), "public", "world-mode", "kanto", "viridian-forest"), prefix: "viridian-forest" },
  ];
  for (const source of sources) {
    const files = await fs.readdir(source.directory).catch(() => [] as string[]);
    for (const file of files.filter((entry) => /\.(png|webp)$/i.test(entry)).sort()) {
    const input = await fs.readFile(path.join(source.directory, file));
    const output = await sharp(input).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toBuffer();
    const webpName = file.replace(/\.(png|webp)$/i, ".webp");
    const storagePath = `world-mode/kanto/${source.prefix ? `${source.prefix}/` : ""}${webpName}`;
    const { error } = await supabase.storage.from("assets").upload(storagePath, output, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: true,
    });
    if (error) throw new Error(`${storagePath}: ${error.message}`);
    console.log(`${webpName}: ${input.length} -> ${output.length} bytes`);
    }
  }

  console.log(`${supabaseUrl}/storage/v1/object/public/assets/world-mode/kanto`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
