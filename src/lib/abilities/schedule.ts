// Agendamento: a partir de 23/11/2026 00:00 (BRT) as habilidades valem em toda a Arena Z
// e a Sala de Treinamento com Habilidades deixa de existir (vira treino comum).
export const ARENA_Z_ABILITIES_LIVE_AT = new Date("2026-11-23T03:00:00.000Z");

export const arenaZAbilitiesLive = (now: Date = new Date()) => now.getTime() >= ARENA_Z_ABILITIES_LIVE_AT.getTime();
