// In-memory cache with TTL
interface CacheEntry { value: unknown; expiresAt: number; }
export class MemoryCache {
  private store = new Map<string, CacheEntry>();
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { this.store.delete(key); return null; }
    return entry.value as T;
  }
  set(key: string, value: unknown, ttlMs = 60000): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
  delete(key: string): void { this.store.delete(key); }
  has(key: string): boolean { return this.get(key) !== null; }
  clear(): void { this.store.clear(); }
}
export const cache = new MemoryCache();

export async function withCache<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached !== null) return cached;
  const result = await fn();
  cache.set(key, result, ttlMs);
  return result;
}