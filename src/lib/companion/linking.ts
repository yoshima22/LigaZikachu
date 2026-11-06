import { randomUUID } from "node:crypto";
import { hashToken, issueTokens, randomToken } from "./auth";

type Device = { id: string; userId: string; refreshHash: string; refreshExpiresAt: Date; revokedAt: Date | null };
type Authorization = { deviceCodeHash: string; userCodeHash: string; expiresAt: Date };
export interface CompanionStore {
  createAuthorization(a: Authorization): Promise<void>;
  approve(codeHash: string, userId: string, now: Date): Promise<boolean>;
  consume(codeHash: string, now: Date, create: (userId: string) => Device): Promise<Device | null>;
  rotate(hash: string, now: Date, create: (device: Device) => Pick<Device, "refreshHash" | "refreshExpiresAt">): Promise<Device | null>;
}
export async function createAuthorization(store: CompanionStore, now = Date.now()) {
  const deviceCode = randomToken(), userCode = randomToken();
  await store.createAuthorization({ deviceCodeHash: hashToken(deviceCode), userCodeHash: hashToken(userCode), expiresAt: new Date(now + 600_000) });
  return { deviceCode, userCode, expiresIn: 600, interval: 5 };
}
export async function approveAuthorization(store: CompanionStore, userCode: string, userId: string, now = Date.now()) {
  return store.approve(hashToken(userCode), userId, new Date(now));
}
export async function exchangeAuthorization(store: CompanionStore, deviceCode: string, secret: string, now = Date.now(), allowed: (id: string) => boolean = () => true) {
  let issued: ReturnType<typeof issueTokens> | undefined;
  const device = await store.consume(hashToken(deviceCode), new Date(now), userId => {
    if (!allowed(userId)) throw new Error("PILOT_DENIED");
    const id = randomUUID(); issued = issueTokens(id, userId, secret, now);
    return { id, userId, refreshHash: hashToken(issued.refreshToken), refreshExpiresAt: issued.refreshExpiresAt, revokedAt: null };
  });
  return device && issued ? issued : null;
}
export async function refreshSession(store: CompanionStore, refreshToken: string, secret: string, now = Date.now(), allowed: (id: string) => boolean = () => true) {
  let issued: ReturnType<typeof issueTokens> | undefined;
  const device = await store.rotate(hashToken(refreshToken), new Date(now), current => {
    if (!allowed(current.userId)) throw new Error("PILOT_DENIED");
    issued = issueTokens(current.id, current.userId, secret, now);
    return { refreshHash: hashToken(issued.refreshToken), refreshExpiresAt: issued.refreshExpiresAt };
  });
  return device && issued ? issued : null;
}
