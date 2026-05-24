export const DEMO_QUERY_VALUE = '1'
export const DEMO_SESSION_STORAGE_KEY = 'hr-onboarding-demo-session'

export function isDemoModeAvailable(): boolean {
  return process.env.NODE_ENV !== 'production'
}

export function isDashboardDemoEnabled(): boolean {
  return process.env.HR_DASHBOARD_DEMO_ENABLED === '1' || process.env.NODE_ENV !== 'production'
}

export function isDemoSearchParamEnabled(searchParams: URLSearchParams): boolean {
  return isDemoModeAvailable() && searchParams.get('demo') === DEMO_QUERY_VALUE
}

export function enableClientDemoSession(): void {
  if (typeof window === 'undefined' || !isDemoModeAvailable()) return
  window.localStorage.setItem(DEMO_SESSION_STORAGE_KEY, DEMO_QUERY_VALUE)
}

export function clearClientDemoSession(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(DEMO_SESSION_STORAGE_KEY)
}

export function isClientDemoSession(): boolean {
  if (typeof window === 'undefined' || !isDemoModeAvailable()) return false
  return window.localStorage.getItem(DEMO_SESSION_STORAGE_KEY) === DEMO_QUERY_VALUE
}
