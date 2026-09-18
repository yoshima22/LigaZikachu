import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { BondsV2Admin } from "./_components/bonds-v2-admin";

export const dynamic = "force-dynamic";

export default async function LacosPage() {
  const session = await getAppSession();
  if (!session?.user) redirect("/login");
  const player = await prisma.player.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!player) redirect("/dashboard");
  return <BondsV2Admin playerId={player.id} />;
}
