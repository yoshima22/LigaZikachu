import { randomBytes } from "crypto";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // sem 0/o/1/l/i

/** Código de 10 caracteres (~50 bits): o link é o segredo da sala. */
export function generateRoomCode(): string {
  const bytes = randomBytes(10);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function isValidRoomCode(code: string): boolean {
  return /^[a-z2-9]{10}$/.test(code);
}

/** Nome curto para exibir ("Sala-0427"). Derivado do código, então é estável; não é único nem secreto. */
export function roomLabel(code: string): string {
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `Sala-${String(h % 10000).padStart(4, "0")}`;
}
