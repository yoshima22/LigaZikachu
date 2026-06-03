/**
 * Cron de eventos sociais dos mascotes.
 * Roda diariamente — cria batalhas e amizades aleatórias entre mascotes de treinadores diferentes.
 * Agendado em vercel.json: "0 18 * * *" (15h BRT)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { battleMascots, formFriendship } from "@/lib/mascot";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Busca todos os mascotes equipados de jogadores distintos
  const equipped = await prisma.mascot.findMany({
    where: { isEquipped: true },
    select: { id: true, playerId: true, pokemonId: true, nickname: true }
  });

  if (equipped.length < 2) {
    return NextResponse.json({ ok: true, message: "Menos de 2 mascotes equipados, nada a fazer." });
  }

  const shuffled = shuffle(equipped);
  const battles: string[] = [];
  const friendships: string[] = [];

  // Parea mascotes de treinadores diferentes — ~30% amizade, 70% batalha
  for (let i = 0; i < shuffled.length - 1; i += 2) {
    const a = shuffled[i];
    const b = shuffled[i + 1];
    if (a.playerId === b.playerId) continue; // mesmo treinador — pula

    const roll = Math.random();
    try {
      if (roll < 0.25) {
        await formFriendship(a.id, b.id);
        friendships.push(`${a.id} + ${b.id}`);
      } else {
        await battleMascots(a.id, b.id);
        battles.push(`${a.id} vs ${b.id}`);
      }
    } catch { /* ignora erros individuais */ }
  }

  return NextResponse.json({
    ok: true,
    pairs: Math.floor(shuffled.length / 2),
    battles: battles.length,
    friendships: friendships.length,
  });
}
