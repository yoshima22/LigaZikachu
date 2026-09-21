import { prisma } from "@/lib/prisma";
import { parseNotificationSettings, isWithinPushCooldown, type NotifCategory } from "@/lib/notification-preferences";

export type NotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
  url?: string;
  /** Categoria para respeitar as preferências do jogador. Sem categoria = envia sempre. */
  category?: NotifCategory;
};

// Filtra destinatários de push pelas preferências (categoria desligada ou dentro
// do cooldown são pulados) e registra o último envio para o cooldown global.
// Sem categoria, devolve a lista original (bypass — ex.: teste do admin).
async function allowPushUserIds(userIds: string[] | null, category?: NotifCategory): Promise<string[] | null> {
  if (!category) return userIds;
  const players = await prisma.player.findMany({
    where: userIds ? { userId: { in: [...new Set(userIds)] } } : undefined,
    select: { id: true, userId: true, notificationSettings: true, lastPushAt: true },
  }).catch(() => [] as { id: string; userId: string; notificationSettings: unknown; lastPushAt: Date | null }[]);
  const now = Date.now();
  const allowed: string[] = [];
  const bumpIds: string[] = [];
  for (const p of players) {
    if (!parseNotificationSettings(p.notificationSettings).categories[category].push) continue;
    if (isWithinPushCooldown(p.notificationSettings, p.lastPushAt, now)) continue;
    allowed.push(p.userId);
    bumpIds.push(p.id);
  }
  if (bumpIds.length) {
    await prisma.player.updateMany({ where: { id: { in: bumpIds } }, data: { lastPushAt: new Date() } }).catch(() => undefined);
  }
  return allowed;
}

// ── FCM HTTP v1 ───────────────────────────────────────────────────────────────

async function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      client_email: string;
      private_key: string;
      project_id: string;
    };
    // A Vercel pode manter os caracteres "\\n" dentro da chave. Normalize
    // somente o campo da chave depois de interpretar o JSON para não invalidá-lo.
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    return parsed;
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

const APP_URL = process.env.NEXTAUTH_URL ?? "https://liga-zikachu.vercel.app";

async function sendFcmMessage(token: string, payload: NotificationPayload, accessToken: string, projectId: string): Promise<boolean> {
  const destination = payload.url?.startsWith("/") && !payload.url.startsWith("//") ? payload.url : "/dashboard";
  // URL absoluta para o deep-link (o app nativo/WebView abre direto nela).
  const absoluteUrl = `${APP_URL.replace(/\/$/, "")}${destination}`;

  const res = await fetch(
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
          // Mantido durante a transição para versões anteriores à 0.7.17, que
          // leem título e corpo apenas do bloco visual do FCM. O `data.url`
          // continua acompanhando o clique e é resolvido pela MainActivity.
          notification: {
            title: payload.title,
            body: payload.body
          },
          data: {
            ...payload.data,
            // Data-only é intencional: em segundo plano o bloco `notification`
            // faria o Android criar um PendingIntent genérico para a Activity,
            // descartando a rota e abrindo primeiro o dashboard.
            title: payload.title,
            body: payload.body,
            // Caminho relativo (compat) + URL absoluta, para o app abrir direto.
            url: destination,
            link: absoluteUrl
          },
          android: {
            priority: "high",
            notification: { sound: "default" }
          },
          // Campo padrão de deep-link do FCM para contextos web push.
          webpush: {
            fcmOptions: { link: absoluteUrl }
          }
        }
      })
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("[FCM] Falha ao enviar mensagem:", err);
    return false;
  }

  return true;
}

// ── API pública ───────────────────────────────────────────────────────────────

export async function sendNotificationToUser(
  userId: string,
  payload: NotificationPayload
): Promise<{ configured: boolean; tokenCount: number; sent: number; failed: number }> {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    console.warn("[FCM] FIREBASE_SERVICE_ACCOUNT_JSON não configurado");
    return { configured: false, tokenCount: 0, sent: 0, failed: 0 };
  }

  const allowed = await allowPushUserIds([userId], payload.category);
  if (allowed && allowed.length === 0) return { configured: true, tokenCount: 0, sent: 0, failed: 0 };

  let tokens: { token: string }[] = [];
  try {
    tokens = await prisma.userFcmToken.findMany({
      where: { userId },
      select: { token: true }
    });
  } catch {
    console.error("[FCM] Tabela user_fcm_tokens não encontrada ou erro ao buscar tokens");
    return { configured: true, tokenCount: 0, sent: 0, failed: 0 };
  }

  if (tokens.length === 0) {
    console.log(`[FCM] Nenhum token registrado para userId=${userId}`);
    return { configured: true, tokenCount: 0, sent: 0, failed: 0 };
  }

  const sa = await getServiceAccount();
  const accessToken = await getAccessToken();
  if (!sa?.project_id || !accessToken) return { configured: false, tokenCount: tokens.length, sent: 0, failed: tokens.length };
  const results = await Promise.all(tokens.map((t) => sendFcmMessage(t.token, payload, accessToken, sa.project_id)));
  const sent = results.filter(Boolean).length;
  return { configured: true, tokenCount: tokens.length, sent, failed: tokens.length - sent };
}

export async function sendNotificationToUsers(
  userIds: string[] | null,
  payload: NotificationPayload
): Promise<{ configured: boolean; users: number; tokenCount: number; sent: number; failed: number }> {
  const sa = await getServiceAccount();
  const accessToken = await getAccessToken();
  if (!sa?.project_id || !accessToken) return { configured: false, users: 0, tokenCount: 0, sent: 0, failed: 0 };

  const allowedUserIds = await allowPushUserIds(userIds, payload.category);
  if (allowedUserIds && allowedUserIds.length === 0) return { configured: true, users: 0, tokenCount: 0, sent: 0, failed: 0 };

  const tokens = await prisma.userFcmToken.findMany({
    where: allowedUserIds ? { userId: { in: [...new Set(allowedUserIds)] } } : undefined,
    select: { token: true, userId: true },
  }).catch(() => [] as { token: string; userId: string }[]);

  let sent = 0;
  let failed = 0;
  // Lotes pequenos evitam saturar a função da Vercel e reutilizam o mesmo token OAuth.
  for (let index = 0; index < tokens.length; index += 50) {
    const results = await Promise.all(tokens.slice(index, index + 50).map((entry) =>
      sendFcmMessage(entry.token, payload, accessToken, sa.project_id)
    ));
    sent += results.filter(Boolean).length;
    failed += results.filter((value) => !value).length;
  }
  return { configured: true, users: new Set(tokens.map((entry) => entry.userId)).size, tokenCount: tokens.length, sent, failed };
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
