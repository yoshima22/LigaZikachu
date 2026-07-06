"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { EggType, FoodType, GiftStatus, GiftType, Prisma, ShopItemType, ZikaCoinTxType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAdmin } from "@/lib/auth/permissions";
import { getSessionPlayer } from "@/lib/session";
import { uploadDataUrlAsset } from "@/lib/asset-storage";
import { creditCoins } from "@/lib/zikacoins";

const rewardKindSchema = z.enum(["NONE", "ZIKA_COINS", "MASCOT_EGG", "MASCOT_FOOD", "MASCOT_BUFF"]);

const newsSchema = z.object({
  title: z.string().trim().min(3, "Titulo muito curto.").max(120),
  subtitle: z.string().trim().max(180).optional().or(z.literal("")),
  body: z.string().trim().min(10, "Texto muito curto.").max(12000),
  imageUrl: z.string().trim().max(12_000_000, "Imagem muito grande. Tente uma imagem menor.").optional().or(z.literal("")),
  published: z.coerce.boolean().default(true),
  rewardKind: rewardKindSchema.default("NONE"),
  rewardAmount: z.coerce.number().int().min(0).max(100000).default(0),
  rewardType: z.string().trim().max(80).optional().or(z.literal("")),
  rewardTitle: z.string().trim().max(120).optional().or(z.literal("")),
});

function buildRewardPayload(data: z.infer<typeof newsSchema>) {
  if (data.rewardKind === "NONE") return { rewardEnabled: false, rewardTitle: null, rewardPayload: Prisma.JsonNull };
  if (data.rewardKind === "ZIKA_COINS") {
    const amount = Math.max(1, data.rewardAmount);
    return {
      rewardEnabled: true,
      rewardTitle: data.rewardTitle || `${amount} ZikaCoins`,
      rewardPayload: { rewardKind: "ZIKA_COINS", amount },
    };
  }
  if (data.rewardKind === "MASCOT_EGG") {
    const eggType = data.rewardType && Object.values(EggType).includes(data.rewardType as EggType)
      ? data.rewardType as EggType
      : EggType.COMMON;
    return {
      rewardEnabled: true,
      rewardTitle: data.rewardTitle || `Ovo ${eggType}`,
      rewardPayload: { rewardKind: "MASCOT_EGG", eggType, origin: "noticia" },
    };
  }
  if (data.rewardKind === "MASCOT_FOOD") {
    const foodType = data.rewardType === "SWEET" ? FoodType.SWEET : FoodType.FOOD;
    const quantity = Math.max(1, data.rewardAmount || 1);
    return {
      rewardEnabled: true,
      rewardTitle: data.rewardTitle || `${quantity} ${foodType === FoodType.SWEET ? "Doce" : "Comida"}`,
      rewardPayload: { rewardKind: "MASCOT_FOOD", foodType, quantity },
    };
  }
  const buffType = data.rewardType && Object.values(ShopItemType).includes(data.rewardType as ShopItemType)
    ? data.rewardType
    : "MASCOT_BUFF_EXP";
  return {
    rewardEnabled: true,
    rewardTitle: data.rewardTitle || "Item de mascote",
    rewardPayload: { rewardKind: "MASCOT_BUFF", buffType, quantity: Math.max(1, data.rewardAmount || 1) },
  };
}

function revalidateNews(userId?: string) {
  revalidatePath("/noticias");
  revalidatePath("/dashboard");
  revalidateTag("news-latest");
  if (userId) revalidateTag(`nav-${userId}`);
}

export async function createNewsPost(raw: z.infer<typeof newsSchema>) {
  try {
    const admin = await requireAdmin();
    const data = newsSchema.parse(raw);
    const uploadedImage = data.imageUrl?.startsWith("data:image/")
      ? await uploadDataUrlAsset(data.imageUrl, "news", data.title)
      : data.imageUrl || null;
    const reward = buildRewardPayload(data);

    await prisma.newsPost.create({
      data: {
        title: data.title,
        subtitle: data.subtitle || null,
        body: data.body,
        imageUrl: uploadedImage,
        published: data.published,
        createdById: admin.id,
        publishedAt: new Date(),
        ...reward,
      },
    });
    revalidateNews();
    return { ok: true };
  } catch (error) {
    console.error("[News] create post failed", error);
    if (error instanceof z.ZodError) {
      return { error: error.errors.map((issue) => issue.message).join(" ") || "Dados invalidos." };
    }
    return { error: error instanceof Error ? error.message : "Erro ao publicar noticia." };
  }
}

