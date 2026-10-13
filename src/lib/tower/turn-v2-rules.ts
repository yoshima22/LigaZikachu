import type { TowerExpeditionV2 } from "./expedition-state";
import { moveMember } from "./route-rules";

export type V2Submission = {
  memberId: string;
  globalTurn: number;
  roomId: string;
  actions: unknown;
};

export type V2SubmissionErrorCode =
  | "STALE_TURN"
  | "WRONG_ROOM"
  | "INACTIVE_MEMBER"
  | "ALREADY_CONFIRMED";

export function validateV2Submission(
  state: TowerExpeditionV2,
  submission: V2Submission,
): { ok: true } | { ok: false; code: V2SubmissionErrorCode } {
  const member = state.members[submission.memberId];
  if (submission.globalTurn !== state.globalTurn) return { ok: false, code: "STALE_TURN" };
  if (!member || member.status !== "ACTIVE" || member.availableFromTurn > state.globalTurn)
    return { ok: false, code: "INACTIVE_MEMBER" };
  if (submission.roomId !== member.roomId) return { ok: false, code: "WRONG_ROOM" };
  if (member.confirmedTurn === state.globalTurn) return { ok: false, code: "ALREADY_CONFIRMED" };
  return { ok: true };
}

function turnActors(state: TowerExpeditionV2): string[] {
  return Object.entries(state.members)
    .filter(([, member]) => member.status === "ACTIVE" && member.availableFromTurn <= state.globalTurn)
    .map(([id]) => id);
}

export function canResolveV2Turn(
  state: TowerExpeditionV2,
  submissions: Record<string, V2Submission>,
  deadlineReached: boolean,
): boolean {
  const actors = turnActors(state);
  return actors.length > 0 && (deadlineReached || actors.every((id) => Boolean(submissions[id])));
}

export type V2TurnAdvance = {
  state: TowerExpeditionV2;
  defensiveMemberIds: string[];
  abandonedMemberIds: string[];
  events: string[];
};

/** Called only after the DB lock; expectedTurn rejects cron/last-click races. */
export function advanceV2Turn(
  state: TowerExpeditionV2,
  submissions: Record<string, V2Submission>,
  expectedTurn: number,
  deadlineReached: boolean,
): V2TurnAdvance | null {
  if (state.globalTurn !== expectedTurn || !canResolveV2Turn(state, submissions, deadlineReached)) return null;
  const defensiveMemberIds: string[] = [];
  const abandonedMemberIds: string[] = [];
  const events: string[] = [];
  const members = { ...state.members };
  for (const memberId of turnActors(state)) {
    const member = state.members[memberId];
    if (submissions[memberId]) {
      members[memberId] = { ...member, consecutiveMisses: 0, confirmedTurn: null };
      continue;
    }
    const misses = member.consecutiveMisses + 1;
    if (misses >= 2) {
      members[memberId] = { ...member, status: "AFK_ABANDONED", consecutiveMisses: misses, confirmedTurn: null };
      abandonedMemberIds.push(memberId);
      events.push(`${memberId} perdeu duas janelas consecutivas e abandonou a expedição por AFK.`);
    } else {
      members[memberId] = { ...member, consecutiveMisses: misses, confirmedTurn: null };
      defensiveMemberIds.push(memberId);
      events.push(`${memberId} não confirmou nesta janela; entrou em defesa automática. Uma nova falta causará abandono.`);
    }
  }
  let movedState: TowerExpeditionV2 = { ...state, members };
  for (const memberId of turnActors(state)) {
    const submission = submissions[memberId];
    if (!submission || !submission.actions || typeof submission.actions !== "object") continue;
    const routeId = (submission.actions as { routeId?: unknown }).routeId;
    if (typeof routeId === "string" && routeId) movedState = moveMember(movedState, memberId, routeId);
  }
  return {
    state: { ...movedState, globalTurn: expectedTurn + 1 },
    defensiveMemberIds,
    abandonedMemberIds,
    events,
  };
}
