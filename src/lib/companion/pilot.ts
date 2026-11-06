type PilotEnv = { ZIKACOMPANION_PILOT_ENABLED?: string; ZIKACOMPANION_PILOT_USER_IDS?: string };
const currentEnv = (): PilotEnv => ({ ZIKACOMPANION_PILOT_ENABLED: process.env.ZIKACOMPANION_PILOT_ENABLED, ZIKACOMPANION_PILOT_USER_IDS: process.env.ZIKACOMPANION_PILOT_USER_IDS });
export function pilotEnabled(env: PilotEnv = currentEnv()): boolean {
  return env.ZIKACOMPANION_PILOT_ENABLED === "true" && Boolean(env.ZIKACOMPANION_PILOT_USER_IDS?.trim());
}
export function pilotAllowed(userId: string | null | undefined, env: PilotEnv = currentEnv()): boolean {
  return pilotEnabled(env) && !!userId && (env.ZIKACOMPANION_PILOT_USER_IDS ?? "").split(",").map(x => x.trim()).includes(userId);
}
