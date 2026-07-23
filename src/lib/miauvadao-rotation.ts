const BRT_UTC_OFFSET_MS = 3 * 60 * 60_000;

export function getMiauvadaoRotation(now = new Date()) {
  const brt = new Date(now.getTime() - BRT_UTC_OFFSET_MS);
  const currentHour = brt.getUTCHours();
  const beforeFirstRotation = currentHour < 4;
  const rotationHour = beforeFirstRotation
    ? 22
    : 4 + Math.floor((currentHour - 4) / 6) * 6;
  const start = new Date(Date.UTC(
    brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate() - (beforeFirstRotation ? 1 : 0), rotationHour,
  ) + BRT_UTC_OFFSET_MS);
  return { start, next: new Date(start.getTime() + 6 * 60 * 60_000) };
}
