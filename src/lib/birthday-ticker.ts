import { prisma } from "@/lib/prisma";
import { publishLeagueTicker } from "@/lib/league-ticker";
import { isBirthdayTodayBRT } from "@/lib/birthday";

// Frases do Professor Enguiça no megafone sobre os aniversariantes.
// {names} é substituído pelos nomes dos aniversariantes do dia.
const BIRTHDAY_PHRASES: string[] = [
  "🎂 Hoje é aniversário de {names}! Até o Miauvadão parou de trapacear por 5 segundos só pra dar os parabéns.",
  "🎉 Parabéns, {names}! Corram comprar um presente no Bazar antes que o Miauvadão gaste tudo no cofre dele!",
  "🎈 {names} está fazendo aniversário! Alguém segura o Miauvadão, que ele já quer 'emprestar' o bolo.",
  "🥳 Feliz aniversário, {names}! Já giraram a roleta de presentes? Juro que não trapaceei nessa... dessa vez.",
  "🎁 É aniversário de {names}! Mandem um mimo pelo Bazar — e nada de embrulhar casca de ovo quebrada, hein!",
  "🎂 {names} completou mais um ano de treinador! O Miauvadão manda um 'miaaau' caprichado de parabéns.",
  "🍰 Atenção, liga: {names} está soprando velinhas hoje! O Miauvadão pediu um pedaço e já saiu correndo sem pagar.",
  "🎊 Parabéns pra você, {names}! O Professor Enguiça preparou uma roleta cheia de presentes — corre girar!",
  "🎉 Hoje tem festa: {names} faz aniversário! Miauvadão sugere presentes... de preferência caros. Coisas de Miauvadão.",
  "🎈 {names} de aniversário! Que tal um presentinho no Bazar? O Miauvadão jura que dessa vez não fica com a comissão.",
];

/** Junta nomes: "A", "A e B", "A, B e C". */
function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

/**
 * Publica algumas frases de aniversário no megafone (LeagueTicker) se houver
 * aniversariantes hoje. Idempotente por eventKey (bucket de tempo), então roda
 * bem em um cron algumas vezes ao dia sem duplicar.
 */
export async function publishBirthdayTickerPhrases(now = new Date()): Promise<{ published: number; birthdayPlayers: number }> {
  const players = await prisma.player.findMany({
    where: { birthDate: { not: null }, active: true, user: { status: "ACTIVE" } },
    select: { displayName: true, birthDate: true },
  });
  const celebrants = players.filter((p) => isBirthdayTodayBRT(p.birthDate, now));
  if (celebrants.length === 0) return { published: 0, birthdayPlayers: 0 };

  const names = joinNames(celebrants.map((p) => p.displayName));
  const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now); // YYYY-MM-DD
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(now));
  const bucket = Math.floor(hour / 3); // muda ~a cada 3h → frases novas ao longo do dia

  // Escolhe 2 frases distintas para este bucket, de forma determinística+variada.
  const shuffled = [...BIRTHDAY_PHRASES].sort(() => Math.random() - 0.5).slice(0, 2);
  let published = 0;
  for (let i = 0; i < shuffled.length; i++) {
    const ok = await publishLeagueTicker({
      type: "BIRTHDAY",
      message: shuffled[i].replace("{names}", names),
      eventKey: `birthday:${dateKey}:${bucket}:${i}`,
      priority: 5,
      ttlHours: 12,
    });
    if (ok) published++;
  }
  return { published, birthdayPlayers: celebrants.length };
}
