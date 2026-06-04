/**
 * getAppSession() — wrapper unificado de sessão.
 *
 * Verifica primeiro o NextAuth (JWT cookie normal).
 * Se não encontrar, verifica o cookie lz_session (login manual fallback).
 * Retorna um objeto compatível com session.user do NextAuth.
 */

import { auth } from "@/auth";
import { getManualSessionUser } from "@/lib/manual-session";
import type { Role, UserStatus } from "@prisma/client";

export interface AppSession {
  user: {
    id: string;
    email: string | null | undefined;
    name: string | null | undefined;
    image?: string | null;
    role: Role;
    status: UserStatus;
  };
}

export async function getAppSession(): Promise<AppSession | null> {
  try {
    const nextAuthSession = await auth();
    if (nextAuthSession?.user?.id) {
      return nextAuthSession as AppSession;
    }
  } catch { /* ignora falhas do NextAuth */ }

  const manualUser = await getManualSessionUser();
  if (manualUser) {
    return {
      user: {
        id: manualUser.id,
        email: manualUser.email,
        name: manualUser.name,
        image: manualUser.image,
        role: manualUser.role,
        status: manualUser.status,
      }
    };
  }

  return null;
}
