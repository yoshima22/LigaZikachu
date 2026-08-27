/**
 * Utilidades de fuso BRT (America/Sao_Paulo, UTC-3, sem horário de verão).
 *
 * O servidor (Vercel) roda em UTC. Inputs `datetime-local` do admin representam
 * o RELÓGIO BRT — precisam ser interpretados como BRT, não como UTC, senão os
 * horários (ex.: liberação de deck do torneio) saem 3h adiantados.
 */

export const BRT_TIME_ZONE = "America/Sao_Paulo";
const BRT_OFFSET_HOURS = 3; // UTC-3 fixo

/**
 * Converte uma string de `<input type="datetime-local">` ("YYYY-MM-DDTHH:mm",
 * relógio BRT) para um Date UTC correto. Retorna null se inválida/ vazia.
 */
export function parseBrtLocal(value: string | null | undefined): Date | null {
  if (!value) return null;
  const s = value.trim();
  if (!s) return null;
  // Se a string já tem fuso explícito (Z ou ±hh:mm), o instante já está definido
  // — NÃO reinterpretar como BRT (evita somar 3h a valores já corretos, ex.: um
  // form que reenvia o deckLockAt existente como ISO).
  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(s);
  if (!m) return null;
  const [, y, mo, d, h, mi, sec] = m;
  // BRT = UTC-3 → o instante UTC é +3h do relógio BRT.
  return new Date(Date.UTC(+y, +mo - 1, +d, +h + BRT_OFFSET_HOURS, +mi, sec ? +sec : 0, 0));
}

/**
 * Formata um Date como valor de `<input type="datetime-local">` no relógio BRT
 * ("YYYY-MM-DDTHH:mm"), para preencher o campo com o horário que o admin espera.
 */
export function formatBrtLocalInput(value: Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  // "sv-SE" produz "YYYY-MM-DD HH:mm:ss"; trocamos o espaço por "T".
  return date.toLocaleString("sv-SE", { timeZone: BRT_TIME_ZONE }).slice(0, 16).replace(" ", "T");
}

/**
 * Ajusta um Date para 21:00 BRT do MESMO dia (relógio BRT). Útil para prazos
 * padrão como a liberação de decks às 21h.
 */
export function atBrtHour(value: Date, hour: number, minute = 0): Date {
  const ymd = value.toLocaleDateString("sv-SE", { timeZone: BRT_TIME_ZONE }); // "YYYY-MM-DD"
  const [y, mo, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, hour + BRT_OFFSET_HOURS, minute, 0, 0));
}

/** Formata data+hora no fuso BRT para exibição (pt-BR). */
export function formatBrtDateTime(value: Date | string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { timeZone: BRT_TIME_ZONE, dateStyle: "short", timeStyle: "short", ...opts });
}
