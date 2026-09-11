import { redirect } from "next/navigation";
import { getAppSession, getSessionPlayer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getPokemonName, getPokemonTypes, getSpriteUrl, WISHLIST_POKEMON_IDS } from "@/lib/mascot-data";
import type { ArenaDraftPet } from "@/lib/arena-draft";
import { ArenaDraftClient } from "./arena-draft-client";

export const dynamic = "force-dynamic";
export default async function ArenaDraftPage() {
  const session = await getAppSession(); if (!session?.user) redirect("/login");
  const player = await getSessionPlayer(session.user.id); if (!player) redirect("/dashboard");
  const [presets, activeMatch, history] = await Promise.all([
    prisma.arenaDraftPreset.findMany({ where: { ownerId: player.id }, orderBy: { updatedAt: "desc" }, take: 30 }),
    prisma.arenaDraftMatch.findFirst({ where: { OR: [{ playerAId: player.id }, { playerBId: player.id }], state: { notIn: ["FINISHED", "CANCELLED"] } }, orderBy: { createdAt: "desc" }, include: { playerA: { select: { displayName: true } }, playerB: { select: { displayName: true } } } }),
    prisma.arenaDraftMatch.findMany({ where: { OR: [{ playerAId: player.id }, { playerBId: player.id }], state: "FINISHED" }, orderBy: { finishedAt: "desc" }, take: 20, include: { playerA: { select: { displayName: true } }, playerB: { select: { displayName: true } } } }),
  ]);
  const species = WISHLIST_POKEMON_IDS.map((id) => ({ id, name: getPokemonName(id), sprite: getSpriteUrl(id), types: getPokemonTypes(id) }));
  const opponent = activeMatch ? (activeMatch.playerAId === player.id ? activeMatch.playerB?.displayName : activeMatch.playerA.displayName) ?? null : null;
  return <ArenaDraftClient species={species} presets={presets.map(p=>({id:p.id,name:p.name,isReady:p.isReady,pets:p.petsJson as unknown as ArenaDraftPet[],updatedAt:p.updatedAt.toISOString()}))} activeMatch={activeMatch?{id:activeMatch.id,state:activeMatch.state,opponent,createdAt:activeMatch.createdAt.toISOString()}:null} history={history.map(m=>({id:m.id,state:m.state,opponent:m.playerAId===player.id?m.playerB?.displayName??"—":m.playerA.displayName,createdAt:m.createdAt.toISOString(),result:m.winnerId===player.id?"Vitória":m.winnerId?"Derrota":"Empate"}))}/>;
}
