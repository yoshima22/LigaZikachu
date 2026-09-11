import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  getPokemonName,
  getPokemonTypes,
  getSpriteUrl,
} from "@/lib/mascot-data";
import type { ArenaDraftPet } from "@/lib/arena-draft";
import { ArenaDraftReplay } from "./replay-client";

export const dynamic = "force-dynamic";
type DraftData = {
  bansA?: string[];
  bansB?: string[];
  picksA?: string[];
  picksB?: string[];
};
type BattleData = {
  result?: string;
  rounds?: number;
  events?: ReplayEvent[];
  strategyHistory?: Array<{
    checkpoint: number;
    activeA: string[];
    activeB: string[];
  }>;
};
type ReplayEvent = {
  turn: number;
  actorId?: string;
  actorName: string;
  targetName: string;
  action: string;
  damage: number;
  effect?: string;
  targetHpAfter?: number;
};
type Metric = {
  petId: string;
  damageDealt: number;
  damageReceived: number;
  healing: number;
  kos: number;
  actions: number;
};

export default async function ReplayPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const match = await prisma.arenaDraftMatch.findFirst({
    where: { id: matchId, state: "FINISHED" },
    include: {
      playerA: { select: { displayName: true } },
      playerB: { select: { displayName: true } },
    },
  });
  if (!match || !match.playerB) notFound();
  const petsA = match.presetASnapshot as unknown as ArenaDraftPet[];
  const petsB = match.presetBSnapshot as unknown as ArenaDraftPet[];
  const draft = (match.draftJson ?? {}) as unknown as DraftData;
  const battle = (match.battleJson ?? {}) as unknown as BattleData;
  const metrics = (match.metricsJson ?? {}) as unknown as {
    playerA?: Metric[];
    playerB?: Metric[];
  };
  const banned = new Set([...(draft.bansA ?? []), ...(draft.bansB ?? [])]);
  const picked = new Set([...(draft.picksA ?? []), ...(draft.picksB ?? [])]);
  const map = (pets: ArenaDraftPet[], side: "A" | "B") =>
    pets.map((p) => ({
      id: p.id,
      name: getPokemonName(p.speciesId),
      sprite: getSpriteUrl(p.speciesId),
      types: getPokemonTypes(p.speciesId),
      isMega: p.isMega,
      personality: p.personality,
      posture: p.posture,
      stats: p.stats,
      banned: banned.has(p.id),
      picked: picked.has(p.id),
      metrics:
        (side === "A" ? metrics.playerA : metrics.playerB)?.find(
          (m) => m.petId === p.id,
        ) ?? null,
    }));
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href="/combates/arena-draft"
          className="text-xs font-bold text-cyan-300"
        >
          ← Arena Draft
        </Link>
        <span className="text-[10px] uppercase tracking-widest text-slate-500">
          Replay público · motor v2
        </span>
      </div>
      <ArenaDraftReplay
        matchId={match.id}
        playerA={match.playerA.displayName}
        playerB={match.playerB.displayName}
        winner={
          match.winnerId === match.playerAId
            ? "A"
            : match.winnerId === match.playerBId
              ? "B"
              : null
        }
        finishedAt={
          match.finishedAt?.toISOString() ?? match.updatedAt.toISOString()
        }
        teamA={map(petsA, "A")}
        teamB={map(petsB, "B")}
        events={battle.events ?? []}
        strategyHistory={battle.strategyHistory ?? []}
        rounds={battle.rounds ?? 0}
      />
    </div>
  );
}
