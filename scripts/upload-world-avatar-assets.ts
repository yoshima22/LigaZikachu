import fs from "node:fs/promises";
import path from "node:path";
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
  } catch { /* arquivo opcional */ }
}

async function main() {
  await loadEnvFile(".env.local");
  await loadEnvFile(".env");
  const source = path.resolve(process.argv[2] || ".asset-staging/world-avatar-test");
  const target = (process.argv[3] || "world-mode/avatars/chibi-v2").replace(/^\/+|\/+$/g, "");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error("Storage do Supabase não configurado.");
  const manifest = JSON.parse(await fs.readFile(path.join(source, "manifest.json"), "utf8")) as { canvas?: { width?: number; height?: number }; assets?: Array<{ file?: string }> };
  const canvasWidth = Number(manifest.canvas?.width ?? 0);
  const canvasHeight = Number(manifest.canvas?.height ?? 0);
  if (!Number.isInteger(canvasWidth) || !Number.isInteger(canvasHeight) || canvasWidth < 256 || canvasHeight < 256) {
    throw new Error("O manifesto deve informar um canvas válido.");
  }
  const files = Array.from(new Set([...(manifest.assets ?? []).map((entry) => entry.file).filter((file): file is string => Boolean(file)), "manifest.json"]));
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  for (const file of files) {
    if (file.includes("..") || path.basename(file) !== file) throw new Error(`Nome de asset inseguro: ${file}`);
    const buffer = await fs.readFile(path.join(source, file));
    const contentType = file.endsWith(".png") ? "image/png" : "application/json";
    const storagePath = `${target}/${file}`;
    const { error } = await supabase.storage.from("assets").upload(storagePath, buffer, { contentType, cacheControl: "31536000", upsert: true });
    if (error) throw new Error(`${storagePath}: ${error.message}`);
    console.log(`${storagePath} · ${buffer.length} bytes`);
  }
  console.log(`${supabaseUrl}/storage/v1/object/public/assets/${target}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
