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

  const { buffer, mimeType, ext } = dataUrlToBuffer(dataUrl);
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
