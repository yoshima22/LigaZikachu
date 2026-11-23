"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
export async function cancelArenaDraftMatchAdminAction(matchId: string) {
  await requireAdmin();
  await prisma.arenaDraftMatch.updateMany({
    where: { id: matchId, state: { notIn: ["FINISHED", "CANCELLED"] } },
    data: {
      state: "CANCELLED",
      deadlineAt: null,
      stateVersion: { increment: 1 },
    },
  });
  revalidatePath("/combates/arena-draft/admin");
  revalidatePath(`/combates/arena-draft/${matchId}`);
}
export async function expireArenaDraftPhaseAdminAction(matchId: string) {
  await requireAdmin();
  await prisma.arenaDraftMatch.updateMany({
    where: {
      id: matchId,
      state: { notIn: ["FINISHED", "CANCELLED", "CREATED", "BATTLE_INIT"] },
    },
    data: { deadlineAt: new Date(0), stateVersion: { increment: 1 } },
  });
  revalidatePath("/combates/arena-draft/admin");
  revalidatePath(`/combates/arena-draft/${matchId}`);
}
