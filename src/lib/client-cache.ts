/**
 * Cache de curta duração no localStorage do navegador.
 * Usado para evitar re-buscar dados estáveis (como lista de mascotes do banco)
 * a cada navegação de página, enquanto o servidor ainda é a fonte de verdade.
 *
 * Uso típico:
 *   const cached = clientCache.get<MyData>("my-key");
 *   if (cached) return cached;
 *   const fresh = await fetchData();
 *   clientCache.set("my-key", fresh, 60); // TTL: 60 segundos
 */

const PREFIX = "lz_cache_";

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

function safeStorage(): Storage | null {
  try { return typeof window !== "undefined" ? window.localStorage : null; }
  catch { return null; }
}

export const clientCache = {
  get<T>(key: string): T | null {
    const storage = safeStorage();
    if (!storage) return null;
    try {
      const raw = storage.getItem(PREFIX + key);
      if (!raw) return null;
      const entry: CacheEntry<T> = JSON.parse(raw);
      if (Date.now() > entry.expiresAt) {
        storage.removeItem(PREFIX + key);
        return null;
      }
      return entry.data;
    } catch {
      return null;
    }
  },

  set<T>(key: string, data: T, ttlSeconds = 60): void {
    const storage = safeStorage();
    if (!storage) return;
    try {
      const entry: CacheEntry<T> = { data, expiresAt: Date.now() + ttlSeconds * 1000 };
      storage.setItem(PREFIX + key, JSON.stringify(entry));
    } catch {
      // localStorage pode estar cheio — ignora silenciosamente
    }
  },

  remove(key: string): void {
    const storage = safeStorage();
    storage?.removeItem(PREFIX + key);
  },

  /** Limpa todas as entradas do prefixo lz_cache_ */
  purge(): void {
    const storage = safeStorage();
    if (!storage) return;
    const toDelete: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k?.startsWith(PREFIX)) toDelete.push(k);
    }
    toDelete.forEach(k => storage.removeItem(k));
  },
};
