/** Zona de Neutralização: protege o jogador do PvP da Arena Z enquanto ele farma o PvE. Sem "use server". */

export const NEUTRALIZATION_ZONE_TYPE = "NEUTRALIZATION_ZONE";
export const NEUTRALIZATION_ZONE_HOURS = 1;
export const NEUTRALIZATION_ZONE_PRICE = 600;

/** Dia civil em BRT (UTC-3, sem horário de verão) — o limite diário reinicia à meia-noite daqui. */
export function brtDayKey(now = new Date()): string {
  return new Date(now.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

/** "42 min" / "1h 05min" / "30s" — tempo restante para mensagens de erro do servidor. */
export function formatProtectionLeft(until: Date | string, now = Date.now()): string {
  const s = Math.max(1, Math.ceil((new Date(until).getTime() - now) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.ceil(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}min`;
}

export function isNeutralized(until: Date | string | null | undefined, now = Date.now()): boolean {
  return !!until && new Date(until).getTime() > now;
}
