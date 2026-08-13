// Utilitários de aniversário do jogador (data imutável + presente anual).

const TZ = "America/Sao_Paulo";

/** Converte "YYYY-MM-DD" para uma data em meia-noite UTC, ou null se inválida. */
export function parseBirthDateInput(input: unknown): Date | null {
  if (typeof input !== "string") return null;
  const match = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const currentYear = new Date().getFullYear();
  if (year < 1900 || year > currentYear) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null; // rejeita datas impossíveis (ex.: 31/02)
  return date;
}

/** Data de hoje no fuso BRT como {year, month(1-12), day}. */
function todayBRT(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(now)
    .split("-")
    .map(Number);
  return { year: parts[0], month: parts[1], day: parts[2] };
}

/**
 * O jogador pode girar a roleta de aniversário se:
 * - tem data de aniversário preenchida;
 * - ainda não resgatou o presente deste ano;
 * - hoje (BRT) já é a data do aniversário dele OU depois, dentro do ano corrente.
 */
export function isBirthdayGiftEligible(
  birthDate: Date | null | undefined,
  birthdayGiftYear: number | null | undefined,
  now = new Date(),
): boolean {
  if (!birthDate) return false;
  const today = todayBRT(now);
  if ((birthdayGiftYear ?? 0) >= today.year) return false;
  const bMonth = birthDate.getUTCMonth() + 1;
  const bDay = birthDate.getUTCDate();
  // hoje >= aniversário (mês/dia) no ano corrente
  if (today.month > bMonth) return true;
  if (today.month < bMonth) return false;
  return today.day >= bDay;
}

/** Exibição amigável "DD/MM" (sem ano, para não expor idade). */
export function formatBirthdayShort(birthDate: Date): string {
  const d = String(birthDate.getUTCDate()).padStart(2, "0");
  const m = String(birthDate.getUTCMonth() + 1).padStart(2, "0");
  return `${d}/${m}`;
}

/** Nomes dos aniversariantes de HOJE (BRT). */
export function isBirthdayTodayBRT(birthDate: Date | null | undefined, now = new Date()): boolean {
  if (!birthDate) return false;
  const today = todayBRT(now);
  return today.month === birthDate.getUTCMonth() + 1 && today.day === birthDate.getUTCDate();
}
