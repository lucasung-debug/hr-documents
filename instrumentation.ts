// Next.js instrumentation hook — runs once when the server process starts.
// Used to register the session cleanup scheduler.
// Requires: experimental.instrumentationHook: true in next.config.ts

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startScheduler } = await import('./lib/storage/scheduler')
    startScheduler()
  }
}
