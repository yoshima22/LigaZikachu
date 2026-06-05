/**
 * Utilitários de data/hora no fuso horário do Brasil (America/Sao_Paulo).
 * Use estas funções em todo o site para garantir consistência de fuso.
 */

export const TZ_BR = "America/Sao_Paulo";

/**
 * Formata data para exibição em pt-BR com fuso de São Paulo.
 * Substitui .toLocaleString("pt-BR") em todo o site.
 */
export function formatDateBR(
  date: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("pt-BR", { timeZone: TZ_BR, ...options });
}

/** Apenas data (sem hora) */
export function formatDateOnlyBR(date: Date | string | null | undefined): string {
  return formatDateBR(date, { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Apenas hora:minuto */
export function formatTimeBR(date: Date | string | null | undefined): string {
  return formatDateBR(date, { hour: "2-digit", minute: "2-digit" });
}

/** Data e hora curtas (DD/MM/YYYY HH:MM) */
export function formatDateTimeBR(date: Date | string | null | undefined): string {
  return formatDateBR(date, {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/** Retorna 'agora', 'há Xmin', 'há Xh', ou data completa */
export function formatRelativeBR(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)  return "agora";
  if (diffMin < 60) return `há ${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return `há ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7)    return `há ${diffD}d`;
  return formatDateOnlyBR(d);
}

/**
 * Cria um Date representando um horário específico no fuso BR.
 * Útil para agendar ZikaLoot: scheduleDateBR(2025, 5, 21, 20, 0) = 20h de 21/05/2025 em SP.
 */
export function scheduleDateBR(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  // Cria a data como se fosse em SP usando o Intl trick
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_BR,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  // Monta string ISO e interpreta no fuso correto
  const isoStr = `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}T${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}:00`;
  // Usa Temporal-like approach: pega o offset de SP para a data desejada
  const testDate = new Date(`${isoStr}Z`);
  const parts = fmt.formatToParts(testDate);
  const pmap: Record<string, string> = {};
  parts.forEach(p => { pmap[p.type] = p.value; });
  // Ajusta para compensar o offset
  const utcStr = `${pmap.year}-${pmap.month}-${pmap.day}T${pmap.hour === "24" ? "00" : pmap.hour}:${pmap.minute}:${pmap.second}Z`;
  const utcDate = new Date(utcStr);
  const offset = utcDate.getTime() - testDate.getTime();
  return new Date(testDate.getTime() - offset);
}
