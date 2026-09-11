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
    include: {
      playerA: { select: { displayName: true } },
      playerB: { select: { displayName: true } },
      actions: { orderBy: { sequence: "desc" }, take: 12 },
    },
  });
  if (
    !match ||
    (match.playerAId !== player.id && match.playerBId !== player.id)
  )
    notFound();
  if (match.state === "CREATED" || match.state === "CANCELLED")
    redirect("/combates/arena-draft");
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
  const bansA = (draft.bansA as string[]) ?? [];
  const bansB = (draft.bansB as string[]) ?? [];
  const picksA = (draft.picksA as string[]) ?? [];
  const picksB = (draft.picksB as string[]) ?? [];
  const ownBans = side === "A" ? bansB : bansA;
  const rivalBans = side === "A" ? bansA : bansB;
  const ownPicks = side === "A" ? picksA : picksB;
  const rivalPicks = side === "A" ? picksB : picksA;
  const battle = match.battleJson as unknown as BattleData | null;
  const ownEligible = new Set(
    side === "A" ? (battle?.eligibleA ?? []) : (battle?.eligibleB ?? []),
  );
  const ownActive =
    side === "A" ? (battle?.activeA ?? []) : (battle?.activeB ?? []);
  const rivalActive =
    side === "A" ? (battle?.activeB ?? []) : (battle?.activeA ?? []);
  const ownPostures =
    side === "A" ? (battle?.posturesA ?? {}) : (battle?.posturesB ?? {});
  // A build (status, personalidade, postura) do time só pode ser revelada ao
  // dono. Para o rival, esses campos ficam ocultos durante inspeção/draft e só
  // aparecem quando o combate já revelou tudo (janela estratégica/replay).
  const map = (
    pets: ArenaDraftPet[] | null,
    strategy = false,
    banned: string[] = [],
    picked: string[] = [],
    revealBuild = false,
  ) =>
    pets
      ?.filter((p) => !strategy || ownEligible.has(p.id))
      .map((p) => {
        const status: "AVAILABLE" | "BANNED" | "PICKED" = banned.includes(p.id)
          ? "BANNED"
          : picked.includes(p.id)
            ? "PICKED"
            : "AVAILABLE";
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
          personality: revealBuild ? p.personality : null,
          types: types.map((type) => TYPE_LABELS_PT[type] ?? type),
          advantages: advantages.map((type) => TYPE_LABELS_PT[type] ?? type),
          weaknesses: weaknesses.map((type) => TYPE_LABELS_PT[type] ?? type),
          isMega: p.isMega,
          status,
          posture: revealBuild ? (ownPostures[p.id] ?? p.posture) : "ATTACKER",
          stats: revealBuild ? p.stats : null,
          hp: battle?.runtime?.hp[p.id] ?? null,
          maxHp: Math.max(
            10,
            Math.round(655 + (p.stats.vitality + (p.isMega ? 10 : 0)) * 4),
          ),
        };
      }) ?? [];
  return (
    <DraftRoomClient
      matchId={match.id}
      state={match.state}
      stateVersion={match.stateVersion}
      turn={String(draft.turn ?? "")}
      ownSide={side}
      playerNames={{
        own:
          side === "A"
            ? match.playerA.displayName
            : (match.playerB?.displayName ?? "Rival"),
        rival:
          side === "A"
            ? (match.playerB?.displayName ?? "Rival")
            : match.playerA.displayName,
      }}
      deadlineAt={match.deadlineAt?.toISOString() ?? null}
      progress={{
        readyA: Boolean(draft.readyA),
        readyB: Boolean(draft.readyB),
        bansA: bansA.length,
        bansB: bansB.length,
        picksA: picksA.length,
        picksB: picksB.length,
      }}
      own={map(own, match.state === "STRATEGY_WINDOW", ownBans, ownPicks, true)}
      rival={map(
        rival,
        false,
        rivalBans,
        rivalPicks,
        ["STRATEGY_WINDOW", "FINISHED"].includes(match.state),
      )}
      activity={match.actions.reverse().map((action) => ({
        sequence: action.sequence,
        actor:
          action.actorId === player.id
            ? "Você"
            : side === "A"
              ? (match.playerB?.displayName ?? "Rival")
              : match.playerA.displayName,
        type: action.actionType,
        targetId: String(
          (action.payloadJson as { targetId?: string } | null)?.targetId ?? "",
        ),
      }))}
      battle={battle}
      winnerName={
        match.winnerId === match.playerAId
          ? match.playerA.displayName
          : match.winnerId === match.playerBId
            ? (match.playerB?.displayName ?? null)
            : null
      }
      strategy={
        match.state === "STRATEGY_WINDOW"
          ? {
              activeIds: ownActive,
              rivalActiveIds: rivalActive,
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
