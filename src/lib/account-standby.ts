const STANDBY_PREFIX = "[LZ_STANDBY_UNTIL:";
const STANDBY_REGEX = /\[LZ_STANDBY_UNTIL:([^\]]+)\]/;

export function getStandbyUntilFromNotes(notes: string | null | undefined) {
  const match = notes?.match(STANDBY_REGEX);
  if (!match?.[1]) return null;
  const date = new Date(match[1]);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isStandbyActive(notes: string | null | undefined, now = new Date()) {
  const standbyUntil = getStandbyUntilFromNotes(notes);
  return !!standbyUntil && standbyUntil > now;
}

export function setStandbyUntilInNotes(notes: string | null | undefined, standbyUntil: Date) {
  const cleaned = (notes ?? "").replace(STANDBY_REGEX, "").trim();
  const marker = `${STANDBY_PREFIX}${standbyUntil.toISOString()}]`;
  return cleaned ? `${cleaned}\n${marker}` : marker;
}
