import { prisma } from "@/lib/prisma";

export type NotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
  url?: string;
};

// ── FCM HTTP v1 ───────────────────────────────────────────────────────────────
// A API legada (fcm.googleapis.com/fcm/send + Server Key) foi descontinuada.
// A v1 usa OAuth2 com Service Account.
// Configure FIREBASE_SERVICE_ACCOUNT_JSON na Vercel com o conteúdo do JSON da conta de serviço.

async function getAccessToken(): Promise<string | null> {
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) return null;

    // Restaurar quebras de linha na private_key que podem ser escapadas como \\n
    const normalized = raw.replace(/\\n/g, "\n");
    const sa = JSON.parse(normalized) as {
      client_email: string;
      private_key: string;
      project_id: string;
    };

    // Criar JWT para OAuth2
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const payload = {
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600
    };

    const encode = (obj: object) =>
      Buffer.from(JSON.stringify(obj)).toString("base64url");

    const unsigned = `${encode(header)}.${encode(payload)}`;

    // Importar crypto para assinar com RS256
    const { createSign } = await import("crypto");
    const sign = createSign("RSA-SHA256");
    sign.update(unsigned);
    const signature = sign.sign(sa.private_key, "base64url");
    const jwt = `${unsigned}.${signature}`;

    // Trocar JWT por access token
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt
      })
    });

    if (!res.ok) return null;
    const data = await res.json() as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

async function getProjectId(): Promise<string | null> {
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) return null;
    const normalized = raw.replace(/\\n/g, "\n");
    const sa = JSON.parse(normalized) as { project_id: string };
    return sa.project_id;
  } catch { return null; }
}

async function sendFcmMessage(token: string, payload: NotificationPayload): Promise<void> {
  const [accessToken, projectId] = await Promise.all([getAccessToken(), getProjectId()]);
  if (!accessToken || !projectId) return;

  await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        message: {
          token,
          notification: {
            title: payload.title,
            body: payload.body
          },
          data: {
            url: payload.url ?? "/dashboard",
            ...payload.data
          },
          android: {
            priority: "high",
            notification: { sound: "default", click_action: "FLUTTER_NOTIFICATION_CLICK" }
          }
        }
      })
    }
  );
}

// ── API pública ───────────────────────────────────────────────────────────────

export async function sendNotificationToUser(
  userId: string,
  payload: NotificationPayload
): Promise<void> {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return;

  const tokens = await prisma.userFcmToken.findMany({
    where: { userId },
    select: { token: true }
  });
  if (tokens.length === 0) return;

  await Promise.allSettled(tokens.map((t) => sendFcmMessage(t.token, payload)));
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
