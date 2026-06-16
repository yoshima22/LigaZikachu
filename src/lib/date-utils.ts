export function toBrtDateString(date: Date): string {
  return date.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}
