export function isDashboardDemoEnabled(): boolean {
  return process.env.HR_DASHBOARD_DEMO_ENABLED === '1' || process.env.NODE_ENV !== 'production'
}
