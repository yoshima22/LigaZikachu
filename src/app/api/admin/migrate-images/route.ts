/**
 * POST /api/admin/migrate-images
 * Migra imageUrl base64 de shop_items e sticker_packs para Supabase Storage.
 * Roda no servidor Vercel que já tem acesso ao banco.
 *
 * Query params:
 *   ?dry=1        — apenas lista o que seria migrado, sem alterar nada
 *   ?table=shop   — migra só shop_items
 *   ?table=packs  — migra só sticker_packs
 *   (sem table)   — migra os dois
 *
 * Requer autenticação admin.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Role } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min — imagens grandes levam tempo

const BUCKET = "assets";

async function checkAdmin() {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  return role === Role.ADMIN || role === Role.SUPER_ADMIN;
}

function slugify(name: string) {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function base64ToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string; ext: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) throw new Error("Formato data URL inválido");
  const mimeType = match[1];
  const ext = mimeType.split("/")[1].replace("jpeg", "jpg").replace("svg+xml", "svg");
  return { buffer: Buffer.from(match[2], "base64"), mimeType, ext };
}

export async function GET(req: NextRequest) {
  if (!(await checkAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Diagnóstico rápido — conta quantos registros têm base64
  const [shopBase64, shopNull, shopUrl, packsBase64, packsNull, packsUrl] = await Promise.all([
    prisma.shopItem.count({ where: { imageUrl: { startsWith: "data:" } } }),
    prisma.shopItem.count({ where: { imageUrl: null } }),
    prisma.shopItem.count({ where: { AND: [{ imageUrl: { not: null } }, { NOT: { imageUrl: { startsWith: "data:" } } }] } }),
    prisma.stickerPack.count({ where: { imageUrl: { startsWith: "data:" } } }),
    prisma.stickerPack.count({ where: { imageUrl: null } }),
    prisma.stickerPack.count({ where: { AND: [{ imageUrl: { not: null } }, { NOT: { imageUrl: { startsWith: "data:" } } }] } }),
  ]);

  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  return NextResponse.json({
    diagnostic: true,
    env: { SUPABASE_SERVICE_ROLE_KEY: hasServiceKey ? "✅ configurada" : "❌ AUSENTE" },
    shop_items: { base64: shopBase64, null: shopNull, url: shopUrl },
    sticker_packs: { base64: packsBase64, null: packsNull, url: packsUrl },
    total_to_migrate: shopBase64 + packsBase64,
  });
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const table = req.nextUrl.searchParams.get("table"); // "shop" | "packs" | null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    const missing = [!supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL", !serviceKey && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean).join(", ");
    return NextResponse.json({ error: `Variáveis ausentes no Vercel: ${missing}` }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const results: { table: string; id: string; name: string; size: string; url?: string; error?: string }[] = [];

  // ── shop_items ──
  if (!table || table === "shop") {
    const items = await prisma.shopItem.findMany({
      where: { imageUrl: { startsWith: "data:" } },
      select: { id: true, name: true, type: true, imageUrl: true },
    });

    for (const item of items) {
      try {
        const { buffer, mimeType, ext } = base64ToBuffer(item.imageUrl!);
        const storagePath = `shop/${item.type.toLowerCase()}/${slugify(item.name)}-${item.id.slice(-6)}.${ext}`;
        const sizeKb = (buffer.length / 1024).toFixed(0);

        if (!dry) {
          const { error: uploadError } = await supabase.storage
            .from(BUCKET).upload(storagePath, buffer, { contentType: mimeType, upsert: true, cacheControl: "31536000" });
          if (uploadError) throw new Error(uploadError.message);

          const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
          await prisma.shopItem.update({ where: { id: item.id }, data: { imageUrl: data.publicUrl } });
          results.push({ table: "shop_items", id: item.id, name: item.name, size: `${sizeKb} kB`, url: data.publicUrl });
        } else {
          results.push({ table: "shop_items", id: item.id, name: item.name, size: `${sizeKb} kB`, url: `[DRY] ${storagePath}` });
        }
      } catch (err) {
        results.push({ table: "shop_items", id: item.id, name: item.name, size: "?", error: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  // ── sticker_packs ──
  if (!table || table === "packs") {
    const packs = await prisma.stickerPack.findMany({
      where: { imageUrl: { startsWith: "data:" } },
      select: { id: true, name: true, imageUrl: true },
    });

    for (const pack of packs) {
      try {
        const { buffer, mimeType, ext } = base64ToBuffer(pack.imageUrl!);
        const storagePath = `stickers/packs/${slugify(pack.name)}-${pack.id.slice(-6)}.${ext}`;
        const sizeKb = (buffer.length / 1024).toFixed(0);

        if (!dry) {
          const { error: uploadError } = await supabase.storage
            .from(BUCKET).upload(storagePath, buffer, { contentType: mimeType, upsert: true, cacheControl: "31536000" });
          if (uploadError) throw new Error(uploadError.message);

          const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
          await prisma.stickerPack.update({ where: { id: pack.id }, data: { imageUrl: data.publicUrl } });
          results.push({ table: "sticker_packs", id: pack.id, name: pack.name, size: `${sizeKb} kB`, url: data.publicUrl });
        } else {
          results.push({ table: "sticker_packs", id: pack.id, name: pack.name, size: `${sizeKb} kB`, url: `[DRY] ${storagePath}` });
        }
      } catch (err) {
        results.push({ table: "sticker_packs", id: pack.id, name: pack.name, size: "?", error: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  const ok = results.filter(r => !r.error).length;
  const errors = results.filter(r => r.error).length;

  return NextResponse.json({ dry, ok, errors, results });
}
