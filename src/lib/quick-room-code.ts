import { randomBytes } from "crypto";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // sem 0/o/1/l/i

/** Código de 10 caracteres (~50 bits): o link é o segredo da sala. */
export function generateRoomCode(): string {
  const bytes = randomBytes(10);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function isValidRoomCode(code: string): boolean {
  return new RegExp(`^[${ALPHABET}]{10}$`).test(code);
}

/** Normaliza o código digitado sem reduzir sua entropia ou aceitar caracteres ambíguos. */
export function normalizeRoomCodeInput(input: string): string {
  const normalized = input.toLowerCase().replace(/[\s-]+/g, "");
  return isValidRoomCode(normalized) ? normalized : "";
}

/** Agrupa o mesmo segredo existente para leitura e ditado, sem alterar seu valor. */
export function formatRoomCode(code: string): string {
  return isValidRoomCode(code) ? code.slice(0, 4) + "-" + code.slice(4, 8) + "-" + code.slice(8) : code;
}

/** Nome curto para exibir ("Sala-0427"). Derivado do código, então é estável; não é único nem secreto. */
export function roomLabel(code: string): string {
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `Sala-${String(h % 10000).padStart(4, "0")}`;
}
