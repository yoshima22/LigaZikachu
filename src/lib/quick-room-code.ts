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
