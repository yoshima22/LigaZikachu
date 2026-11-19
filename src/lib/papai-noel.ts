// Evento de Natal: Papai Noel voando pelo site. Módulo puro (sem "use server") para ser importado do layout e das actions.
import { memoTtl } from "@/lib/memo-ttl";
import { prisma } from "@/lib/prisma";

/** Janela do evento (BRT): 01/12/2026 00:00 até 26/12/2026 00:00 (depois da entrega do Amigo Oculto). */
export const SANTA_STARTS_AT = new Date("2026-12-01T03:00:00.000Z");
export const SANTA_ENDS_AT = new Date("2026-12-26T03:00:00.000Z");
export const SANTA_SETTING_KEY = "santa_event";
/** Cooldown por jogador, sorteado a cada resgate. */
export const SANTA_MIN_HOURS = 4;
export const SANTA_MAX_HOURS = 6;

export type SantaSetting = { enabled: boolean; /** admin: ignora a janela de datas (testes) */ ignoreWindow: boolean };

export type SantaPrize = { id: string; weight: number; label: string; emoji: string } & (
  | { kind: "ZC"; amount: number }
  | { kind: "FOOD"; food: "FOOD" | "SWEET" | "RARE_SWEET"; amount: number }
);

/** Tabela de prêmios (presentes bobinhos). Soma dos pesos = 100. */
export const SANTA_PRIZES: SantaPrize[] = [
  { id: "zc10", kind: "ZC", amount: 10, weight: 30, label: "10 ZikaCoins", emoji: "🪙" },
  { id: "zc25", kind: "ZC", amount: 25, weight: 15, label: "25 ZikaCoins", emoji: "💰" },
  { id: "zc50", kind: "ZC", amount: 50, weight: 5, label: "50 ZikaCoins", emoji: "🤑" },
  { id: "food2", kind: "FOOD", food: "FOOD", amount: 2, weight: 25, label: "2 Comidas de mascote", emoji: "🍖" },
  { id: "sweet1", kind: "FOOD", food: "SWEET", amount: 1, weight: 20, label: "1 Doce de mascote", emoji: "🍬" },
  { id: "sweet3", kind: "FOOD", food: "SWEET", amount: 3, weight: 4, label: "3 Doces de mascote", emoji: "🍭" },
  { id: "rare1", kind: "FOOD", food: "RARE_SWEET", amount: 1, weight: 1, label: "1 Doce Raro", emoji: "🎄" },
];

export function rollSantaPrize(rand = Math.random()): SantaPrize {
  const total = SANTA_PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = rand * total;
  for (const p of SANTA_PRIZES) { r -= p.weight; if (r < 0) return p; }
  return SANTA_PRIZES[0];
}

export function nextSantaAt(from = new Date(), rand = Math.random()): Date {
  const hours = SANTA_MIN_HOURS + rand * (SANTA_MAX_HOURS - SANTA_MIN_HOURS);
  return new Date(from.getTime() + Math.round(hours * 3_600_000));
}

/** Setting do admin (cache 30 s por instância: no layout só custa uma ida ao banco a cada 30 s). Sem registro = ligado. */
/** Leitura direta (painel admin, sem cache). */
export async function getSantaSettingFresh(): Promise<SantaSetting> {
  const row = await prisma.appSetting.findUnique({ where: { key: SANTA_SETTING_KEY }, select: { value: true } });
  const v = (row?.value ?? {}) as Partial<SantaSetting>;
  return { enabled: v.enabled !== false, ignoreWindow: v.ignoreWindow === true };
}
const readSetting = memoTtl(getSantaSettingFresh, 30000);

export async function getSantaSetting(): Promise<SantaSetting> {
  return readSetting().catch(() => ({ enabled: false, ignoreWindow: false }));
}

export function isInSantaWindow(now = new Date()) {
  return now >= SANTA_STARTS_AT && now < SANTA_ENDS_AT;
}

export async function isSantaActive(): Promise<boolean> {
  // Fora da janela e sem override: nem toca no banco.
  const inWindow = isInSantaWindow();
  const s = await getSantaSetting();
  return s.enabled && (inWindow || s.ignoreWindow);
}
