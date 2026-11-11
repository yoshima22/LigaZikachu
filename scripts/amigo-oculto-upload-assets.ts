// Publica as ilustrações da cartinha do Amigo Oculto em assets/events/amigo-oculto/ (upsert), redimensionadas a 768px.
// Uso: npx tsx scripts/amigo-oculto-upload-assets.ts <pasta com 9.webp..18.webp>
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = process.argv[2];
if (!DIR) { console.error("Informe a pasta das imagens."); process.exit(1); }
const MAP: Record<string, string> = {
  "9.webp": "cleide-arvore", "10.webp": "miauvadao-arvore", "11.webp": "miauvadao-noel", "12.webp": "amigos-suspeitos", "13.webp": "troca-presentes",
  "14.webp": "laboratorio", "15.webp": "ceia", "16.webp": "brinde", "17.webp": "noel-chamine", "18.webp": "enguica-lista",
};
(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Variáveis do Supabase ausentes.");
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const sharp = (await import("sharp")).default;
  for (const [src, name] of Object.entries(MAP)) {
    const buf = await sharp(readFileSync(join(DIR, src))).resize(768, 768, { fit: "inside" }).webp({ quality: 85, alphaQuality: 100 }).toBuffer();
    const dest = `events/amigo-oculto/${name}.webp`;
    const { error } = await supabase.storage.from("assets").upload(dest, buf, { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
    if (error) throw new Error(`${dest}: ${error.message}`);
    const pub = supabase.storage.from("assets").getPublicUrl(dest).data.publicUrl;
    const head = await fetch(pub, { method: "HEAD" });
    console.log(`${head.ok ? "OK " : "ERRO"} ${(buf.length / 1024).toFixed(0).padStart(4)} KB  ${pub}`);
  }
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
