import { prisma } from "@/lib/prisma";

export type NotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
  url?: string;
};

// ── FCM HTTP v1 ───────────────────────────────────────────────────────────────

async function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    // Restaurar quebras de linha na private_key (podem vir escapadas como \\n da Vercel)
    const normalized = raw.replace(/\\n/g, "\n");
    return JSON.parse(normalized) as {
      client_email: string;
      private_key: string;
      project_id: string;
    };
  } catch {
    console.error("[FCM] Falha ao parsear FIREBASE_SERVICE_ACCOUNT_JSON");
    return null;
  }
}

async function getAccessToken(): Promise<string | null> {
  try {
    const sa = await getServiceAccount();
    if (!sa?.client_email || !sa?.private_key) {
      console.error("[FCM] Service account inválido — faltam client_email ou private_key");
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const payload = {
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600
    };

    const encode = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
    const unsigned = `${encode(header)}.${encode(payload)}`;

    const { createSign } = await import("crypto");
    const sign = createSign("RSA-SHA256");
    sign.update(unsigned);
    const signature = sign.sign(sa.private_key, "base64url");
    const jwt = `${unsigned}.${signature}`;

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt
      })
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[FCM] Falha ao obter access token:", err);
      return null;
    }

    const data = await res.json() as { access_token?: string };
    return data.access_token ?? null;
  } catch (e) {
    console.error("[FCM] Erro no getAccessToken:", e);
    return null;
  }
}

async function sendFcmMessage(token: string, payload: NotificationPayload): Promise<void> {
  const sa = await getServiceAccount();
  if (!sa?.project_id) return;

  const accessToken = await getAccessToken();
  if (!accessToken) return;

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
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
            notification: { sound: "default" }
          }
        }
      })
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("[FCM] Falha ao enviar mensagem:", err);
  }
}

// ── API pública ───────────────────────────────────────────────────────────────

export async function sendNotificationToUser(
  userId: string,
  payload: NotificationPayload
): Promise<void> {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    console.warn("[FCM] FIREBASE_SERVICE_ACCOUNT_JSON não configurado");
    return;
  }

  let tokens: { token: string }[] = [];
  try {
    tokens = await prisma.userFcmToken.findMany({
      where: { userId },
      select: { token: true }
    });
  } catch {
    console.error("[FCM] Tabela user_fcm_tokens não encontrada ou erro ao buscar tokens");
    return;
  }

  if (tokens.length === 0) {
    console.log(`[FCM] Nenhum token registrado para userId=${userId}`);
    return;
  }

  await Promise.allSettled(tokens.map((t) => sendFcmMessage(t.token, payload)));
}

export async function sendNotificationToPlayers(
  playerIds: string[],
  payload: NotificationPayload
): Promise<void> {
  const players = await prisma.player.findMany({
    where: { id: { in: playerIds } },
    select: { userId: true }
  }).catch(() => [] as { userId: string }[]);

  await Promise.allSettled(
    players.map((p) => sendNotificationToUser(p.userId, payload))
  );
}
