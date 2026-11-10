// Publica as imagens do evento no bucket "assets" do Supabase com nomes estáveis (upsert).
// Uso: npx tsx scripts/rei-do-rio-upload-assets.ts <pasta com 1.webp..8.webp>
// Converte para WebP só se o arquivo ainda não for WebP (preserva transparência).
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = process.argv[2];
if (!DIR) { console.error("Informe a pasta das imagens."); process.exit(1); }

// arquivo de origem -> caminho no bucket
const MAP: Record<string, string> = {
  "1.webp": "events/rei-do-rio/cover.webp",
  "2.webp": "events/rei-do-rio/banner.webp",
  "3.webp": "events/rei-do-rio/background.webp",
  "4.webp": "events/rei-do-rio/ornaments/crown.webp",
  "5.webp": "events/rei-do-rio/ornaments/lantern.webp",
  "6.webp": "events/rei-do-rio/ornaments/gift.webp",
  "7.webp": "events/rei-do-rio/ornaments/bauble-ball.webp",
  "8.webp": "events/rei-do-rio/ornaments/snowflake.webp",
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Variáveis do Supabase ausentes.");
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const sharp = (await import("sharp")).default;
  for (const [src, dest] of Object.entries(MAP)) {
    let buf: Buffer = Buffer.from(readFileSync(join(DIR, src)));
    const meta = await sharp(buf).metadata();
    if (meta.format !== "webp") buf = await sharp(buf).webp({ quality: 85, alphaQuality: 100 }).toBuffer();
    const { error } = await supabase.storage.from("assets").upload(dest, buf, { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
    if (error) throw new Error(`${dest}: ${error.message}`);
    const pub = supabase.storage.from("assets").getPublicUrl(dest).data.publicUrl;
    const head = await fetch(pub, { method: "HEAD" });
    console.log(`${head.ok ? "OK " : "ERRO"} ${(buf.length / 1024).toFixed(0).padStart(4)} KB  ${meta.width}x${meta.height}  ${pub}`);
  }
}
main().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
