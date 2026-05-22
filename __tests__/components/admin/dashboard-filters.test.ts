import {
  filterDashboardEmployees,
  isReminderEligible,
} from '@/components/admin/dashboard-filters'
import { demoDashboardResponse } from '@/lib/onboarding/demo-fixtures'
import type { DashboardEmployee } from '@/types/admin'
import { DOC_STATUS } from '@/types/document'

const baseEmployee: DashboardEmployee = {
  employee_id: 'EMP001',
  name: '김민준',
  department: '인사팀',
  hire_date: '2026-06-01',
  session_status: 'IN_PROGRESS',
  documents: {
    labor_contract: DOC_STATUS.SIGNED,
    personal_info_consent: DOC_STATUS.SIGNED,
    holiday_extension: DOC_STATUS.SIGNED,
    data_security_pledge: DOC_STATUS.SIGNED,
    compliance: DOC_STATUS.SIGNED,
    overtime_work: DOC_STATUS.SIGNED,
  },
  completed_count: 6,
  all_completed_at: '',
  email_sent_at: '',
  case_id: 'ONB-2026-001',
  case_status: 'collecting_documents',
  pdf_packet_status: 'pending',
  workspace_sync_status: 'pending',
  notification_status: 'none',
  action_required: 'none',
  blocked_reason: '',
  drive_archived_at: '',
  slack_notified_at: '',
  case_schema_version: 2,
}

const employees: DashboardEmployee[] = [
  { ...baseEmployee, employee_id: 'EMP001', case_id: 'ONB-2026-001', name: '김민준' },
  {
    ...baseEmployee,
    employee_id: 'EMP002',
    case_id: 'ONB-2026-002',
    name: '이서연',
    department: '재무팀',
    case_status: 'action_required',
    action_required: 'hr_review',
    blocked_reason: '인사 검토 필요',
  },
  {
    ...baseEmployee,
    employee_id: 'EMP003',
    case_id: 'ONB-2026-003',
    name: '박도윤',
    department: '플랫폼팀',
    case_status: 'failed',
    workspace_sync_status: 'failed',
    action_required: 'drive_sync_failed',
  },
  {
    ...baseEmployee,
    employee_id: 'EMP004',
    case_id: 'ONB-2026-004',
    name: '최하린',
    department: '마케팅팀',
    case_status: 'docs_completed',
    pdf_packet_status: 'generated',
    workspace_sync_status: 'synced',
    action_required: 'none',
    drive_archived_at: '',
  },
  {
    ...baseEmployee,
    employee_id: 'EMP005',
    case_id: 'ONB-2026-005',
    name: '정지후',
    department: '영업팀',
    case_status: 'archived',
    drive_archived_at: '2026-05-20T09:00:00+09:00',
  },
  {
    ...baseEmployee,
    employee_id: 'EMP006',
    case_id: 'ONB-2026-006',
    name: '한유진',
    department: '법무팀',
    case_status: 'docs_completed',
    all_completed_at: '2026-05-19T09:00:00+09:00',
    pdf_packet_status: 'generated',
    drive_archived_at: '',
  },
  {
    ...baseEmployee,
    employee_id: 'EMP007',
    case_id: 'ONB-2026-007',
    name: '오지민',
    department: '운영팀',
    case_status: 'collecting_documents',
    email_sent_at: '2026-05-18T09:00:00+09:00',
  },
]

describe('filterDashboardEmployees', () => {
  it('filters action required cases', () => {
    expect(filterDashboardEmployees(employees, { filter: 'action_required', search: '' }).map(e => e.case_id)).toEqual([
      'ONB-2026-002',
    ])
  })

  it('filters archive pending cases', () => {
    expect(filterDashboardEmployees(employees, { filter: 'archive_pending', search: '' }).map(e => e.case_id)).toEqual([
      'ONB-2026-004',
      'ONB-2026-006',
    ])
  })

  it('filters sync failed cases', () => {
    expect(filterDashboardEmployees(employees, { filter: 'sync_failed', search: '' }).map(e => e.case_id)).toEqual([
      'ONB-2026-003',
    ])
  })

  it('searches by case id, name, or department', () => {
    expect(filterDashboardEmployees(employees, { filter: 'all', search: 'ONB-2026-003' })).toHaveLength(1)
    expect(filterDashboardEmployees(employees, { filter: 'all', search: '서연' })).toHaveLength(1)
    expect(filterDashboardEmployees(employees, { filter: 'all', search: '마케팅' })).toHaveLength(1)
  })

  it('includes archived and legacy-completed employees in the completed filter', () => {
    expect(filterDashboardEmployees(employees, { filter: 'completed', search: '' }).map(e => e.case_id)).toEqual([
      'ONB-2026-005',
      'ONB-2026-006',
      'ONB-2026-007',
    ])
  })

  it('excludes archived and legacy-completed employees from reminder eligibility', () => {
    expect(employees.filter(isReminderEligible).map(e => e.case_id)).toEqual([
      'ONB-2026-001',
      'ONB-2026-002',
      'ONB-2026-003',
      'ONB-2026-004',
    ])
  })

  it('keeps demo completed stats aligned with the completed filter', () => {
    expect(demoDashboardResponse.stats.completed).toBe(
      filterDashboardEmployees(demoDashboardResponse.employees, { filter: 'completed', search: '' }).length
    )
  })
})
