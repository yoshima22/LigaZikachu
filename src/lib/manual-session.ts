import { cookies } from "next/headers";
import { UserStatus } from "@prisma/client";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const MANUAL_SESSION_COOKIE = "lz_session";
export const ADMIN_MAINTENANCE_BYPASS_COOKIE = "lz_admin_maintenance";
export const MANUAL_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export type ManualSessionUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role: Role;
  status: UserStatus;
};

export async function getManualSessionUser(): Promise<ManualSessionUser | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(MANUAL_SESSION_COOKIE)?.value;
  if (!sessionToken) return null;

  const session = await prisma.session.findUnique({
    where: { sessionToken },
    include: {
      user: {
        select: { id: true, email: true, name: true, image: true, role: true, status: true }
      }
    }
  });

  if (!session || session.expires <= new Date()) return null;
  if (session.user.status === UserStatus.SUSPENDED || session.user.status === UserStatus.REJECTED) return null;

  return session.user;
}

export function manualSessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: MANUAL_SESSION_MAX_AGE_SECONDS
  };
}
