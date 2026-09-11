import { notFound, redirect } from "next/navigation";
import { getAppSession, getSessionPlayer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  getPokemonName,
  getPokemonTypes,
  getSpriteUrl,
  TYPE_ADVANTAGE,
  TYPE_LABELS_PT,
} from "@/lib/mascot-data";
import type { ArenaDraftPet } from "@/lib/arena-draft";
import type { ArenaCombatRuntime, ArenaMascot } from "@/lib/arena-z";
import { DraftRoomClient } from "./room-client";

export const dynamic = "force-dynamic";
type BattleData = {
  result?: string;
  rounds?: number;
  events?: Array<{
    turn: number;
    actorName: string;
    targetName: string;
    action: string;
    damage: number;
    effect?: string;
  }>;
  checkpoint?: number;
  checkpoints?: number[];
  eligibleA?: string[];
  eligibleB?: string[];
  activeA?: string[];
  activeB?: string[];
  posturesA?: Record<string, ArenaMascot["combatRole"]>;
  posturesB?: Record<string, ArenaMascot["combatRole"]>;
  runtime?: ArenaCombatRuntime;
  plans?: { A?: unknown; B?: unknown };
};

export default async function DraftRoomPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const session = await getAppSession();
  if (!session?.user) redirect("/login");
  const player = await getSessionPlayer(session.user.id);
  if (!player) redirect("/dashboard");
  const { matchId } = await params;
  const match = await prisma.arenaDraftMatch.findUnique({
    where: { id: matchId },
  });
  if (
    !match ||
    (match.playerAId !== player.id && match.playerBId !== player.id)
  )
    notFound();
  const side = match.playerAId === player.id ? "A" : "B";
  const own = (side === "A"
    ? match.presetASnapshot
    : match.presetBSnapshot) as unknown as ArenaDraftPet[];
  const rival = (side === "A"
    ? match.presetBSnapshot
    : match.presetASnapshot) as unknown as ArenaDraftPet[];
  const draft = (match.draftJson ?? {
    bansA: [],
    bansB: [],
    picksA: [],
    picksB: [],
    turn: "A",
  }) as Record<string, unknown>;
  const disabled = new Set([
    ...((draft.bansA as string[]) ?? []),
    ...((draft.bansB as string[]) ?? []),
    ...((draft.picksA as string[]) ?? []),
    ...((draft.picksB as string[]) ?? []),
  ]);
  const battle = match.battleJson as unknown as BattleData | null;
  const ownEligible = new Set(
    side === "A" ? (battle?.eligibleA ?? []) : (battle?.eligibleB ?? []),
  );
  const ownActive =
    side === "A" ? (battle?.activeA ?? []) : (battle?.activeB ?? []);
  const ownPostures =
    side === "A" ? (battle?.posturesA ?? {}) : (battle?.posturesB ?? {});
  const map = (pets: ArenaDraftPet[] | null, strategy = false) =>
    pets
      ?.filter((p) => !strategy || ownEligible.has(p.id))
      .map((p) => {
        const types = getPokemonTypes(p.speciesId);
        const advantages = [
          ...new Set(types.flatMap((type) => TYPE_ADVANTAGE[type] ?? [])),
        ];
        const weaknesses = Object.entries(TYPE_ADVANTAGE)
          .filter(([, strong]) => strong.some((type) => types.includes(type)))
          .map(([type]) => type);
        return {
          id: p.id,
          speciesId: p.speciesId,
          name: getPokemonName(p.speciesId),
          sprite: getSpriteUrl(p.speciesId),
          types,
          advantages: advantages.map((type) => TYPE_LABELS_PT[type] ?? type),
          weaknesses: weaknesses.map((type) => TYPE_LABELS_PT[type] ?? type),
          isMega: p.isMega,
          disabled: disabled.has(p.id),
          posture: ownPostures[p.id] ?? p.posture,
          hp: battle?.runtime?.hp[p.id] ?? null,
        };
      }) ?? [];
  return (
    <DraftRoomClient
      matchId={match.id}
      state={match.state}
      turn={String(draft.turn ?? "")}
      ownSide={side}
      own={map(own, match.state === "STRATEGY_WINDOW")}
      rival={map(rival)}
      battle={battle}
      strategy={
        match.state === "STRATEGY_WINDOW"
          ? {
              activeIds: ownActive,
              ownConfirmed: Boolean(battle?.plans?.[side]),
              rivalConfirmed: Boolean(
                battle?.plans?.[side === "A" ? "B" : "A"],
              ),
              checkpointTurn:
                battle?.checkpoints?.[battle?.checkpoint ?? 0] ?? null,
              deadlineAt: match.deadlineAt?.toISOString() ?? null,
            }
          : null
      }
    />
  );
}
