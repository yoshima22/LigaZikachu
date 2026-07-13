import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

async function loadEnvFile(file: string) {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), file), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional env file
  }
}

const BUCKET = "assets";
const FOLDER = "events/order";

const FILES = [
  "ordem-da-trapaca-intro.png",
  "ordem-da-trapaca-reward.png",
  "ordem-da-trapaca-capitao.png",
] as const;

function contentType(file: string) {
  if (file.endsWith(".webp")) return "image/webp";
  if (file.endsWith(".jpg") || file.endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
}

async function main() {
  await loadEnvFile(".env.local");
  await loadEnvFile(".env");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de rodar.");
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  }).catch(() => null);

  for (const file of FILES) {
    const localPath = path.join(process.cwd(), "public", "events", file);
    const buffer = await fs.readFile(localPath);
    const storagePath = `${FOLDER}/${file}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: contentType(file),
        upsert: true,
        cacheControl: "31536000",
      });
    if (error) throw new Error(`${file}: ${error.message}`);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    console.log(`${file} -> ${data.publicUrl}`);
  }

  console.log(`\nConfigure NEXT_PUBLIC_ORDER_EVENT_ASSET_BASE_URL=${supabaseUrl}/storage/v1/object/public/${BUCKET}/${FOLDER}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
