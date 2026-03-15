import { listAllSessionIds, getSessionDirMtime, deleteSessionDir } from './temp-files'
import { createLogger } from '@/lib/logger'

const log = createLogger('[scheduler]')

const SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const SCAN_INTERVAL_MS = 5 * 60 * 1000    // scan every 5 minutes

let schedulerStarted = false

export function cleanupExpiredSessions(): number {
  const sessionIds = listAllSessionIds()
  let deletedCount = 0
  const now = Date.now()

  for (const sessionId of sessionIds) {
    const mtime = getSessionDirMtime(sessionId)
    if (mtime && now - mtime.getTime() > SESSION_TIMEOUT_MS) {
      try {
        deleteSessionDir(sessionId)
        deletedCount++
      } catch {
        log.error(`Failed to delete session dir: ${sessionId.slice(0, 8)}...`)
      }
    }
  }

  return deletedCount
}

export function startScheduler(): void {
  if (schedulerStarted) return
  schedulerStarted = true

  setInterval(() => {
    const deleted = cleanupExpiredSessions()
    if (deleted > 0) {
      log.info(`Cleaned up ${deleted} expired session(s)`)
    }
  }, SCAN_INTERVAL_MS)

  log.info('Session cleanup scheduler started (interval: 5min, timeout: 30min)')
}
