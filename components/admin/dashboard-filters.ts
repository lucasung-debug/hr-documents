import type { DashboardEmployee } from '@/types/admin'

export type DashboardFilter = 'all' | 'action_required' | 'archive_pending' | 'sync_failed' | 'completed'

export interface DashboardFilterOptions {
  filter: DashboardFilter
  search: string
}

export function isArchivePending(employee: DashboardEmployee): boolean {
  return employee.case_status === 'docs_completed' && employee.pdf_packet_status === 'generated' && !employee.drive_archived_at
}

export function isDashboardEmployeeCompleted(employee: DashboardEmployee): boolean {
  return employee.case_status === 'archived' || Boolean(employee.all_completed_at) || Boolean(employee.email_sent_at)
}

export function isReminderEligible(employee: DashboardEmployee): boolean {
  return !isDashboardEmployeeCompleted(employee)
}

export function filterDashboardEmployees(
  employees: DashboardEmployee[],
  { filter, search }: DashboardFilterOptions
): DashboardEmployee[] {
  const query = search.trim().toLowerCase()

  return employees.filter(employee => {
    if (filter === 'action_required' && employee.case_status !== 'action_required') return false
    if (filter === 'archive_pending' && !isArchivePending(employee)) return false
    if (filter === 'sync_failed' && employee.workspace_sync_status !== 'failed') return false
    if (filter === 'completed' && !isDashboardEmployeeCompleted(employee)) return false

    if (!query) return true

    return [employee.name, employee.department, employee.case_id]
      .some(value => value.toLowerCase().includes(query))
  })
}
