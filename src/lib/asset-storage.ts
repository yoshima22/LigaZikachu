import { createClient } from "@supabase/supabase-js";

const BUCKET = "assets";

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string; ext: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) throw new Error("Formato de imagem invalido.");
  const mimeType = match[1];
  const ext = mimeType.split("/")[1].replace("jpeg", "jpg").replace("svg+xml", "svg");
  return { buffer: Buffer.from(match[2], "base64"), mimeType, ext };
}

function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "imagem";
}

function getStorageClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function uploadDataUrlAsset(dataUrl: string, folder: string, name: string): Promise<string> {
  if (!dataUrl.startsWith("data:image/")) return dataUrl;
  const supabase = getStorageClient();
  if (!supabase) throw new Error("Storage nao configurado.");

  let { buffer, mimeType, ext } = dataUrlToBuffer(dataUrl);
  // Todo upload do site vira WebP: grande -> máx. 1400px (q82); pequeno (sprite/ícone) -> sem perda. GIF segue animado.
  // Se o sharp falhar, sobe o original. SVG não é rasterizado.
  if (ext !== "svg") {
    try {
      const sharp = (await import("sharp")).default;
      const img = sharp(buffer, { animated: true }).rotate();
      const meta = await img.metadata();
      const small = Math.max(meta.width ?? 0, meta.pageHeight ?? meta.height ?? 0) <= 512;
      const out = await img
        .resize({ width: 1400, withoutEnlargement: true })
        .webp(small ? { lossless: true } : { quality: 82 })
        .toBuffer();
      if (out.length < buffer.length) { buffer = out; mimeType = "image/webp"; ext = "webp"; }
    } catch { /* mantém o original */ }
  }
  const storagePath = `${folder}/${slugify(name)}-${Date.now()}.${ext}`;

  let { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: true, cacheControl: "31536000" });
  if (error?.message.toLowerCase().includes("bucket")) {
    await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
    });
    const retry = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: mimeType, upsert: true, cacheControl: "31536000" });
    error = retry.error;
  }
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}
