interface CacheEntry<T> {
  data: T
  expiresAt: number
}

/**
 * Simple in-memory TTL cache for reducing repeated Google Sheets API calls.
 * Each entry expires after its configured TTL.
 */
class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>()

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    return entry.data as T
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs })
  }

  invalidate(pattern: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(pattern)) {
        this.store.delete(key)
      }
    }
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }
}

export const cache = new MemoryCache()

// Cache TTL constants
export const CACHE_TTL = {
  /** Employee lookup — rarely changes during a session */
  EMPLOYEE: 5 * 60 * 1000, // 5 minutes
  /** Contract conditions — almost never changes */
  CONTRACT: 10 * 60 * 1000, // 10 minutes
} as const
