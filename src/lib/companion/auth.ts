import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const randomToken = () => randomBytes(32).toString("base64url");

export function issueTokens(deviceId: string, userId: string, secret: string, now = Date.now()) {
  if (!secret) throw new Error("Companion signing secret is required");
  const payload = Buffer.from(JSON.stringify({ deviceId, userId, exp: now + 15 * 60_000 })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return { accessToken: `${payload}.${signature}`, refreshToken: randomToken(), refreshExpiresAt: new Date(now + 30 * 24 * 60 * 60_000) };
}

export function verifyAccessToken(token: string, secret: string, now = Date.now()): { deviceId: string; userId: string } | null {
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const expected = createHmac("sha256", secret).update(parts[0]).digest();
  const signature = Buffer.from(parts[1], "base64url");
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected) || signature.toString("base64url") !== parts[1]) return null;
  try {
    const data = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    if (typeof data.deviceId !== "string" || typeof data.userId !== "string" || typeof data.exp !== "number" || data.exp <= now) return null;
    return { deviceId: data.deviceId, userId: data.userId };
  } catch { return null; }
}

export function eligibleStatus(status: string | null | undefined): boolean {
  return status === "ACTIVE" || status === "PENDING_APPROVAL";
}

type AccessDevice = { id: string; userId: string; revokedAt: Date | null; user: { status: string } };
export async function authenticateAccess(
  token: string, secret: string, lookup: (id: string) => Promise<AccessDevice | null>,
  allowed: (userId: string) => boolean, now = Date.now()
): Promise<{ deviceId: string; userId: string } | null> {
  const identity = verifyAccessToken(token, secret, now);
  if (!identity || !allowed(identity.userId)) return null;
  const device = await lookup(identity.deviceId);
  if (!device || device.id !== identity.deviceId || device.userId !== identity.userId || device.revokedAt || !eligibleStatus(device.user.status)) return null;
  return identity;
}