export async function updateNewsPost(postId: string, raw: z.infer<typeof newsSchema>) {
  try {
    const admin = await requireAdmin();
    const data = newsSchema.parse(raw);
    const uploadedImage = data.imageUrl?.startsWith("data:image/")
      ? await uploadDataUrlAsset(data.imageUrl, "news", data.title)
      : data.imageUrl || null;
    const reward = buildRewardPayload(data);

    await prisma.newsPost.update({
      where: { id: postId },
      data: {
        title: data.title,
        subtitle: data.subtitle || null,
        body: data.body,
        imageUrl: uploadedImage,
        published: data.published,
        createdById: admin.id,
        ...reward,
      },
    });
    revalidateNews();
    return { ok: true };
  } catch (error) {
    console.error("[News] update post failed", error);
    if (error instanceof z.ZodError) {
      return { error: error.errors.map((issue) => issue.message).join(" ") || "Dados invalidos." };
    }
    return { error: error instanceof Error ? error.message : "Erro ao editar noticia." };
  }
}

export async function markNewsRead(postId: string) {
  const user = await getSessionUser();
  if (!user) return { error: "Nao autenticado." };
  const player = await getSessionPlayer(user.id);
  if (!player) return { error: "Perfil nao encontrado." };
  await prisma.newsRead.upsert({
    where: { postId_playerId: { postId, playerId: player.id } },
    create: { postId, playerId: player.id },
    update: { readAt: new Date() },
  });
  revalidateNews(user.id);
  return { ok: true };
}

export async function markNewsPostsRead(postIds: string[]) {
  const user = await getSessionUser();
  if (!user) return { error: "Nao autenticado." };
  const player = await getSessionPlayer(user.id);
  if (!player) return { error: "Perfil nao encontrado." };

  const ids = Array.from(new Set(postIds.filter(Boolean))).slice(0, 5);
  if (ids.length === 0) return { ok: true };

  await prisma.newsRead.createMany({
    data: ids.map((postId) => ({ postId, playerId: player.id })),
    skipDuplicates: true,
  });
  revalidateNews(user.id);
  return { ok: true };
}

export async function claimNewsReward(postId: string) {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Nao autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil nao encontrado." };

    const post = await prisma.newsPost.findUnique({
      where: { id: postId },
      select: { id: true, title: true, rewardEnabled: true, rewardTitle: true, rewardPayload: true, published: true },
    });
    if (!post?.published || !post.rewardEnabled || !post.rewardPayload) return { error: "Esta noticia nao possui recompensa." };

    const payload = post.rewardPayload as Record<string, unknown>;
    await prisma.$transaction(async (tx) => {
      await tx.newsRewardClaim.create({
        data: { postId, playerId: player.id },
      });

      const rewardKind = payload.rewardKind;
      if (rewardKind === "ZIKA_COINS") {
        const amount = typeof payload.amount === "number" ? Math.max(1, Math.floor(payload.amount)) : 1;
        await creditCoins(tx, {
          playerId: player.id,
          type: ZikaCoinTxType.ACHIEVEMENT_REWARD,
          amount,
          description: `Noticia: ${post.title}`,
        });
      } else if (rewardKind === "MASCOT_EGG" && typeof payload.eggType === "string") {
        await tx.mascotEgg.create({
          data: {
            playerId: player.id,
            type: payload.eggType as EggType,
            origin: `noticia:${post.id}`,
          },
        });
      } else if (rewardKind === "MASCOT_FOOD" && typeof payload.foodType === "string") {
        const quantity = typeof payload.quantity === "number" ? Math.max(1, Math.floor(payload.quantity)) : 1;
        await tx.mascotFoodItem.upsert({
          where: { playerId_type: { playerId: player.id, type: payload.foodType as FoodType } },
          create: { playerId: player.id, type: payload.foodType as FoodType, quantity },
          update: { quantity: { increment: quantity } },
        });
      } else if (rewardKind === "MASCOT_BUFF" && typeof payload.buffType === "string") {
        const quantity = typeof payload.quantity === "number" ? Math.max(1, Math.floor(payload.quantity)) : 1;
        const item = await tx.shopItem.findFirst({ where: { type: payload.buffType as ShopItemType }, select: { id: true } });
        if (item) {
          await tx.playerInventory.upsert({
            where: { playerId_itemId: { playerId: player.id, itemId: item.id } },
            create: { playerId: player.id, itemId: item.id, quantity, source: "NEWS_REWARD" },
            update: { quantity: { increment: quantity } },
          });
        }
      }
      await tx.newsRead.upsert({
        where: { postId_playerId: { postId, playerId: player.id } },
        create: { postId, playerId: player.id },
        update: { readAt: new Date() },
      });
      await tx.playerGift.create({
        data: {
          playerId: player.id,
          type: GiftType.CUSTOM,
          title: `Noticia: ${post.rewardTitle ?? post.title}`,
          description: "Recompensa resgatada diretamente pela pagina de noticias.",
          payload: { rewardKind: "NEWS_REWARD_LOG", postId },
          status: GiftStatus.CLAIMED,
          claimedAt: new Date(),
        },
      });
    }, { timeout: 15000, maxWait: 10000 });

    revalidateNews(user.id);
    revalidatePath("/mascotes");
    revalidatePath("/carteira");
    revalidatePath("/inventario");
    return { ok: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Voce ja resgatou esta recompensa." };
    }
    return { error: error instanceof Error ? error.message : "Erro ao resgatar recompensa." };
  }
}
