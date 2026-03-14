interface RateLimitEntry {
  count: number
  resetAt: number
}

const MAX_ATTEMPTS = 5
const WINDOW_MS = 60_000

const store = new Map<string, RateLimitEntry>()

export function checkRateLimit(key: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
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
