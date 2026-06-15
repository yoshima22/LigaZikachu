/**
 * getAppSession() — wrapper unificado de sessão.
 *
 * Verifica primeiro o NextAuth (JWT cookie normal).
 * Se não encontrar, verifica o cookie lz_session (login manual fallback).
 * Retorna um objeto compatível com session.user do NextAuth.
 */

import { cache } from "react";
import { auth } from "@/auth";
import { getManualSessionUser } from "@/lib/manual-session";
import { prisma } from "@/lib/prisma";
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

async function resolveAppSession(): Promise<AppSession | null> {
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

export const getAppSession = cache(resolveAppSession);

/**
 * getSessionPlayer() — busca o Player associado ao usuário logado.
 *
 * Usa React.cache() para deduplicar dentro do mesmo request:
 * a primeira chamada vai ao banco, todas as subsequentes na mesma
 * requisição reutilizam o resultado sem nova query.
 *
 * Uso: `const player = await getSessionPlayer()` em qualquer server component ou action.
 */
export const getSessionPlayer = cache(async (userId: string) => {
  return prisma.player.findUnique({
    where: { userId },
    select: { id: true, displayName: true, ptcglNick: true, avatarUrl: true },
  });
});
