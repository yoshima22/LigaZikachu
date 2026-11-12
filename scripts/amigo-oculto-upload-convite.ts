// Publica o banner do convite do Amigo Oculto em assets/events/amigo-oculto/convite.webp (upsert, 1400px de largura).
// Uso: npx tsx scripts/amigo-oculto-upload-convite.ts <arquivo.webp>
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const FILE = process.argv[2];
if (!FILE) { console.error("Informe o arquivo."); process.exit(1); }
(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Variáveis do Supabase ausentes.");
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const sharp = (await import("sharp")).default;
  const buf = await sharp(readFileSync(FILE)).resize(1400, undefined, { fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  const dest = "events/amigo-oculto/convite.webp";
  const { error } = await supabase.storage.from("assets").upload(dest, buf, { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(error.message);
  const pub = supabase.storage.from("assets").getPublicUrl(dest).data.publicUrl;
  const head = await fetch(pub, { method: "HEAD" });
  console.log(`${head.ok ? "OK " : "ERRO"} ${(buf.length / 1024).toFixed(0)} KB ${pub}`);
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
