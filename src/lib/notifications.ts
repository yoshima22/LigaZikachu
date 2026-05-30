import { prisma } from "@/lib/prisma";

export type NotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
  url?: string;
};

/**
 * Envia push notification via FCM para um ou mais usuários.
 * Requer FCM_SERVER_KEY nas variáveis de ambiente.
 */
export async function sendNotificationToUser(
  userId: string,
  payload: NotificationPayload
): Promise<void> {
  const serverKey = process.env.FCM_SERVER_KEY;
  if (!serverKey) return; // silently skip if not configured

  const tokens = await prisma.userFcmToken.findMany({
    where: { userId },
    select: { token: true }
  });
  if (tokens.length === 0) return;

  await Promise.allSettled(
    tokens.map((t) =>
      fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `key=${serverKey}`
        },
        body: JSON.stringify({
          to: t.token,
          notification: {
            title: payload.title,
            body: payload.body,
            sound: "default",
            click_action: "FLUTTER_NOTIFICATION_CLICK"
          },
          data: {
            url: payload.url ?? "/dashboard",
            ...payload.data
          }
        })
      })
    )
  );
}

export async function sendNotificationToPlayers(
  playerIds: string[],
  payload: NotificationPayload
): Promise<void> {
  const players = await prisma.player.findMany({
    where: { id: { in: playerIds } },
    select: { userId: true }
  });
  await Promise.allSettled(
    players.map((p) => sendNotificationToUser(p.userId, payload))
  );
}
