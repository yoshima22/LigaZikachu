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
  const prefix = String(process.argv[2] ?? "").replace(/^\/+|\/+$/g, "");
  if (!prefix || prefix.includes("..")) throw new Error("Informe um prefixo seguro para exclusão.");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error("Storage do Supabase não configurado.");
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await supabase.storage.from("assets").list(prefix, { limit: 1000 });
  if (error) throw error;
  const files = (data ?? []).filter((entry) => entry.id).map((entry) => `${prefix}/${entry.name}`);
  if (!files.length) {
    console.log(`Nenhum arquivo encontrado em ${prefix}.`);
    return;
  }
  const { error: removeError } = await supabase.storage.from("assets").remove(files);
  if (removeError) throw removeError;
  console.log(`${files.length} arquivo(s) removido(s) de ${prefix}.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
