// Limite de tentativas por chave (IP, e-mail...) em janela fixa, em memória da instância.
// ponytail: o contador é por instância serverless (um atacante que cai em várias instâncias ganha mais tentativas);
// se precisar de limite global, trocar o Map por Upstash/Redis mantendo esta assinatura.
const hits = new Map<string, { count: number; resetAt: number }>();

/** Retorna true se a tentativa pode seguir; false se estourou `max` dentro de `windowMs`. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= max;
}

/** IP do cliente a partir dos headers do proxy (Vercel preenche x-forwarded-for). */
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
