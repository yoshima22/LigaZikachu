import { prisma } from "@/lib/prisma";

export type GiftPopupData = { id: string; kind: "SUPPORTER_PASS" | "LIGA_CASH"; senderName: string; title: string; message: string | null; rewardLabel: string };

const rec = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

/** Presente de outro jogador (passe ou LC) ainda não resgatado e cuja janela ainda não foi vista. */
export async function getGiftPopup(playerId: string): Promise<GiftPopupData | null> {
  const gifts = await prisma.playerGift.findMany({
    where: { playerId, status: "UNCLAIMED", type: "CUSTOM", OR: [{ payload: { path: ["rewardKind"], equals: "SUPPORTER_PASS" } }, { payload: { path: ["rewardKind"], equals: "LIGA_CASH" } }] },
    orderBy: { createdAt: "asc" },
    take: 10,
    select: { id: true, title: true, description: true, payload: true },
  });
  for (const gift of gifts) {
    const payload = rec(gift.payload);
    const sender = typeof payload.senderName === "string" ? payload.senderName : "";
    if (!sender || payload.popupSeenAt) continue;
    if (payload.rewardKind === "SUPPORTER_PASS") {
      const key = typeof payload.passScheduleKey === "string" ? payload.passScheduleKey : "";
      const base = key === "singleton" ? "Passe Apoiador" : key || "Passe Apoiador";
      return { id: gift.id, kind: "SUPPORTER_PASS", senderName: sender, title: gift.title, message: gift.description, rewardLabel: payload.passSlot === "NEXT" ? `${base} (passe do mês seguinte)` : base };
    }
    return { id: gift.id, kind: "LIGA_CASH", senderName: sender, title: gift.title, message: gift.description, rewardLabel: typeof payload.rewardLabel === "string" ? payload.rewardLabel : "LigaCash" };
  }
  return null;
}
