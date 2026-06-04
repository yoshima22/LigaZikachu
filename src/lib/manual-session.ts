import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { Role, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const MANUAL_SESSION_COOKIE = "lz_session";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type ManualSessionPayload = {
  sub: string;
  email: string;
  name: string | null;
  image: string | null;
  role: Role;
  status: UserStatus;
  exp: number;
};

export type ManualSessionUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role: Role;
  status: UserStatus;
};

function secret() {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? process.env.MANUAL_SESSION_SECRET ?? "";
}

function b64url(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fromB64url(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(payload: string) {
  const key = secret();
  if (!key) throw new Error("Missing AUTH_SECRET/NEXTAUTH_SECRET for manual session.");
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function createManualSessionToken(user: ManualSessionUser) {
  const payload: ManualSessionPayload = {
    sub: user.id,
    email: user.email,
    name: user.name ?? null,
    image: user.image ?? null,
    role: user.role,
    status: user.status,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS
  };
  const encoded = b64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifyManualSessionToken(token: string | undefined): ManualSessionPayload | null {
  if (!token || !token.includes(".")) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  const parsed = JSON.parse(fromB64url(encoded)) as Partial<ManualSessionPayload>;
  if (!parsed.sub || !parsed.email || !parsed.role || !parsed.status || !parsed.exp) return null;
  if (parsed.exp < Math.floor(Date.now() / 1000)) return null;

  return parsed as ManualSessionPayload;
}

export async function getManualSessionUser(): Promise<ManualSessionUser | null> {
  const cookieStore = await cookies();
  const payload = verifyManualSessionToken(cookieStore.get(MANUAL_SESSION_COOKIE)?.value);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, image: true, role: true, status: true }
  });
  if (!user || user.status === UserStatus.SUSPENDED || user.status === UserStatus.REJECTED) return null;
  return user;
}

export function manualSessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: MAX_AGE_SECONDS
  };
}
