/** Envia as imagens dos líderes de Johto para o Storage do Supabase (bucket assets, pasta JohtoLeaders, cache de 1 ano). npx tsx scripts/upload-johto-leaders.ts */
import { config } from "dotenv"; config({ path: ".env.local" }); config();
import { readFileSync, readdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Variáveis do Supabase ausentes");
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
(async () => {
  for (const file of readdirSync("public/johto-leaders (apagada após o envio; recupere do git se precisar reenviar)").filter((f) => f.endsWith(".png"))) {
    const path = `JohtoLeaders/${file}`;
    const { error } = await supabase.storage.from("assets").upload(path, readFileSync(`public/johto-leaders (apagada após o envio; recupere do git se precisar reenviar)/${file}`), { contentType: "image/png", upsert: true, cacheControl: "31536000" });
    if (error) throw new Error(`${file}: ${error.message}`);
    console.log(supabase.storage.from("assets").getPublicUrl(path).data.publicUrl);
  }
})();
