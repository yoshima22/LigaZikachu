"use server";

import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/session";
import { isAdmin } from "@/lib/auth/permissions";

export async function getTutorialStatus(pageId: string): Promise<{ completed: boolean; isAdmin: boolean }> {
  try {
    const session = await getAppSession();
    if (!session?.user) return { completed: true, isAdmin: false };
    if (isAdmin(session.user.role)) return { completed: true, isAdmin: true };

    const progress = await prisma.userTutorialProgress.findUnique({
      where: { userId_pageId: { userId: session.user.id, pageId } }
    });

    return { completed: progress?.completed ?? false, isAdmin: false };
  } catch {
    return { completed: true, isAdmin: false };
  }
}

export async function completeTutorial(pageId: string): Promise<void> {
  try {
    const session = await getAppSession();
    if (!session?.user || isAdmin(session.user.role)) return;

    await prisma.userTutorialProgress.upsert({
      where: { userId_pageId: { userId: session.user.id, pageId } },
      create: { userId: session.user.id, pageId, completed: true, completedAt: new Date() },
      update: { completed: true, completedAt: new Date() }
    });
  } catch {
    // Fail silently to avoid broken UX
  }
}

export async function resetTutorial(pageId: string): Promise<void> {
  try {
    const session = await getAppSession();
    if (!session?.user) return;

    await prisma.userTutorialProgress.deleteMany({
      where: { userId: session.user.id, pageId }
    });
  } catch {
    // Fail silently
  }
}
