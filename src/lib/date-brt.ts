/**
 * Utilitários de data/hora no fuso horário brasileiro (BRT = UTC-3 / America/Sao_Paulo).
 * Usar em componentes SERVER para exibir datas corretas sem depender do client.
 */

const BRT = "America/Sao_Paulo";

/** Formata data + hora em BRT (ex.: "03/06/2026 às 20:00") */
export function formatDateTimeBRT(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("pt-BR", {
    timeZone: BRT,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Formata só a hora em BRT (ex.: "20:00") */
export function formatTimeBRT(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("pt-BR", {
    timeZone: BRT,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Formata só a data em BRT (ex.: "03/06/2026") */
export function formatDateBRT(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR", { timeZone: BRT });
}

/** Formata data por extenso em BRT (ex.: "3 de junho de 2026") */
export function formatDateLongBRT(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR", {
    timeZone: BRT,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Retorna uma string no formato datetime-local (YYYY-MM-DDTHH:mm)
 *  ajustada para BRT — útil para popular inputs datetime-local em formulários. */
export function toDateTimeLocalBRT(date: Date | null | undefined): string {
  if (!date) return "";
  // Converte para o timezone BRT e formata como string local sem offset
  const brtStr = new Date(date).toLocaleString("sv-SE", { timeZone: BRT }); // "2026-06-03 20:00:00"
  return brtStr.replace(" ", "T").slice(0, 16); // "2026-06-03T20:00"
}
