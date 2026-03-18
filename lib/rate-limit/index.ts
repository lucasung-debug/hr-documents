interface RateLimitEntry {
  count: number
  resetAt: number
}

const MAX_ATTEMPTS = 5
const WINDOW_MS = 60_000
const CLEANUP_INTERVAL = 50 // run cleanup every N checks

const store = new Map<string, RateLimitEntry>()
let checkCount = 0

function cleanupExpired(): void {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) store.delete(key)
  }
}

export function checkRateLimit(key: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()

  // Lazy cleanup of expired entries to prevent unbounded memory growth
  if (++checkCount >= CLEANUP_INTERVAL) {
    checkCount = 0
    cleanupExpired()
  }

  const entry = store.get(key)

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, retryAfterMs: 0 }
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterMs: entry.resetAt - now }
  }

  entry.count += 1
  return { allowed: true, retryAfterMs: 0 }
}

export function resetRateLimit(key: string): void {
  store.delete(key)
}
