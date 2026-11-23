/** Zona de Neutralização: protege o jogador do PvP da Arena Z enquanto ele farma o PvE. Sem "use server". */

export const NEUTRALIZATION_ZONE_TYPE = "NEUTRALIZATION_ZONE";
export const NEUTRALIZATION_ZONE_HOURS = 1;
export const NEUTRALIZATION_ZONE_PRICE = 600;

/** Dia civil em BRT (UTC-3, sem horário de verão) — o limite diário reinicia à meia-noite daqui. */
export function brtDayKey(now = new Date()): string {
  return new Date(now.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

export function isNeutralized(until: Date | string | null | undefined, now = Date.now()): boolean {
  return !!until && new Date(until).getTime() > now;
}
