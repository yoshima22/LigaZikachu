import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeamTimeMultiplier } from "@/lib/arena-z";

/** Retorna vault atualizado de times PvP específicos (polling leve) */
export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("ids")?.split(",").filter(Boolean) ?? [];
  if (ids.length === 0) return NextResponse.json([]);
  if (ids.length > 20) return NextResponse.json({ error: "max 20 ids" }, { status: 400 });

  const teams = await prisma.arenaTeam.findMany({
    where: {
      id: { in: ids },
      status: "ACTIVE",
    },
    select: {
      id: true,
      vaultCoins: true,
      vaultExp: true,
      vaultFood: true,
      vaultSweet: true,
      enteredAt: true,
      lastBattleAt: true,
      members: { select: { id: true } },
    },
  });

  return NextResponse.json(
    teams.map(t => ({
      id: t.id,
      vaultCoins: t.vaultCoins,
      vaultExp: t.vaultExp,
      vaultFood: t.vaultFood,
      vaultSweet: t.vaultSweet,
      multiplier: parseFloat(getTeamTimeMultiplier(t.enteredAt).toFixed(1)),
      memberCount: t.members.length,
      updatedAt: Date.now(),
    }))
  );
}
