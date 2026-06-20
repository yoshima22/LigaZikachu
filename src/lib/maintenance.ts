export type MaintenanceState = {
  active: boolean;
  until: Date | null;
  message: string | null;
  reason: "emergency" | "scheduled" | "window" | null;
};

function parseDateEnv(value: string | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getMaintenanceState(now = new Date()): MaintenanceState {
  const message = process.env.MAINTENANCE_MESSAGE?.trim() || null;
  const emergencyUntil = parseDateEnv(process.env.EMERGENCY_MAINTENANCE_UNTIL);
  const emergencyFlag = process.env.EMERGENCY_MAINTENANCE === "true";
  const emergencyWindowActive = Boolean(emergencyUntil && emergencyUntil.getTime() > now.getTime());

  if ((emergencyFlag || emergencyWindowActive) && (!emergencyUntil || emergencyWindowActive)) {
    return { active: true, until: emergencyUntil, message, reason: "emergency" };
  }

  const scheduledStart = parseDateEnv(process.env.MAINTENANCE_START_AT);
  const scheduledEnd = parseDateEnv(process.env.MAINTENANCE_END_AT);
  if (scheduledStart && scheduledEnd && now >= scheduledStart && now < scheduledEnd) {
    return { active: true, until: scheduledEnd, message, reason: "scheduled" };
  }

  const windows = (process.env.MAINTENANCE_WINDOWS ?? "")
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  for (const windowSpec of windows) {
    const [startRaw, endRaw, windowMessage] = windowSpec.split("|");
    const start = parseDateEnv(startRaw);
    const end = parseDateEnv(endRaw);
    if (start && end && now >= start && now < end) {
      return {
        active: true,
        until: end,
        message: windowMessage?.trim() || message,
        reason: "window",
      };
    }
  }

  return { active: false, until: null, message: null, reason: null };
}
