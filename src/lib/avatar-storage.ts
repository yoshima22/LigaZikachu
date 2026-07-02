// Server-only — upload de avatares para o Supabase Storage.
// Avatares eram salvos como data-URL base64 (até 1,2MB) na coluna players.avatarUrl,
// o que multiplicava o egress do banco em todo select do campo. Agora o arquivo vai
// para o bucket "assets" e o banco guarda só a URL pública (~100 bytes).
import { createClient } from "@supabase/supabase-js";

const BUCKET = "assets";

function base64ToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string; ext: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) throw new Error("Formato de imagem inválido.");
  const mimeType = match[1];
  const ext = mimeType.split("/")[1].replace("jpeg", "jpg").replace("svg+xml", "svg");
  return { buffer: Buffer.from(match[2], "base64"), mimeType, ext };
}

function getStorageClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Sobe um avatar base64 para o Storage e retorna a URL pública.
 * Caminho com timestamp para evitar CDN servindo versão antiga; remove
 * versões anteriores do mesmo jogador (best effort).
 */
export async function uploadAvatarToStorage(playerId: string, dataUrl: string): Promise<string> {
  const supabase = getStorageClient();
  if (!supabase) throw new Error("Storage não configurado (SUPABASE_SERVICE_ROLE_KEY ausente).");

  const { buffer, mimeType, ext } = base64ToBuffer(dataUrl);
  const storagePath = `avatars/${playerId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: true, cacheControl: "31536000" });
  if (uploadError) throw new Error(uploadError.message);

  // Limpa versões anteriores do avatar deste jogador (não bloqueia em caso de falha)
  try {
    const { data: existing } = await supabase.storage.from(BUCKET).list("avatars", { search: `${playerId}-` });
    const stale = (existing ?? [])
      .filter((f) => f.name.startsWith(`${playerId}-`) && `avatars/${f.name}` !== storagePath)
      .map((f) => `avatars/${f.name}`);
    if (stale.length > 0) await supabase.storage.from(BUCKET).remove(stale);
  } catch { /* best effort */ }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}
