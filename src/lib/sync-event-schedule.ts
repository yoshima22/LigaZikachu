export const SYNC_EVENT_DATE = "2026-10-28";

export type SyncScheduleInput = {
  registrationOpensAt: Date | string | null;
  registrationClosesAt: Date | string | null;
  round1At: Date | string | null;
  round2At: Date | string | null;
  round3At: Date | string | null;
  tiebreakAt: Date | string | null;
};

export type SyncSchedulePhase = "REGISTRATION" | "ROUND_1_SELECTION" | "ROUND_1_EXECUTION" | "ROUND_2_SELECTION" | "ROUND_2_EXECUTION" | "ROUND_3_SELECTION" | "ROUND_3_EXECUTION" | "TIEBREAK_SELECTION" | "TIEBREAK_EXECUTION" | "FINISHED";

const instant = (value: Date | string | null) => value ? new Date(value).getTime() : Number.NaN;

export function validateSyncSchedule(input: SyncScheduleInput) {
  const values = [input.registrationOpensAt, input.registrationClosesAt, input.round1At, input.round2At, input.round3At, input.tiebreakAt].map(instant);
  return { valid: values.every(Number.isFinite) && values.every((value, index) => index === 0 || value < values[index + 1] || index === values.length - 1) && values[0] < values[1] && values[1] < values[2] && values[2] < values[3] && values[3] < values[4] && values[4] < values[5] };
}

export function getSyncScheduleState(input: SyncScheduleInput, now = new Date()): { phase: SyncSchedulePhase } {
  if (!validateSyncSchedule(input).valid) return { phase: "FINISHED" };
  const [opens, close, r1, r2, r3, tie] = [input.registrationOpensAt, input.registrationClosesAt, input.round1At, input.round2At, input.round3At, input.tiebreakAt].map(instant);
  const at = now.getTime();
  if (at < close) return { phase: "REGISTRATION" };
  if (at < r1) return { phase: "ROUND_1_SELECTION" };
  if (at < r1 + 60_000) return { phase: "ROUND_1_EXECUTION" };
  if (at < r2) return { phase: "ROUND_2_SELECTION" };
  if (at < r2 + 60_000) return { phase: "ROUND_2_EXECUTION" };
  if (at < r3) return { phase: "ROUND_3_SELECTION" };
  if (at < r3 + 60_000) return { phase: "ROUND_3_EXECUTION" };
  if (at < tie) return { phase: "TIEBREAK_SELECTION" };
  if (at < tie + 60_000) return { phase: "TIEBREAK_EXECUTION" };
  return { phase: "FINISHED" };
}
