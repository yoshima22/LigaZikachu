/**
 * Cache em memória por instância serverless, com TTL. Substitui unstable_cache nos
 * dados globais lidos em TODA renderização do layout: cada leitura do Data Cache da
 * Vercel conta como um evento de "External API" no Observability Plus (cobrado por
 * evento). Devolve uma cópia JSON, igual ao unstable_cache (datas viram string).
 * Mudanças de admin chegam em até `ttlMs` (a revalidateTag não alcança a memória).
 */
export function memoTtl<A extends unknown[], R>(fn: (...args: A) => Promise<R> | R, ttlMs: number) {
  const store = new Map<string, { at: number; value: Promise<R> }>();
  return (...args: A): Promise<R> => {
    const key = JSON.stringify(args);
    const hit = store.get(key);
    const now = Date.now();
    if (!hit || now - hit.at >= ttlMs) {
      const value = Promise.resolve(fn(...args)).then((v) => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as R)));
      store.set(key, { at: now, value });
      value.catch(() => {
        if (store.get(key)?.value === value) store.delete(key); // não guarda falha
      });
      return value.then((v) => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as R)));
    }
    return hit.value.then((v) => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as R)));
  };
}
